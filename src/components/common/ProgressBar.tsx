import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Colors from '@/theme/colors';
import { useColorScheme } from '@/components/useColorScheme';

interface ProgressBarProps {
  progress: number; // 0 to 1
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export function ProgressBar({
  progress,
  height = 4,
  style,
}: ProgressBarProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  
  // Ensure progress is between 0 and 1
  const clampedProgress = Math.min(Math.max(progress, 0), 1);

  return (
    <View 
      style={[
        styles.container,
        { 
          height,
          backgroundColor: theme.surfaceVariant,
        },
        style
      ]}
    >
      <View
        style={[
          styles.progress,
          {
            width: `${clampedProgress * 100}%`,
            backgroundColor: theme.primary,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progress: {
    height: '100%',
  },
});