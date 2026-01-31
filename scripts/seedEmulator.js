/**
 * Firebase Emulator Seed Data Script
 *
 * Creates test users and games for safe testing without touching production data.
 * Run with: node scripts/seedEmulator.js
 *
 * SAFETY: This script ONLY works with Firebase Emulator (localhost)
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK pointing to EMULATOR
const app = admin.initializeApp({
  projectId: 'mynewpokerapp'
});

// Connect to Firestore Emulator
const db = admin.firestore();
db.settings({
  host: 'localhost:8080',
  ssl: false
});

// Test user fixtures
const testUsers = [
  {
    id: 'user-admin-001',
    authUid: 'test-admin-001',
    name: 'מנהל בדיקה',
    phone: '+972501111111',
    role: 'admin',
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'user-super-001',
    authUid: 'test-super-001',
    name: 'משתמש על 1',
    phone: '+972502222222',
    role: 'super',
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'user-super-002',
    authUid: 'test-super-002',
    name: 'משתמש על 2',
    phone: '+972503333333',
    role: 'super',
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'user-super-003',
    authUid: 'test-super-003',
    name: 'משתמש על 3 (לא פעיל)',
    phone: '+972504444444',
    role: 'super',
    isActive: false, // Inactive user - should NOT appear in handoff eligible list
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'user-regular-001',
    authUid: 'test-regular-001',
    name: 'משתמש רגיל',
    phone: '+972505555555',
    role: 'regular',
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'user-guest-001',
    authUid: 'test-guest-001',
    name: 'אורח',
    phone: '+972506666666',
    role: 'guest',
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
];

// Test game fixtures
const testGames = [
  {
    id: 'game-active-001',
    name: 'משחק בדיקה פעיל',
    createdBy: 'test-super-001', // Owned by super user 1
    originalCreatedBy: 'test-super-001',
    status: 'active',
    players: [
      {
        id: 'player-001',
        userId: 'user-super-001',
        userName: 'משתמש על 1',
        buyIn: 100,
        rebuys: [],
        isActive: true
      },
      {
        id: 'player-002',
        userId: 'user-regular-001',
        userName: 'משתמש רגיל',
        buyIn: 100,
        rebuys: [],
        isActive: true
      }
    ],
    settings: {
      buyInAmount: 100,
      smallBlind: 5,
      bigBlind: 10
    },
    handoffLog: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'game-completed-001',
    name: 'משחק בדיקה מסויים',
    createdBy: 'test-super-001',
    originalCreatedBy: 'test-super-001',
    status: 'completed',
    players: [
      {
        id: 'player-003',
        userId: 'user-super-001',
        userName: 'משתמש על 1',
        buyIn: 100,
        rebuys: [],
        isActive: false,
        finalStack: 150
      }
    ],
    settings: {
      buyInAmount: 100,
      smallBlind: 5,
      bigBlind: 10
    },
    handoffLog: [],
    createdAt: Date.now() - 86400000, // 1 day ago
    updatedAt: Date.now() - 3600000,  // 1 hour ago
    completedAt: Date.now() - 3600000
  },
  {
    id: 'game-with-handoff-001',
    name: 'משחק עם העברת שליטה',
    createdBy: 'test-admin-001', // Currently owned by admin
    originalCreatedBy: 'test-super-001', // Originally created by super user 1
    status: 'active',
    players: [
      {
        id: 'player-004',
        userId: 'user-super-001',
        userName: 'משתמש על 1',
        buyIn: 100,
        rebuys: [],
        isActive: true
      },
      {
        id: 'player-005',
        userId: 'user-admin-001',
        userName: 'מנהל בדיקה',
        buyIn: 100,
        rebuys: [],
        isActive: true
      }
    ],
    settings: {
      buyInAmount: 100,
      smallBlind: 5,
      bigBlind: 10
    },
    handoffLog: [
      {
        id: 'handoff-001',
        fromUserId: 'user-super-001',
        fromUserName: 'משתמש על 1',
        fromAuthUid: 'test-super-001',
        toUserId: 'user-admin-001',
        toUserName: 'מנהל בדיקה',
        toAuthUid: 'test-admin-001',
        timestamp: Date.now() - 1800000, // 30 minutes ago
        reason: 'בדיקת מערכת העברת שליטה',
        initiatedBy: 'test-super-001' // Owner-initiated
      }
    ],
    createdAt: Date.now() - 7200000, // 2 hours ago
    updatedAt: Date.now() - 1800000
  }
];

async function seedEmulator() {
  console.log('🌱 Starting Firebase Emulator seed process...\n');
  console.log('✅ Connecting to emulator at localhost:8080');
  console.log('   ⚠️ This script only works with the emulator - production is safe\n');

  try {

    // Seed users
    console.log('\n👥 Seeding test users...');
    for (const user of testUsers) {
      await db.collection('users').doc(user.id).set(user);
      console.log(`   ✓ Created user: ${user.name} (${user.role})`);
    }

    // Seed games
    console.log('\n🎮 Seeding test games...');
    for (const game of testGames) {
      await db.collection('games').doc(game.id).set(game);
      console.log(`   ✓ Created game: ${game.name} (status: ${game.status})`);
    }

    console.log('\n✅ Seed complete!\n');
    console.log('📊 Test Data Summary:');
    console.log(`   Users: ${testUsers.length}`);
    console.log(`   Games: ${testGames.length}`);
    console.log('\n🔐 Test User Credentials (use authUid for login):');
    testUsers.forEach(u => {
      console.log(`   ${u.role.padEnd(8)} - authUid: ${u.authUid.padEnd(20)} - ${u.name}`);
    });
    console.log('\n🎯 Ready for testing!');
    console.log('   Emulator UI: http://localhost:4000');
    console.log('   Firestore: http://localhost:4000/firestore');
    console.log('   Auth: http://localhost:4000/auth\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Seed failed:', error.message);
    process.exit(1);
  }
}

// Run seed
seedEmulator();
