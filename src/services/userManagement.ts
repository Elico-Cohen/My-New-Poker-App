import { db } from '@/config/firebase';
import { collection, doc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { UserProfile, UserRole } from '@/models/UserProfile';

export interface UpdateUserRoleParams {
  userId: string;
  newRole: UserRole;
  updatedBy: string;
}

/**
 * Update user role (admin only)
 * Validates that user cannot change their own role and cannot remove last admin
 */
export const updateUserRole = async (params: UpdateUserRoleParams): Promise<void> => {
  const { userId, newRole, updatedBy } = params;

  // Validation: cannot change own role
  if (userId === updatedBy) {
    throw new Error('לא ניתן לשנות את התפקיד שלך');
  }

  // Validation: check if user is last admin
  if (newRole !== 'admin') {
    const usersRef = collection(db, 'users');
    const adminsQuery = query(usersRef, where('role', '==', 'admin'), where('isActive', '==', true));
    const adminsSnapshot = await getDocs(adminsQuery);

    // Check if this is the last active admin
    const activeAdmins = adminsSnapshot.docs.filter(doc => doc.id !== userId);
    if (activeAdmins.length === 0) {
      // Check if the user being modified is an admin
      const userDoc = adminsSnapshot.docs.find(doc => doc.id === userId);
      if (userDoc) {
        throw new Error('לא ניתן לשנות תפקיד של המנהל האחרון במערכת');
      }
    }
  }

  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      role: newRole,
      updatedAt: Date.now()
    });

    console.log(`✓ User ${userId} role updated to ${newRole}`);
  } catch (error: any) {
    console.error('Error updating user role:', error);
    // Preserve original error context
    throw new Error(`שגיאה בעדכון תפקיד המשתמש: ${error.message || 'נסה שוב מאוחר יותר'}`);
  }
};

/**
 * Toggle user active status (admin only)
 * Validates that user cannot deactivate themselves
 */
export const toggleUserActiveStatus = async (
  userId: string,
  isActive: boolean,
  updatedBy: string
): Promise<void> => {
  // Validation: cannot deactivate self
  if (userId === updatedBy && !isActive) {
    throw new Error('לא ניתן להשבית את החשבון שלך');
  }

  // Additional validation: cannot deactivate last active admin
  if (!isActive) {
    const usersRef = collection(db, 'users');
    const userDocRef = doc(db, 'users', userId);
    const userSnapshot = await getDocs(query(usersRef, where('__name__', '==', userId)));

    if (!userSnapshot.empty) {
      const userData = userSnapshot.docs[0].data() as UserProfile;

      if (userData.role === 'admin') {
        const adminsQuery = query(
          usersRef,
          where('role', '==', 'admin'),
          where('isActive', '==', true)
        );
        const adminsSnapshot = await getDocs(adminsQuery);

        // Check if this is the last active admin
        const activeAdmins = adminsSnapshot.docs.filter(doc => doc.id !== userId);
        if (activeAdmins.length === 0) {
          throw new Error('לא ניתן להשבית את המנהל האחרון הפעיל במערכת');
        }
      }
    }
  }

  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      isActive,
      updatedAt: Date.now()
    });

    console.log(`✓ User ${userId} active status set to ${isActive}`);
  } catch (error: any) {
    console.error('Error updating user status:', error);
    // Preserve original error context
    throw new Error(`שגיאה בעדכון סטטוס המשתמש: ${error.message || 'נסה שוב מאוחר יותר'}`);
  }
};

/**
 * Require password change for a user (admin only)
 */
export const requirePasswordChange = async (
  userId: string,
  updatedBy: string
): Promise<void> => {
  // Validation: cannot require password change for self
  if (userId === updatedBy) {
    throw new Error('לא ניתן לדרוש שינוי סיסמה עבור עצמך');
  }

  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      mustChangePassword: true,
      updatedAt: Date.now()
    });

    console.log(`✓ Password change required for user ${userId}`);
  } catch (error: any) {
    console.error('Error requiring password change:', error);
    // Preserve original error context
    throw new Error(`שגיאה בדרישת שינוי סיסמה: ${error.message || 'נסה שוב מאוחר יותר'}`);
  }
};
