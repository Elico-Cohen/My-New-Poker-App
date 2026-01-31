/**
 * Script to set mustChangePassword flag for users
 *
 * This script sets mustChangePassword: true for all users who:
 * - Have an authUid (can log in)
 * - Are not admins (admins don't need to change default password)
 *
 * Usage: node scripts/set-must-change-password.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Path to service account key
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'service-account-key.json');

// Initialize Firebase Admin
try {
  const serviceAccount = require(SERVICE_ACCOUNT_PATH);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase Admin:', error.message);
  console.log('\nMake sure you have the service account key file at:', SERVICE_ACCOUNT_PATH);
  process.exit(1);
}

const db = admin.firestore();

async function setMustChangePasswordForUsers() {
  console.log('\n=== Setting mustChangePassword for users ===\n');

  try {
    // Get all users from Firestore
    const usersSnapshot = await db.collection('users').get();

    console.log(`Found ${usersSnapshot.size} users in database\n`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const userId = doc.id;
      const authUid = userData.authUid;
      const role = userData.role || 'regular';
      const name = userData.name || 'Unknown';

      // Skip users without authUid (they can't log in anyway)
      if (!authUid) {
        console.log(`SKIP: ${name} - No login account`);
        skippedCount++;
        continue;
      }

      // Skip admins - they set the passwords so they don't need to change
      if (role === 'admin') {
        console.log(`SKIP: ${name} - Admin user`);
        skippedCount++;
        continue;
      }

      // Skip if already has mustChangePassword set to false (already changed)
      if (userData.mustChangePassword === false) {
        console.log(`SKIP: ${name} - Already changed password`);
        skippedCount++;
        continue;
      }

      try {
        // Set mustChangePassword: true
        await doc.ref.update({
          mustChangePassword: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`OK: ${name} - Set mustChangePassword: true`);
        updatedCount++;
      } catch (error) {
        console.error(`ERROR: ${name} - ${error.message}`);
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log(`Total: ${usersSnapshot.size}`);

    if (updatedCount > 0) {
      console.log('\n✅ Done! These users will be asked to change their password on next login.');
    }

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
setMustChangePasswordForUsers()
  .then(() => {
    console.log('\nScript completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
