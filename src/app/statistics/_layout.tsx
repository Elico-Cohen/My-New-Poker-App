// src/app/statistics/_layout.tsx
import React from 'react';
import { Stack } from 'expo-router';
import Colors from '@/theme/colors';
import { useColorScheme } from '@/components/useColorScheme';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function StatisticsLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  
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
      />
    </ProtectedRoute>
  );
}