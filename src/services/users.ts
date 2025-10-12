import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, where, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { UserProfile, UserRole } from '@/models/UserProfile';

// Collection reference
const usersCollection = collection(db, 'users');

// Get all users without any filtering (for dashboard)
export const getAllUsers = async (): Promise<UserProfile[]> => {
  console.log('Fetching all users from Firestore');
  const querySnapshot = await getDocs(usersCollection);
  const users = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as UserProfile));
  console.log('Fetched all users:', users);
  return users;
};

// Get only active users (for game-related features)
export const getActiveUsers = async (): Promise<UserProfile[]> => {
  console.log('Fetching active users from Firestore');
  const q = query(usersCollection, where('isActive', '==', true));
  const querySnapshot = await getDocs(q);
  const users = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as UserProfile));
  console.log('Fetched active users:', users);
  return users;
};

// Get user by ID
export const getUserById = async (userId: string): Promise<UserProfile | null> => {
  const docRef = doc(db, 'users', userId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  return {
    id: docSnap.id,
    ...docSnap.data()
  } as UserProfile;
};

// Get user by phone number
export const getUserByPhone = async (phone: string): Promise<UserProfile | null> => {
  const q = query(usersCollection, where('phone', '==', phone), where('isActive', '==', true));
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) return null;
  
  const doc = querySnapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data()
  } as UserProfile;
};

// Create new user
export const createUser = async (userData: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const now = Date.now();
  const newUser = {
    ...userData,
    email: userData.email || null,
    authUid: userData.authUid || null,
    isActive: true,
    createdAt: now,
    updatedAt: now
  };
  
  const docRef = await addDoc(usersCollection, newUser);
  return docRef.id;
};

// Update user
export const updateUser = async (userId: string, userData: Partial<UserProfile>): Promise<void> => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    ...userData,
    updatedAt: Date.now()
  });
};

/**
 * makeUserInactive
 * 
 * פונקציה זו מסמנת משתמש כלא פעיל (soft delete).
 * השימוש בה מתאים במקרים בהם נדרש להעביר משתמש מ״פעיל״ ל״לא פעיל״,
 * למשל כאשר המשתמש נמחק מקבוצה היחידה בה הוא רשום.
 */
export const makeUserInactive = async (userId: string): Promise<void> => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    isActive: false,
    updatedAt: Date.now()
  });
};

/**
 * deleteUser
 * 
 * פונקציה זו מוחקת את המשתמש מהמסד באופן מוחלט (hard delete).
 * יש להשתמש בה כאשר יש צורך להסיר לחלוטין את המשתמש מהמערכת.
 */
export const deleteUser = async (userId: string): Promise<void> => {
  const userRef = doc(db, 'users', userId);
  await deleteDoc(userRef);
};

// Update user's payment unit
export const updateUserPaymentUnit = async (userId: string, paymentUnitId: string | null): Promise<void> => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    paymentUnitId,
    updatedAt: Date.now()
  });
};

// Get users by role
export const getUsersByRole = async (role: UserRole): Promise<UserProfile[]> => {
  const q = query(usersCollection, 
    where('role', '==', role),
    where('isActive', '==', true)
  );
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as UserProfile));
};

// Get users by payment unit
export const getUsersByPaymentUnit = async (paymentUnitId: string): Promise<UserProfile[]> => {
  const q = query(usersCollection, 
    where('paymentUnitId', '==', paymentUnitId),
    where('isActive', '==', true)
  );
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as UserProfile));
};
