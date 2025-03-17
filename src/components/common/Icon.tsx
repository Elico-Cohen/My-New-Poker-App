// src/components/common/Icon.tsx
import React from 'react';
import { StyleProp, ViewStyle, TextStyle } from 'react-native';  // הוספנו TextStyle
import Colors from '@/theme/colors';
import { IconName, ICON_SIZES } from '@/theme/icons';
import { useColorScheme } from '@/components/useColorScheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface IconProps {
  name: IconName;
  size?: keyof typeof ICON_SIZES | number;
  color?: string;
  style?: StyleProp<TextStyle>;  // שינינו ל-TextStyle
}

export function Icon({ 
  name, 
  size = 'medium',
  color,
  style 
}: IconProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  
  const iconSize = typeof size === 'number' ? size : ICON_SIZES[size];
  const iconColor = color || theme.textPrimary;

  return (
    <MaterialCommunityIcons
      name={name as keyof typeof MaterialCommunityIcons.glyphMap}
      size={iconSize}
      color={iconColor}
      style={style}
    />
  );
}