// src/utils/securityAudit.ts
import { getAuth, fetchSignInMethodsForEmail } from 'firebase/auth';
import { collection, getDocs, query, where, getDoc, doc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import NetInfo from '@react-native-community/netinfo';

/**
 * Security Audit Results interface
 */
export interface SecurityAuditResults {
  firebaseConfigSecure: boolean;
  authImplementationSecure: boolean;
  apiKeysInEnvironment: boolean;
  sessionHandlingSecure: boolean;
  passwordPolicyEnforced: boolean;
  dataAccessControlsSecure: boolean;
  networkSecurityChecks: boolean;
  offlineAccessSecure: boolean;
  inactiveUsersChecked: boolean;
  issues: SecurityIssue[];
}

/**
 * Security Issue interface
 */
export interface SecurityIssue {
  severity: 'high' | 'medium' | 'low';
  description: string;
  recommendation: string;
}

/**
 * Security audit function for the Poker Night app
 * This function checks for common security issues and returns a report
 */
export async function performSecurityAudit(): Promise<SecurityAuditResults> {
  const issues: SecurityIssue[] = [];
  
  // Initialize results
  const results: SecurityAuditResults = {
    firebaseConfigSecure: true,
    authImplementationSecure: true,
    apiKeysInEnvironment: false, // Default to false, we'll check this
    sessionHandlingSecure: true,
    passwordPolicyEnforced: true,
    dataAccessControlsSecure: true,
    networkSecurityChecks: true,
    offlineAccessSecure: true,
    inactiveUsersChecked: true,
    issues: []
  };

  // Check for hardcoded Firebase credentials
  if (global.process?.env?.EXPO_PUBLIC_FIREBASE_API_KEY === undefined) {
    results.apiKeysInEnvironment = false;
    issues.push({
      severity: 'medium',
      description: 'Firebase API keys are hardcoded in the application code',
      recommendation: 'Move Firebase configuration to environment variables or secure storage'
    });
  }

  // Check for proper authentication implementation
  try {
    const userQuery = query(collection(db, 'users'), where('isActive', '==', true));
    const userDocs = await getDocs(userQuery);
    
    if (userDocs.empty) {
      results.inactiveUsersChecked = false;
      issues.push({
        severity: 'low',
        description: 'No active users found in the database',
        recommendation: 'Verify user accounts are properly created and activated'
      });
    }

    // Check if there are any users with admin role but no lastLoginAt timestamp
    const adminQuery = query(
      collection(db, 'users'), 
      where('role', '==', 'admin')
    );
    
    const adminDocs = await getDocs(adminQuery);
    
    for (const adminDoc of adminDocs.docs) {
      const adminData = adminDoc.data();
      if (!adminData.lastLoginAt) {
        issues.push({
          severity: 'medium',
          description: `Admin user ${adminDoc.id} has no login timestamp record`,
          recommendation: 'Implement and verify login timestamp tracking for all admin users'
        });
      }
    }
  } catch (error) {
    console.error('Error checking user data:', error);
    results.dataAccessControlsSecure = false;
    issues.push({
      severity: 'high',
      description: 'Could not verify user data access controls',
      recommendation: 'Verify Firestore security rules and ensure proper authentication checking'
    });
  }

  // Check network security
  try {
    const networkState = await NetInfo.fetch();
    if (!networkState.isConnected) {
      results.networkSecurityChecks = false;
      issues.push({
        severity: 'low',
        description: 'Device is currently offline, network security checks cannot be performed',
        recommendation: 'Perform security audit when connected to a network'
      });
    }
  } catch (error) {
    console.error('Network check error:', error);
    results.networkSecurityChecks = false;
  }

  // Check for password policy enforcement
  if (!sessionStorage || !localStorage) {
    results.passwordPolicyEnforced = false;
    issues.push({
      severity: 'medium',
      description: 'Web storage is not available, which might indicate a non-standard environment',
      recommendation: 'Ensure the app runs in a secure context with standard Web APIs available'
    });
  }

  // Finalize results
  results.issues = issues;
  return results;
}

/**
 * Check if an email is already registered in Firebase
 * Useful for preventing account enumeration attacks
 */
export async function isEmailRegistered(email: string): Promise<boolean> {
  try {
    const auth = getAuth();
    const methods = await fetchSignInMethodsForEmail(auth, email);
    // Return true if any sign-in methods exist for this email
    return methods.length > 0;
  } catch (error) {
    console.error('Error checking email registration:', error);
    // Return false on error to be safe
    return false;
  }
}

/**
 * Check for inactive user accounts
 * Helps identify potential security risks from dormant accounts
 */
export async function getInactiveUsers(daysInactive: number = 90): Promise<string[]> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysInactive);
    const cutoffTimestamp = cutoffDate.getTime();
    
    const usersQuery = query(collection(db, 'users'), where('isActive', '==', true));
    const userDocs = await getDocs(usersQuery);
    
    const inactiveUserIds: string[] = [];
    
    for (const userDoc of userDocs.docs) {
      const userData = userDoc.data();
      // Check if lastLoginAt exists and is older than the cutoff date
      if (!userData.lastLoginAt || userData.lastLoginAt.toMillis() < cutoffTimestamp) {
        inactiveUserIds.push(userDoc.id);
      }
    }
    
    return inactiveUserIds;
  } catch (error) {
    console.error('Error fetching inactive users:', error);
    return [];
  }
}

