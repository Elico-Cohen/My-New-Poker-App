import * as React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';
import { TouchableOpacity, Text, View, StyleSheet, I18nManager } from 'react-native';

// Force RTL layout for Hebrew
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);
import { useAuth, AuthProvider } from '@/contexts/AuthContext';
import { GameProvider } from '@/contexts/GameContext';
import { useColorScheme } from '../../src/components/useColorScheme';
import Colors from '@/theme/colors';
import { migrateGameDates } from '@/services/migrations';
import Toast from 'react-native-toast-message';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

// Custom Error Boundary Component
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('AppErrorBoundary caught an error:', error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.title}>אופס! משהו השתבש</Text>
          <Text style={errorStyles.message}>
            {this.state.error?.message || 'אירעה שגיאה בלתי צפויה'}
          </Text>
          <TouchableOpacity style={errorStyles.button} onPress={this.resetError}>
            <Text style={errorStyles.buttonText}>נסה שוב</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0D1B1E',
    padding: 20,
  },
  title: {
    fontSize: 24,
    color: '#FFD700',
    marginBottom: 20,
    fontWeight: 'bold',
  },
  message: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#35654d',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export const unstable_settings = {
  // הגדרות יציבות יותר למערכת הניווט
  initialRouteName: 'index',
  animations: {
    // אנימציות שמתאימות למערכת הניווט
    push: {
      screen: {
        animation: 'default',
      },
    },
    // אנימציה חלקה יותר להחלפה בין מסכים
    replace: {
      screen: {
        animation: 'none',
      },
    },
  },
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

let isInitialNavigation = true;

export default function RootLayout() {
  const [fontsLoaded, fontsError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceMono: require('../../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Handle font loading errors gracefully - don't crash the app
  // @ts-ignore - מתעלמים מסוג ה-useEffect
  React.useEffect(() => {
    if (fontsError) {
      console.warn('Font loading failed, using system fonts as fallback:', fontsError);
      // Don't throw - continue with system fonts
    }
  }, [fontsError]);

  // @ts-ignore - מתעלמים מסוג ה-useEffect
  React.useEffect(() => {
    if (fontsLoaded || fontsError) {
      // Hide splash screen when fonts loaded OR if there was an error (fallback to system fonts)
      SplashScreen.hideAsync();
      // Run data migration after splash screen is hidden
      migrateGameDates()
        .then(() => console.log('Migration check completed'))
        .catch(error => console.error('Migration check failed:', error));
    }
  }, [fontsLoaded, fontsError]);

  if (!fontsLoaded && !fontsError) {
    // Only show loading state if fonts are still loading (no error yet)
    return null;
  }

  // Wrap the entire app with ErrorBoundary, AuthProvider and GameProvider
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <GameProvider>
          <RootLayoutNav />
        </GameProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { isAuthenticated, isLoading } = useAuth();
  
  // לוג פשוט מאוד, ללא ניווטים אוטומטיים - זה בעייתי
  console.log('RootLayoutNav rendered', { isAuthenticated, isLoading });
  
  return (
    <>
      <Stack>
        {/* מסך אינדקס - יגיע למסך הלוגין באמצעות Redirect */}
        <Stack.Screen 
          name="index" 
          options={{ 
            headerShown: false,
            animation: 'none'
          }}
        />
        
        {/* מסך לוגין */}
        <Stack.Screen 
          name="login" 
          options={{ 
            headerShown: false,
            animation: 'none'
          }}
        />
        
        {/* מסך רישום */}
        <Stack.Screen
          name="register"
          options={{
            title: 'הרשמה',
            headerShown: false,
            animation: 'slide_from_right'
          }}
        />

        {/* מסך שינוי סיסמה */}
        <Stack.Screen
          name="change-password"
          options={{
            title: 'שינוי סיסמה',
            headerShown: false,
            animation: 'slide_from_right'
          }}
        />
        
        {/* מסך דשבורד */}
        <Stack.Screen 
          name="dashboard" 
          options={{ 
            headerShown: false,
            animation: 'fade'
          }}
        />
        
        {/* מסכי טאבים */}
        <Stack.Screen 
          name="(tabs)" 
          options={{ 
            headerShown: false,
            animation: 'fade'
          }}
        />
        
        {/* מסכי היסטוריה */}
        <Stack.Screen 
          name="history" 
          options={{ 
            headerShown: false,
            animation: 'slide_from_right'
          }}
        />
        
        {/* מסכי סטטיסטיקות */}
        <Stack.Screen 
          name="statistics" 
          options={{ 
            headerShown: false,
            animation: 'slide_from_right'
          }}
        />

        {/* מסכי גיים פלו */}
        <Stack.Screen 
          name="gameFlow" 
          options={{ 
            headerShown: false,
            animation: 'slide_from_right'
          }}
        />
      </Stack>
      <Toast />
    </>
  );
}