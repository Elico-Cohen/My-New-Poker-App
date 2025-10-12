// src/services/playerManagement/playerManagement.ts

import { getAllUsers, createUser, updateUser } from '@/services/users';
import { addPlayerToGroup } from '@/services/groups';
import { UserProfile } from '@/models/UserProfile';
import { auth } from '@/config/firebase';
import { createUserWithEmailAndPassword, fetchSignInMethodsForEmail, signOut, signInWithEmailAndPassword, deleteUser } from 'firebase/auth';

/**
 * נתוני שחקן חדש.
 */
export interface NewPlayerData {
  name: string;
  phone: string;
  email?: string;
}

/**
 * בודקת אם שם השחקן כבר קיים במערכת.
 * @param name - שם השחקן לבדיקה.
 * @returns Promise שמחזירה true אם השם קיים, או false אחרת.
 */
export async function isPlayerNameExists(name: string): Promise<boolean> {
  const users: UserProfile[] = await getAllUsers();
  return users.some(user => user.name.toLowerCase() === name.trim().toLowerCase());
}

/**
 * בודקת אם אימייל קיים ב-Firebase Authentication
 * @param email - האימייל לבדיקה
 * @returns Promise שמחזירה true אם האימייל קיים, או false אחרת
 */
export async function checkEmailExistsInAuth(email: string): Promise<boolean> {
  try {
    const signInMethods = await fetchSignInMethodsForEmail(auth, email);
    console.log(`Email ${email} sign-in methods:`, signInMethods);
    return signInMethods.length > 0;
  } catch (error) {
    console.error('Error checking email in Firebase Auth:', error);
    return false;
  }
}

/**
 * מוחקת את האימייל וה-authUid של משתמש מ-Firestore
 * הערה: הפונקציה לא מוחקת את המשתמש מ-Firebase Authentication, רק מנתקת אותו מהרשומה ב-Firestore
 * @param email - האימייל של המשתמש למחיקה
 * @returns Promise שמחזירה true תמיד (כי אנחנו רק מוחקים מ-Firestore)
 */
export async function deleteAuthUserByEmail(email: string): Promise<boolean> {
  try {
    console.log(`Clearing email and authUid from Firestore for email: ${email}`);
    
    // הפונקציה הזו כבר לא מנסה למחוק מ-Authentication
    // היא רק מנקה את השדות ב-Firestore
    // המשתמש ב-Authentication יישאר אבל לא יוכל להתחבר לאפליקציה
    
    console.log(`Email ${email} will be cleared from Firestore only. Authentication record will remain but will be disconnected.`);
    return true;
    
  } catch (error: any) {
    console.error("Error in deleteAuthUserByEmail:", error);
    return false;
  }
}

/**
 * יוצרת משתמש ב-Firebase Authentication ומעדכנת את ה-authUid ב-Firestore.
 * הסדר: עדכון אימייל ב-Firestore -> יצירת Authentication -> עדכון authUid -> התנתקות מהמשתמש החדש
 * 
 * ⚠️ חשוב: פונקציה זו תגרום להתנתקות אוטומטית מהמשתמש הנוכחי כדי לשמור על אבטחת המערכת.
 * המשתמש יצטרך להתחבר מחדש לאחר השלמת התהליך.
 * 
 * @param email 
 * @param firestoreUserId 
 */
export async function createAuthUserAndUpdateFirestore(email: string, firestoreUserId: string): Promise<string | null> {
  // First, check if email actually exists in Firebase Authentication
  console.log(`Checking if email ${email} exists in Firebase Authentication...`);
  const emailExists = await checkEmailExistsInAuth(email);
  console.log(`Email ${email} exists in Firebase Auth: ${emailExists}`);
  
  if (emailExists) {
    throw new Error(`האימייל ${email} כבר קיים במערכת Authentication. אנא נסה עם אימייל אחר.`);
  }
  
  // Save current user info before creating new user
  const currentUser = auth.currentUser;
  const currentUserEmail = currentUser?.email;
  const currentUserUid = currentUser?.uid;
  
  console.log(`Current admin user before creating new auth user: ${currentUserEmail} (${currentUserUid})`);
  
  try {
    // Step 1: Update email in Firestore first
    console.log(`Step 1: Updating email in Firestore for user ${firestoreUserId}`);
    await updateUser(firestoreUserId, { email });
    console.log(`Successfully updated email in Firestore`);
    
    // Step 2: Create user in Firebase Authentication
    console.log(`Step 2: Creating user in Firebase Authentication with email ${email}`);
    const userCredential = await createUserWithEmailAndPassword(auth, email, "123456");
    const authUid = userCredential.user.uid;
    console.log(`Successfully created auth user with UID: ${authUid}`);
    
    // Step 3: Update authUid in Firestore (the new user can update their own authUid if it was null)
    console.log(`Step 3: Updating authUid in Firestore for user ${firestoreUserId}`);
    await updateUser(firestoreUserId, { authUid });
    console.log(`Successfully updated authUid for user ${firestoreUserId}`);
    
    // Step 4: Sign out the newly created user to prevent automatic login
    console.log(`Step 4: Signing out newly created user to prevent staying logged in as them`);
    await signOut(auth);
    console.log(`Signed out from newly created user ${authUid}`);
    
    // Note: The admin will need to sign in again, but this is expected behavior
    // The AuthContext will detect the sign out and redirect to login screen
    console.log(`Admin (${currentUserEmail}) will be redirected to login screen and can sign in again`);
    
    return authUid;
    
  } catch (error: any) {
    console.error("Error in createAuthUserAndUpdateFirestore:", error);
    console.error("Full error object:", JSON.stringify(error, null, 2));
    
    // If we're here and there's a current user different from the original, try to sign out
    if (auth.currentUser && auth.currentUser.uid !== currentUserUid) {
      try {
        await signOut(auth);
        console.log(`Signed out from problematic user session`);
      } catch (signOutError) {
        console.error("Error signing out after failed auth creation:", signOutError);
      }
    }
    
    // Handle specific error: email already in use
    if (error.code === 'auth/email-already-in-use') {
      throw new Error(`האימייל ${email} כבר קיים במערכת Authentication. אנא נסה עם אימייל אחר.`);
    }
    
    // For other errors, return null and let the caller decide
    return null;
  }
}

