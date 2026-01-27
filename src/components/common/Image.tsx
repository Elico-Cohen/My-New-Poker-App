import React from 'react';
import {
  Image as RNImage,
  ImageProps as RNImageProps,
  StyleSheet,
  View,
  ActivityIndicator,
} from 'react-native';
import Colors from '@/theme/colors';
import { useColorScheme } from '@/components/useColorScheme';

interface ImageProps extends RNImageProps {
  showLoadingIndicator?: boolean;
}

export function Image({
  showLoadingIndicator = true,
  style,
  ...props
}: ImageProps) {
  const [isLoading, setIsLoading] = React.useState(true);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <View style={styles.container}>
      <RNImage
        {...props}
        style={[styles.image, style]}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
      />
      {showLoadingIndicator && isLoading && (
        <View style={[styles.loadingContainer, { backgroundColor: theme.surface }]}>
          <ActivityIndicator color={theme.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});