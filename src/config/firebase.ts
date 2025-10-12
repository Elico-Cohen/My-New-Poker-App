// src/config/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAII9gGuKKcZSS3iZAlMW9gfCpyB0XTMO4",
  authDomain: "mynewpokerapp.firebaseapp.com",
  projectId: "mynewpokerapp",
  storageBucket: "mynewpokerapp.appspot.com", // Fixed storage bucket URL
  messagingSenderId: "884814703281",
  appId: "1:884814703281:web:cc83e9610b5c831e219090"
};

// Initialize Firebase only if it hasn't been initialized already
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore
const db = getFirestore(app);

// Initialize Auth
const auth = getAuth(app);

export { db, auth };