/**
 * יוצרת שחקן חדש במערכת ומוסיפה אותו לקבוצה כ"שחקן אורח".
 *
 * שלבים:
 * 1. בודקת אם שם השחקן כבר קיים – אם כן, זורקת שגיאה.
 * 2. יוצרת את המשתמש החדש באמצעות createUser (כולל אימייל אם סופק).
 * 3. אם סופק אימייל, מנסה ליצור חשבון ב-Firebase Authentication עם האימייל וסיסמה ראשונית.
 *    אם מצליח, מעדכנת את המשתמש ב-Firestore עם ה-authUid.
 * 4. מוסיפה את השחקן לקבוצה באמצעות addPlayerToGroup.
 * 5. מחזירה את מזהה המשתמש החדש.
 *
 * @param newPlayerData - נתוני השחקן החדש (שם, טלפון וכו').
 * @param groupId - מזהה הקבוצה שאליה יש להוסיף את השחקן.
 * @returns Promise שמחזירה את מזהה המשתמש החדש.
 * @throws Error אם השם כבר קיים במערכת או אם יצירת המשתמש נכשלת.
 */
export async function createNewPlayerAndAddToGroup(
  newPlayerData: NewPlayerData,
  groupId: string
): Promise<string> {
  if (await isPlayerNameExists(newPlayerData.name)) {
    throw new Error('שם זה כבר קיים במערכת');
  }

  // Check for email duplication if email is provided
  if (newPlayerData.email && newPlayerData.email.trim() !== '') {
    const allUsers = await getAllUsers();
    const emailExists = allUsers.some(
      user => user.email?.toLowerCase() === newPlayerData.email!.trim().toLowerCase()
    );
    if (emailExists) {
      throw new Error('כתובת האימייל שהוזנה כבר קיימת במערכת.');
    }
  }

  // Prepare user data for Firestore, including email if provided
  const newUserFirestoreData: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'> = {
    name: newPlayerData.name.trim(),
    phone: newPlayerData.phone.trim(),
    role: 'regular' as const,
    isActive: true,
    // authUid will be undefined initially, email will be included if present
  };

  if (newPlayerData.email && newPlayerData.email.trim() !== '') {
    newUserFirestoreData.email = newPlayerData.email.trim();
  }

  // Step 2: Create user in Firestore
  const newUserId = await createUser(newUserFirestoreData);

  // If email is provided, create Firebase Authentication user
  if (newUserFirestoreData.email) {
    console.log(`Creating Firebase Authentication user for email: ${newUserFirestoreData.email}`);
    try {
      const authUid = await createAuthUserAndUpdateFirestore(newUserFirestoreData.email, newUserId);
      if (authUid) {
        console.log(`Successfully created auth user with UID: ${authUid} for new player ${newUserId}`);
        // Note: The user will be automatically signed out and redirected to login
        // This is expected behavior for security reasons
      } else {
        console.warn(`Failed to create auth user for new player ${newUserId}, but player was created in Firestore`);
        // Player exists in Firestore but without auth - this is still a valid state
      }
    } catch (authError: any) {
      console.error(`Failed to create auth user for new player ${newUserId}:`, authError);
      // Don't throw here - the player was successfully created in Firestore
      // The auth creation failure is logged but doesn't prevent the player creation
      // The admin can manually handle the auth creation later if needed
    }
  }

  // Step 4: Add player to the group
  await addPlayerToGroup(groupId, newUserId, false); // Assuming new players are added as non-permanent guests

  // Step 5: Return the new user ID
  return newUserId;
}
