import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook נוח לבדיקות הרשאה ספציפיות
 */
export function useCan() {
  const {
    canAccessDashboard,
    canStartNewGame,
    canManageGame,
    canDeleteActiveGame,
    canDeleteCompletedGame,
    canViewGameAsReadOnly,
    canContinueGame,
    canAddPlayerToGame,
    canDeleteEntity
  } = useAuth();

  return {
    // בדיקות הרשאה כלליות
    accessDashboard: canAccessDashboard,
    deleteEntity: canDeleteEntity,
    
    // בדיקות הרשאה למשחקים
    startNewGame: canStartNewGame,
    manageGame: canManageGame,
    continueGame: canContinueGame,
    addPlayerToGame: canAddPlayerToGame,
    viewGameAsReadOnly: canViewGameAsReadOnly,
    
    // בדיקות הרשאה למחיקה
    deleteActiveGame: canDeleteActiveGame,
    deleteCompletedGame: canDeleteCompletedGame,
  };
} 