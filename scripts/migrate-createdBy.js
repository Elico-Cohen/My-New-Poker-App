/**
 * Migration Script: Add createdBy field to existing games and groups
 *
 * This script assumes the admin created all existing games and groups.
 * Run this BEFORE deploying the new Firestore security rules.
 *
 * Usage:
 *   node scripts/migrate-createdBy.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// You'll need to download your service account key from Firebase Console
// and save it as service-account-key.json in the project root
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * Find the admin user ID
 */
async function findAdminUserId() {
  console.log('Looking for admin user...');

  const usersSnapshot = await db.collection('users')
    .where('role', '==', 'admin')
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    throw new Error('No admin user found! Please create an admin user first.');
  }

  const adminUser = usersSnapshot.docs[0];
  console.log(`✓ Found admin user: ${adminUser.data().name} (${adminUser.id})`);

  return adminUser.id;
}

/**
 * Migrate games collection
 */
async function migrateGames(adminUserId) {
  console.log('\n=================================');
  console.log('Migrating Games Collection');
  console.log('=================================\n');

  const gamesSnapshot = await db.collection('games').get();
  console.log(`Found ${gamesSnapshot.size} games to check\n`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const doc of gamesSnapshot.docs) {
    const game = doc.data();

    if (!game.createdBy) {
      await doc.ref.update({
        createdBy: adminUserId,
        lastModified: Date.now()
      });
      console.log(`✓ Updated game ${doc.id} - set createdBy to admin`);
      updatedCount++;
    } else {
      console.log(`- Skipped game ${doc.id} (already has createdBy: ${game.createdBy})`);
      skippedCount++;
    }
  }

  console.log('\n--- Games Migration Summary ---');
  console.log(`Updated: ${updatedCount} games`);
  console.log(`Skipped: ${skippedCount} games`);
  console.log('-------------------------------\n');

  return { updated: updatedCount, skipped: skippedCount };
}

/**
 * Migrate groups collection
 */
async function migrateGroups(adminUserId) {
  console.log('\n=================================');
  console.log('Migrating Groups Collection');
  console.log('=================================\n');

  const groupsSnapshot = await db.collection('groups').get();
  console.log(`Found ${groupsSnapshot.size} groups to check\n`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const doc of groupsSnapshot.docs) {
    const group = doc.data();

    if (!group.createdBy) {
      await doc.ref.update({
        createdBy: adminUserId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`✓ Updated group ${doc.id} - set createdBy to admin`);
      updatedCount++;
    } else {
      console.log(`- Skipped group ${doc.id} (already has createdBy: ${group.createdBy})`);
      skippedCount++;
    }
  }

  console.log('\n--- Groups Migration Summary ---');
  console.log(`Updated: ${updatedCount} groups`);
  console.log(`Skipped: ${skippedCount} groups`);
  console.log('--------------------------------\n');

  return { updated: updatedCount, skipped: skippedCount };
}

/**
 * Main migration function
 */
async function runMigrations() {
  console.log('\n=================================');
  console.log('Firebase Migration Script');
  console.log('Adding createdBy to Games & Groups');
  console.log('=================================\n');

  try {
    // Step 1: Find admin user
    const adminUserId = await findAdminUserId();

    // Step 2: Migrate games
    const gamesResult = await migrateGames(adminUserId);

    // Step 3: Migrate groups
    const groupsResult = await migrateGroups(adminUserId);

    // Summary
    console.log('\n=================================');
    console.log('Migration Complete!');
    console.log('=================================');
    console.log(`\nGames:  ${gamesResult.updated} updated, ${gamesResult.skipped} skipped`);
    console.log(`Groups: ${groupsResult.updated} updated, ${groupsResult.skipped} skipped`);
    console.log('\nAll existing games and groups are now owned by the admin user.');
    console.log('\n✅ You can now deploy the Firestore security rules:');
    console.log('   firebase deploy --only firestore:rules\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nPlease fix the error and try again.\n');
    process.exit(1);
  }
}

// Run the migration
runMigrations();
