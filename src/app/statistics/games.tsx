// src/app/statistics/games.tsx

import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Text } from '@/components/common/Text';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { Dropdown } from '@/components/common/Dropdown';
import { Button } from '@/components/common/Button';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { getGameStatistics } from '@/services/statistics/gameStatistics';
import { GameStatisticsResponse, StatisticsFilter } from '@/models/Statistics';
import { useGroups } from '@/hooks/useAppStore';
import StatisticsChart from '@/components/statistics/StatisticsChart';
import StatCard from '@/components/statistics/StatCard';
import StatisticsList from '@/components/statistics/StatisticsList';
import { formatCurrency } from '@/utils/formatters/currencyFormatter';
import { clearStatsCache } from '@/services/statistics/statisticsService';
import { syncService } from '@/store/SyncService';

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

export default function GamesStatisticsScreen() {
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
    ...groups.map(group => ({
      label: group.name,
      value: group.id
    }))
  ];
  
  // טעינת נתונים לפי סינון
  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('GamesScreen: מנקה מטמון ומרענן נתונים מהשרת');
      clearStatsCache();
      await syncService.forceRefresh();
      
      // יצירת אובייקט הסינון עם הערכים הנוכחיים
      const filter: StatisticsFilter = {
        timeFilter: selectedTimeFilter as 'all' | 'month' | 'quarter' | 'year',
        groupId: selectedGroupId ? selectedGroupId : undefined,
        // מציג רק משחקים בסטטוס 'completed'
        statuses: ['completed']
      };
      
      console.log('GamesScreen: מבקש סטטיסטיקות משחקים עם פילטר:', filter);

      // קבלת הנתונים מהשירות
      const stats = await getGameStatistics(filter);
      console.log('GamesScreen: התקבלו נתוני משחקים:', {
        monthlyStats: stats.monthlyStats?.length || 0,
        groupStats: stats.groupStats?.length || 0,
        averagePlayersPerGame: stats.averagePlayersPerGame || 0
      });
      
      setStatistics(stats);
      
      console.log('GamesScreen: התקבלו נתוני משחקים בהצלחה');
    } catch (error) {
      console.error('שגיאה בטעינת סטטיסטיקות משחקים:', error);
      setError('שגיאה בטעינת הנתונים. נסה שוב.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // טעינת נתונים בעת טעינת המסך או שינוי פילטרים
  useEffect(() => {
    if (!groupsLoading) {
      loadData();
    }
  }, [selectedTimeFilter, selectedGroupId, groupsLoading]);
  
  // רענון נתונים
  const handleRefresh = () => {
    loadData();
  };
  
  // חזרה למסך הסטטיסטיקות הראשי
  const handleBack = () => {
    router.back();
  };
  
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingIndicator size="large" />
        <Text style={styles.loadingText}>טוען סטטיסטיקות משחקים...</Text>
      </View>
    );
  }
  
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="alert-circle-outline" size={48} color={CASINO_COLORS.error} />
        <Text style={styles.errorText}>{error}</Text>
        <Button title="נסה שוב" onPress={handleRefresh} />
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container}>
      {/* כפתור חזרה */}
      <TouchableOpacity style={styles.backButton} onPress={handleBack}>
        <Icon name="arrow-right" size={24} color={CASINO_COLORS.gold} />
        <Text style={styles.backButtonText}>חזרה לסטטיסטיקות</Text>
      </TouchableOpacity>
      
      <Text style={styles.screenTitle}>סטטיסטיקת משחקים</Text>
      
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
            <StatCard
              title="ממוצע שחקנים"
              value={statistics.averagePlayersPerGame.toFixed(1)}
              icon="account-group"
              color={CASINO_COLORS.primary}
            />
            
            <StatCard
              title="סה״כ משחקים"
              value={statistics.monthlyStats.reduce((sum, month) => sum + month.games, 0).toString()}
              icon="cards"
              color={CASINO_COLORS.gold}
            />
            
            <StatCard
              title="סה״כ כסף"
              value={formatCurrency(statistics.monthlyStats.reduce((sum, month) => sum + month.money, 0))}
              icon="cash"
              color={CASINO_COLORS.success}
            />
          </View>
          
          {/* גרף חודשי */}
          {statistics.monthlyStats.length > 0 && (
            <Card style={styles.chartCard}>
              <Text style={styles.cardTitle}>מגמות לפי חודש</Text>
              <StatisticsChart 
                data={statistics.monthlyStats.map(item => ({
                  name: item.month,
                  משחקים: item.games,
                  כסף: item.money / 100 // מחלקים ב-100 לצורך תצוגה נוחה יותר בגרף
                }))}
              />
            </Card>
          )}
          
          {/* סטטיסטיקות לפי קבוצה */}
          {statistics.groupStats && statistics.groupStats.length > 0 && (
            <Card style={styles.listCard}>
              <Text style={styles.cardTitle}>סטטיסטיקות לפי קבוצה</Text>
              <StatisticsList
                data={statistics.groupStats.map(group => ({
                  title: group.name,
                  subtitle: `${group.games} משחקים`,
                  value: formatCurrency(group.totalMoney)
                }))}
              />
            </Card>
          )}
          
          {/* התפלגות שחקנים */}
          {statistics.playerDistribution.length > 0 && (
            <Card style={styles.listCard}>
              <Text style={styles.cardTitle}>התפלגות מספר שחקנים</Text>
              <StatisticsList
                data={statistics.playerDistribution.map(item => ({
                  title: `${item.playerCount} שחקנים`,
                  subtitle: '',
                  value: `${item.gameCount} משחקים`
                }))}
              />
            </Card>
          )}
          
          {/* התפלגות לפי יום בשבוע */}
          {statistics.gameByDayOfWeek.length > 0 && (
            <Card style={styles.listCard}>
              <Text style={styles.cardTitle}>התפלגות לפי יום בשבוע</Text>
              <StatisticsList
                data={statistics.gameByDayOfWeek.map(item => ({
                  title: `יום ${item.day}`,
                  subtitle: '',
                  value: `${item.count} משחקים`
                }))}
              />
            </Card>
          )}
          
          {/* משחקים מובילים */}
          {statistics.topGames.length > 0 && (
            <Card style={styles.listCard}>
              <Text style={styles.cardTitle}>משחקים מובילים</Text>
              <StatisticsList
                data={statistics.topGames.map(game => ({
                  title: game.groupName,
                  subtitle: `${game.date} • ${game.players} שחקנים`,
                  value: formatCurrency(game.totalMoney)
                }))}
              />
            </Card>
          )}
        </>
      )}
      
      {/* כפתור רענון */}
      <Button
        title="רענן נתונים"
        onPress={handleRefresh}
        icon="refresh"
        style={styles.refreshButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CASINO_COLORS.background,
  },
  header: {
    flexDirection: 'row-reverse',
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
    backgroundColor: 'rgba(255,215,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    color: CASINO_COLORS.gold,
    fontSize: 16,
    fontWeight: 'bold',
  },
  screenTitle: {
    color: CASINO_COLORS.gold,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  filtersContainer: {
    backgroundColor: CASINO_COLORS.surface,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: CASINO_COLORS.gold,
  },
  filterItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterLabel: {
    width: 80,
    fontSize: 16,
    color: CASINO_COLORS.text,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  dropdown: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: CASINO_COLORS.gold,
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
    fontSize: 16,
    textAlign: 'center',
  },
  summaryCardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  chartCard: {
    marginBottom: 16,
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
    backgroundColor: CASINO_COLORS.surface,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
    borderRadius: 8,
    padding: 16,
  },
  refreshButton: {
    marginTop: 16,
    marginHorizontal: 16,
  },
});