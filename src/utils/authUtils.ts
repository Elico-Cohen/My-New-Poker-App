// src/utils/authUtils.ts
import { UserRole } from '@/models/UserProfile';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { auth } from '@/config/firebase';
import * as SecureStore from 'expo-secure-store';

/**
 * Helper function to display a formatted role name in Hebrew
 */
export function getRoleDisplay(role: UserRole): string {
  switch (role) {
    case 'admin':
      return 'מנהל מערכת';
    case 'super':
      return 'משתמש מתקדם';
    case 'regular':
      return 'משתמש רגיל';
    default:
      return role;
  }
}

/**
 * Shows a permission denied alert and optionally navigates back
 */
export function showPermissionDeniedAlert(
  operation: string = 'פעולה זו', 
  requiredRole: UserRole = 'admin',
  navigateBack: boolean = false
): void {
  Alert.alert(
    "אין הרשאה",
    `אין לך הרשאה לבצע ${operation}. פעולה זו דורשת הרשאת ${getRoleDisplay(requiredRole)}.`,
    [
      { 
        text: "הבנתי", 
        onPress: () => {
          if (navigateBack) {
            router.back();
          }
        } 
      }
    ]
  );
}

/**
 * Shows a confirmation before a critical action
 */
export function confirmAction(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmText: string = "אישור",
  cancelText: string = "ביטול"
): void {
  Alert.alert(
    title,
    message,
    [
      {
        text: cancelText,
        style: "cancel"
      },
      {
        text: confirmText,
        onPress: onConfirm
      }
    ]
  );
}

/**
 * Shows a logout confirmation dialog
 */
export function confirmLogout(onConfirm: () => void): void {
  Alert.alert(
    "יציאה מהמערכת",
    "האם אתה בטוח שברצונך להתנתק?",
    [
      {
        text: "ביטול",
        style: "cancel"
      },
      {
        text: "התנתק",
        onPress: onConfirm
      }
    ]
  );
}

/**
 * Get current authenticated user ID safely
 */
export function getCurrentUserId(): string | null {
  return auth.currentUser?.uid || null;
}

/**
 * Store sensitive information securely
 */
export async function storeSecureItem(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (error) {
    console.error('Error storing secure item:', error);
  }
}

/**
 * Retrieve sensitive information securely
 */
export async function getSecureItem(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    console.error('Error retrieving secure item:', error);
    return null;
  }
}

/**
 * Remove sensitive information securely
 */
export async function removeSecureItem(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (error) {
    console.error('Error removing secure item:', error);
  }
}

/**
 * Checks if the string is a valid email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Checks if the password meets minimum requirements
 * - At least 6 characters
 * - Contains at least one number
 * - Contains at least one special character (optional for backward compatibility)
 */
export function isValidPassword(password: string, enforceStrong: boolean = false): boolean {
  // Basic check for backward compatibility
  if (password.length < 6) {
    return false;
  }
  
  if (enforceStrong) {
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    return hasNumber && hasSpecialChar;
  }
  
  return true;
}

/**
 * Returns appropriate validation error messages for login form
 */
export function validateLoginCredentials(email: string, password: string): { 
  email?: string; 
  password?: string 
} {
  const errors: { email?: string; password?: string } = {};
  
  if (!email.trim()) {
    errors.email = 'נא להזין כתובת אימייל';
  } else if (!isValidEmail(email)) {
    errors.email = 'כתובת אימייל לא תקינה';
  }
  
  if (!password) {
    errors.password = 'נא להזין סיסמה';
  } else if (!isValidPassword(password)) {
    errors.password = 'הסיסמה צריכה להכיל לפחות 6 תווים';
  }
  
  return errors;
}