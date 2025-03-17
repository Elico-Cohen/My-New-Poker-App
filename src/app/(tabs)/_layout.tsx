// src/app/(tabs)/_layout.tsx - Add this at the top level component
import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link, Tabs, Redirect } from 'expo-router';
import { Pressable } from 'react-native';
// החזרת ייבוא ה-ProtectedRoute לאחר התיקונים שעשינו בקומפוננטה
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import ExitHandler from '@/components/navigation/ExitHandler';

import Colors from '@/theme/colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

// נגדיר טיפוס לכל שמות האייקונים האפשריים ב-FontAwesome
type FontAwesomeName = keyof typeof FontAwesome.glyphMap;

// פונקציה שבונה אייקון לטאב
function TabBarIcon(props: { name: FontAwesomeName; color: string }) {
  return <FontAwesome name={props.name} size={28} style={{ marginBottom: -3 }} color={props.color} />;
}

export default function TabsLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  console.log("TabsLayout rendering WITH improved ProtectedRoute");

  return (
    // החזרנו את ProtectedRoute אחרי השיפורים
    <ProtectedRoute>
      {/* Add the ExitHandler component to manage app exit */}
      <ExitHandler active={true} showLogoutOption={true} />
      
      <Tabs
        screenOptions={{
          // הסרת ה-header המובנה על ידי הגדרה קבועה של false
          headerShown: false,
          tabBarActiveTintColor: theme.primary,
          tabBarStyle: {
            backgroundColor: theme.background,
            borderTopColor: theme.border,
          },
          headerStyle: {
            backgroundColor: theme.background,
          },
          headerTintColor: theme.textPrimary,
        }}
      >
        {/* Redirect home to home2 */}
        <Tabs.Screen
          name="home"
          options={{
            href: null, // This hides the tab from the tab bar
          }}
          redirect={true}  // This redirects to home2
        />
        
        {/* Redirect home3 to home2 */}
        <Tabs.Screen
          name="home3"
          options={{
            href: null, // This hides the tab from the tab bar
          }}
          redirect={true}  // This redirects to home2
        />
        
        {/* Home2 tab - Make this the main home */}
        <Tabs.Screen
          name="home2"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }: { color: string }) => <TabBarIcon name="home" color={color} />,
          }}
        />
        
        {/* Games tab */}
        <Tabs.Screen
          name="games"
          options={{
            title: 'Games',
            tabBarIcon: ({ color }: { color: string }) => <TabBarIcon name="gamepad" color={color} />,
          }}
        />
        
        {/* History tab */}
        <Tabs.Screen
          name="history"
          options={{
            title: 'History',
            tabBarIcon: ({ color }: { color: string }) => <TabBarIcon name="history" color={color} />,
          }}
        />
        
        {/* Statistics tab */}
        <Tabs.Screen
          name="statistics"
          options={{
            title: 'Statistics',
            tabBarIcon: ({ color }: { color: string }) => <TabBarIcon name="line-chart" color={color} />,
          }}
        />
      </Tabs>
    </ProtectedRoute>
  );
}