// src/app/statistics/games.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Text } from '@/components/common/Text';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { Dropdown } from '@/components/common/Dropdown';
import { Button } from '@/components/common/Button';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { getGameStatistics } from '@/services/statistics/statisticsService';
import { GameStatisticsResponse } from '@/services/statistics/gameStatistics';
import { StatisticsFilter } from '@/models/Statistics';
import { useGroups } from '@/hooks/useAppStore';
import StatisticsChart from '@/components/statistics/StatisticsChart';
import StatCard from '@/components/statistics/StatCard';
import StatisticsList from '@/components/statistics/StatisticsList';
import { formatCurrency } from '@/utils/formatters/currencyFormatter';
import { clearStatsCache } from '@/services/statistics/statisticsService';
import { syncService } from '@/store/SyncService';
import HeaderBar from '@/components/navigation/HeaderBar';

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

interface CustomStatCardProps {
  title: string;
  value: string;
  icon: string;
  iconColor?: string;
}

export default function GamesStatisticsScreen() {
  console.log('🔄 GamesStatisticsScreen: המסך נטען');
  
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // מצב המסך
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statistics, setStatistics] = useState<GameStatisticsResponse | null>(null);
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<string>(
    params.timeFilter as string || 'all'
  );
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    params.groupId as string || ''
  );
  
  // שימוש בהוק החדש לקבלת קבוצות
  const { groups, loading: groupsLoading } = useGroups();
  
  // אפשרויות סינון זמן
  const timeFilterOptions = [
    { label: 'הכל', value: 'all' },
    { label: 'חודש אחרון', value: 'month' },
    { label: 'רבעון אחרון', value: 'quarter' },
    { label: 'שנה אחרונה', value: 'year' }
  ];
  
  // יצירת אפשרויות קבוצה לדרופדאון
  const groupOptions = [
    { label: 'כל הקבוצות', value: '' },
    ...groups
      .filter(group => group.isActive) // סינון רק קבוצות פעילות
      .map(group => ({
        label: group.name,
        value: group.id
      }))
  ];
  
  // טעינת נתונים לפי סינון
  const loadData = async (forceRefresh = false) => {
    try {
      console.log('🔄 GamesScreen: מתחיל טעינת נתונים, forceRefresh=', forceRefresh);
      // מאפס את המצב לפני הטעינה
      setIsLoading(true);
      setError(null);
      
      // מגדירים timeout למקרה שהטעינה לא מסתיימת תוך זמן סביר
      const timeout = setTimeout(() => {
        console.warn('⚠️ GamesScreen: טיימאאוט בטעינת נתונים - מסיים טעינה');
        setIsLoading(false);
        setError('הטעינה נמשכה זמן רב מדי. נסה לרענן את המסך.');
      }, 10000); // 10 שניות טיימאאוט
      
      if (forceRefresh) {
        console.log('🔄 GamesScreen: מנקה מטמון ומרענן נתונים מהשרת');
        clearStatsCache();
        await syncService.forceRefresh();
      } else {
        console.log('🔄 GamesScreen: טוען נתונים מהמטמון אם קיימים');
      }
      
      // יצירת אובייקט הסינון עם הערכים הנוכחיים
      const filter: StatisticsFilter = {
        timeFilter: selectedTimeFilter as 'all' | 'month' | 'quarter' | 'year',
        groupId: selectedGroupId ? selectedGroupId : undefined,
        // מציג רק משחקים בסטטוס 'completed'
        statuses: ['completed']
      };
      
      console.log('🔄 GamesScreen: מבקש סטטיסטיקות משחקים עם פילטר:', filter);

      // קבלת הנתונים מהשירות
      console.log('🔄 GamesScreen: לפני קריאה לפונקציה getGameStatistics');
      let stats: GameStatisticsResponse | null = null;
      
      try {
        stats = await getGameStatistics(filter);
        console.log('✅ GamesScreen: getGameStatistics החזירה נתונים');
      } catch (innerError) {
        console.error('❌ GamesScreen: שגיאה בקריאה ל-getGameStatistics:', innerError);
        throw new Error(`שגיאה בקריאה לפונקציית הסטטיסטיקות: ${innerError}`);
      }
      
      if (!stats) {
        console.error('❌ GamesScreen: התקבל ערך null או undefined מ-getGameStatistics');
        throw new Error('לא התקבלו נתונים מהשירות');
      }
      
      // מבטל את הטיימאאוט כי הצלחנו לקבל נתונים
      clearTimeout(timeout);
      
      console.log('🔍 GamesScreen: בדיקת מבנה הנתונים שהתקבלו:', {
        monthlyStats: stats.monthlyStats ? `יש ${stats.monthlyStats.length} פריטים` : 'חסר',
        groupStats: stats.groupStats ? `יש ${stats.groupStats.length} פריטים` : 'חסר',
        averagePlayersPerGame: stats.averagePlayersPerGame !== undefined ? stats.averagePlayersPerGame : 'חסר',
        totalGames: stats.totalGames !== undefined ? stats.totalGames : 'חסר',
        activePlayers: stats.activePlayers !== undefined ? stats.activePlayers : 'חסר',
        totalRebuys: stats.totalRebuys !== undefined ? stats.totalRebuys : 'חסר',
        totalMoney: stats.totalMoney !== undefined ? stats.totalMoney : 'חסר',
        averageRebuysPerGame: stats.averageRebuysPerGame !== undefined ? stats.averageRebuysPerGame : 'חסר',
        averageMoneyPerGame: stats.averageMoneyPerGame !== undefined ? stats.averageMoneyPerGame : 'חסר',
        averageMoneyPerPlayer: stats.averageMoneyPerPlayer !== undefined ? stats.averageMoneyPerPlayer : 'חסר'
      });
      
      // וידוא שכל השדות קיימים
      if (!stats.monthlyStats) {
        console.log('⚠️ GamesScreen: שדה monthlyStats חסר, משתמש בברירת מחדל');
        stats.monthlyStats = [];
      }
      
      if (stats.totalGames === undefined) {
        console.log('⚠️ GamesScreen: שדה totalGames חסר, משתמש בברירת מחדל');
        stats.totalGames = stats.monthlyStats.reduce((sum: number, month: { games: number }) => sum + month.games, 0);
      }
      
      if (stats.activePlayers === undefined) {
        console.log('⚠️ GamesScreen: שדה activePlayers חסר, משתמש בברירת מחדל');
        stats.activePlayers = 0; // ברירת מחדל
      }
      
      if (stats.totalRebuys === undefined) {
        console.log('⚠️ GamesScreen: שדה totalRebuys חסר, משתמש בברירת מחדל');
        stats.totalRebuys = 0; // ברירת מחדל
      }
      
      if (stats.totalMoney === undefined) {
        console.log('⚠️ GamesScreen: שדה totalMoney חסר, משתמש בברירת מחדל');
        stats.totalMoney = stats.monthlyStats.reduce((sum: number, month: { money: number }) => sum + month.money, 0);
      }
      
      if (stats.averageRebuysPerGame === undefined) {
        console.log('⚠️ GamesScreen: שדה averageRebuysPerGame חסר, משתמש בברירת מחדל');
        stats.averageRebuysPerGame = 0; // ברירת מחדל
      }
      
      if (stats.averageMoneyPerGame === undefined) {
        console.log('⚠️ GamesScreen: שדה averageMoneyPerGame חסר, משתמש בברירת מחדל');
        stats.averageMoneyPerGame = stats.totalGames > 0 ? stats.totalMoney / stats.totalGames : 0;
      }
      
      if (stats.averageMoneyPerPlayer === undefined) {
        console.log('⚠️ GamesScreen: שדה averageMoneyPerPlayer חסר, משתמש בחישוב מקומי');
        // חישוב נכון: סה"כ קניות מחולק בסה"כ המשתתפים בכל המשחקים
        // סה"כ משתתפים = ממוצע שחקנים למשחק * מספר משחקים
        const totalParticipants = stats.averagePlayersPerGame * stats.totalGames;
        stats.averageMoneyPerPlayer = totalParticipants > 0 ? stats.totalMoney / totalParticipants : 0;
      }
      
      // שדות שהתווספו בגרסה החדשה
      if (!stats.playerDistribution) {
        console.log('⚠️ GamesScreen: שדה playerDistribution חסר, משתמש בברירת מחדל');
        stats.playerDistribution = [];
      }
      
      if (!stats.gameByDayOfWeek) {
        console.log('⚠️ GamesScreen: שדה gameByDayOfWeek חסר, משתמש בברירת מחדל');
        stats.gameByDayOfWeek = [];
      }
      
      if (!stats.rebuyDistribution) {
        console.log('⚠️ GamesScreen: שדה rebuyDistribution חסר, משתמש בברירת מחדל');
        stats.rebuyDistribution = [];
      }
      
      if (!stats.investmentDistribution) {
        console.log('⚠️ GamesScreen: שדה investmentDistribution חסר, משתמש בברירת מחדל');
        stats.investmentDistribution = [];
      }
      
      if (!stats.topGames) {
        console.log('⚠️ GamesScreen: שדה topGames חסר, משתמש בברירת מחדל');
        stats.topGames = [];
      }
      
      console.log('✅ GamesScreen: כל השדות הנדרשים קיימים או הושלמו');
      setStatistics(stats);
      
      console.log('✅ GamesScreen: הנתונים הועברו בהצלחה למצב הקומפוננטה');
    } catch (error) {
      console.error('❌ שגיאה בטעינת סטטיסטיקות משחקים:', error);
      setError(`שגיאה בטעינת הנתונים: ${error instanceof Error ? error.message : 'תקלה לא ידועה'}`);
    } finally {
      setIsLoading(false);
      console.log('✅ GamesScreen: סיום תהליך הטעינה, isLoading=false');
    }
  };
  
  // טעינת נתונים בעת טעינת המסך או שינוי פילטרים
  useEffect(() => {
    console.log('🔄 GamesScreen: useEffect נקרא, groupsLoading=', groupsLoading);
    // טוען נתונים גם אם הקבוצות עדיין נטענות - בכל מקרה יש ברירות מחדל
    console.log('🔄 GamesScreen: מתחיל לטעון נתונים מ-useEffect');
    loadData(false); // לא מרענן בכפייה בטעינה ראשונית
  }, [selectedTimeFilter, selectedGroupId]);
  
  // טעינת נתונים בעת חזרה למסך
  useFocusEffect(
    useCallback(() => {
      console.log('🔄 GamesScreen: useFocusEffect הופעל - המסך קיבל פוקוס');
      // תמיד לטעון נתונים, גם אם הקבוצות עדיין בטעינה
      console.log('🔄 GamesScreen: מרענן נתונים בעת חזרה למסך');
      loadData(false);
      
      return () => {
        console.log('🔄 GamesScreen: המסך איבד פוקוס');
      };
    }, [])  // הסרנו את התלות ב-groupsLoading לגמרי
  );
  
  // בדיקה אם יש מידע בסטטיסטיקות
  const hasStats = statistics && (
    statistics.monthlyStats?.length > 0 || 
    statistics.totalGames > 0 ||
    statistics.activePlayers > 0
  );

  console.log('🔍 GamesScreen: האם יש נתונים בסטטיסטיקות:', hasStats ? 'כן' : 'לא');

  // רענון נתונים
  const handleRefresh = () => {
    console.log('🔄 GamesScreen: לחיצה על כפתור רענון');
    loadData(true); // מרענן בכפייה כשהמשתמש לוחץ על הכפתור
  };
  
  // חזרה למסך הסטטיסטיקות הראשי
  const handleBack = () => {
    console.log('🔄 GamesScreen: לחיצה על כפתור חזרה - חוזר למסך הסטטיסטיקות הראשי');
    // ניווט למסך הסטטיסטיקות הראשי באמצעות שם קובץ index
    router.replace("../index");
  };
  
  // יצירת אלמנט כפתור רענון לכותרת
  const refreshButtonElement = (
    <TouchableOpacity 
      onPress={handleRefresh}
      style={styles.headerButton}
      activeOpacity={0.6}
    >
      <Icon name="refresh" size={28} color={CASINO_COLORS.gold} />
    </TouchableOpacity>
  );
  
  const CustomStatCard = ({ 
    title, 
    value, 
    icon, 
    iconColor = CASINO_COLORS.gold 
  }: CustomStatCardProps) => {
    return (
      <View style={styles.customCard}>
        {/* אייקון בשורה העליונה */}
        <View style={styles.cardIconRow}>
          <Icon name={icon as any} size={26} color={iconColor} />
        </View>

        {/* טקסט ונתון באותה שורה */}
        <View style={styles.cardContentRow}>
          <Text style={styles.cardStatValue}>{value}</Text>
          <Text style={styles.cardStatTitle}>{title}</Text>
        </View>
      </View>
    );
  };
  
  if (isLoading) {
    console.log('🔄 GamesScreen: מציג מסך טעינה');
    return (
      <View style={styles.container}>
        <HeaderBar
          title="סטטיסטיקת משחקים"
          showBack={true}
          onBackPress={handleBack}
          backgroundColor={CASINO_COLORS.primary}
          textColor={CASINO_COLORS.gold}
          borderColor={CASINO_COLORS.gold}
          leftElement={refreshButtonElement}
        />
        <View style={styles.loadingContainer}>
          <LoadingIndicator size="large" />
          <Text style={styles.loadingText}>טוען סטטיסטיקות משחקים...</Text>
        </View>
      </View>
    );
  }
  
  if (error) {
    console.log('❌ GamesScreen: מציג מסך שגיאה:', error);
    return (
      <View style={styles.container}>
        <HeaderBar
          title="סטטיסטיקת משחקים"
          showBack={true}
          onBackPress={handleBack}
          backgroundColor={CASINO_COLORS.primary}
          textColor={CASINO_COLORS.gold}
          borderColor={CASINO_COLORS.gold}
          leftElement={refreshButtonElement}
        />
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={48} color={CASINO_COLORS.warning} />
          <Text style={styles.errorText}>{error}</Text>
          <Button title="נסה שוב" onPress={handleRefresh} />
        </View>
      </View>
    );
  }
  
  if (!statistics || !hasStats) {
    console.log('❌ GamesScreen: אין נתונים להצגה');
    return (
      <View style={styles.container}>
        <HeaderBar
          title="סטטיסטיקת משחקים"
          showBack={true}
          onBackPress={handleBack}
          backgroundColor={CASINO_COLORS.primary}
          textColor={CASINO_COLORS.gold}
          borderColor={CASINO_COLORS.gold}
          leftElement={refreshButtonElement}
        />
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={48} color={CASINO_COLORS.warning} />
          <Text style={styles.errorText}>אין נתוני סטטיסטיקה זמינים כרגע</Text>
          <Button title="נסה שוב" onPress={handleRefresh} />
        </View>
      </View>
    );
  }
  
  console.log('✅ GamesScreen: מציג את המסך הראשי עם הנתונים');
  return (
    <View style={styles.container}>
      <HeaderBar
        title="סטטיסטיקת משחקים"
        showBack={true}
        onBackPress={handleBack}
        backgroundColor={CASINO_COLORS.primary}
        textColor={CASINO_COLORS.gold}
        borderColor={CASINO_COLORS.gold}
        leftElement={refreshButtonElement}
      />
      <ScrollView style={styles.scrollContainer}>
        {/* פילטרים */}
        <View style={styles.filtersContainer}>
          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>תקופה:</Text>
            <Dropdown
              items={timeFilterOptions}
              value={selectedTimeFilter}
              onSelect={(value) => setSelectedTimeFilter(value as string)}
              placeholder="בחר תקופה"
              style={styles.dropdown}
            />
          </View>
          
          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>קבוצה:</Text>
            <Dropdown
              items={groupOptions.map(item => ({
                label: item.label,
                value: item.value || ''
              }))}
              value={selectedGroupId || ''}
              onSelect={(value) => setSelectedGroupId(value)}
              placeholder="בחר קבוצה"
              style={styles.dropdown}
            />
          </View>
        </View>
        
        {statistics && (
          <>
            {/* כרטיסי סיכום */}
            <View style={styles.summaryCardsContainer}>
              <CustomStatCard 
                title="שחקנים פעילים"
                value={(statistics.activePlayers !== undefined) ? statistics.activePlayers.toString() : '0'}
                icon="account-group"
              />
              
              <CustomStatCard 
                title="סה״כ משחקים"
                value={(statistics.totalGames !== undefined) ? statistics.totalGames.toString() : '0'}
                icon="cards"
              />
              
              <CustomStatCard 
                title="ריבאיים"
                value={(statistics.totalRebuys !== undefined) ? statistics.totalRebuys.toString() : '0'}
                icon="refresh"
              />
              
              <CustomStatCard 
                title="סה״כ קניות"
                value={formatCurrency(statistics.totalMoney !== undefined ? statistics.totalMoney : 0)}
                icon="cash"
              />
            </View>
            
            {/* כרטיס גדול עם ממוצעים */}
            <Card style={styles.averagesCard}>
              <Text style={styles.averagesTitle}>פעילות משחקים ושחקנים</Text>
              <View style={styles.averagesGrid}>
                {/* ממוצע ריבאיים למשחק */}
                <View style={styles.averageItem}>
                  <Text style={styles.averageLabel}>ממוצע ריבאיים למשחק</Text>
                  <Text style={styles.averageValue}>
                    {(statistics.averageRebuysPerGame !== undefined) ? 
                      statistics.averageRebuysPerGame.toFixed(1) : '0.0'}
                  </Text>
                </View>
                
                {/* ממוצע קניות למשחק */}
                <View style={styles.averageItem}>
                  <Text style={styles.averageLabel}>ממוצע קניות למשחק</Text>
                  <Text style={styles.averageValue}>
                    {formatCurrency(statistics.averageMoneyPerGame !== undefined ? 
                      statistics.averageMoneyPerGame : 0)}
                  </Text>
                </View>
                
                {/* ממוצע שחקנים למשחק */}
                <View style={styles.averageItem}>
                  <Text style={styles.averageLabel}>ממוצע שחקנים למשחק</Text>
                  <Text style={styles.averageValue}>
                    {(statistics.averagePlayersPerGame !== undefined) ? 
                      statistics.averagePlayersPerGame.toFixed(1) : '0.0'}
                  </Text>
                </View>
                
                {/* ממוצע קניות לשחקן */}
                <View style={styles.averageItem}>
                  <Text style={styles.averageLabel}>ממוצע קניות לשחקן</Text>
                  <Text style={styles.averageValue}>
                    {formatCurrency(statistics.averageMoneyPerPlayer !== undefined ? 
                      statistics.averageMoneyPerPlayer : 0)}
                  </Text>
                </View>
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CASINO_COLORS.background,
  },
  scrollContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: CASINO_COLORS.textSecondary,
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: CASINO_COLORS.error,
    marginTop: 16,
    marginBottom: 20,
    fontSize: 16,
    textAlign: 'center',
  },
  filtersContainer: {
    flexDirection: 'column',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: CASINO_COLORS.surface,
    marginBottom: 8,
  },
  filterItem: {
    marginBottom: 8,
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  filterLabel: {
    color: CASINO_COLORS.text,
    marginLeft: 8,
    fontWeight: 'bold',
    minWidth: 60,
    textAlign: 'right',
  },
  dropdown: {
    backgroundColor: CASINO_COLORS.background,
    borderWidth: 0,
    flex: 1,
  },
  summaryCardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginVertical: 12,
  },
  averagesCard: {
    marginBottom: 16,
    marginHorizontal: 16,
    backgroundColor: CASINO_COLORS.surface,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
    borderRadius: 8,
    padding: 16,
  },
  averagesTitle: {
    color: CASINO_COLORS.gold,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  averagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  averageItem: {
    width: '48%',
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#1C2C2E',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CASINO_COLORS.primary,
  },
  averageLabel: {
    color: CASINO_COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  averageValue: {
    color: CASINO_COLORS.gold,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  chartCard: {
    marginBottom: 16,
    marginHorizontal: 16,
    backgroundColor: CASINO_COLORS.surface,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
    borderRadius: 8,
    padding: 16,
  },
  cardTitle: {
    color: CASINO_COLORS.gold,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  listCard: {
    marginBottom: 16,
    marginHorizontal: 16,
    backgroundColor: CASINO_COLORS.surface,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
    borderRadius: 8,
    padding: 16,
  },
  refreshButton: {
    marginTop: 16,
    marginHorizontal: 16,
    marginBottom: 24,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  customCard: {
    width: '48%',
    backgroundColor: CASINO_COLORS.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: CASINO_COLORS.gold,
    padding: 12,
    marginBottom: 12,
    height: 120,
    justifyContent: 'space-between',
  },
  cardIconRow: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  cardContentRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardStatTitle: {
    fontSize: 12,
    color: CASINO_COLORS.textSecondary,
    marginRight: 8,
  },
  cardStatValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: CASINO_COLORS.gold,
  },
});