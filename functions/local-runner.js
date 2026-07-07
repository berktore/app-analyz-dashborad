const path = require("path");
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(
  __dirname,
  "..",
  "service-account.json"
);

const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { BetaAnalyticsDataClient } = require("@google-analytics/data");

initializeApp();
const db = getDatabase();
const analytics = new BetaAnalyticsDataClient();

const GA_PROPERTY_ID = "properties/"; // ← DOLDURULACAK

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
  const val = response.rows?.[0]?.metricValues?.[0]?.value;
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

async function main() {
  const propertyId = GA_PROPERTY_ID;
  if (!propertyId || propertyId === "properties/") {
    console.log("GA_PROPERTY_ID eksik. Önce Firebase Console'a girip");
    console.log("Analytics → Admin → Property Settings'den property ID'yi al.");
    console.log("Şu format: properties/123456789");
    console.log("\nDevam etmek için yukarıdaki sabiti düzenle.");
    return;
  }

  console.log("GA4'den veri çekiliyor...");
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

  console.log("\n=== ANALYTICS RAPORU ===");
  console.log(`Tarih: ${yesterday}`);
  console.log(`DAU (Günlük Aktif): ${dau.toLocaleString()}`);
  console.log(`WAU (Haftalık Aktif): ${wau.toLocaleString()}`);
  console.log(`MAU (Aylık Aktif): ${mau.toLocaleString()}`);
  console.log(`Oturum: ${sessions.toLocaleString()}`);
  console.log(`Ort. Oturum Süresi: ${(avgSessionDur / 60).toFixed(1)} dk`);
  console.log(`Ekran Görüntüleme: ${screenViews.toLocaleString()}`);
  console.log(`Yeni Kullanıcı: ${newUsers.toLocaleString()}`);
  console.log("\nPlatform bazlı DAU:", JSON.stringify(dauByPlat));
  console.log("Platform bazlı Oturum:", JSON.stringify(sessionByPlat));

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
  console.log("\n✓ RTDB'ye yazıldı!");
}

main().catch((e) => {
  console.error("Hata:", e.message);
  process.exit(1);
});
