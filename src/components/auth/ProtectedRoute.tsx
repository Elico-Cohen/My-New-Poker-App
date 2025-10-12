// src/components/auth/ProtectedRoute.tsx
import React, { useEffect, createContext, useContext } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Text } from '@/components/common/Text';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/models/UserProfile';
import { router } from 'expo-router'; // Import router for navigation

// Context למצב קריאה בלבד
interface ReadOnlyContextType {
  isReadOnlyMode: boolean;
}

const ReadOnlyContext = createContext<ReadOnlyContextType>({ isReadOnlyMode: false });

export const useReadOnlyMode = () => useContext(ReadOnlyContext);

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole | UserRole[]; // Make it optional
  /** אפשר מצב קריאה בלבד למשתמשים רגילים */
  allowReadOnlyMode?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole, allowReadOnlyMode }) => {
  const { user, isAuthenticated, isLoading, hasPermission } = useAuth();
  
  useEffect(() => {
    // רק לוג על התחברות/התנתקות, לא בכל רנדור
    if (!isLoading && !isAuthenticated) {
      console.log("ProtectedRoute: User not authenticated, redirecting to /login");
      router.replace('/login'); // Redirect to login if not authenticated and not loading
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading) {
    // מוריד את הלוג של מצב הטעינה שמתעדכן כל הזמן
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>טוען...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    // This case should ideally be handled by the useEffect redirect,
    // but as a fallback, show a message or a minimal UI.
    return (
      <View style={styles.container}>
        <Text style={styles.messageText}>יש להתחבר למערכת</Text>
      </View>
    );
  }

  // If no specific role is required, allow access for any authenticated user
  if (requiredRole && !hasPermission(requiredRole)) {
    // בדוק אם מצב קריאה בלבד מאופשר ומשתמש רגיל
    if (allowReadOnlyMode && user?.role === 'regular') {
      console.log(`ProtectedRoute: User is regular but read-only mode is allowed. Rendering in read-only mode.`);
      return (
        <ReadOnlyContext.Provider value={{ isReadOnlyMode: true }}>
          {children}
        </ReadOnlyContext.Provider>
      );
    }
    
    console.log(`ProtectedRoute: User does not have required role. User role: ${user?.role}, Required: ${JSON.stringify(requiredRole)}`);
    return (
      <View style={styles.container}>
        <Text style={styles.messageText}>אין לך הרשאה לגשת לדף זה.</Text>
        <Text style={styles.messageTextSmall}>(נדרשת הרשאת: {Array.isArray(requiredRole) ? requiredRole.join(', ') : requiredRole})</Text>
      </View>
    );
  }

  // מוריד את הלוג של הצלחה שמתעדכן כל הזמן
  return (
    <ReadOnlyContext.Provider value={{ isReadOnlyMode: false }}>
      {children}
    </ReadOnlyContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0D1B1E', // Or your theme background
    padding: 20,
  },
  loadingText: {
    color: '#FFD700', // Or your theme primary color
    marginTop: 20,
    fontSize: 16,
  },
  messageText: {
    color: '#FFFFFF', // Or your theme text color
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 10,
  },
  messageTextSmall: {
    color: '#B0B0B0', // Or your theme secondary text color
    fontSize: 14,
    textAlign: 'center',
  }
});

export default ProtectedRoute;