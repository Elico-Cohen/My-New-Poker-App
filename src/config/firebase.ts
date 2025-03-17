// src/config/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAII9gGuKKcZSS3iZAlMW9gfCpyB0XTMO4",
  authDomain: "mynewpokerapp.firebaseapp.com",
  projectId: "mynewpokerapp",
  storageBucket: "mynewpokerapp.firebasestorage.app", // Keeping original value
  messagingSenderId: "884814703281",
  appId: "1:884814703281:web:cc83e9610b5c831e219090"
};

// Initialize Firebase only if it hasn't been initialized already
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore
const db = getFirestore(app);

// Initialize Auth with persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export { db, auth };