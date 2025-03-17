// src/app/offline.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { router } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';

const CASINO_COLORS = {
  background: '#0D1B1E',
  primary: '#35654d',
  gold: '#FFD700',
  surface: '#1C2C2E',
  text: '#FFFFFF',
  error: '#ef4444',
  warning: '#f59e0b'
};

export default function OfflineScreen() {
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  
  // Auto-check for connection and redirect when back online
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        // When connection is restored, redirect to home
        router.replace('/(tabs)/home2');
      }
    });
    
    return () => unsubscribe();
  }, []);
  
  // Manually check connection
  const checkConnection = async () => {
    setIsCheckingConnection(true);
    
    try {
      const state = await NetInfo.fetch();
      
      if (state.isConnected) {
        router.replace('/(tabs)/home2');
      } else {
        // Still offline, show error message or update UI
        setIsCheckingConnection(false);
      }
    } catch (error) {
      console.error('Error checking connection:', error);
      setIsCheckingConnection(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Icon name="wifi-off" size="xlarge" color={CASINO_COLORS.warning} />
      </View>
      
      <Text variant="h3" style={styles.title}>אין חיבור לאינטרנט</Text>
      
      <Text style={styles.message}>
        אין חיבור לאינטרנט כרגע. חלק מהתכונות באפליקציה דורשות חיבור פעיל.
      </Text>
      
      <Text style={styles.submessage}>
        בדוק את החיבור שלך ונסה שוב.
      </Text>
      
      <View style={styles.buttonsContainer}>
        <Button
          title={isCheckingConnection ? "בודק חיבור..." : "בדוק חיבור שוב"}
          onPress={checkConnection}
          style={styles.checkButton}
          textStyle={styles.buttonText}
          loading={isCheckingConnection}
          disabled={isCheckingConnection}
        />
        
        <TouchableOpacity 
          style={styles.offlineLink}
          onPress={() => router.push('/(tabs)/home2')}
        >
          <Text style={styles.offlineText}>המשך למצב לא מקוון</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.featuresContainer}>
        <Text style={styles.featuresTitle}>תכונות זמינות במצב לא מקוון:</Text>
        
        <View style={styles.featureItem}>
          <Icon name="check-circle" size="small" color={CASINO_COLORS.primary} />
          <Text style={styles.featureText}>צפייה בנתוני משחק</Text>
        </View>
        
        <View style={styles.featureItem}>
          <Icon name="check-circle" size="small" color={CASINO_COLORS.primary} />
          <Text style={styles.featureText}>סטטיסטיקות בסיסיות</Text>
        </View>
        
        <View style={styles.featureItem}>
          <Icon name="close-circle" size="small" color={CASINO_COLORS.error} />
          <Text style={styles.featureText}>יצירת משחקים חדשים</Text>
        </View>
        
        <View style={styles.featureItem}>
          <Icon name="close-circle" size="small" color={CASINO_COLORS.error} />
          <Text style={styles.featureText}>עדכון נתונים</Text>
        </View>
      </View>
    </View>
  );
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
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: CASINO_COLORS.warning,
  },
  title: {
    color: CASINO_COLORS.warning,
    marginBottom: 16,
    fontSize: 28,
  },
  message: {
    color: CASINO_COLORS.text,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 16,
  },
  submessage: {
    color: CASINO_COLORS.text,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    opacity: 0.8,
  },
  buttonsContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 32,
  },
  checkButton: {
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
  offlineLink: {
    marginTop: 16,
    paddingVertical: 8,
  },
  offlineText: {
    color: CASINO_COLORS.gold,
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  featuresContainer: {
    width: '100%',
    backgroundColor: CASINO_COLORS.surface,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
  },
  featuresTitle: {
    color: CASINO_COLORS.gold,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  featureItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    color: CASINO_COLORS.text,
    marginRight: 8,
    fontSize: 16,
    textAlign: 'right',
  },
});