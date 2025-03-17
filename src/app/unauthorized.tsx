// src/app/unauthorized.tsx
import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';

const CASINO_COLORS = {
  background: '#0D1B1E',
  primary: '#35654d',
  gold: '#FFD700',
  surface: '#1C2C2E',
  text: '#FFFFFF',
  error: '#ef4444'
};

export default function UnauthorizedScreen() {
  const { logout, user } = useAuth();

  const handleGoHome = () => {
    router.replace('/(tabs)/home2');
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Icon name="lock" size="xlarge" color={CASINO_COLORS.error} />
      </View>
      
      <Text variant="h3" style={styles.title}>אין גישה</Text>
      
      <Text style={styles.message}>
        אין לך הרשאות מספיקות לגשת לדף זה.
      </Text>
      
      <Text style={styles.roleInfo}>
        התפקיד שלך: {getRoleDisplay(user?.role || 'regular')}
      </Text>
      
      <View style={styles.buttonsContainer}>
        <Button
          title="חזור לדף הבית"
          onPress={handleGoHome}
          style={styles.homeButton}
          textStyle={styles.buttonText}
        />
        
        <TouchableOpacity 
          style={styles.logoutLink}
          onPress={logout}
        >
          <Text style={styles.logoutText}>התנתק</Text>
        </TouchableOpacity>
      </View>
      
      <Text style={styles.helpText}>
        אם אתה סבור שמדובר בטעות, אנא פנה למנהל המערכת.
      </Text>
    </View>
  );
}

// Helper function to display role in Hebrew
function getRoleDisplay(role: string): string {
  switch (role) {
    case 'admin':
      return 'מנהל מערכת';
    case 'super':
      return 'משתמש מתקדם';
    case 'regular':
      return 'משתמש רגיל';
    default:
      return role;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CASINO_COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  iconContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: CASINO_COLORS.error,
  },
  title: {
    color: CASINO_COLORS.error,
    marginBottom: 16,
    fontSize: 28,
  },
  message: {
    color: CASINO_COLORS.text,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 16,
  },
  roleInfo: {
    color: CASINO_COLORS.gold,
    fontSize: 16,
    marginBottom: 32,
  },
  buttonsContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 32,
  },
  homeButton: {
    backgroundColor: CASINO_COLORS.primary,
    borderColor: CASINO_COLORS.gold,
    borderWidth: 2,
    paddingVertical: 14,
    width: '80%',
  },
  buttonText: {
    color: CASINO_COLORS.gold,
    fontSize: 18,
  },
  logoutLink: {
    marginTop: 16,
    paddingVertical: 8,
  },
  logoutText: {
    color: CASINO_COLORS.gold,
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  helpText: {
    color: CASINO_COLORS.text,
    opacity: 0.7,
    textAlign: 'center',
  },
});