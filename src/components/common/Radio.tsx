import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Text } from './Text';
import Colors from '@/theme/colors';
import { useColorScheme } from '@/components/useColorScheme';

interface RadioOption {
  label: string;
  value: string;
}

interface RadioProps {
  value: string;
  options: RadioOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Radio({
  value,
  options,
  onChange,
  disabled = false,
  style,
}: RadioProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.container, style]}>
      {options.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.option,
            {
              opacity: disabled ? 0.5 : 1,
            },
          ]}
          onPress={() => !disabled && onChange(option.value)}
          disabled={disabled}
        >
          <View
            style={[
              styles.radio,
              {
                borderColor: theme.primary,
                backgroundColor: theme.surface,
              },
            ]}
          >
            {value === option.value && (
              <View
                style={[
                  styles.selected,
                  {
                    backgroundColor: theme.primary,
                  },
                ]}
              />
            )}
          </View>
          <Text variant="bodyNormal" style={styles.label}>
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginEnd: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  label: {
    marginStart: 8,
  },
});