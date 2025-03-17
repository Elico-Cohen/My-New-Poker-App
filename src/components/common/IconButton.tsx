// src/components/common/IconButton.tsx
import React from 'react';
import { TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Icon } from './Icon';
import { IconName } from '@/theme/icons';
import Colors from '@/theme/colors';
import { useColorScheme } from '@/components/useColorScheme';

interface IconButtonProps {
  name: IconName;
  size?: number;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({ name, size, onPress, style }: IconButtonProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.container, { backgroundColor: theme.surface }, style]}
    >
      <Icon name={name} size={size} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  }
});