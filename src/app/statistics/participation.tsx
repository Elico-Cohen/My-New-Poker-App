// src/app/statistics/participation.tsx

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Text } from '@/components/common/Text';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { Button } from '@/components/common/Button';
import { Dropdown } from '@/components/common/Dropdown';
import { useGroups } from '@/hooks/useAppStore';
import { getParticipationStatistics } from '@/services/statistics/playerStatistics';
import { ParticipationStats, StatisticsFilter, TimeFilter } from '@/models/Statistics';
import { Group } from '@/models/Group';
import StatisticsList from '@/components/statistics/StatisticsList';
import HeaderBar from '@/components/navigation/HeaderBar';
import { clearStatsCache } from '@/services/statistics/statisticsService';
import { syncService } from '@/store/SyncService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CASINO_COLORS = {
  background: '#0D1B1E',
  primary: '#35654d',
  gold: '#FFD700',
  surface: '#1C2C2E',
  text: '#FFFFFF',
  textSecondary: '#B8B8B8',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444'
};

export default function ParticipationScreen() {
  console.log('ParticipationScreen: הקומפוננטה נטענה מחדש');
  
  const router = useRouter();
  
  // הוקים לגישה לנתונים
  const { groups, loading: groupsLoading } = useGroups();
  
  // מעקב אחר מצב טעינה - משתמשים ב-useRef במקום useState למניעת רינדורים מיותרים
  const dataLoadedRef = useRef(false);
  const isMountedRef = useRef(false);
  const lastRefreshTimeRef = useRef(0);
  
  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ParticipationStats | null>(null);
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [groupOptions, setGroupOptions] = useState<{ label: string, value: string }[]>([]);
  const [groupFilter, setGroupFilter] = useState<string>('all');
  
  // טעינת הפילטרים השמורים בעת אתחול הקומפוננטה
  useEffect(() => {
    const loadSavedFilters = async () => {
      try {
        const savedTimeFilter = await AsyncStorage.getItem('participationTimeFilter');
        const savedGroupFilter = await AsyncStorage.getItem('participationGroupFilter');
        
        if (savedTimeFilter) {
          setTimeFilter(savedTimeFilter);
        }
        
        if (savedGroupFilter) {
          setGroupFilter(savedGroupFilter);
        }
      } catch (error) {
        console.error('שגיאה בטעינת הפילטרים השמורים:', error);
      }
    };
    
    loadSavedFilters();
  }, []);

  // שמירת הפילטרים כשהם משתנים
  useEffect(() => {
    const saveFilter = async () => {
      try {
        await AsyncStorage.setItem('participationTimeFilter', timeFilter);
      } catch (error) {
        console.error('שגיאה בשמירת פילטר זמן:', error);
      }
    };
    
    saveFilter();
  }, [timeFilter]);

  useEffect(() => {
    const saveFilter = async () => {
      try {
        await AsyncStorage.setItem('participationGroupFilter', groupFilter);
      } catch (error) {
        console.error('שגיאה בשמירת פילטר קבוצה:', error);
      }
    };
    
    saveFilter();
  }, [groupFilter]);
  
  // לוג מצב התחלתי
  console.log(`ParticipationScreen: מצב התחלתי - stats: ${stats ? 'יש נתונים' : 'אין נתונים'}, dataLoaded: ${dataLoadedRef.current}, groupsLoading: ${groupsLoading}`);
  
  // Time filter options
  const timeFilterOptions = [
    { label: 'כל הזמנים', value: 'all' },
    { label: 'חודש אחרון', value: 'month' },
    { label: 'רבעון אחרון', value: 'quarter' },
    { label: 'שנה אחרונה', value: 'year' }
  ];
  
  // יצירת אפשרויות הקבוצה מהנתונים שהתקבלו מההוק
  useEffect(() => {
    console.log('ParticipationScreen: useEffect עבור קבוצות נקרא');
    if (groups && groups.length > 0) {
      console.log(`ParticipationScreen: התקבלו ${groups.length} קבוצות מהמאגר`);
      
      // סינון רק קבוצות פעילות
      const activeGroups = groups.filter(group => group.isActive);
      console.log(`ParticipationScreen: ${activeGroups.length} קבוצות פעילות מתוך ${groups.length}`);
      
      const options = [
        { label: 'כל הקבוצות', value: 'all' },
        ...activeGroups.map((group: Group) => ({
          label: group.name,
          value: group.id
        }))
      ];
      setGroupOptions(options);
      console.log(`ParticipationScreen: נוצרו ${options.length} אפשרויות קבוצה כולל 'כל הקבוצות'`);
    } else {
      console.log('ParticipationScreen: לא התקבלו קבוצות או התקבל מערך ריק');
    }
  }, [groups]);
  
  // פונקציה לטעינת נתונים
  const loadData = async (forceRefresh = false) => {
    console.log('loadData called:', {
      forceRefresh,
      filters: { timeFilter, groupFilter }
    });

    // מונע טעינות כפולות קרובות מדי זו לזו
    const now = Date.now();
    const MIN_REFRESH_INTERVAL = 2000; // 2 שניות מינימום בין טעינות
    
    if (!forceRefresh && now - lastRefreshTimeRef.current < MIN_REFRESH_INTERVAL) {
      console.log('ParticipationScreen: דילוג על טעינה - חלף זמן קצר מדי מהטעינה האחרונה');
      return;
    }
    
    lastRefreshTimeRef.current = now;

    // בדיקה אם כבר מתבצעת טעינה
    if (loading) {
      console.log('כבר מתבצעת טעינה, מתעלם');
      return;
    }

    setLoading(true);
    try {
      // אם זה רענון מאולץ, מנקה את המטמון
      if (forceRefresh) {
        console.log('ParticipationScreen: ביצוע רענון מאולץ - מנקה מטמון');
        clearStatsCache();
        await syncService.forceRefresh();
      }

      const filter: StatisticsFilter = {
        timeFilter: timeFilter as TimeFilter,
        groupId: groupFilter !== 'all' ? groupFilter : undefined,
        statuses: ['completed', 'final_results']
      };
      console.log('מתחיל טעינת נתונים עם הפילטרים:', filter);
      
      const result = await getParticipationStatistics(filter);
      console.log('התקבלו נתונים מהשרת:', {
        playersCount: result.playerParticipation.length,
        participationRates: result.playerParticipation.map(p => ({
          name: p.playerName,
          rate: p.participationRate
        }))
      });
      
      setStats(result);
      // מעדכן שהנתונים נטענו בהצלחה
      dataLoadedRef.current = true;
      console.log('הנתונים עודכנו בהצלחה, dataLoaded=true');
    } catch (error) {
      console.error('שגיאה בטעינת נתונים:', error);
      setError('אירעה שגיאה בטעינת נתוני ההשתתפות');
      Alert.alert('שגיאה', 'אירעה שגיאה בטעינת נתוני ההשתתפות');
    } finally {
      setLoading(false);
    }
  };
  
  // בדיקה האם יש צורך בטעינת נתונים
  const checkAndLoadData = React.useCallback((force = false) => {
    if (force || !dataLoadedRef.current) {
      console.log('ParticipationScreen: טוען נתונים - force:', force, ', dataLoaded:', dataLoadedRef.current);
      loadData(force);
    } else {
      console.log('ParticipationScreen: הנתונים כבר נטענו, דילוג על טעינה');
    }
  }, [timeFilter, groupFilter]);
  
  // טעינת נתונים בטעינה ראשונית
  useEffect(() => {
    if (!isMountedRef.current && !groupsLoading) {
      console.log('ParticipationScreen: מתחיל טעינה ראשונית של המסך');
      isMountedRef.current = true;
      checkAndLoadData();
    }
  }, [groupsLoading, checkAndLoadData]);
  
  // טעינת הנתונים כאשר משתנים הפילטרים
  useEffect(() => {
    if (isMountedRef.current) {
      console.log('ParticipationScreen: הפילטרים השתנו, טוען נתונים מחדש');
      // כשפילטרים משתנים, תמיד טוענים מחדש כי הנתונים צריכים להשתנות
      dataLoadedRef.current = false;
      loadData(false); // אנחנו רוצים לטעון ישירות ולא לעבור דרך checkAndLoadData
    }
  }, [timeFilter, groupFilter]);
  
  // טעינת נתונים בכל פעם שהמסך מקבל פוקוס (חוזרים למסך)
  useFocusEffect(
    React.useCallback(() => {
      console.log('ParticipationScreen: המסך קיבל פוקוס, בודק אם יש נתונים');
      
      // אם כבר יש נתונים, לא צריך לטעון מחדש
      if (dataLoadedRef.current) {
        console.log('ParticipationScreen: הנתונים כבר נטענו, אין צורך בטעינה מחדש');
      } else {
        console.log('ParticipationScreen: אין נתונים, מבצע טעינה במעבר למסך');
        checkAndLoadData();
      }
      
      return () => {
        // נקיון בעת יציאה מהמסך (אופציונלי)
        console.log('ParticipationScreen: יציאה מהמסך');
      };
    }, [checkAndLoadData])
  );
  
  // פונקציית רענון
  const handleRefresh = () => {
    console.log('ParticipationScreen: הופעל רענון ידני');
    // איפוס הדגל לרענון ידני
    dataLoadedRef.current = false; 
    loadData(true); // forceRefresh = true
  };
  
  // חזרה למסך הסטטיסטיקה הראשי
  const handleBack = () => {
    console.log('ParticipationScreen: לחיצה על כפתור חזרה - חוזר למסך הסטטיסטיקות הראשי');
    // ניווט למסך הסטטיסטיקות הראשי באמצעות שם קובץ index
    router.replace("../index");
  };
  
  return (
    <View style={styles.container}>
      {/* הסרה מוחלטת של הכותרת הלבנה */}
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <HeaderBar 
        title="סטטיסטיקת השתתפות"
        showBack={true}
        backgroundColor={CASINO_COLORS.primary}
        textColor={CASINO_COLORS.gold}
        borderColor={CASINO_COLORS.gold}
        onBackPress={handleBack}
        leftElement={
          <TouchableOpacity onPress={handleRefresh} style={styles.headerRefreshButton}>
            <Icon name="refresh" size={24} color={CASINO_COLORS.gold} />
          </TouchableOpacity>
        }
      />
      
      {/* Filters and refresh button */}
      <View style={styles.filtersContainer}>
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>קבוצה:</Text>
          <View style={styles.filterControl}>
            <Dropdown
              value={groupFilter}
              onSelect={(value) => {
                console.log(`ParticipationScreen: נבחרה קבוצה חדשה: ${value}`);
                setGroupFilter(value);
              }}
              items={groupOptions}
            />
          </View>
        </View>
        
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>תקופה:</Text>
          <View style={styles.filterControl}>
            <Dropdown
              value={timeFilter}
              onSelect={(value) => {
                console.log(`ParticipationScreen: נבחר פילטר זמן חדש: ${value}`);
                setTimeFilter(value);
              }}
              items={timeFilterOptions}
            />
          </View>
        </View>
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={CASINO_COLORS.gold} />
          <Text style={styles.loadingText}>טוען סטטיסטיקות...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size="large" color={CASINO_COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
          <Button 
            title="נסה שוב" 
            onPress={handleRefresh} 
            style={styles.retryButton}
          />
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
        >
          {/* רק טבלת השחקנים - הסרנו את הכרטיסים, התרשימים והגרפים */}
          <Card style={styles.card}>
            <View style={styles.titleContainer}>
              <View style={styles.titleWithIcon}>
                <Icon 
                  name="account-group" 
                  size="medium" 
                  color={CASINO_COLORS.gold} 
                  style={styles.titleIcon} 
                />
                <Text style={styles.cardTitle}>רשימת השתתפות במשחקים</Text>
              </View>
            </View>
            
            {stats && stats.playerParticipation.length > 0 ? (
              <View>
                {/* Players Ranking List */}
                <StatisticsList
                  items={stats.playerParticipation
                    // הוספת מיון: קודם לפי אחוז השתתפות (יורד), ואז לפי שם (בסדר א'-ב')
                    .sort((a, b) => {
                      // קודם מיון לפי אחוז השתתפות (יורד)
                      if (b.participationRate !== a.participationRate) {
                        return b.participationRate - a.participationRate;
                      }
                      // אם אחוז ההשתתפות זהה, מיון לפי שם (א'-ב')
                      return a.playerName.localeCompare(b.playerName, 'he');
                    })
                    .map((player) => ({
                      id: player.playerId,
                      title: player.playerName,
                      value: `${player.gamesCount} משחקים`,
                      subtitle: `${player.participationRate.toFixed(1)}% מהמשחקים`,
                      // הסרת האייקונים של 3 המקומות הראשונים
                      valueColor: CASINO_COLORS.gold,
                    }))}
                  showRank={true}
                  showDividers={true}
                />
              </View>
            ) : (
              <View style={styles.noDataContainer}>
                <Icon name="information-outline" size="large" color={CASINO_COLORS.warning} />
                <Text style={styles.noDataText}>אין נתונים זמינים</Text>
                <Text style={styles.noDataSubtext}>
                  {stats ? 'לא נמצאו שחקנים שהשתתפו במשחקים בתקופה זו' : 'לא התקבלו נתונים מהשרת'}
                </Text>
                <Button 
                  title="רענן" 
                  onPress={handleRefresh} 
                  style={styles.refreshButton}
                />
              </View>
            )}
          </Card>
          
          {/* View ריק בסוף המסך ליצירת מרווח נוסף בתחתית */}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}
    </View>
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
    backgroundColor: CASINO_COLORS.primary,
    padding: 16,
    borderBottomWidth: 2,
    borderBottomColor: CASINO_COLORS.gold,
  },
  headerTitle: {
    color: CASINO_COLORS.gold,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtersContainer: {
    backgroundColor: CASINO_COLORS.surface,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: CASINO_COLORS.gold,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    justifyContent: 'space-between',
  },
  filterLabel: {
    color: CASINO_COLORS.textSecondary,
    fontSize: 16,
    fontWeight: 'bold',
    marginStart: 10,
    textAlign: 'right',
  },
  filterControl: {
    flex: 1,
    maxWidth: '70%',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 16,
  },
  card: {
    backgroundColor: CASINO_COLORS.surface,
    marginBottom: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleIcon: {
    marginStart: 8,
  },
  cardTitle: {
    color: CASINO_COLORS.gold,
    fontSize: 18,
    fontWeight: 'bold',
    marginEnd: 10,
    textAlign: 'right',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: CASINO_COLORS.gold,
    fontSize: 16,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: CASINO_COLORS.error,
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: CASINO_COLORS.primary,
  },
  noDataContainer: {
    alignItems: 'center',
    padding: 20,
  },
  noDataText: {
    color: CASINO_COLORS.textSecondary,
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
    textAlign: 'center',
  },
  noDataSubtext: {
    color: CASINO_COLORS.textSecondary,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  refreshButton: {
    marginTop: 16,
    backgroundColor: CASINO_COLORS.primary,
  },
  headerRefreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSpacer: {
    height: 60,
  },
  // styles for the header go here
});