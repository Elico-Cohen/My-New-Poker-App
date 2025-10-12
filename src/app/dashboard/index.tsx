// src/app/dashboard/index.tsx

import React from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/common/Text';
import { Icon } from '@/components/common/Icon';

// מסך דשבורד מינימלי מאוד
export default function DashboardScreen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: '#0D1B1E' }}>
      {/* Header */}
      <View style={{ 
        padding: 16,
        backgroundColor: '#35654d',
        borderBottomWidth: 2,
        borderBottomColor: '#FFD700',
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <TouchableOpacity
          onPress={() => {
            console.log('Back button pressed - navigating directly to home tab');
            router.replace('/(tabs)/home2');
          }}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(255,215,0,0.1)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Icon name="arrow-right" size="medium" color="#FFD700" />
        </TouchableOpacity>
        <Text variant="h4" style={{ color: '#FFD700', textAlign: 'center', flex: 1 }}>
          לוח ניהול
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1, padding: 16 }}>
        {/* Groups Management Button */}
        <TouchableOpacity 
          onPress={() => router.push('/dashboard/groups')}
          style={{
            backgroundColor: '#35654d',
            padding: 24,
            borderRadius: 12,
            marginBottom: 16,
            flexDirection: 'row-reverse',
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 2,
            borderColor: '#FFD700',
            elevation: 5,
            shadowColor: '#FFD700',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
          }}
        >
          <Icon name="account-group" size="xlarge" color="#FFD700" />
          <Text variant="h3" style={{ color: '#FFD700', marginRight: 16 }}>
            ניהול קבוצות
          </Text>
        </TouchableOpacity>

        {/* Users Management Button */}
        <TouchableOpacity 
          onPress={() => router.push('/dashboard/users')}
          style={{
            backgroundColor: '#35654d',
            padding: 24,
            borderRadius: 12,
            marginBottom: 16,
            flexDirection: 'row-reverse',
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 2,
            borderColor: '#FFD700',
            elevation: 5,
            shadowColor: '#FFD700',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
          }}
        >
          <Icon name="account-multiple" size="xlarge" color="#FFD700" />
          <Text variant="h3" style={{ color: '#FFD700', marginRight: 16 }}>
            ניהול משתמשים
          </Text>
        </TouchableOpacity>

        {/* Payment Units Management Button */}
        <TouchableOpacity 
          onPress={() => router.push('/dashboard/payment-units')}
          style={{
            backgroundColor: '#35654d',
            padding: 24,
            borderRadius: 12,
            marginBottom: 16,
            flexDirection: 'row-reverse',
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 2,
            borderColor: '#FFD700',
            elevation: 5,
            shadowColor: '#FFD700',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
          }}
        >
          <Icon name="cash" size="xlarge" color="#FFD700" />
          <Text variant="h3" style={{ color: '#FFD700', marginRight: 16 }}>
            ניהול יחידות תשלום
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}