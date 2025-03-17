// src/components/auth/ProtectedRoute.tsx
import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Text } from '@/components/common/Text';
import { useAuth } from '@/contexts/AuthContext';

// הקומפוננטה פשוטה ביותר, רק מציגה את הילדים שלה
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoading } = useAuth();
  
  useEffect(() => {
    console.log("ProtectedRoute: Simplified version mounted");
  }, []);

  // מציג מסך טעינה רק במצב הטעינה הראשוני
  if (isLoading) {
    console.log("ProtectedRoute: Rendering loading state");
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0D1B1E' }}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={{ color: '#FFD700', marginTop: 20 }}>טוען...</Text>
      </View>
    );
  }

  // תמיד מציג את הילדים בכל מקרה אחר
  console.log("ProtectedRoute: Rendering children (simplified)");
  return <>{children}</>;
};

export default ProtectedRoute;