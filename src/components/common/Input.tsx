import React from 'react';
import { TextInput, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import Colors from '@/theme/colors';
import Typography from '@/theme/typography';
import { useColorScheme } from '@/components/useColorScheme';

interface InputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'phone-pad';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  editable?: boolean;
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
}: InputProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const defaultInputStyle: TextStyle = {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    ...Typography.styles.bodyNormal,
  };

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.textDisabled}
      keyboardType={keyboardType}
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize}
      editable={editable}
      style={[
        styles.input,
        defaultInputStyle,
        style,
        inputStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
  },
});