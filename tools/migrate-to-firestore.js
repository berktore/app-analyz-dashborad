const { initializeApp, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const fs = require('fs');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'service-account.json'));

initializeApp({
  credential: cert(serviceAccount),
  databaseURL: 'https://info-superapp-default-rtdb.europe-west1.firebasedatabase.app',
});

const db = getDatabase();

async function migrate() {
  const dataPath = path.join(__dirname, '..', 'data.json');
  const raw = fs.readFileSync(dataPath, 'utf8');
  const data = JSON.parse(raw);

  const { meta, apps } = data;

  console.log('Uploading meta...');
  await db.ref('meta').set(meta);
  console.log('  \u2713 meta set');

  console.log(`Uploading ${apps.length} apps...`);
  const updates = {};
  for (const app of apps) {
    updates[`apps/${app.id}`] = app;
  }
  await db.ref().update(updates);
  console.log(`  \u2713 All ${apps.length} apps uploaded`);

  console.log('\nDone! RTDB is ready.');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
