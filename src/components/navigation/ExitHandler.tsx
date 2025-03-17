// src/components/navigation/ExitHandler.tsx
import React, { useEffect } from 'react';
import { Alert, BackHandler } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';

/**
 * Component that handles system back button press to show an exit confirmation dialog
 * Options for logout when exiting the app
 */
export const ExitHandler: React.FC = () => {
  const { logout } = useAuth();

  useEffect(() => {
    const backAction = () => {
      Alert.alert(
        "יציאה מהאפליקציה", 
        "האם אתה בטוח שברצונך לצאת?", 
        [
          {
            text: "ביטול",
            onPress: () => null,
            style: "cancel"
          },
          { 
            text: "צא והתנתק", 
            onPress: async () => {
              console.log('Logout initiated from ExitHandler');
              try {
                await logout();
                console.log('Navigating to login after logout from ExitHandler');
                router.navigate('/login');
                // אחרי ניווט ללוגין, סוגרים את האפליקציה
                setTimeout(() => {
                  BackHandler.exitApp();
                }, 300);
              } catch (error) {
                console.error('Error during logout from ExitHandler:', error);
                BackHandler.exitApp();
              }
            }
          },
          { 
            text: "צא", 
            onPress: () => BackHandler.exitApp() 
          }
        ]
      );
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    return () => backHandler.remove();
  }, [logout]);

  return null;
};

export default ExitHandler;