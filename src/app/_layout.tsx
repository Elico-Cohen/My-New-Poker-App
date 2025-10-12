import * as React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';
import { TouchableOpacity, Text, View } from 'react-native';
import { useAuth, AuthProvider } from '@/contexts/AuthContext';
import { GameProvider } from '@/contexts/GameContext';
import { useColorScheme } from '../../src/components/useColorScheme';
import Colors from '@/theme/colors';
import { migrateGameDates } from '@/services/migrations';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import Toast from 'react-native-toast-message';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // הגדרות יציבות יותר למערכת הניווט
  initialRouteName: 'index',
  animations: {
    // אנימציות שמתאימות למערכת הניווט
    push: {
      screen: {
        animation: 'default',
      },
    },
    // אנימציה חלקה יותר להחלפה בין מסכים
    replace: {
      screen: {
        animation: 'none',
      },
    },
  },
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

let isInitialNavigation = true;

export default function RootLayout() {
  const [fontsLoaded, fontsError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceMono: require('../../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // @ts-ignore - מתעלמים מסוג ה-useEffect
  React.useEffect(() => {
    if (fontsError) throw fontsError;
  }, [fontsError]);

  // @ts-ignore - מתעלמים מסוג ה-useEffect
  React.useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
      // Run data migration after fonts are loaded and splash screen is hidden
      migrateGameDates()
        .then(() => console.log('Migration check completed'))
        .catch(error => console.error('Migration check failed:', error));
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  // Wrap the entire app with AuthProvider and GameProvider
  return (
    <AuthProvider>
      <GameProvider>
      <RootLayoutNav />
      </GameProvider>
    </AuthProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { isAuthenticated, isLoading } = useAuth();
  
  // לוג פשוט מאוד, ללא ניווטים אוטומטיים - זה בעייתי
  console.log('RootLayoutNav rendered', { isAuthenticated, isLoading });
  
  return (
    <>
      <Stack>
        {/* מסך אינדקס - יגיע למסך הלוגין באמצעות Redirect */}
        <Stack.Screen 
          name="index" 
          options={{ 
            headerShown: false,
            animation: 'none'
          }}
        />
        
        {/* מסך לוגין */}
        <Stack.Screen 
          name="login" 
          options={{ 
            headerShown: false,
            animation: 'none'
          }}
        />
        
        {/* מסך רישום */}
        <Stack.Screen 
          name="register" 
          options={{ 
            title: 'הרשמה',
            headerShown: false,
            animation: 'slide_from_right'
          }}
        />
        
        {/* מסך דשבורד */}
        <Stack.Screen 
          name="dashboard" 
          options={{ 
            headerShown: false,
            animation: 'fade'
          }}
        />
        
        {/* מסכי טאבים */}
        <Stack.Screen 
          name="(tabs)" 
          options={{ 
            headerShown: false,
            animation: 'fade'
          }}
        />
        
        {/* מסכי היסטוריה */}
        <Stack.Screen 
          name="history" 
          options={{ 
            headerShown: false,
            animation: 'slide_from_right'
          }}
        />
        
        {/* מסכי סטטיסטיקות */}
        <Stack.Screen 
          name="statistics" 
          options={{ 
            headerShown: false,
            animation: 'slide_from_right'
          }}
        />

        {/* מסכי גיים פלו */}
        <Stack.Screen 
          name="gameFlow" 
          options={{ 
            headerShown: false,
            animation: 'slide_from_right'
          }}
        />
      </Stack>
      <Toast />
    </>
  );
}