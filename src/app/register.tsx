import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Alert
} from 'react-native';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import BackButton from '@/components/navigation/BackButton';

const CASINO_COLORS = {
  background: '#0D1B1E',
  primary: '#35654d',
  gold: '#FFD700',
  surface: '#1C2C2E',
  text: '#FFFFFF',
  error: '#ef4444',
  success: '#22c55e'
};

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationErrors, setValidationErrors] = useState<{ 
    name?: string; 
    email?: string; 
    password?: string;
    confirmPassword?: string;
  }>({});
  const [isRegistering, setIsRegistering] = useState(false);
  const { register, isAuthenticated, isLoading, error, clearError, isOffline } = useAuth();

  // מחיקת שגיאות קודמות כאשר הערכים משתנים
  useEffect(() => {
    if (error) {
      clearError();
    }
  }, [name, email, password, confirmPassword]);

  // וידוא קלט
  const validateInputs = (): boolean => {
    const errors: { 
      name?: string; 
      email?: string; 
      password?: string;
      confirmPassword?: string;
    } = {};
    
    // בדיקת שם
    if (!name.trim()) {
      errors.name = 'נא להזין שם מלא';
    }
    
    // בדיקת אימייל
    if (!email.trim()) {
      errors.email = 'נא להזין כתובת אימייל';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'כתובת אימייל לא תקינה';
    }
    
    // בדיקת סיסמה
    if (!password) {
      errors.password = 'נא להזין סיסמה';
    } else if (password.length < 6) {
      errors.password = 'הסיסמה חייבת להכיל לפחות 6 תווים';
    }
    
    // בדיקת אימות סיסמה
    if (!confirmPassword) {
      errors.confirmPassword = 'נא לאמת את הסיסמה';
    } else if (confirmPassword !== password) {
      errors.confirmPassword = 'הסיסמאות אינן תואמות';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // טיפול בהרשמה
  const handleRegister = async () => {
    if (isOffline) {
      Alert.alert(
        "אין חיבור לאינטרנט",
        "הרשמה דורשת חיבור לאינטרנט. בדוק את החיבור שלך ונסה שוב."
      );
      return;
    }
    
    if (validateInputs()) {
      setIsRegistering(true);
      try {
        await register(name, email, password);
        
        // ניווט מפורש לאחר הרשמה מוצלחת
        if (!error) {
          router.replace('/(tabs)/home2');
        }
      } catch (err) {
        console.error('Register error in component:', err);
      } finally {
        setIsRegistering(false);
      }
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <BackButton 
            backTo="/login" 
            color={CASINO_COLORS.gold}
          />
          <Text variant="h4" style={styles.headerTitle}>
            הרשמה
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.logoContainer}>
          <Image 
            source={require('@/assets/images/poker-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        
        <View style={styles.formContainer}>
          <Text style={styles.instructions}>
            צור חשבון חדש כדי להתחיל להשתמש באפליקציה.
          </Text>
          
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          
          {isOffline && (
            <View style={styles.offlineContainer}>
              <Text style={styles.offlineText}>אין חיבור לאינטרנט</Text>
            </View>
          )}
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>שם מלא</Text>
            <TextInput
              style={[styles.input, validationErrors.name && styles.inputError]}
              placeholder="הזן את שמך המלא"
              placeholderTextColor="#666"
              value={name}
              onChangeText={setName}
              editable={!isRegistering}
            />
            {validationErrors.name && (
              <Text style={styles.errorText}>{validationErrors.name}</Text>
            )}
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>אימייל</Text>
            <TextInput
              style={[styles.input, validationErrors.email && styles.inputError]}
              placeholder="הזן את האימייל שלך"
              placeholderTextColor="#666"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              editable={!isRegistering}
            />
            {validationErrors.email && (
              <Text style={styles.errorText}>{validationErrors.email}</Text>
            )}
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>סיסמה</Text>
            <TextInput
              style={[styles.input, validationErrors.password && styles.inputError]}
              placeholder="הזן סיסמה (לפחות 6 תווים)"
              placeholderTextColor="#666"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              editable={!isRegistering}
            />
            {validationErrors.password && (
              <Text style={styles.errorText}>{validationErrors.password}</Text>
            )}
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>אימות סיסמה</Text>
            <TextInput
              style={[styles.input, validationErrors.confirmPassword && styles.inputError]}
              placeholder="הזן שוב את הסיסמה"
              placeholderTextColor="#666"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              editable={!isRegistering}
            />
            {validationErrors.confirmPassword && (
              <Text style={styles.errorText}>{validationErrors.confirmPassword}</Text>
            )}
          </View>
          
          <Button
            title={isRegistering ? "נרשם..." : "הירשם"}
            onPress={handleRegister}
            style={styles.registerButton}
            loading={isRegistering}
            disabled={isRegistering || isOffline}
          />
          
          <TouchableOpacity 
            style={styles.loginLink}
            onPress={() => router.back()}
          >
            <Text style={styles.loginLinkText}>
              כבר יש לך חשבון? התחבר
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CASINO_COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 16,
  },
  headerTitle: {
    color: CASINO_COLORS.gold,
    textAlign: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  logo: {
    width: 80,
    height: 80,
  },
  formContainer: {
    paddingHorizontal: 32,
  },
  instructions: {
    color: CASINO_COLORS.text,
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: CASINO_COLORS.error,
  },
  offlineContainer: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  errorText: {
    color: CASINO_COLORS.error,
    fontSize: 14,
  },
  offlineText: {
    color: '#f59e0b',
    fontSize: 14,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: CASINO_COLORS.text,
    marginBottom: 4,
    fontSize: 16,
    textAlign: 'right',
  },
  input: {
    backgroundColor: CASINO_COLORS.surface,
    color: CASINO_COLORS.text,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    textAlign: 'right',
  },
  inputError: {
    borderColor: CASINO_COLORS.error,
  },
  registerButton: {
    backgroundColor: CASINO_COLORS.primary,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: CASINO_COLORS.gold,
    marginTop: 8,
  },
  loginLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  loginLinkText: {
    color: CASINO_COLORS.gold,
    fontSize: 16,
    textDecorationLine: 'underline',
  },
});
