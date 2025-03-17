import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Colors from '@/theme/colors';
import { useColorScheme } from '@/components/useColorScheme';

interface CardProps {
  children?: React.ReactNode;
  variant?: 'default' | 'outlined';
  style?: StyleProp<ViewStyle>;
}

export function Card({ 
  children, 
  variant = 'default', 
  style 
}: CardProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: variant === 'default' ? theme.surface : 'transparent',
        borderColor: theme.border,
        borderWidth: variant === 'outlined' ? 1 : 0,
      },
      style
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});