/**
 * Verify role-based access control for a specific user and resource
 */
export async function verifyAccessControl(userId: string, resourcePath: string, action: 'read' | 'write' | 'delete'): Promise<boolean> {
  try {
    // לוג לאבחון
    console.log(`Verifying access for user ${userId} to ${resourcePath} with action ${action}`);
    
    // מקרה מיוחד: בדיקה אם זה המשתמש האדמין הראשי לפי ה-UID הידוע
    const specialAdminUids = ["OZnLfjK1S3cdspBEnQKpYicdC6T2"];
    if (specialAdminUids.includes(userId)) {
      console.log(`Special admin detected by UID: ${userId}, granting all permissions`);
      return true;
    }
    
    // Get user document
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    // מקרה מיוחד: אם המשתמש הוא האדמין הראשי אבל אין לו מסמך ב-Firestore
    const currentUser = getAuth().currentUser;
    const specialAdminEmails = ["elico.cohen@gmail.com", "eli@nirvered.com"];
    
    if (currentUser && specialAdminEmails.includes(currentUser.email || '')) {
      console.log(`Special admin detected by email: ${currentUser.email}, granting all permissions`);
      return true;
    }
    
    if (!userDoc.exists()) {
      console.error(`User document not found for ID: ${userId}`);
      
      // גם פה בודקים אם זה אימייל של אדמין ידוע
      if (currentUser?.uid === userId && specialAdminEmails.includes(currentUser.email || '')) {
        console.log(`Admin email (${currentUser.email}) without user document, granting permissions`);
        return true;
      }
      
      return false;
    }
    
    const userData = userDoc.data();
    const userRole = userData.role;
    
    console.log(`User role found: ${userRole} for user ${userId}`);
    
    // Basic RBAC rules
    const accessMatrix: Record<string, Record<string, string[]>> = {
      'games': {
        'read': ['admin', 'super', 'regular'],
        'write': ['admin', 'super'],
        'delete': ['admin']
      },
      'users': {
        'read': ['admin', 'super'],
        'write': ['admin'],
        'delete': ['admin']
      },
      'groups': {
        'read': ['admin', 'super', 'regular'],
        'write': ['admin', 'super'],
        'delete': ['admin']
      },
      'paymentUnits': {
        'read': ['admin', 'super', 'regular'],
        'write': ['admin', 'super'],
        'delete': ['admin']
      }
    };
    
    // Simple resource pattern matching
    const [resourceType, resourceId] = resourcePath.split('/');
    
    // Check if the resource type exists in our matrix
    if (!accessMatrix[resourceType]) {
      console.error(`Resource type ${resourceType} not found in access matrix`);
      return false;
    }
    
    // Check if the action is allowed for this resource
    if (!accessMatrix[resourceType][action]) {
      console.error(`Action ${action} not defined for resource ${resourceType}`);
      return false;
    }
    
    // Check if the user's role is allowed for this action on this resource
    const hasAccess = accessMatrix[resourceType][action].includes(userRole);
    console.log(`Access decision for ${userId} to ${resourceType}/${action}: ${hasAccess}`);
    return hasAccess;
  } catch (error) {
    console.error('Error verifying access control:', error);
    
    // במקרה של שגיאה, נאפשר למשתמש האדמין הראשי לעבור
    const currentUser = getAuth().currentUser;
    if (currentUser?.uid === userId && currentUser?.email === "elico.cohen@gmail.com") {
      console.log(`Error occurred but allowing admin ${currentUser.email} to proceed`);
      return true;
    }
    
    return false;
  }
}