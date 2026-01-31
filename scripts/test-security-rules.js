/**
 * Security Rules Test Script
 *
 * Tests the Firestore security rules with different user roles.
 * Run this while the Firebase emulators are running.
 *
 * Usage: node scripts/test-security-rules.js
 */

const admin = require('firebase-admin');
const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  connectFirestoreEmulator,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} = require('firebase/firestore');
const {
  getAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} = require('firebase/auth');

// Initialize Firebase Admin for emulator (bypass security rules for setup)
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

admin.initializeApp({
  projectId: 'mynewpokerapp'
});

const adminDb = admin.firestore();
const adminAuth = admin.auth();

// Firebase client config (for testing with security rules)
const firebaseConfig = {
  apiKey: "demo-key",
  projectId: "mynewpokerapp",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Connect to emulators
connectFirestoreEmulator(db, '127.0.0.1', 8080);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

// Test users
const testUsers = {
  admin: { email: 'admin@test.com', password: 'password123', role: 'admin' },
  super: { email: 'super@test.com', password: 'password123', role: 'super' },
  regular: { email: 'regular@test.com', password: 'password123', role: 'regular' },
};

// Helper to create test user using Admin SDK (bypasses security rules)
async function createTestUserWithAdmin(userData) {
  try {
    // Create user in Auth
    const userRecord = await adminAuth.createUser({
      email: userData.email,
      password: userData.password,
    });
    const uid = userRecord.uid;

    // Set custom claims directly
    await adminAuth.setCustomUserClaims(uid, { role: userData.role });

    // Create user document in Firestore using Admin SDK
    await adminDb.collection('users').doc(uid).set({
      authUid: uid,
      name: userData.role + ' User',
      email: userData.email,
      role: userData.role,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✅ Created ${userData.role} user: ${uid} with claims`);
    return uid;
  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      // User already exists, get their UID and ensure claims are set
      const existingUser = await adminAuth.getUserByEmail(userData.email);
      const uid = existingUser.uid;

      // Always ensure custom claims are set correctly
      await adminAuth.setCustomUserClaims(uid, { role: userData.role });

      // Update user document to ensure role is correct
      await adminDb.collection('users').doc(uid).set({
        authUid: uid,
        name: userData.role + ' User',
        email: userData.email,
        role: userData.role,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      console.log(`ℹ️  ${userData.role} user already exists: ${uid} (claims updated)`);
      return uid;
    }
    throw error;
  }
}

// Helper to run a test and catch permission errors
async function testPermission(description, shouldSucceed, testFn) {
  try {
    await testFn();
    if (shouldSucceed) {
      console.log(`✅ ${description}`);
      return true;
    } else {
      console.log(`❌ ${description} (SHOULD HAVE BEEN BLOCKED)`);
      return false;
    }
  } catch (error) {
    if (error.code === 'permission-denied') {
      if (!shouldSucceed) {
        console.log(`🚫 ${description} (correctly blocked)`);
        return true;
      } else {
        console.log(`❌ ${description} (UNEXPECTEDLY BLOCKED)`);
        return false;
      }
    }
    console.log(`❓ ${description} - Error: ${error.message}`);
    return null;
  }
}

// Helper to sign in and refresh token to get new claims
async function signInAndRefresh(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  // Force token refresh to get the latest custom claims
  await userCredential.user.getIdToken(true);
  return userCredential;
}

// Main test function
async function runTests() {
  console.log('\n=== Firebase Security Rules Test ===\n');

  let passed = 0;
  let failed = 0;

  // Create test users using Admin SDK (bypasses rules)
  console.log('--- Creating Test Users (Admin SDK) ---');
  const adminUid = await createTestUserWithAdmin(testUsers.admin);
  const superUid = await createTestUserWithAdmin(testUsers.super);
  const regularUid = await createTestUserWithAdmin(testUsers.regular);

  // Also create a test group using Admin SDK for later tests
  await adminDb.collection('groups').doc('super-group').set({
    name: 'Super Group',
    createdBy: superUid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`✅ Created test group: super-group`);

  // Create test game using Admin SDK
  await adminDb.collection('games').doc('super-game').set({
    groupId: 'super-group',
    status: 'active',
    createdBy: superUid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`✅ Created test game: super-game`);

  console.log('\n');

  // ============================================
  // Test 1: UNAUTHENTICATED User (Guest)
  // ============================================
  console.log('--- Testing UNAUTHENTICATED User (Guest) ---');
  await auth.signOut();

  if (await testPermission('Guest READ users', false, async () => {
    await getDocs(collection(db, 'users'));
  })) passed++; else failed++;

  if (await testPermission('Guest READ games', false, async () => {
    await getDocs(collection(db, 'games'));
  })) passed++; else failed++;

  if (await testPermission('Guest CREATE user', false, async () => {
    await setDoc(doc(db, 'users', 'guest-user'), {
      name: 'Guest User'
    });
  })) passed++; else failed++;

  // ============================================
  // Test 2: Regular User Permissions
  // ============================================
  console.log('\n--- Testing REGULAR User Permissions ---');
  await signInAndRefresh(testUsers.regular.email, testUsers.regular.password);

  if (await testPermission('Regular user READ users', true, async () => {
    await getDocs(collection(db, 'users'));
  })) passed++; else failed++;

  if (await testPermission('Regular user READ games', true, async () => {
    await getDocs(collection(db, 'games'));
  })) passed++; else failed++;

  if (await testPermission('Regular user CREATE user', false, async () => {
    await setDoc(doc(db, 'users', 'test-user'), {
      name: 'Test',
      email: 'test@test.com',
      role: 'regular',
      authUid: 'test-uid'
    });
  })) passed++; else failed++;

  if (await testPermission('Regular user CREATE game', false, async () => {
    await setDoc(doc(db, 'games', 'test-game'), {
      groupId: 'test-group',
      status: 'active',
      createdBy: regularUid
    });
  })) passed++; else failed++;

  if (await testPermission('Regular user CREATE group', false, async () => {
    await setDoc(doc(db, 'groups', 'test-group'), {
      name: 'Test Group',
      createdBy: regularUid
    });
  })) passed++; else failed++;

  if (await testPermission('Regular user UPDATE game', false, async () => {
    await updateDoc(doc(db, 'games', 'super-game'), {
      status: 'ended'
    });
  })) passed++; else failed++;

  // ============================================
  // Test 3: Super User Permissions
  // ============================================
  console.log('\n--- Testing SUPER User Permissions ---');
  await signInAndRefresh(testUsers.super.email, testUsers.super.password);

  if (await testPermission('Super user READ users', true, async () => {
    await getDocs(collection(db, 'users'));
  })) passed++; else failed++;

  if (await testPermission('Super user CREATE group (own)', true, async () => {
    await setDoc(doc(db, 'groups', 'super-new-group'), {
      name: 'Super New Group',
      createdBy: superUid
    });
  })) passed++; else failed++;

  if (await testPermission('Super user UPDATE own group', true, async () => {
    await updateDoc(doc(db, 'groups', 'super-group'), {
      name: 'Updated Super Group'
    });
  })) passed++; else failed++;

  if (await testPermission('Super user CREATE game (own)', true, async () => {
    await setDoc(doc(db, 'games', 'super-new-game'), {
      groupId: 'super-group',
      status: 'active',
      createdBy: superUid
    });
  })) passed++; else failed++;

  if (await testPermission('Super user UPDATE own game', true, async () => {
    await updateDoc(doc(db, 'games', 'super-game'), {
      status: 'ended'
    });
  })) passed++; else failed++;

  if (await testPermission('Super user CREATE user', false, async () => {
    await setDoc(doc(db, 'users', 'new-user'), {
      name: 'New User',
      email: 'new@test.com',
      role: 'regular',
      authUid: 'new-uid'
    });
  })) passed++; else failed++;

  if (await testPermission('Super user CREATE payment unit', false, async () => {
    await setDoc(doc(db, 'paymentUnits', 'test-unit'), {
      name: 'Test Unit',
      members: [superUid]
    });
  })) passed++; else failed++;

  // ============================================
  // Test 4: Admin User Permissions
  // ============================================
  console.log('\n--- Testing ADMIN User Permissions ---');
  await signInAndRefresh(testUsers.admin.email, testUsers.admin.password);

  if (await testPermission('Admin CREATE user', true, async () => {
    await setDoc(doc(db, 'users', 'admin-created-user'), {
      name: 'Admin Created User',
      email: 'created@test.com',
      role: 'regular',
      authUid: 'created-uid'
    });
  })) passed++; else failed++;

  if (await testPermission('Admin UPDATE any user', true, async () => {
    await updateDoc(doc(db, 'users', superUid), {
      name: 'Updated by Admin'
    });
  })) passed++; else failed++;

  if (await testPermission('Admin CREATE payment unit', true, async () => {
    await setDoc(doc(db, 'paymentUnits', 'admin-unit'), {
      name: 'Admin Payment Unit',
      members: [adminUid, superUid]
    });
  })) passed++; else failed++;

  if (await testPermission('Admin UPDATE any group', true, async () => {
    await updateDoc(doc(db, 'groups', 'super-group'), {
      name: 'Updated by Admin Again'
    });
  })) passed++; else failed++;

  if (await testPermission('Admin DELETE any game', true, async () => {
    await deleteDoc(doc(db, 'games', 'super-game'));
  })) passed++; else failed++;

  if (await testPermission('Admin DELETE user', true, async () => {
    await deleteDoc(doc(db, 'users', 'admin-created-user'));
  })) passed++; else failed++;

  // ============================================
  // Summary
  // ============================================
  console.log('\n=== Security Rules Test Complete ===');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);

  if (failed === 0) {
    console.log('\n🎉 All security rules are working correctly!');
  } else {
    console.log('\n⚠️ Some security rules need attention.');
  }
}

// Run tests
runTests()
  .then(() => {
    console.log('\nTests completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
