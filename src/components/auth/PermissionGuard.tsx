import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useUserRole } from '@/hooks/useUserRole';
import { lightTheme } from '@/theme/colors';

type UserRole = 'admin' | 'super' | 'regular';

interface PermissionGuardProps {
  /** תפקיד מינימלי נדרש */
  requiredRole?: UserRole;
  /** פונקציה מותאמת לבדיקת הרשאה */
  checkPermission?: () => boolean;
  /** תוכן שיוצג אם יש הרשאה */
  children: React.ReactNode;
  /** תוכן שיוצג אם אין הרשאה (אופציונלי) */
  fallback?: React.ReactNode;
  /** האם להציג הודעה ברירת מחדל אם אין הרשאה */
  showFallbackMessage?: boolean;
  /** הודעת שגיאה מותאמת */
  fallbackMessage?: string;
  /** פונקציה שתופעל בלחיצה על הודעת השגיאה */
  onUnauthorized?: () => void;
}

/**
 * רכיב לעטיפת תוכן בהתאם להרשאות משתמש
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  requiredRole,
  checkPermission,
  children,
  fallback,
  showFallbackMessage = false,
  fallbackMessage = "אין לך הרשאה לגשת לתוכן זה.",
  onUnauthorized
}) => {
  const { hasMinimumRole } = useUserRole();

  // בדיקת הרשאה
  const hasPermission = checkPermission 
    ? checkPermission() 
    : requiredRole 
      ? hasMinimumRole(requiredRole)
      : true;

  // אם יש הרשאה, הצג את התוכן
  if (hasPermission) {
    return <>{children}</>;
  }

  // אם אין הרשאה והוגדר fallback, הצג אותו
  if (fallback) {
    return <>{fallback}</>;
  }

  // אם אין הרשאה ונדרש להציג הודעה
  if (showFallbackMessage) {
    return (
      <TouchableOpacity 
        style={styles.fallbackContainer}
        onPress={onUnauthorized}
        disabled={!onUnauthorized}
      >
        <Text style={styles.fallbackText}>{fallbackMessage}</Text>
      </TouchableOpacity>
    );
  }

  // אם אין הרשאה ולא הוגדר fallback, אל תציג כלום
  return null;
};

const styles = StyleSheet.create({
  fallbackContainer: {
    padding: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    alignItems: 'center',
    margin: 8,
  },
  fallbackText: {
    color: lightTheme.error,
    fontSize: 14,
    textAlign: 'center',
  },
}); 