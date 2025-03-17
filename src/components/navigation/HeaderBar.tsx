// src/components/navigation/HeaderBar.tsx
import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/common/Text';
import BackButton from './BackButton';
import LogoutButton from '@/components/auth/LogoutButton';

interface HeaderBarProps {
  /** Title text to display */
  title: string;
  /** Optional style to apply to container */
  style?: StyleProp<ViewStyle>;
  /** Whether to show back button */
  showBack?: boolean;
  /** Whether to show logout button */
  showLogout?: boolean;
  /** Where to navigate on back press */
  backTo?: string;
  /** Function to call on back press */
  onBackPress?: () => boolean | void;
  /** Whether to show confirmation on back press */
  confirmBack?: boolean;
  /** Confirmation message for back button */
  backConfirmationMessage?: string;
  /** Whether back button should consider unsaved changes */
  hasUnsavedChanges?: boolean;
  /** Custom right element */
  rightElement?: React.ReactNode;
  /** Custom left element */
  leftElement?: React.ReactNode;
  /** Background color */
  backgroundColor?: string;
  /** Text color */
  textColor?: string;
  /** Border color */
  borderColor?: string;
}

/**
 * A consistent header bar component with back and logout buttons
 */
export const HeaderBar: React.FC<HeaderBarProps> = ({
  title,
  style,
  showBack = false,
  showLogout = false,
  backTo,
  onBackPress,
  confirmBack = false,
  backConfirmationMessage,
  hasUnsavedChanges = false,
  rightElement,
  leftElement,
  backgroundColor = '#35654d',
  textColor = '#FFD700',
  borderColor = '#FFD700',
}) => {
  return (
    <View 
      style={[
        styles.container, 
        { 
          backgroundColor,
          borderBottomColor: borderColor
        },
        style
      ]}
    >
      {/* Right Element (typically back button) */}
      <View style={styles.sideElement}>
        {rightElement || (showBack && (
          <BackButton
            backTo={backTo}
            onPress={onBackPress}
            showConfirmation={confirmBack}
            confirmationMessage={backConfirmationMessage}
            hasUnsavedChanges={hasUnsavedChanges}
            color={textColor}
          />
        )) || <View style={styles.placeholder} />}
      </View>
      
      {/* Title */}
      <Text 
        variant="h4" 
        style={[
          styles.title,
          { color: textColor }
        ]}
      >
        {title}
      </Text>
      
      {/* Left Element (typically logout button) */}
      <View style={styles.sideElement}>
        {leftElement || (showLogout && (
          <LogoutButton color={textColor} />
        )) || <View style={styles.placeholder} />}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row-reverse', // For RTL support
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 2,
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
  sideElement: {
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    width: 40,
  },
});

export default HeaderBar;