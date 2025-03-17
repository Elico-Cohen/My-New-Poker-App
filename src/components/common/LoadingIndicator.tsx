import React from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Text } from './Text';
import Colors from '@/theme/colors';
import { useColorScheme } from '@/components/useColorScheme';

interface LoadingIndicatorProps {
  size?: 'small' | 'large';
  text?: string;
  fullscreen?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function LoadingIndicator({
  size = 'large',
  text,
  fullscreen = false,
  style,
}: LoadingIndicatorProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <View style={[
      styles.container,
      fullscreen && styles.fullscreen,
      style
    ]}>
      <ActivityIndicator 
        size={size} 
        color={theme.primary}
      />
      {text && (
        <Text 
          variant="bodyNormal" 
          style={styles.text}
        >
          {text}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  text: {
    marginTop: 12,
  },
});