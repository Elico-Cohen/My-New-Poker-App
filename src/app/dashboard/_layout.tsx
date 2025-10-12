import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import Colors from '@/theme/colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Icon } from '@/components/common/Icon';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function DashboardLayout() {
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];
  
    return (
      // Only admin and super users can access dashboard
      <ProtectedRoute requiredRole={['admin']}>
        <Stack
          screenOptions={{
            headerShown: false,
            headerStyle: {
              backgroundColor: theme.surface,
            },
            headerTintColor: theme.primary,
            headerTitleStyle: {
              fontFamily: 'Inter_600SemiBold',
            },
            contentStyle: {
              backgroundColor: theme.background,
            },
          }}
        >
          <Stack.Screen
            name="groups"
            options={{
              title: 'Groups Management',
              headerShown: false,
              headerRight: () => (
                <Icon name="account-group" size="medium" color={theme.primary} />
              ),
            }}
          />
    
          <Stack.Screen
            name="users"
            options={{
              title: 'Players Management',
              headerShown: false,
              headerRight: () => (
                <Icon name="account-multiple" size="medium" color={theme.primary} />
              ),
            }}
          />
    
          <Stack.Screen
            name="payment-units"
            options={{
              title: 'Payment Units',
              headerShown: false,
              headerRight: () => (
                <Icon name="cash" size="medium" color={theme.primary} />
              ),
            }}
          />
          
          {/* Group details screens */}
          <Stack.Screen
            name="group-details/[id]"
            options={{
              title: 'Group Details',
              headerShown: false,
            }}
          />
          
          <Stack.Screen
            name="group-details/new"
            options={{
              title: 'New Group',
              headerShown: false,
            }}
          />
        </Stack>
      </ProtectedRoute>
    );
}