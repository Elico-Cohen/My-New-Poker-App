// src/config/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAII9gGuKKcZSS3iZAlMW9gfCpyB0XTMO4",
  authDomain: "mynewpokerapp.firebaseapp.com",
  projectId: "mynewpokerapp",
  storageBucket: "mynewpokerapp.appspot.com", // Fixed storage bucket URL
  messagingSenderId: "884814703281",
  appId: "1:884814703281:web:cc83e9610b5c831e219090"
};

// 🧪 EMULATOR CONFIGURATION
// Set to true ONLY for testing with Firebase Emulator
// ⚠️ IMPORTANT: Set to false before production deployment
const USE_EMULATOR = false; // Set to true for local emulator testing

// Initialize Firebase only if it hasn't been initialized already
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore
const db = getFirestore(app);

// Initialize Auth
const auth = getAuth(app);

// Connect to emulator if enabled
if (USE_EMULATOR) {
  // Check if already connected to avoid double-connection error
  try {
    // For web/iOS: use localhost
    const FIRESTORE_HOST = 'localhost';
    const AUTH_HOST = 'http://localhost:9099';

    // For Android emulator: uncomment these instead
    // const FIRESTORE_HOST = '10.0.2.2';
    // const AUTH_HOST = 'http://10.0.2.2:9099';

    connectFirestoreEmulator(db, FIRESTORE_HOST, 8080);
    connectAuthEmulator(auth, AUTH_HOST, { disableWarnings: true });

    console.log('🧪 Connected to Firebase Emulator');
    console.log(`   Firestore: ${FIRESTORE_HOST}:8080`);
    console.log(`   Auth: ${AUTH_HOST}`);
    console.log('   ⚠️ All data is LOCAL - production is safe');
  } catch (error) {
    console.log('🧪 Emulator already connected or connection failed');
  }
} else {
  console.log('🔴 Connected to PRODUCTION Firebase');
}

export { db, auth };