import { useAuth } from '@/contexts/AuthContext';

type UserRole = 'admin' | 'super' | 'regular';

/**
 * Hook לבדיקת תפקיד ותפקידי משתמש
 */
export function useUserRole() {
  const { user } = useAuth();

  const getUserRole = (): UserRole => {
    return user?.role || 'regular';
  };

  const isAdmin = (): boolean => {
    return getUserRole() === 'admin';
  };

  const isSuperUser = (): boolean => {
    return getUserRole() === 'super';
  };

  const isRegularUser = (): boolean => {
    return getUserRole() === 'regular';
  };

  const hasMinimumRole = (minimumRole: UserRole): boolean => {
    const currentRole = getUserRole();
    
    if (minimumRole === 'regular') return true;
    if (minimumRole === 'super') return currentRole === 'super' || currentRole === 'admin';
    if (minimumRole === 'admin') return currentRole === 'admin';
    
    return false;
  };

  return {
    userRole: getUserRole(),
    isAdmin,
    isSuperUser,
    isRegularUser,
    hasMinimumRole,
    getUserRole,
  };
} 