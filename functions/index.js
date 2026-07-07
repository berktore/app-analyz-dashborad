const functions = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { BetaAnalyticsDataClient } = require("@google-analytics/data");

initializeApp();
const db = getDatabase();
const analytics = new BetaAnalyticsDataClient();

const GA_PROPERTY_ID = "properties/"; // ← KULLANICI BURAYI DOLDURACAK

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

function prevDate(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatDate(d);
}

async function runReport(propertyId, metric, dateRanges) {
  const [response] = await analytics.runReport({
    property: propertyId,
    dateRanges,
    metrics: [{ name: metric }],
  });
  const val =
    response.rows?.[0]?.metricValues?.[0]?.value;
  return val ? parseInt(val, 10) : 0;
}

async function runReportWithPlatform(propertyId, metric, dateRanges) {
  const [response] = await analytics.runReport({
    property: propertyId,
    dateRanges,
    dimensions: [{ name: "platform" }],
    metrics: [{ name: metric }],
  });
  const result = {};
  for (const row of response.rows || []) {
    const platform = row.dimensionValues?.[0]?.value || "unknown";
    const val = row.metricValues?.[0]?.value;
    result[platform] = val ? parseInt(val, 10) : 0;
  }
  return result;
}

async function syncAnalytics() {
  const propertyId = GA_PROPERTY_ID;
  if (!propertyId || propertyId === "properties/") {
    console.warn("GA_PROPERTY_ID bulunamadı, atlanıyor.");
    return null;
  }

  const yesterday = prevDate(1);
  const last7 = prevDate(7);
  const last28 = prevDate(28);

  const dateRange1d = [{ startDate: yesterday, endDate: yesterday }];
  const dateRange7d = [{ startDate: last7, endDate: yesterday }];
  const dateRange28d = [{ startDate: last28, endDate: yesterday }];

  const [dau, sessions, screenViews, newUsers, dauByPlat, sessionByPlat] =
    await Promise.all([
      runReport(propertyId, "activeUsers", dateRange1d),
      runReport(propertyId, "sessions", dateRange1d),
      runReport(propertyId, "screenPageViews", dateRange1d),
      runReport(propertyId, "newUsers", dateRange1d),
      runReportWithPlatform(propertyId, "activeUsers", dateRange1d),
      runReportWithPlatform(propertyId, "sessions", dateRange1d),
    ]);

  const avgSessionDur = await runReport(
    propertyId,
    "averageSessionDuration",
    dateRange1d
  );

  const [wau, mau] = await Promise.all([
    runReport(propertyId, "activeUsers", dateRange7d),
    runReport(propertyId, "activeUsers", dateRange28d),
  ]);

  const payload = {
    daily: {
      [yesterday]: {
        activeUsers: dau,
        sessions,
        avgSessionDuration: avgSessionDur,
        screenViews,
        newUsers,
        wau,
        mau,
        byPlatform: {
          ios: {
            activeUsers: dauByPlat["ios"] || 0,
            sessions: sessionByPlat["ios"] || 0,
          },
          android: {
            activeUsers: dauByPlat["android"] || 0,
            sessions: sessionByPlat["android"] || 0,
          },
        },
      },
    },
    latest: {
      dau,
      wau,
      mau,
      sessions,
      avgSessionDuration: avgSessionDur,
      screenViews,
      newUsers,
      lastUpdated: new Date().toISOString(),
    },
  };

  await db.ref("analytics").update(payload);
  console.log("✓ Analytics synced:", yesterday, "DAU:", dau);
  return payload;
}

exports.syncAnalyticsDaily = functions.onSchedule(
  { schedule: "0 6 * * *", timeZone: "Europe/Istanbul" },
  async () => {
    await syncAnalytics();
  }
);

exports.syncAnalyticsNow = functions.https.onCall(async () => {
  return await syncAnalytics();
});
