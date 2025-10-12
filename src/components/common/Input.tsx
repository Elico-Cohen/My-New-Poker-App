import React from 'react';
import { TextInput, StyleSheet, StyleProp, ViewStyle, TextStyle, View, TouchableOpacity } from 'react-native';
import Colors from '@/theme/colors';
import Typography from '@/theme/typography';
import { useColorScheme } from '@/components/useColorScheme';
import { Icon } from './Icon';
import { IconName } from '@/theme/icons';

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
  clearable?: boolean;
  onClear?: () => void;
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
}: InputProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const baseInputStyle: TextStyle = {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    color: theme.textPrimary,
    ...Typography.styles.bodyNormal,
    textAlign: 'right',
    paddingLeft: clearable && value ? 40 : 16,
    flex: 1,
  };

  return (
    <View style={[styles.container, style]}>
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
          baseInputStyle,
        inputStyle,
      ]}
    />
      {clearable && value && (
        <TouchableOpacity onPress={onClear} style={styles.clearButton}>
          <Icon name="close-circle" size="small" color={theme.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    borderColor: 'transparent',
    width: '100%',
  },
  input: {
    paddingVertical: 12,
  },
  clearButton: {
    position: 'absolute',
    left: 8,
    padding: 8,
  },
});