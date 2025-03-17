// src/utils/sessionUtils.ts
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '@/config/firebase';

// Constants
const SESSION_DURATION = 1000 * 60 * 60 * 24; // 24 hours in milliseconds
const AUTH_SESSION_KEY = 'auth_session_timestamp';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const LAST_ACTIVE_KEY = 'auth_last_active';
const DEVICE_ID_KEY = 'device_id';

/**
 * Store a value securely
 * Falls back to AsyncStorage on web
 */
export async function storeSecurely(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      // On web, use AsyncStorage with a warning
      console.warn('SecureStore not available on web, using AsyncStorage');
      await AsyncStorage.setItem(key, value);
    } else {
      // On native platforms, use SecureStore
      await SecureStore.setItemAsync(key, value);
    }
  } catch (error) {
    console.error(`Error storing ${key}:`, error);
    throw error;
  }
}

/**
 * Retrieve a securely stored value
 * Falls back to AsyncStorage on web
 */
export async function getSecureValue(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return await AsyncStorage.getItem(key);
    } else {
      return await SecureStore.getItemAsync(key);
    }
  } catch (error) {
    console.error(`Error retrieving ${key}:`, error);
    return null;
  }
}

/**
 * Remove a securely stored value
 */
export async function removeSecureValue(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  } catch (error) {
    console.error(`Error removing ${key}:`, error);
    throw error;
  }
}

/**
 * Initialize a new session
 */
export async function initializeSession(): Promise<void> {
  const timestamp = Date.now().toString();
  await storeSecurely(AUTH_SESSION_KEY, timestamp);
  await storeSecurely(LAST_ACTIVE_KEY, timestamp);
  
  // Generate or retrieve device ID
  const deviceId = await getDeviceId();
  console.log('Session initialized with device ID:', deviceId);
}

/**
 * Update session activity timestamp
 */
export async function updateSessionActivity(): Promise<void> {
  await storeSecurely(LAST_ACTIVE_KEY, Date.now().toString());
}

/**
 * Check if the current session is valid
 */
export async function isSessionValid(): Promise<boolean> {
  try {
    // Check if user is authenticated
    if (!auth.currentUser) {
      return false;
    }
    
    // Get session timestamp
    const sessionTimestamp = await getSecureValue(AUTH_SESSION_KEY);
    if (!sessionTimestamp) {
      return false;
    }
    
    // Check if session has expired
    const currentTime = Date.now();
    const sessionTime = parseInt(sessionTimestamp);
    
    if (currentTime - sessionTime > SESSION_DURATION) {
      return false;
    }
    
    // Check last activity timestamp
    const lastActiveTimestamp = await getSecureValue(LAST_ACTIVE_KEY);
    if (!lastActiveTimestamp) {
      return false;
    }
    
    const lastActiveTime = parseInt(lastActiveTimestamp);
    const inactiveTime = currentTime - lastActiveTime;
    
    // Session times out after 2 hours of inactivity
    const INACTIVITY_TIMEOUT = 1000 * 60 * 60 * 2; // 2 hours
    
    if (inactiveTime > INACTIVITY_TIMEOUT) {
      return false;
    }
    
    // Session is valid
    return true;
  } catch (error) {
    console.error('Error checking session validity:', error);
    return false;
  }
}

/**
 * Clear all session data
 */
export async function clearSession(): Promise<void> {
  try {
    await removeSecureValue(AUTH_SESSION_KEY);
    await removeSecureValue(REFRESH_TOKEN_KEY);
    await removeSecureValue(LAST_ACTIVE_KEY);
    // Note: We don't clear the device ID as it should persist
  } catch (error) {
    console.error('Error clearing session:', error);
    throw error;
  }
}

/**
 * Generate or retrieve a unique device identifier
 */
export async function getDeviceId(): Promise<string> {
  try {
    // Check if we already have a device ID
    let deviceId = await getSecureValue(DEVICE_ID_KEY);
    
    if (!deviceId) {
      // Generate a new device ID
      deviceId = `${Platform.OS}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      await storeSecurely(DEVICE_ID_KEY, deviceId);
    }
    
    return deviceId;
  } catch (error) {
    console.error('Error getting device ID:', error);
    // Fallback to a temporary device ID
    return `temp_${Date.now()}`;
  }
}

/**
 * Get time remaining in the current session
 * Returns milliseconds remaining or 0 if session is expired
 */
export async function getSessionTimeRemaining(): Promise<number> {
  try {
    const sessionTimestamp = await getSecureValue(AUTH_SESSION_KEY);
    if (!sessionTimestamp) {
      return 0;
    }
    
    const sessionTime = parseInt(sessionTimestamp);
    const currentTime = Date.now();
    const sessionEndTime = sessionTime + SESSION_DURATION;
    
    if (currentTime >= sessionEndTime) {
      return 0;
    }
    
    return sessionEndTime - currentTime;
  } catch (error) {
    console.error('Error getting session time remaining:', error);
    return 0;
  }
}