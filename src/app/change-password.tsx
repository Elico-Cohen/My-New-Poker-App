import React, { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform, BackHandler } from 'react-native';
import { router } from 'expo-router';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { useAuth } from '@/contexts/AuthContext';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider, signOut } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';

const COLORS = {
  background: '#0D1B1E',
  primary: '#35654d',
  gold: '#FFD700',
  surface: '#1C2C2E',
  text: '#FFFFFF',
  error: '#ef4444',
  border: 'rgba(255, 215, 0, 0.3)'
};

export default function ChangePasswordScreen() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Prevent going back if user must change password
  useEffect(() => {
    if (user?.mustChangePassword) {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        // Show alert instead of going back
        Alert.alert(
          'שינוי סיסמה נדרש',
          'עליך לשנות את הסיסמה לפני שתוכל להמשיך להשתמש באפליקציה',
          [{ text: 'הבנתי', style: 'default' }]
        );
        return true; // Prevent default back behavior
      });

      return () => backHandler.remove();
    }
  }, [user?.mustChangePassword]);

  const validatePassword = (password: string): string | null => {
    if (password.length < 6) {
      return 'הסיסמה חייבת להכיל לפחות 6 תווים';
    }
    return null;
  };

  const handleChangePassword = async () => {
    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('שגיאה', 'אנא מלא את כל השדות');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('שגיאה', 'הסיסמאות החדשות אינן תואמות');
      return;
    }

    if (currentPassword === newPassword) {
      Alert.alert('שגיאה', 'הסיסמה החדשה חייבת להיות שונה מהסיסמה הנוכחית');
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      Alert.alert('שגיאה', passwordError);
      return;
    }

    setIsLoading(true);

    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser || !firebaseUser.email) {
        throw new Error('משתמש לא מחובר');
      }

      // Re-authenticate user with current password
      const credential = EmailAuthProvider.credential(
        firebaseUser.email,
        currentPassword
      );

      await reauthenticateWithCredential(firebaseUser, credential);

      // Update password in Firebase Auth
      await updatePassword(firebaseUser, newPassword);

      // Update mustChangePassword flag in Firestore (with error handling)
      if (user?.id) {
        try {
          const userRef = doc(db, 'users', user.id);
          await updateDoc(userRef, {
            mustChangePassword: false,
            updatedAt: Date.now()
          });

          // Success - password changed and flag cleared
          Alert.alert(
            'הצלחה',
            'הסיסמה שונתה בהצלחה',
            [{ text: 'אישור', onPress: () => router.replace('/(tabs)/home') }]
          );
        } catch (firestoreError: any) {
          console.error('Failed to clear mustChangePassword flag:', firestoreError);
          // Password already changed, so warn but don't fail completely
          Alert.alert(
            'אזהרה',
            'הסיסמה שונתה בהצלחה, אך ייתכן שתתבקש לשנות אותה שוב. נסה להתנתק ולהתחבר מחדש.',
            [{ text: 'אישור', onPress: () => router.replace('/(tabs)/home') }]
          );
        }
      } else {
        // No user ID, but password was changed successfully
        Alert.alert(
          'הצלחה',
          'הסיסמה שונתה בהצלחה',
          [{ text: 'אישור', onPress: () => router.replace('/(tabs)/home') }]
        );
      }

    } catch (error: any) {
      console.error('Error changing password:', error);

      let errorMessage = 'שגיאה בשינוי הסיסמה';

      if (error.code === 'auth/wrong-password') {
        errorMessage = 'הסיסמה הנוכחית שגויה';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'בעיית חיבור לאינטרנט. אנא נסה שוב.';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'נדרשת התחברות מחדש. אנא התנתק והתחבר שוב.';
      } else if (error.code === 'auth/invalid-credential') {
        errorMessage = 'הסיסמה הנוכחית שגויה';
      }

      Alert.alert('שגיאה', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          {!user?.mustChangePassword && (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Icon name="arrow-right" size="medium" color={COLORS.gold} />
            </TouchableOpacity>
          )}
          <Text style={styles.title}>שינוי סיסמה</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.subtitle}>
            {user?.mustChangePassword
              ? 'נדרש לשנות את הסיסמה שלך לפני המשך השימוש במערכת'
              : 'הזן את הסיסמה הנוכחית והסיסמה החדשה'}
          </Text>

          {/* Current Password */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>סיסמה נוכחית</Text>
            <View style={styles.passwordInputWrapper}>
              <TouchableOpacity
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                style={styles.eyeIcon}
              >
                <Icon
                  name={showCurrentPassword ? "eye-off" : "eye"}
                  size="small"
                  color={COLORS.gold}
                />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder="הזן סיסמה נוכחית"
                placeholderTextColor="rgba(255, 215, 0, 0.5)"
                secureTextEntry={!showCurrentPassword}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>
          </View>

          {/* New Password */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>סיסמה חדשה</Text>
            <View style={styles.passwordInputWrapper}>
              <TouchableOpacity
                onPress={() => setShowNewPassword(!showNewPassword)}
                style={styles.eyeIcon}
              >
                <Icon
                  name={showNewPassword ? "eye-off" : "eye"}
                  size="small"
                  color={COLORS.gold}
                />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder="הזן סיסמה חדשה (לפחות 6 תווים)"
                placeholderTextColor="rgba(255, 215, 0, 0.5)"
                secureTextEntry={!showNewPassword}
                value={newPassword}
                onChangeText={setNewPassword}
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>
          </View>

          {/* Confirm Password */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>אימות סיסמה חדשה</Text>
            <View style={styles.passwordInputWrapper}>
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeIcon}
              >
                <Icon
                  name={showConfirmPassword ? "eye-off" : "eye"}
                  size="small"
                  color={COLORS.gold}
                />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder="הזן שוב את הסיסמה החדשה"
                placeholderTextColor="rgba(255, 215, 0, 0.5)"
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>
          </View>

          {/* Buttons Row */}
          <View style={styles.buttonsRow}>
            <Button
              title={isLoading ? 'משנה...' : 'שנה סיסמה'}
              onPress={handleChangePassword}
              disabled={isLoading}
              style={[styles.button, styles.submitButton, isLoading && styles.buttonDisabled]}
              textStyle={styles.buttonText}
            />
            <Button
              title="ביטול"
              onPress={() => {
                if (user?.mustChangePassword) {
                  Alert.alert(
                    'התנתקות',
                    'האם אתה בטוח? תצטרך לשנות את הסיסמה בהתחברות הבאה.',
                    [
                      { text: 'המשך', style: 'cancel' },
                      {
                        text: 'התנתק',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await signOut(auth);
                            router.replace('/login');
                          } catch (error) {
                            console.error('Error signing out:', error);
                            router.replace('/login');
                          }
                        }
                      }
                    ]
                  );
                } else {
                  router.back();
                }
              }}
              variant="outline"
              disabled={isLoading}
              style={styles.cancelButton}
              textStyle={styles.cancelButtonText}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.primary,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.gold,
  },
  backButton: {
    padding: 8,
  },
  title: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: COLORS.gold,
  },
  content: {
    padding: 20,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 30,
    color: COLORS.text,
    lineHeight: 22,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: COLORS.gold,
    textAlign: 'right',
  },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    padding: 15,
    fontSize: 16,
    textAlign: 'right',
  },
  eyeIcon: {
    padding: 12,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.gold,
    borderWidth: 2,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButton: {
    flex: 2,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: COLORS.gold,
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    borderColor: COLORS.border,
    padding: 15,
  },
  cancelButtonText: {
    color: COLORS.text,
  },
});
