import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
  ActivityIndicator
} from 'react-native';
import Colors from '@/theme/colors';
import Typography from '@/theme/typography';
import { useColorScheme } from '@/components/useColorScheme';
import { Icon } from './Icon';
import { IconName } from '@/theme/icons';

type ButtonStylesType = {
  [key: string]: any;  // מאפשר גישה דינמית למאפיינים
};

export interface ButtonProps {
  onPress: () => void;
  title?: string;  // הפך לאופציונלי
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  icon?: IconName;
  iconColor?: string;  // חדש - צבע מותאם לאייקון
  iconSize?: number;   // חדש - גודל מותאם לאייקון
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function Button({
  onPress,
  title,
  variant = 'primary',
  size = 'medium',
  icon,
  iconColor,
  iconSize,
  disabled = false,
  loading = false,
  style,
  textStyle,
}: ButtonProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const getButtonStyles = (): StyleProp<ViewStyle>[] => {
    const baseStyles: StyleProp<ViewStyle>[] = [styles.button];
    
    // רק אם יש טקסט, נוסיף את סגנונות הגודל הרגילים
    if (title) {
      baseStyles.push(styles[`button_${size}` as keyof typeof styles]);
    }

    switch (variant) {
      case 'primary':
        baseStyles.push({
          backgroundColor: theme.primary as string,
          borderWidth: 0,
        });
        break;
      case 'secondary':
        baseStyles.push({
          backgroundColor: theme.secondary as string,
          borderWidth: 0,
        });
        break;
      case 'outline':
        baseStyles.push({
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderColor: theme.primary as string,
        });
        break;
      case 'ghost':
        baseStyles.push({
          backgroundColor: 'transparent',
          borderWidth: 0,
        });
        break;
    }

    if (disabled) {
      baseStyles.push(styles.button_disabled as StyleProp<ViewStyle>);
    }

    return baseStyles;
  };

  const getTextStyles = (): StyleProp<TextStyle>[] => {
    const baseStyles: StyleProp<TextStyle>[] = [
      styles.text, 
      styles[`text_${size}` as keyof typeof styles] as StyleProp<TextStyle>
    ];

    switch (variant) {
      case 'primary':
      case 'secondary':
        baseStyles.push({ color: theme.onPrimary as string });
        break;
      case 'outline':
      case 'ghost':
        baseStyles.push({ color: theme.primary as string });
        break;
    }

    if (disabled) {
      baseStyles.push({ color: theme.textDisabled as string });
    }

    return baseStyles;
  };

  const defaultIconColor = variant === 'primary' ? theme.onPrimary as string : theme.primary as string;
  const defaultIconSize = size === 'small' ? 16 : size === 'medium' ? 20 : 24;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[getButtonStyles(), style]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? theme.onPrimary as string : theme.primary as string} />
      ) : (
        <>
          {icon && (
            <Icon
              name={icon}
              size={iconSize || defaultIconSize}
              color={iconColor || defaultIconColor}
              style={title ? styles.iconWithText : undefined}
            />
          )}
          {title && <Text style={[getTextStyles(), textStyle]}>{title}</Text>}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  button_small: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  button_medium: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  button_large: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  button_disabled: {
    opacity: 0.5,
  },
  text: {
    ...Typography.styles.bodyNormal,
    textAlign: 'center',
  },
  text_small: {
    fontSize: Typography.sizes.bodySmall,
  },
  text_medium: {
    fontSize: Typography.sizes.bodyNormal,
  },
  text_large: {
    fontSize: Typography.sizes.bodyLarge,
  },
  iconWithText: {
    marginRight: 8,
  },
}) as ButtonStylesType;