/**
 * One-time script to set custom claims for all existing users
 *
 * This script needs to be run ONCE after deploying the Cloud Functions
 * to set up role badges for users who were created before we had this system.
 *
 * HOW TO RUN:
 * 1. Make sure you have a service account key file (ask your developer)
 * 2. Set the path to it below in SERVICE_ACCOUNT_PATH
 * 3. Run: node scripts/set-existing-user-claims.js
 */

const admin = require('firebase-admin');
const path = require('path');

// IMPORTANT: Update this path to your service account key file
// You can download this from Firebase Console > Project Settings > Service Accounts
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
  console.log('You can download it from Firebase Console > Project Settings > Service Accounts');
  process.exit(1);
}

const db = admin.firestore();

async function setClaimsForAllUsers() {
  console.log('\n=== Starting to set custom claims for all users ===\n');

  try {
    // Get all users from Firestore
    const usersSnapshot = await db.collection('users').get();

    console.log(`Found ${usersSnapshot.size} users in database\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const userId = doc.id;
      const authUid = userData.authUid;
      const role = userData.role || 'regular';
      const name = userData.name || 'Unknown';

      // Skip users without authUid (they can't log in anyway)
      if (!authUid) {
        console.log(`SKIP: ${name} (${userId}) - No authUid`);
        skipCount++;
        continue;
      }

      try {
        // Set custom claims
        await admin.auth().setCustomUserClaims(authUid, { role: role });

        // Update user document to mark claims were set
        await doc.ref.update({
          claimsUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`OK: ${name} (${userId}) - Role set to: ${role}`);
        successCount++;
      } catch (error) {
        console.error(`ERROR: ${name} (${userId}) - ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Success: ${successCount}`);
    console.log(`Skipped: ${skipCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Total: ${usersSnapshot.size}`);

    if (successCount > 0) {
      console.log('\n✅ Custom claims set successfully!');
      console.log('Note: Users may need to log out and log back in for changes to take effect.');
    }

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
setClaimsForAllUsers()
  .then(() => {
    console.log('\nScript completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
