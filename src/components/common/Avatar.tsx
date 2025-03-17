import React from 'react';
import {
  View,
  Image,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Text } from './Text';
import Colors from '@/theme/colors';
import { useColorScheme } from '@/components/useColorScheme';

interface AvatarProps {
  size?: number;
  source?: { uri: string };
  initials?: string;
  style?: StyleProp<ViewStyle>;
}

export function Avatar({
  size = 40,
  source,
  initials,
  style,
}: AvatarProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: source ? theme.surface : theme.primary,
        },
        style,
      ]}
    >
      {source ? (
        <Image
          source={source}
          style={[
            styles.image,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
        />
      ) : (
        initials && (
          <Text
            variant="bodyNormal"
            style={[
              styles.initials,
              { color: theme.onPrimary },
            ]}
          >
            {initials.toUpperCase()}
          </Text>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  initials: {
    fontSize: 16,
    fontWeight: '500',
  },
});