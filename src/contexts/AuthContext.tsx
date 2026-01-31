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
import { router } from 'expo-router';

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
  canStartNewGame: () => boolean;
  clearError: () => void;
  isOffline: boolean;
  canAccessDashboard: () => boolean;
  canManageGame: (gameData?: { createdBy?: string; status?: string }) => boolean;
  canDeleteActiveGame: (gameData?: { createdBy?: string; status?: string }) => boolean;
  canDeleteCompletedGame: () => boolean;
  canViewGameAsReadOnly: () => boolean;
  // New permission functions for game management
  canContinueGame: (gameData?: { createdBy?: string; status?: string }) => boolean;
  canAddPlayerToGame: (gameData?: { createdBy?: string; status?: string }) => boolean;
  canHandoffGame: (gameData?: { createdBy?: string; status?: string }) => boolean;
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

// הגדרת גלובל למעקב אחרי פונקציית המתנה לשמירות
let globalWaitForActiveSaves: (() => Promise<void>) | null = null;
let globalClearActiveGame: (() => Promise<void>) | null = null;

export const setGlobalWaitForActiveSaves = (fn: (() => Promise<void>) | null) => {
  globalWaitForActiveSaves = fn;
};

export const setGlobalClearActiveGame = (fn: (() => Promise<void>) | null) => {
  globalClearActiveGame = fn;
};

