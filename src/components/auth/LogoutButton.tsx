// src/components/auth/LogoutButton.tsx
import React from 'react';
import { TouchableOpacity, Alert, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Icon } from '@/components/common/Icon';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';

interface LogoutButtonProps {
  style?: StyleProp<ViewStyle>;
  color?: string;
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  showConfirmation?: boolean;
}

/**
 * A reusable logout button component that handles the logout process
 * and optionally shows a confirmation dialog
 */
export const LogoutButton: React.FC<LogoutButtonProps> = ({
  style,
  color = '#FFD700',
  size = 'medium',
  showConfirmation = true,
}) => {
  const { logout } = useAuth();

  const handleLogout = async () => {
    if (showConfirmation) {
      Alert.alert(
        "יציאה מהמערכת",
        "האם אתה בטוח שברצונך להתנתק?",
        [
          {
            text: "ביטול",
            style: "cancel"
          },
          {
            text: "התנתק",
            onPress: async () => {
              try {
                console.log('Logout initiated from LogoutButton');
                await logout();
                // ניווט למסך הלוגין
                console.log('Navigating to login screen after logout');
                router.navigate('/login');
              } catch (error) {
                console.error('Logout error:', error);
              }
            }
          }
        ]
      );
    } else {
      try {
        console.log('Direct logout initiated from LogoutButton');
        await logout();
        // ניווט למסך הלוגין
        console.log('Navigating to login screen after direct logout');
        router.navigate('/login');
      } catch (error) {
        console.error('Direct logout error:', error);
      }
    }
  };

  return (
    <TouchableOpacity
      onPress={handleLogout}
      style={[
        styles.button,
        style
      ]}
    >
      <Icon name="account-multiple" size={size} color={color} />
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

export default LogoutButton;