import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();

  // פונקציה לטעינת הסטטיסטיקות
  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('HomeScreen: מנקה מטמון ומרענן נתונים');
      clearStatsCache();
      await syncService.forceRefresh();
      
      // טעינת פרופיל המשתמש
      const userProfile = await getUserProfile(auth.currentUser?.email || '');
      setUserProfile(userProfile);
      
      // טעינת סטטיסטיקות קבוצה
      const groupStats = await fetchGroupStatistics();
      setGroupStatistics(groupStats);
      
      // טעינת סטטיסטיקות מנצחים ומפסידים
      const winnersLosers = await getWinnersLosersStatistics(5);
      setWinnersLosersStats(winnersLosers);
      
      console.log('HomeScreen: טעינת סטטיסטיקות הושלמה בהצלחה');
    } catch (error) {
      console.error('שגיאה בטעינת סטטיסטיקות:', error);
      setError('שגיאה בטעינת הנתונים. נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home Screen</Text>

      {/* כפתור לניווט ל-StartGame */}
      <Button
        title="Go to Start Game"
        onPress={() => router.push('/gameFlow/StartGame')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
});
