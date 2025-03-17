// src/app/reset-password.tsx
import React, { useState } from 'react';
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
import { isValidEmail } from '@/utils/authUtils';
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

export default function ResetPasswordScreen() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { resetPassword, error, clearError, isOffline } = useAuth();

  // Validate email
  const validateEmail = (): boolean => {
    if (!email.trim()) {
      setEmailError('נא להזין כתובת אימייל');
      return false;
    }
    
    if (!isValidEmail(email)) {
      setEmailError('כתובת אימייל לא תקינה');
      return false;
    }
    
    setEmailError(null);
    return true;
  };

  // Handle reset password request
  const handleResetPassword = async () => {
    if (!validateEmail()) {
      return;
    }

    if (isOffline) {
      Alert.alert(
        "אין חיבור לאינטרנט",
        "איפוס סיסמה דורש חיבור לאינטרנט. בדוק את החיבור שלך ונסה שוב.",
        [{ text: "הבנתי" }]
      );
      return;
    }

    setIsSubmitting(true);
    clearError();
    
    const success = await resetPassword(email);
    
    if (success) {
      setIsSubmitted(true);
    }
    
    setIsSubmitting(false);
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
            איפוס סיסמה
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
        
        {isSubmitted ? (
          <View style={styles.successContainer}>
            <View style={styles.iconContainer}>
              <Image 
                source={require('@/assets/images/email-sent.png')}
                style={styles.emailIcon}
                resizeMode="contain"
              />
            </View>
            
            <Text variant="h4" style={styles.successTitle}>
              הוראות נשלחו בהצלחה
            </Text>
            
            <Text style={styles.successMessage}>
              שלחנו הוראות לאיפוס הסיסמה לכתובת {email}.
              אנא בדוק את תיבת הדואר שלך ועקוב אחר ההוראות.
            </Text>
            
            <Button
              title="חזור למסך ההתחברות"
              onPress={() => router.replace('/login')}
              style={styles.returnButton}
            />
          </View>
        ) : (
          <View style={styles.formContainer}>
            <Text style={styles.instructions}>
              הזן את כתובת האימייל שלך ונשלח לך הוראות לאיפוס הסיסמה.
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
              <Text style={styles.label}>כתובת אימייל</Text>
              <TextInput
                style={[styles.input, emailError && styles.inputError]}
                placeholder="הזן את האימייל שלך"
                placeholderTextColor="#666"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                editable={!isSubmitting}
              />
              {emailError && (
                <Text style={styles.errorText}>{emailError}</Text>
              )}
            </View>
            
            <Button
              title={isSubmitting ? "שולח..." : "שלח הוראות איפוס"}
              onPress={handleResetPassword}
              style={styles.resetButton}
              loading={isSubmitting}
              disabled={isSubmitting || isOffline}
            />
            
            <TouchableOpacity 
              style={styles.loginLink}
              onPress={() => router.back()}
            >
              <Text style={styles.loginLinkText}>
                חזרה למסך התחברות
              </Text>
            </TouchableOpacity>
          </View>
        )}
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
    marginTop: 20,
    marginBottom: 40,
  },
  logo: {
    width: 100,
    height: 100,
  },
  formContainer: {
    paddingHorizontal: 32,
  },
  instructions: {
    color: CASINO_COLORS.text,
    textAlign: 'center',
    marginBottom: 24,
    fontSize: 16,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: CASINO_COLORS.error,
  },
  errorText: {
    color: CASINO_COLORS.error,
    textAlign: 'right',
    fontSize: 14,
  },
  offlineContainer: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  offlineText: {
    color: '#f59e0b',
    textAlign: 'center',
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    color: CASINO_COLORS.gold,
    marginBottom: 8,
    textAlign: 'right',
    fontSize: 16,
  },
  input: {
    backgroundColor: CASINO_COLORS.surface,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
    borderRadius: 8,
    color: CASINO_COLORS.text,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    textAlign: 'right',
  },
  inputError: {
    borderColor: CASINO_COLORS.error,
  },
  resetButton: {
    backgroundColor: CASINO_COLORS.primary,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: CASINO_COLORS.gold,
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
  successContainer: {
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  iconContainer: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: CASINO_COLORS.success,
  },
  emailIcon: {
    width: 60,
    height: 60,
  },
  successTitle: {
    color: CASINO_COLORS.success,
    marginBottom: 16,
    textAlign: 'center',
  },
  successMessage: {
    color: CASINO_COLORS.text,
    textAlign: 'center',
    marginBottom: 32,
    fontSize: 16,
    lineHeight: 24,
  },
  returnButton: {
    backgroundColor: CASINO_COLORS.primary,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: CASINO_COLORS.gold,
    width: '100%',
  },
});