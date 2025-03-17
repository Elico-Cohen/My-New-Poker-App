// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserProfile, UserRole } from '@/models/UserProfile';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, updateDoc, setDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncService } from '@/store/SyncService';

// Constants
const SESSION_DURATION = 1000 * 60 * 60 * 24; // 24 hours in milliseconds
const AUTH_SESSION_KEY = 'auth_session_timestamp';

// Define what the AuthContext will provide
interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<void>;
  hasPermission: (requiredRole: UserRole | UserRole[]) => boolean;
  canDeleteEntity: (entityType: 'user' | 'group' | 'paymentUnit' | 'game') => boolean;
  canManageEntity: (entityType: 'user' | 'group' | 'paymentUnit' | 'game') => boolean;
  clearError: () => void;
  isOffline: boolean;
}

// Create the Auth Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Custom hook to use the AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Props interface for AuthProvider
interface AuthProviderProps {
  children: ReactNode;
}

// Function to update the user's last login timestamp
const updateUserLastLogin = async (userId: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      lastLoginAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating last login:', error);
  }
};

// Implementation of the AuthProvider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoading(true);
      try {
        if (firebaseUser) {
          // בדיקה אם מדובר במשתמש אדמין מיוחד
          if (firebaseUser.email === 'elico.cohen@gmail.com') {
            console.log('AuthContext: ADMIN SPECIAL CASE - Detected admin email in auth state change');
            
            // Check if session is still valid (within 24 hours)
            const sessionTimestamp = await AsyncStorage.getItem(AUTH_SESSION_KEY);
            if (sessionTimestamp) {
              const currentTime = Date.now();
              const sessionTime = parseInt(sessionTimestamp);
              
              if (currentTime - sessionTime > SESSION_DURATION) {
                // Session expired, log out
                await signOut(auth);
                await AsyncStorage.removeItem(AUTH_SESSION_KEY);
                setUser(null);
                setError('הסשן פג תוקף. אנא התחבר מחדש.');
                setIsLoading(false);
                return;
              }
              
              // אם הסשן תקף, יצירת פרופיל אדמין מלא ללא תלות ב-Firestore
              const adminUserData: UserProfile = {
                id: firebaseUser.uid,
                name: 'מנהל מערכת',
                email: firebaseUser.email || 'elico.cohen@gmail.com',
                role: 'admin',
                isActive: true,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                phone: '',
                paymentUnitId: '',
              };
              
              console.log('AuthContext: ADMIN SPECIAL CASE - Using admin profile in auth state change');
              setUser(adminUserData);
              setIsLoading(false);
              return;
            }
          }
          
          // Check if session is still valid (within 24 hours)
          const sessionTimestamp = await AsyncStorage.getItem(AUTH_SESSION_KEY);
          if (sessionTimestamp) {
            const currentTime = Date.now();
            const sessionTime = parseInt(sessionTimestamp);
            
            if (currentTime - sessionTime > SESSION_DURATION) {
              // Session expired, log out
              await signOut(auth);
              await AsyncStorage.removeItem(AUTH_SESSION_KEY);
              setUser(null);
              setError('הסשן פג תוקף. אנא התחבר מחדש.');
              setIsLoading(false);
              return;
            }
          }
          
          // Fetch user profile from Firestore
          try {
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
              const userData = userDoc.data() as Omit<UserProfile, 'id'>;
              
              // Check if user is active
              if (!userData.isActive) {
                await signOut(auth);
                setUser(null);
                setError('חשבון זה אינו פעיל. צור קשר עם מנהל המערכת.');
                return;
              }
              
              setUser({
                id: firebaseUser.uid,
                ...userData
              });
            } else {
              // טיפול מיוחד במשתמש אדמין אם לא נמצא ב-Firestore
              if (firebaseUser.email === 'elico.cohen@gmail.com') {
                console.log('AuthContext: ADMIN SPECIAL CASE - Admin not found in Firestore, creating local profile');
                // יצירת פרופיל אדמין מקומי
                const adminUserData: UserProfile = {
                  id: firebaseUser.uid,
                  name: 'מנהל מערכת',
                  email: firebaseUser.email || 'elico.cohen@gmail.com',
                  role: 'admin',
                  isActive: true,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  phone: '',
                  paymentUnitId: '',
                };
                
                setUser(adminUserData);
              } else {
                // User record doesn't exist in Firestore
                await signOut(auth);
                setUser(null);
                setError('משתמש לא נמצא. צור קשר עם מנהל המערכת.');
              }
            }
          } catch (firestoreError) {
            console.error('Error accessing Firestore:', firestoreError);
            
            // טיפול מיוחד במשתמש אדמין אם יש שגיאת גישה ל-Firestore
            if (firebaseUser.email === 'elico.cohen@gmail.com') {
              console.log('AuthContext: ADMIN SPECIAL CASE - Firestore error, creating local admin profile');
              // יצירת פרופיל אדמין מקומי
              const adminUserData: UserProfile = {
                id: firebaseUser.uid,
                name: 'מנהל מערכת',
                email: firebaseUser.email || 'elico.cohen@gmail.com',
                role: 'admin',
                isActive: true,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                phone: '',
                paymentUnitId: '',
              };
              
              setUser(adminUserData);
            } else {
              // לא משתמש אדמין - מוציאים אותו מהמערכת
              await signOut(auth);
              setUser(null);
              setError('שגיאה בגישה למידע המשתמש. צור קשר עם מנהל המערכת.');
            }
          }

          // Initialize syncService after successful authentication
          try {
            await syncService.initialize();
            console.log('AuthContext: SyncService initialized successfully');
          } catch (syncError) {
            console.error('AuthContext: Failed to initialize SyncService:', syncError);
          }
        } else {
          setUser(null);
          
          // Cleanup syncService when user is not authenticated
          syncService.cleanup();
          await AsyncStorage.removeItem(AUTH_SESSION_KEY);
        }
      } catch (err) {
        console.error('Error getting user profile:', err);
        setError('שגיאה בטעינת פרופיל משתמש');
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    });
    
    // Cleanup subscription
    return () => unsubscribe();
  }, []);
  
  // Clear error
  const clearError = () => {
    setError(null);
  };
  
  // Login function
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    // מעקף מלא עבור המשתמש האדמין - בדיקה ראשונית
    if (email.toLowerCase() === 'elico.cohen@gmail.com') {
      console.log('AuthContext: ADMIN BYPASS - Detected admin email, applying special login logic');
      
      try {
        // ניסיון להתחבר רגיל רק כדי לוודא שהסיסמה נכונה
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log('AuthContext: ADMIN BYPASS - Authentication successful for admin');
        
        // יצירת פרופיל אדמין מלא ללא תלות ב-Firestore
        const adminUserData: UserProfile = {
          id: userCredential.user.uid,  // שימוש ב-UID האמיתי במקום קבוע
          name: 'מנהל מערכת',
          email: email,
          role: 'admin',
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          phone: '',
          paymentUnitId: '',
        };
        
        // רישום זמן הסשן באופן ברור יותר
        const sessionTime = Date.now().toString();
        console.log('AuthContext: ADMIN BYPASS - Setting session timestamp:', sessionTime);
        await AsyncStorage.setItem(AUTH_SESSION_KEY, sessionTime);
        
        // הגדרת המשתמש באופן מיידי, ללא תלות ב-Firestore
        console.log('AuthContext: ADMIN BYPASS - Setting admin user profile manually');
        setUser(adminUserData);
        setIsLoading(false);
        
        // סיום הפונקציה כאן, מבלי להמשיך לקוד הרגיל
        return;
      } catch (authError: any) {
        // במקרה של שגיאת אימות (סיסמה שגויה למשל)
        console.error('AuthContext: ADMIN BYPASS - Authentication error:', authError);
        
        if (authError.code === 'auth/wrong-password') {
          setError('סיסמה שגויה');
        } else if (authError.code === 'auth/too-many-requests') {
          setError('יותר מדי ניסיונות כניסה. נסה שוב מאוחר יותר');
        } else {
          setError('שגיאה בכניסה למערכת. אנא נסה שוב');
        }
        
        setIsLoading(false);
        return;
      }
    }
    
    // המשך הקוד הרגיל לכל המשתמשים האחרים
    try {
      console.log('AuthContext: attempting login for:', email);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('AuthContext: Firebase authentication successful, uid:', userCredential.user.uid);
      
      // Firebase Auth successful, now get user profile from Firestore
      try {
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
        
        if (userDoc.exists()) {
          console.log('AuthContext: user document found in Firestore');
          const userData = userDoc.data() as Omit<UserProfile, 'id'>;
          
          // Check if user is active
          if (!userData.isActive) {
            console.log('AuthContext: user account is not active');
            await signOut(auth);
            setError('חשבון זה אינו פעיל. צור קשר עם מנהל המערכת.');
            return;
          }
          
          // Set session timestamp
          await AsyncStorage.setItem(AUTH_SESSION_KEY, Date.now().toString());
          
          // Update last login timestamp
          await updateUserLastLogin(userCredential.user.uid);
          
          setUser({
            id: userCredential.user.uid,
            ...userData
          });
        } else {
          console.log('AuthContext: user exists in Authentication but not in Firestore');
          
          try {
            // בדיקה אם קיימת רשומה עם אותו אימייל בקולקציית המשתמשים
            const userByEmailQuery = query(
              collection(db, 'users'), 
              where('email', '==', userCredential.user.email)
            );
            
            const matchingUsers = await getDocs(userByEmailQuery);
            
            if (!matchingUsers.empty) {
              console.log('AuthContext: found user by email in Firestore');
              // עדכון מזהה המשתמש באימות למזהה המשתמש ב-Firestore
              const firestoreUser = matchingUsers.docs[0];
              const firestoreData = firestoreUser.data() as Omit<UserProfile, 'id'>;
              
              // Check if user is active
              if (!firestoreData.isActive) {
                console.log('AuthContext: user found by email is not active');
                await signOut(auth);
                setError('חשבון זה אינו פעיל. צור קשר עם מנהל המערכת.');
                return;
              }
              
              // Set session timestamp
              await AsyncStorage.setItem(AUTH_SESSION_KEY, Date.now().toString());
              
              // Update last login timestamp in the matching document
              await updateUserLastLogin(firestoreUser.id);
              
              setUser({
                id: firestoreUser.id,
                ...firestoreData
              });
            } else {
              // טיפול מיוחד למשתמשי אדמין - אם אנחנו לא יכולים למצוא את המשתמש ב-Firestore
              // ויש שגיאת הרשאות, נצור פרופיל משתמש מקומי עם הרשאות אדמין
              if (userCredential.user.email === 'elico.cohen@gmail.com') {
                console.log('AuthContext: special handling for admin user by email');
                const now = Date.now();
                
                // יצירת אובייקט משתמש לאדמין
                const adminUserData = {
                  name: 'אלי כהן',
                  email: userCredential.user.email,
                  role: 'admin' as UserRole,
                  isActive: true,
                  createdAt: now,
                  updatedAt: now,
                  phone: '',
                  paymentUnitId: '',
                };
                
                // הגדרת המשתמש באופן מקומי בלבד (בלי לכתוב ל-Firestore)
                console.log('AuthContext: setting local admin profile without Firestore write');
                
                // Set session timestamp
                await AsyncStorage.setItem(AUTH_SESSION_KEY, Date.now().toString());
                
                // הגדרת המשתמש כאדמין
                setUser({
                  id: userCredential.user.uid,
                  ...adminUserData
                });
              } else {
                // ניצור משתמש רגיל אם זה לא האדמין המוכר
                console.log('AuthContext: creating new user profile in Firestore');
                // נייצר פרופיל ב-Firestore
                const authUser = userCredential.user;
                const now = Date.now();
                
                // יצירת אובייקט משתמש התואם את המבנה של UserProfile
                const newUserData = {
                  name: authUser.displayName || email.split('@')[0],
                  email: authUser.email || email,
                  phone: authUser.phoneNumber || '',
                  role: 'regular' as UserRole,
                  isActive: true,
                  createdAt: now,
                  updatedAt: now,
                  paymentUnitId: '',
                  // מידע נוסף שאינו חלק מהמבנה הבסיסי
                  preferences: {
                    language: 'he',
                    theme: 'dark',
                    notifications: true
                  }
                };
                
                try {
                  // שמירת פרופיל המשתמש החדש ב-Firestore
                  await setDoc(doc(db, 'users', authUser.uid), newUserData);
                  
                  // Set session timestamp
                  await AsyncStorage.setItem(AUTH_SESSION_KEY, Date.now().toString());
                  
                  // הגדרת המשתמש באופן מפורש באפליקציה
                  setUser({
                    id: authUser.uid,
                    ...newUserData
                  });
                } catch (firestoreError) {
                  console.error('AuthContext: Error creating new user in Firestore:', firestoreError);
                  // אם נכשל ביצירת המשתמש ב-Firestore, עדיין נאפשר כניסה עם הרשאות בסיסיות
                  setUser({
                    id: authUser.uid,
                    ...newUserData
                  });
                }
              }
            }
          } catch (queryError) {
            console.error('AuthContext: Error querying by email:', queryError);
            // אם יש שגיאת הרשאות גם בחיפוש לפי אימייל, נטפל בו כמקרה מיוחד
            if (userCredential.user.email === 'elico.cohen@gmail.com') {
              console.log('AuthContext: special handling for admin user by email after query error');
              const now = Date.now();
              
              // יצירת אובייקט משתמש לאדמין
              const adminUserData = {
                name: 'אלי כהן',
                email: userCredential.user.email,
                role: 'admin' as UserRole,
                isActive: true,
                createdAt: now,
                updatedAt: now,
                phone: '',
                paymentUnitId: '',
              };
              
              // הגדרת המשתמש באופן מקומי בלבד (בלי לכתוב ל-Firestore)
              console.log('AuthContext: setting local admin profile without Firestore write');
              
              // Set session timestamp
              await AsyncStorage.setItem(AUTH_SESSION_KEY, Date.now().toString());
              
              // הגדרת המשתמש כאדמין
              setUser({
                id: userCredential.user.uid,
                ...adminUserData
              });
            } else {
              throw queryError; // זרוק את השגיאה להמשך הטיפול
            }
          }
        }
      } catch (firestoreError: any) {
        console.error('AuthContext: Firestore error:', firestoreError, 'code:', firestoreError.code);
        
        // אם יש שגיאת הרשאות, ננסה לטפל במקרים מיוחדים
        if (firestoreError.code === 'permission-denied') {
          console.log('AuthContext: handling permission-denied error');
          
          // טיפול מיוחד לאדמין ידוע
          if (userCredential.user.email === 'elico.cohen@gmail.com') {
            console.log('AuthContext: special handling for admin user by email');
            const now = Date.now();
            
            // יצירת אובייקט משתמש לאדמין
            const adminUserData = {
              name: 'אלי כהן',
              email: userCredential.user.email,
              role: 'admin' as UserRole,
              isActive: true,
              createdAt: now,
              updatedAt: now,
              phone: '',
              paymentUnitId: '',
            };
            
            // Set session timestamp
            await AsyncStorage.setItem(AUTH_SESSION_KEY, Date.now().toString());
            
            // הגדרת המשתמש כאדמין
            setUser({
              id: userCredential.user.uid,
              ...adminUserData
            });
            
            return; // מסיים את הפונקציה בהצלחה
          } else {
            // עבור משתמשים אחרים עם שגיאות הרשאה, נתנתק ונשלח שגיאה מתאימה
            await signOut(auth);
            setError('אין הרשאות גישה למערכת. צור קשר עם מנהל המערכת.');
            return;
          }
        } else {
          // זרוק את השגיאה להמשך הטיפול
          throw firestoreError;
        }
      }
    } catch (err: any) {
      console.error('AuthContext: Login error:', err, 'code:', err.code);
      
      // Handle common Firebase auth errors
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('שם משתמש או סיסמה שגויים');
      } else if (err.code === 'auth/too-many-requests') {
        setError('יותר מדי ניסיונות כניסה. נסה שוב מאוחר יותר');
      } else if (err.code === 'auth/network-request-failed') {
        setError('בעיית חיבור לאינטרנט. בדוק את החיבור שלך ונסה שוב.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-email') {
        setError('אימייל או סיסמה לא תקינים');
      } else if (err.code === 'auth/user-disabled') {
        setError('חשבון זה חסום. צור קשר עם מנהל המערכת.');
      } else if (err.code === 'permission-denied') {
        setError('אין הרשאת גישה למערכת. צור קשר עם מנהל המערכת.');
      } else {
        setError('שגיאה בכניסה למערכת. אנא נסה שוב');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Logout function
  const logout = async () => {
    console.log('AuthContext: logout function called');
    setIsLoading(true);
    try {
      // Clean up syncService before logging out
      syncService.cleanup();
      console.log('AuthContext: SyncService cleaned up');
      
      // נקה את כל הנתונים המקומיים לפני ביצוע התנתקות מהשרת
      setUser(null);
      await AsyncStorage.removeItem(AUTH_SESSION_KEY);
      
      // כעת נתנתק מהשרת
      console.log('AuthContext: signing out from Firebase');
      await signOut(auth);
      
      console.log('AuthContext: logout successful, all local data cleared');
    } catch (err) {
      console.error('AuthContext: logout error:', err);
      // גם אם יש שגיאה, ננקה את הנתונים המקומיים
      setUser(null);
      await AsyncStorage.removeItem(AUTH_SESSION_KEY);
      setError('שגיאה ביציאה מהמערכת');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Reset password function
  const resetPassword = async (email: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      await sendPasswordResetEmail(auth, email);
      return true;
    } catch (err: any) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('לא נמצא משתמש עם כתובת האימייל הזו');
      } else {
        setError('שגיאה באיפוס הסיסמה. אנא נסה שוב מאוחר יותר');
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Register function
  const register = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // יצירת משתמש חדש ב-Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      const now = Date.now();
      
      // יצירת מסמך משתמש ב-Firestore לפי המבנה הקיים
      const userData = {
        name: name,
        email: email,
        isActive: true,
        role: 'regular' as UserRole, 
        createdAt: now,
        updatedAt: now,
        phone: '', // שדה ריק לטלפון
        paymentUnitId: '' // שדה ריק ליחידת תשלום
      };
      
      await setDoc(doc(db, 'users', userCredential.user.uid), userData);
      
      // שמירת הסשן
      await AsyncStorage.setItem(AUTH_SESSION_KEY, Date.now().toString());
      
      // עדכון פרטי המשתמש במערכת עם ID
      const newUser: UserProfile = {
        id: userCredential.user.uid,
        ...userData
      };

      // הגדרת המשתמש באופן מפורש
      setUser(newUser);
      
    } catch (err: any) {
      console.error('Registration error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('כתובת האימייל כבר קיימת במערכת');
      } else if (err.code === 'auth/invalid-email') {
        setError('כתובת אימייל לא תקינה');
      } else if (err.code === 'auth/weak-password') {
        setError('הסיסמה חלשה מדי');
      } else if (err.code === 'auth/network-request-failed') {
        setError('בעיית חיבור לאינטרנט. בדוק את החיבור שלך ונסה שוב.');
      } else {
        setError('שגיאה בהרשמה. אנא נסה שוב');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Check if user has the required role
  const hasPermission = (requiredRole: UserRole | UserRole[]): boolean => {
    if (!user) return false;
    
    // Convert requiredRole to array if it's not already
    const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    
    // Admin has all permissions
    if (user.role === 'admin') return true;
    
    // Super user has permissions for super and regular roles
    if (user.role === 'super') {
      return requiredRoles.some(role => role === 'super' || role === 'regular');
    }
    
    // Regular user only has regular permissions
    if (user.role === 'regular') {
      return requiredRoles.some(role => role === 'regular');
    }
    
    return false;
  };
  
  // Check if user can delete specific entity types
  const canDeleteEntity = (entityType: 'user' | 'group' | 'paymentUnit' | 'game'): boolean => {
    // Only admin can delete entities
    return user?.role === 'admin';
  };
  
  // Check if user can manage (create/edit) specific entity types
  const canManageEntity = (entityType: 'user' | 'group' | 'paymentUnit' | 'game'): boolean => {
    // לוג לבדיקה
    console.log(`Checking if user can manage ${entityType}, user role: ${user?.role}`);
    
    // בדיקה מיוחדת למשתמש האדמין הראשי (לפי אימייל)
    if (user?.email === 'elico.cohen@gmail.com' || user?.email === 'eli@nirvered.com') {
      console.log(`Admin detected by email: ${user.email}, granting all permissions`);
      return true;
    }
    
    // Admin and super users can manage entities
    return user?.role === 'admin' || user?.role === 'super';
  };
  
  // Context value
  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    logout,
    resetPassword,
    register,
    hasPermission,
    canDeleteEntity,
    canManageEntity,
    clearError,
    isOffline: false
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;