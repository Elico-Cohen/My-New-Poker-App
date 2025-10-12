// src/app/statistics/_layout.tsx
import React from 'react';
import { Stack } from 'expo-router';
import Colors from '@/theme/colors';
import { useColorScheme } from '@/components/useColorScheme';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function StatisticsLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  
  console.log("StatisticsLayout: מרנדר את מסך הסטטיסטיקות");
  
  return (
    // All authenticated users can access statistics
    <ProtectedRoute>
      <Stack
        screenOptions={{
          headerShown: false,
          header: () => null,
          title: '',
          contentStyle: {
            backgroundColor: '#0D1B1E', // Use consistent background color
          },
        }}
      >
        {/* מסך הסטטיסטיקות הראשי */}
        <Stack.Screen 
          name="index"
          options={{
            headerShown: false,
            header: () => null
          }}
        />
        
        {/* מסך סטטיסטיקת משחקים */}
        <Stack.Screen 
          name="games"
          options={{
            headerShown: false,
            header: () => null
          }}
        />
        
        {/* מסכי סטטיסטיקה אחרים */}
        <Stack.Screen 
          name="openGames"
          options={{
            headerShown: false,
            header: () => null
          }}
        />
        
        <Stack.Screen 
          name="rebuys"
          options={{
            headerShown: false,
            header: () => null
          }}
        />
        
        <Stack.Screen 
          name="winnersLosers"
          options={{
            headerShown: false,
            header: () => null
          }}
        />
        
        <Stack.Screen 
          name="playerStats"
          options={{
            headerShown: false,
            header: () => null
          }}
        />
        
        <Stack.Screen 
          name="participation"
          options={{
            headerShown: false,
            header: () => null
          }}
        />
      </Stack>
    </ProtectedRoute>
  );
}