// Implementation of the AuthProvider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false); // דגל למניעת הפניה מעגלית
  
  // Initialize auth state
  useEffect(() => {
    let isMounted = true; // Track if component is still mounted

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Check if component is still mounted
      if (!isMounted) {
        console.log('AuthContext: Component unmounted, skipping auth state change');
        return;
      }

      // מניעת עיבוד במקרה של התנתקות פעילה
      if (isSigningOut) {
        console.log('AuthContext: התנתקות פעילה, מדלג על onAuthStateChanged');
        return;
      }
      
      setIsLoading(true);
      setError(null); // ניקוי שגיאות קודמות בתחילת התהליך
      try {
        if (firebaseUser) {
          // Check if session is still valid (within 24 hours)
          const sessionTimestamp = await AsyncStorage.getItem(AUTH_SESSION_KEY);
          if (sessionTimestamp) {
            const currentTime = Date.now();
            const sessionTime = parseInt(sessionTimestamp);
            
            if (currentTime - sessionTime > SESSION_DURATION) {
              // Session expired, log out
              console.log('AuthContext: הסשן פג תוקף, מתנתק');
              setIsSigningOut(true);
              await signOut(auth);
              await AsyncStorage.removeItem(AUTH_SESSION_KEY);
              setUser(null);
              setError('הסשן פג תוקף. אנא התחבר מחדש.');
              setIsLoading(false);
              setIsSigningOut(false);
              return;
            }
          }
          
          // Fetch user profile from Firestore using authUid
          try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('authUid', '==', firebaseUser.uid));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
              if (querySnapshot.docs.length > 1) {
                console.warn(`AuthContext: Multiple Firestore users found with the same authUid: ${firebaseUser.uid}. Using the first one.`);
                // Consider how to handle this case, e.g., log for admin, or pick based on other criteria.
              }
              const userDocSnapshot = querySnapshot.docs[0];
              const userData = userDocSnapshot.data() as Omit<UserProfile, 'id'>;
              
              if (!userData.isActive) {
                console.log('AuthContext: משתמש לא פעיל, מתנתק');
                setIsSigningOut(true);
                await signOut(auth);
                setUser(null);
                setError('חשבון זה אינו פעיל. צור קשר עם מנהל המערכת.');
                setIsLoading(false);
                setIsSigningOut(false);
                return;
              }
              
              const userProfile: UserProfile = {
                id: userDocSnapshot.id, // Use the Firestore document ID
                authUid: firebaseUser.uid, // Explicitly set authUid on the user object
                ...userData
              };

              setUser(userProfile);
              
              // Initialize syncService only if not already initialized and user is set
              if (!syncService.getIsInitialized()) {
                try {
                  await syncService.initialize();
                  console.log('AuthContext: SyncService initialized successfully');
                } catch (syncError) {
                  console.error('AuthContext: Failed to initialize SyncService:', syncError);
                  // Non-critical error, continue
                }
              }
              
            } else {
              // User record doesn't exist in Firestore with this authUid
              console.warn(`AuthContext: User with authUid ${firebaseUser.uid} (email: ${firebaseUser.email}) not found in Firestore by authUid. Attempting to find by email.`);
              
              // Attempt to find user by email as a fallback
              if (firebaseUser.email) {
                const qEmail = query(usersRef, where('email', '==', firebaseUser.email));
                const emailQuerySnapshot = await getDocs(qEmail);

                if (!emailQuerySnapshot.empty) {
                  if (emailQuerySnapshot.docs.length > 1) {
                     console.warn(`AuthContext: Multiple Firestore users found with the same email: ${firebaseUser.email} during onAuthStateChanged. Using the first one.`);
                  }
                  const userDocByEmailSnapshot = emailQuerySnapshot.docs[0];
                  const userDataByEmail = userDocByEmailSnapshot.data() as Omit<UserProfile, 'id'>;

                  if (!userDataByEmail.isActive) {
                    console.log('AuthContext: משתמש לא פעיל (נמצא לפי אימייל), מתנתק');
                    setIsSigningOut(true);
                    await signOut(auth);
                    setUser(null);
                    setError('חשבון זה אינו פעיל (נמצא לפי אימייל). צור קשר עם מנהל המערכת.');
                    setIsLoading(false);
                    setIsSigningOut(false);
                    return;
                  }

                  // Update the authUid in Firestore for this user
                  try {
                    await updateDoc(doc(db, 'users', userDocByEmailSnapshot.id), {
                      authUid: firebaseUser.uid,
                      updatedAt: serverTimestamp()
                    });
                    console.log(`AuthContext: Successfully updated authUid for user ${userDocByEmailSnapshot.id} found by email.`);
                  } catch (updateError) {
                    console.error(`AuthContext: Failed to update authUid for user ${userDocByEmailSnapshot.id} found by email:`, updateError);
                    // Decide if this is a critical error. For now, proceed with setting the user.
                  }

                  const userProfile: UserProfile = {
                    id: userDocByEmailSnapshot.id,
                    authUid: firebaseUser.uid,
                    ...userDataByEmail
                  };

                  setUser(userProfile);
                  
                  // Initialize syncService only if not already initialized
                  if (!syncService.getIsInitialized()) {
                    try {
                      await syncService.initialize();
                      console.log('AuthContext: SyncService initialized successfully after email fallback');
                    } catch (syncError) {
                      console.error('AuthContext: Failed to initialize SyncService after email fallback:', syncError);
                      // Non-critical error, continue
                    }
                  }

                } else {
                  console.warn(`AuthContext: User with authUid ${firebaseUser.uid} also not found by email ${firebaseUser.email}. Logging out.`);
                  setIsSigningOut(true);
                  await signOut(auth);
                  setUser(null);
                  setError('פרטי המשתמש לא נמצאו במערכת. אנא נסה להתחבר מחדש או צור קשר עם התמיכה.');
                  setIsSigningOut(false);
                }
              } else {
                // No email to fallback on
                console.warn(`AuthContext: User with authUid ${firebaseUser.uid} not found in Firestore and no email provided for fallback. Logging out.`);
                setIsSigningOut(true);
                await signOut(auth);
                setUser(null);
                setError('פרטי המשתמש לא אותרו. צור קשר עם מנהל המערכת.');
                setIsSigningOut(false);
              }
            }
          } catch (firestoreError: any) {
            console.error('AuthContext: Error accessing Firestore during onAuthStateChanged:', firestoreError);
            
            // במקרה של שגיאת הרשאות, לא נתנתק - רק נראה הודעת שגיאה
            if (firestoreError.toString().includes('Missing or insufficient permissions')) {
              console.log('AuthContext: שגיאת הרשאות - לא מתנתק, מחכה לרשת');
              if (isMounted) {
                setError('בעיית חיבור לשרת. מנסה שוב...');
              }
              // נותן זמן לרשת להתחבר ולא מתנתק
              setTimeout(() => {
                if (isMounted && error && error.includes('בעיית חיבור לשרת')) {
                  setError(null);
                }
              }, 5000);
            } else {
              // Generic error, log out user
              if (isMounted) {
                setIsSigningOut(true);
                await signOut(auth);
                setUser(null);
                setError('שגיאה בגישה למידע המשתמש. אנא נסה מאוחר יותר.');
                setIsSigningOut(false);
              }
            }
          }
        } else {
          console.log('AuthContext: אין משתמש מחובר, מנקה נתונים');
          if (isMounted) {
            setUser(null);
          }
          syncService.cleanup();
          await AsyncStorage.removeItem(AUTH_SESSION_KEY);
        }
      } catch (err) {
        console.error('AuthContext: Error in onAuthStateChanged:', err);
        if (isMounted) {
          setError('שגיאה בטעינת פרופיל משתמש');
          setUser(null);
        }
        // Ensure sign out if there's an unexpected error, but avoid circular calls
        if (auth.currentUser && !isSigningOut && isMounted) {
            setIsSigningOut(true);
            await signOut(auth);
            setIsSigningOut(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    });

    // Cleanup subscription
    return () => {
      console.log('AuthContext: Cleaning up auth state listener');
      isMounted = false;
      unsubscribe();
    };
  }, []); // Empty dependency array - only run once on mount
  
  // Clear error
  const clearError = () => {
    setError(null);
  };
  
  // Login function
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('AuthContext: attempting login for:', email);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseAuthUser = userCredential.user;
      console.log('AuthContext: Firebase authentication successful, uid:', firebaseAuthUser.uid);
      
      // Firebase Auth successful, now get user profile from Firestore using authUid
      try {
        const usersRef = collection(db, 'users');
        // Primary query: by authUid
        const qAuthUid = query(usersRef, where('authUid', '==', firebaseAuthUser.uid));
        let querySnapshot = await getDocs(qAuthUid);
        let userDocSnapshot: any; // Explicitly type if possible, using 'any' for brevity in example

        if (!querySnapshot.empty) {
          if (querySnapshot.docs.length > 1) {
            console.warn(`AuthContext: Multiple Firestore users found with the same authUid: ${firebaseAuthUser.uid} during login. Using the first one.`);
          }
          userDocSnapshot = querySnapshot.docs[0];
        } else {
          // Fallback: if no user found by authUid, try by email (and then update authUid)
          console.warn(`AuthContext: User with authUid ${firebaseAuthUser.uid} not found in Firestore during login. Attempting to find by email.`);
          if (firebaseAuthUser.email) {
            const qEmail = query(usersRef, where('email', '==', firebaseAuthUser.email));
            const emailQuerySnapshot = await getDocs(qEmail);
            if (!emailQuerySnapshot.empty) {
              if (emailQuerySnapshot.docs.length > 1) {
                console.warn(`AuthContext: Multiple Firestore users found with the same email: ${firebaseAuthUser.email} during login fallback. Using the first one.`);
              }
              userDocSnapshot = emailQuerySnapshot.docs[0];
              // Update authUid in Firestore as it was missing or incorrect
              try {
                await updateDoc(doc(db, 'users', userDocSnapshot.id), {
                  authUid: firebaseAuthUser.uid,
                  updatedAt: serverTimestamp()
                });
                console.log(`AuthContext: Successfully updated authUid for user ${userDocSnapshot.id} found by email during login.`);
              } catch (updateError) {
                console.error(`AuthContext: Failed to update authUid for user ${userDocSnapshot.id} found by email during login:`, updateError);
                // Continue without this update, but log it
              }
            } else {
              console.error(`AuthContext: User not found by authUid NOR by email (${firebaseAuthUser.email}) during login.`);
              setError('פרטי המשתמש אינם קיימים במערכת. אנא ודא שהאימייל שהזנת נכון או פנה למנהל.');
              await signOut(auth); // Sign out from Firebase Auth as well
              setIsLoading(false);
              return;
            }
          } else {
            console.error('AuthContext: User not found by authUid and no email available on firebaseAuthUser for fallback during login.');
            setError('שגיאה באימות. לא ניתן לאתר את פרטי המשתמש.');
            await signOut(auth);
            setIsLoading(false);
            return;
          }
        }

        const userData = userDocSnapshot.data() as Omit<UserProfile, 'id'>;

        if (!userData.isActive) {
          setError('חשבון זה אינו פעיל. צור קשר עם מנהל המערכת.');
          await signOut(auth);
          setIsLoading(false);
          return;
        }

        // Check for mustChangePassword - לוגיקה זו מושבתת זמנית לצורך פיתוח ובדיקות
        /*
        if (userData.mustChangePassword) {
          setError('נדרש שינוי סיסמה. אנא פנה למנהל המערכת לסיוע.'); // Placeholder message
          // TODO: Implement password change flow. For now, we block login.
          // Example: setPasswordChangeRequired(true); and navigate to a change password screen.
          await signOut(auth); // Sign out user until password is changed
          setIsLoading(false);
          return;
        }
        */
        
        const userProfile: UserProfile = {
          id: userDocSnapshot.id, // Use the Firestore document ID
          authUid: firebaseAuthUser.uid, // Ensure authUid is set from the authenticated user
          ...userData,
        };

        setUser(userProfile);
        await AsyncStorage.setItem(AUTH_SESSION_KEY, Date.now().toString());
        await updateUserLastLogin(userProfile.id);
        console.log('AuthContext: Login successful, user profile set:', userProfile);

        // Initialize syncService after successful login and profile retrieval
        try {
          await syncService.initialize();
          console.log('AuthContext: SyncService initialized successfully after login');
        } catch (syncError) {
          console.error('AuthContext: Failed to initialize SyncService after login:', syncError);
          // Non-critical error for login itself, but should be monitored
        }

      } catch (firestoreError: any) {
        console.error('AuthContext: Firestore error during login:', firestoreError);
        setError(`שגיאה בטעינת פרופיל המשתמש: ${firestoreError.message || 'נסה שוב מאוחר יותר'}`);
        await signOut(auth); // Sign out from Firebase to be safe
      }
    } catch (authError: any) {
      console.error('AuthContext: Firebase authentication error during login:', authError);
      if (authError.code === 'auth/user-not-found' || authError.code === 'auth/wrong-password' || authError.code === 'auth/invalid-credential') {
        setError('אימייל או סיסמה שגויים.');
      } else {
        setError(`שגיאת התחברות: ${authError.message || 'נסה שוב מאוחר יותר'}`);
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
      // חכה לסיום שמירות פעילות לפני התנתקות
      if (globalWaitForActiveSaves && typeof globalWaitForActiveSaves === 'function') {
        try {
          console.log('AuthContext: waiting for active saves to complete');
          await globalWaitForActiveSaves();
        } catch (saveError) {
          console.error('AuthContext: Error waiting for saves, but continuing with logout:', saveError);
        }
      }
      
      // נקה את המשחק הפעיל אחרי שהשמירות הסתיימו
      if (globalClearActiveGame && typeof globalClearActiveGame === 'function') {
        try {
          console.log('AuthContext: clearing active game');
          await globalClearActiveGame();
        } catch (clearError) {
          console.error('AuthContext: Error clearing active game, but continuing with logout:', clearError);
        }
      }
      
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

      // Clear navigation stack and go to login
      // This prevents Android back button from returning to protected screens
      console.log('AuthContext: clearing navigation stack');
      while (router.canGoBack()) {
        router.back();
      }
      router.replace('/login');
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
      const firebaseAuthUser = userCredential.user;
      const now = Date.now();
      
      // יצירת מסמך משתמש ב-Firestore עם authUid כשדה נפרד
      // ו-Document ID שנוצר אוטומטית.
      const newFirestoreUserDocRef = doc(collection(db, 'users')); // יוצר Document ID אוטומטי

      const newUserFirestoreData: Omit<UserProfile, 'id'> & { authUid: string } = {
        name: name,
        email: email,
        isActive: true,
        role: 'regular' as UserRole, 
        createdAt: now,
        updatedAt: now,
        phone: '', 
        paymentUnitId: '',
        authUid: firebaseAuthUser.uid // שמירת ה-authUid
      };
      
      await setDoc(newFirestoreUserDocRef, newUserFirestoreData);
      
      await AsyncStorage.setItem(AUTH_SESSION_KEY, Date.now().toString());
      
      const newUserProfile: UserProfile = {
        id: newFirestoreUserDocRef.id, // שימוש ב-ID החדש שנוצר
        ...newUserFirestoreData
      };

      setUser(newUserProfile);
      
    } catch (err: any) {
      console.error('AuthContext: Registration error:', err);
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
    
    // Admin and super users can manage entities
    return user?.role === 'admin' || user?.role === 'super';
  };
  
  // Check if user can start a new game (basic role check)
  const canStartNewGame = (): boolean => {
    if (!user) return false;

    // Admin and super users can attempt to start a new game
    // More specific checks (e.g., active games for super user) should be done by the calling component/service
    return user.role === 'admin' || user.role === 'super';
  };
  
  // Check if user can access dashboard - only admin
  const canAccessDashboard = (): boolean => {
    return user?.role === 'admin';
  };
  
  // Check if user can manage a specific game
  const canManageGame = (gameData?: { createdBy?: string; status?: string }): boolean => {
    if (!user) return false;

    // Admin can manage any game
    if (user.role === 'admin') return true;

    // Super user can manage only games they created
    // Compare with authUid (createdBy stores authUid, not Firestore user.id)
    if (user.role === 'super' && gameData?.createdBy === user.authUid) return true;

    // Regular users cannot manage games
    return false;
  };
  
  // Check if user can delete active games
  const canDeleteActiveGame = (gameData?: { createdBy?: string; status?: string }): boolean => {
    if (!user) return false;

    // Admin can delete any game
    if (user.role === 'admin') return true;

    // Super user can delete only active games they created
    // Compare with authUid (createdBy stores authUid, not Firestore user.id)
    if (user.role === 'super' &&
        gameData?.createdBy === user.authUid &&
        gameData?.status !== 'completed') {
      return true;
    }

    // Additional check for UID mismatch cases (same as canContinueGame)
    // This handles legacy games or fallback scenarios
    if (user.role === 'super' &&
        gameData?.createdBy &&
        gameData.createdBy !== user.authUid &&
        gameData?.status !== 'completed') {
      console.log(`canDeleteActiveGame: Different UID detected - ${gameData.createdBy} vs ${user.authUid}`);
      console.log(`canDeleteActiveGame: Allowing super user to potentially delete (will be validated in game loading)`);
      return true;
    }

    // Regular users cannot delete games
    return false;
  };
  
  // Check if user can delete completed games - only admin
  const canDeleteCompletedGame = (): boolean => {
    return user?.role === 'admin';
  };
  
  // Check if user can view games in read-only mode - all authenticated users
  const canViewGameAsReadOnly = (): boolean => {
    return !!user && (user.role === 'admin' || user.role === 'super' || user.role === 'regular');
  };
  
  // New permission functions for game management
  const canContinueGame = (gameData?: { createdBy?: string; status?: string }): boolean => {
    if (!user) return false;

    // Admin can continue any game
    if (user.role === 'admin') return true;

    // Super user can continue only games they created
    // Compare with authUid (createdBy stores authUid, not Firestore user.id)
    if (user.role === 'super' && gameData?.createdBy === user.authUid) return true;
    
    // Additional check: if user email matches the creator's email (for UID mismatch cases)
    // This handles the case where Firebase Auth generated different UIDs for the same user
    if (user.role === 'super' && gameData?.createdBy && gameData.createdBy !== user.authUid) {
      // Note: This additional check would require access to user profiles
      // For now, we'll let the game loading logic handle this through the fallback search
      console.log(`canContinueGame: Different UID detected - ${gameData.createdBy} vs ${user.authUid}`);
      console.log(`canContinueGame: Allowing super user to potentially continue (will be validated in game loading)`);
      // Temporarily allow super users to attempt continuation - the actual validation happens in game loading
      return true;
    }

    // Regular users cannot continue games
    return false;
  };

  const canAddPlayerToGame = (gameData?: { createdBy?: string; status?: string }): boolean => {
    if (!user) return false;

    // Admin can add player to any game
    if (user.role === 'admin') return true;

    // Super user can add player to only games they created
    // Compare with authUid (createdBy stores authUid, not Firestore user.id)
    if (user.role === 'super' && gameData?.createdBy === user.authUid) return true;

    // Regular users cannot add player to games
    return false;
  };

  const canHandoffGame = (gameData?: { createdBy?: string; status?: string }): boolean => {
    if (!user) return false;

    // Cannot hand off completed games
    if (gameData?.status === 'completed') return false;

    // Admin can hand off any game
    if (user.role === 'admin') return true;

    // Super user can hand off only games they created (and not completed)
    // Compare with authUid (createdBy stores authUid, not Firestore user.id)
    if (user.role === 'super' && gameData?.createdBy === user.authUid) return true;

    // Regular users cannot hand off games
    return false;
  };

  // Context value
  const value: AuthContextType = {
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
    canStartNewGame,
    clearError,
    isOffline: false,
    canAccessDashboard,
    canManageGame,
    canDeleteActiveGame,
    canDeleteCompletedGame,
    canViewGameAsReadOnly,
    canContinueGame,
    canAddPlayerToGame,
    canHandoffGame
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;