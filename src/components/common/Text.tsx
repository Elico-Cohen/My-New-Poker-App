import React from 'react';
import { Text as RNText, TextStyle, StyleSheet, StyleProp } from 'react-native';
import Colors from '@/theme/colors';
import Typography, { textStyles } from '@/theme/typography';
import { useColorScheme } from '@/components/useColorScheme';

interface TextProps {
  variant?: keyof typeof textStyles;
  style?: StyleProp<TextStyle>;
  children?: React.ReactNode;
  color?: string;
  align?: 'auto' | 'left' | 'right' | 'center' | 'justify';
}

export function Text({
  variant,
  children,
  color,
  align,
  style,
}: TextProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <RNText
      style={[
        variant ? Typography.styles[variant] : Typography.styles.bodyNormal,
        {
          color: color || theme.textPrimary,
          textAlign: align,
        },
        style,
      ]}
    >
      {children}
    </RNText>
  );
}