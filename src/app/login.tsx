// src/app/login.tsx
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';

// מסך לוגין משופר
export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginInProgress, setLoginInProgress] = useState(false);
  const { login, isAuthenticated, isLoading, error, clearError } = useAuth();
  
  // נוסיף לוגים מפורטים לצורך דיבוג
  useEffect(() => {
    console.log("Login screen mounted");
    // ניקוי שגיאות קודמות בטעינת המסך
    clearError?.();
    return () => console.log("Login screen unmounted");
  }, []);

  useEffect(() => {
    console.log('Login status changed:', { isAuthenticated, isLoading, error });
    
    // עדכון מצב הטעינה המקומי לפי מצב הטעינה הכללי
    if (!isLoading) {
      setLoginInProgress(false);
    }
    
    // אם המשתמש מאומת, ננסה לנווט ל-home2
    if (isAuthenticated && !isLoading) {
      console.log('Navigation to home2 will be attempted in 2 seconds');
      setTimeout(() => {
        console.log('Attempting navigation to home2');
        try {
          // שימוש ב-navigate במקום replace
          router.navigate('/(tabs)/home2');
          console.log('Navigation command executed');
        } catch (err) {
          console.error('Navigation error:', err);
        }
      }, 2000);
    }
  }, [isAuthenticated, isLoading, error]);

  // פונקציה לטיפול בכניסה למערכת
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("שגיאה", "אנא הזן אימייל וסיסמה");
      return;
    }

    try {
      // ניקוי שגיאות קודמות
      clearError?.();
      setLoginInProgress(true);
      console.log('Attempting login with:', email);
      await login(email, password);
      console.log('Login succeeded');
      // הניווט יתבצע באמצעות ה-useEffect שמאזין לשינויים ב-isAuthenticated
    } catch (err) {
      console.error('Login failed:', err);
      // שגיאות מטופלות בתוך פונקציית login, אז אין צורך בטיפול נוסף כאן
    }
    // לא מבצעים כאן finally וסומכים על ה-useEffect לעדכן את מצב הטעינה
  };

  // הניקוי של שדות הטופס בשינוי אימייל או סיסמה
  useEffect(() => {
    if (error) {
      console.log('Clearing error on input change');
      clearError?.();
    }
  }, [email, password]);

  // מסך טעינה פשוט - משתמשים בו רק אם isLoading = true במצב ההתחלתי
  if (isLoading && !loginInProgress) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>טוען...</Text>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  // מסך לוגין
  return (
    <View style={styles.container}>
      <Text style={styles.title}>התחברות למערכת</Text>
      
      {error && <Text style={styles.errorText}>{error}</Text>}
      
      {/* שדה אימייל */}
      <TextInput
        style={styles.input}
        placeholder="אימייל"
        placeholderTextColor="#888"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        editable={!loginInProgress}
      />
      
      {/* שדה סיסמה */}
      <TextInput
        style={styles.input}
        placeholder="סיסמה"
        placeholderTextColor="#888"
        secureTextEntry={true}
        value={password}
        onChangeText={setPassword}
        editable={!loginInProgress}
      />
      
      {/* כפתור התחברות */}
      <TouchableOpacity 
        style={[
          styles.button, 
          (!email || !password || loginInProgress) && styles.disabledButton
        ]} 
        onPress={handleLogin}
        disabled={loginInProgress || !email || !password}
      >
        {loginInProgress ? (
          <ActivityIndicator color="white" size="small" />
        ) : (
          <Text style={styles.buttonText}>התחבר</Text>
        )}
      </TouchableOpacity>
      
      {/* כפתור הרשמה */}
      <TouchableOpacity 
        style={styles.button} 
        onPress={() => router.navigate('/register')}
        disabled={loginInProgress}
      >
        <Text style={styles.buttonText}>הירשם</Text>
      </TouchableOpacity>
      
      {/* קישור לאיפוס סיסמה */}
      <TouchableOpacity 
        style={styles.forgotPassword}
        disabled={loginInProgress}
        onPress={() => {
          if (email) {
            Alert.alert(
              "איפוס סיסמה",
              "האם לשלוח קישור לאיפוס סיסמה לכתובת " + email + "?",
              [
                {
                  text: "ביטול",
                  style: "cancel"
                },
                {
                  text: "שלח",
                  onPress: async () => {
                    try {
                      setLoginInProgress(true);
                      // קריאה לפונקציית איפוס סיסמה מ-useAuth
                      const { resetPassword } = useAuth();
                      if (resetPassword) {
                        const success = await resetPassword(email);
                        if (success) {
                          Alert.alert("נשלח בהצלחה", "קישור לאיפוס סיסמה נשלח לכתובת האימייל שלך");
                        } else {
                          Alert.alert("שגיאה", "לא היה ניתן לשלוח קישור לאיפוס סיסמה");
                        }
                      }
                    } catch (error) {
                      console.error("שגיאה באיפוס סיסמה:", error);
                      Alert.alert("שגיאה", "לא היה ניתן לשלוח קישור לאיפוס סיסמה");
                    } finally {
                      setLoginInProgress(false);
                    }
                  }
                }
              ]
            );
          } else {
            Alert.alert("שגיאה", "אנא הזן את כתובת האימייל שלך קודם");
          }
        }}
      >
        <Text style={styles.forgotPasswordText}>שכחת סיסמה?</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0D1B1E',
    padding: 20,
  },
  title: {
    fontSize: 28,
    color: '#FFD700',
    marginBottom: 30,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 24,
    color: '#FFD700',
    marginBottom: 20,
  },
  errorText: {
    color: '#ef4444',
    marginBottom: 20,
    textAlign: 'center',
    padding: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    width: '80%',
  },
  input: {
    backgroundColor: '#1C2C2E',
    width: '80%',
    padding: 15,
    borderRadius: 8,
    color: 'white',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#FFD700',
    textAlign: 'right',
    direction: 'rtl',
  },
  button: {
    backgroundColor: '#35654d',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 8,
    marginBottom: 15,
    width: '70%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
    minHeight: 50,
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: '#1C2C2E',
    borderColor: '#666',
    opacity: 0.7,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  forgotPassword: {
    marginTop: 10,
  },
  forgotPasswordText: {
    color: '#FFD700',
    textDecorationLine: 'underline',
  }
});