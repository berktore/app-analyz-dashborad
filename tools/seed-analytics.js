const path = require("path");
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(
  __dirname, "..", "service-account.json"
);

const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");

initializeApp({
  databaseURL: "https://info-superapp-default-rtdb.europe-west1.firebasedatabase.app",
});

const db = getDatabase();

async function seed() {
  const payload = {
    latest: {
      dau: 0,
      wau: 0,
      mau: 0,
      sessions: 0,
      avgSessionDuration: 0,
      screenViews: 0,
      newUsers: 0,
      lastUpdated: new Date().toISOString(),
      note: "GA4 bağlanana kadar beklemede",
    },
    daily: {},
  };

  await db.ref("analytics").set(payload);
  console.log("✓ analytics node RTDB'ye eklendi (boş şablon)");
  process.exit(0);
}

seed().catch((e) => {
  console.error("Hata:", e.message);
  process.exit(1);
});
