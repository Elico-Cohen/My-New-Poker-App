import React from 'react';
import { TextInput, StyleSheet, StyleProp, ViewStyle, TextStyle, View, TouchableOpacity } from 'react-native';
import Colors from '@/theme/colors';
import Typography from '@/theme/typography';
import { useColorScheme } from '@/components/useColorScheme';
import { Icon } from './Icon';
import { IconName } from '@/theme/icons';
import { Text } from './Text';

export interface InputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'phone-pad' | 'email-address';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  editable?: boolean;
  clearable?: boolean;
  onClear?: () => void;
  label?: string;
  error?: string | null;
  onFocus?: () => void;
  onBlur?: () => void;
}

export function Input({
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  secureTextEntry = false,
  autoCapitalize = 'none',
  style,
  inputStyle,
  editable = true,
  clearable = false,
  onClear,
  label,
  error,
  onFocus,
  onBlur,
}: InputProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const baseInputStyle: TextStyle = {
    backgroundColor: theme.surface,
    borderColor: error ? theme.error : theme.border,
    color: theme.textPrimary,
    ...Typography.styles.bodyNormal,
    textAlign: 'right',
    paddingStart: clearable && value ? 40 : 16,
    flex: 1,
  };

  return (
    <View style={[styles.wrapper, style]}>
      {label && (
        <Text variant="bodySmall" style={styles.label} color={theme.textSecondary}>
          {label}
        </Text>
      )}
      <View style={styles.container}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textDisabled}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          editable={editable}
          onFocus={onFocus}
          onBlur={onBlur}
          style={[
            baseInputStyle,
            styles.input,
            inputStyle,
          ]}
        />
        {clearable && value && (
          <TouchableOpacity onPress={onClear} style={styles.clearButton}>
            <Icon name="close-circle" size="small" color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text variant="bodySmall" style={styles.error} color={theme.error}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    borderColor: 'transparent',
    width: '100%',
  },
  label: {
    marginBottom: 4,
    textAlign: 'right',
  },
  error: {
    marginTop: 4,
    textAlign: 'right',
  },
  input: {
    paddingVertical: 14,
    minHeight: 48,
  },
  clearButton: {
    position: 'absolute',
    left: 8,
    padding: 8,
  },
});