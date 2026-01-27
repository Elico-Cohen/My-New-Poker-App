// src/components/navigation/BackButton.tsx
import React from 'react';
import { TouchableOpacity, StyleSheet, StyleProp, ViewStyle, Alert } from 'react-native';
import { Icon } from '@/components/common/Icon';
import { router } from 'expo-router';

interface BackButtonProps {
  /** Style to apply to the button container */
  style?: StyleProp<ViewStyle>;
  /** Color of the icon */
  color?: string;
  /** Size of the icon */
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  /** Route to go back to. If not provided, will use router.back() */
  backTo?: string;
  /** Whether to show confirmation when navigating back */
  showConfirmation?: boolean;
  /** Custom confirmation message */
  confirmationMessage?: string;
  /** If provided, will be called when back button is pressed. Return false to prevent navigation */
  onPress?: () => boolean | void;
  /** If true, unsaved changes exist and confirmation should be shown */
  hasUnsavedChanges?: boolean;
}

/**
 * A reusable back button component that handles navigation and optionally shows a confirmation dialog
 */
export const BackButton: React.FC<BackButtonProps> = ({
  style,
  color = '#FFD700',
  size = 'medium',
  backTo,
  showConfirmation = false,
  confirmationMessage = 'האם אתה בטוח שברצונך לצאת? שינויים שלא נשמרו יאבדו.',
  onPress,
  hasUnsavedChanges = false,
}) => {
  const handleBackPress = () => {
    // Execute custom handler if provided
    if (onPress) {
      const shouldContinue = onPress();
      if (shouldContinue === false) {
        return;
      }
    }

    // Show confirmation if requested or if there are unsaved changes
    if ((showConfirmation || hasUnsavedChanges) && confirmationMessage) {
      Alert.alert(
        "יציאה מהמסך",
        confirmationMessage,
        [
          {
            text: "ביטול",
            style: "cancel"
          },
          {
            text: "צא",
            onPress: () => {
              if (backTo) {
                router.push(backTo as any);
              } else {
                router.back();
              }
            }
          }
        ]
      );
    } else {
      // Navigate directly if no confirmation needed
      if (backTo) {
        router.push(backTo as any);
      } else {
        router.back();
      }
    }
  };

  return (
    <TouchableOpacity
      onPress={handleBackPress}
      style={[styles.button, style]}
    >
      <Icon name="arrow-right" size={size} color={color} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default BackButton;