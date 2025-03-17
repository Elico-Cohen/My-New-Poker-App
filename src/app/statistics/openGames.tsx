// src/app/statistics/openGames.tsx

import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Text } from '@/components/common/Text';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { Dropdown } from '@/components/common/Dropdown';
import { getOpenGamesStatistics } from '@/services/statistics/openGamesStatistics';
import { OpenGamesStats, StatisticsFilter } from '@/models/Statistics';
import PlayersRanking from '@/components/statistics/PlayersRanking';
import StatisticsChart from '@/components/statistics/StatisticsChart';
import StatCard from '@/components/statistics/StatCard';
import StatisticsList from '@/components/statistics/StatisticsList';
import { useGroups } from '@/hooks/useAppStore';
import HeaderBar from '@/components/navigation/HeaderBar';
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
  error: '#ef4444',
  darkGray: '#666666'
};

export default function OpenGamesScreen() {
  const router = useRouter();
  
  // הוקים לגישה לנתונים
  const { groups, loading: groupsLoading } = useGroups();
  
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<OpenGamesStats | null>(null);
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [groupOptions, setGroupOptions] = useState<{ label: string, value: string }[]>([]);
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [gamesCount, setGamesCount] = useState(0);
  const [sortBy, setSortBy] = useState<'wins' | 'money'>('wins');
  
  // Time filter options
  const timeFilterOptions = [
    { label: 'כל הזמנים', value: 'all' },
    { label: 'חודש אחרון', value: 'month' },
    { label: 'רבעון אחרון', value: 'quarter' },
    { label: 'שנה אחרונה', value: 'year' }
  ];
  
  // יצירת אפשרויות הקבוצה מהנתונים שהתקבלו מההוק
  useEffect(() => {
    if (groups && groups.length > 0) {
      const options = [
        { label: 'כל הקבוצות', value: 'all' },
        ...groups.map(group => ({
          label: group.name,
          value: group.id
        }))
      ];
      setGroupOptions(options);
    }
  }, [groups]);
  
  // טעינת הנתונים לפי סינון
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('OpenGamesScreen: מנקה מטמון ומרענן נתונים מהשרת');
      clearStatsCache();
      await syncService.forceRefresh();
      
      // יצירת אובייקט הסינון עם הערכים הנוכחיים
      const filter: StatisticsFilter = {
        timeFilter: timeFilter as 'all' | 'month' | 'quarter' | 'year',
        groupId: groupFilter !== 'all' ? groupFilter : undefined,
        // חשוב - לא קובעים statuses כדי לאפשר קבלת משחקים פתוחים מכל הסטטוסים
        includeAllStatuses: true // מאפשר קבלת משחקים בכל הסטטוסים
      };
      
      console.log('OpenGamesScreen: מבקש סטטיסטיקות משחקים פתוחים עם פילטר:', filter);
      
      // קבלת הנתונים מהשירות
      const stats = await getOpenGamesStatistics(filter);
      console.log('OpenGamesScreen: התקבלו נתוני משחקים פתוחים:', {
        totalOpenGames: stats.totalOpenGames,
        topWinnersCount: stats.topWinners?.length || 0,
        gamesCount: stats.gamesCount
      });
      
      setStats(stats);
      setGamesCount(stats.gamesCount || 0);
      
      console.log('OpenGamesScreen: התקבלו נתוני משחקים פתוחים בהצלחה');
    } catch (error) {
      console.error('שגיאה בטעינת סטטיסטיקות משחקים פתוחים:', error);
      setError('שגיאה בטעינת הנתונים. נסה שוב.');
    } finally {
      setLoading(false);
    }
  };
  
  // טעינת הנתונים כאשר משתנים הפילטרים או כאשר מרעננים את המסך
  useEffect(() => {
    if (!groupsLoading) {
      loadData();
    }
  }, [timeFilter, groupFilter, refreshKey, groupsLoading]);
  
  // פונקציית רענון
  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };
  
  // חזרה למסך הסטטיסטיקה הראשי
  const handleBack = () => {
    router.back();
  };
  
  // כאשר משתנה הסינון, גם משתנה מפתח הרענון
  const handleTimeFilterChange = (value: string) => {
    setTimeFilter(value);
    setRefreshKey(prev => prev + 1); // מגדיל את מפתח הרענון בכל פעם
  };
  
  // כאשר משתנה בחירת הקבוצה, גם משתנה מפתח הרענון
  const handleGroupFilterChange = (value: string) => {
    setGroupFilter(value);
    setRefreshKey(prev => prev + 1);
  };
  
  // Format currency
  const formatCurrency = (amount: number): string => {
    return `${amount.toLocaleString()} ₪`;
  };
  
  // בודק האם הערך קיים לפני קריאה ל-toFixed
  const safeToFixed = (value: any, digits: number = 1) => {
    if (value === undefined || value === null) return '0';
    return value.toFixed(digits);
  };
  
  return (
    <View style={styles.container}>
      {/* Header Bar with Back Button */}
      <HeaderBar
        title="סטטיסטיקת משחקים פתוחים"
        showBack={true}
        backgroundColor={CASINO_COLORS.primary}
        textColor={CASINO_COLORS.gold}
        borderColor={CASINO_COLORS.gold}
      />
      
      {/* Filters */}
      <View style={styles.filtersContainer}>
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>קבוצה:</Text>
          <View style={styles.filterControl}>
            <Dropdown
              value={groupFilter}
              onSelect={handleGroupFilterChange}
              items={groupOptions}
              rtl={true}
            />
          </View>
        </View>
        
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>תקופה:</Text>
          <View style={styles.filterControl}>
            <Dropdown
              value={timeFilter}
              onSelect={handleTimeFilterChange}
              items={timeFilterOptions}
              rtl={true}
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
          <Icon name="trash-can" size="large" color={CASINO_COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : !stats ? (
        <View style={styles.errorContainer}>
          <Icon name="refresh" size="large" color={CASINO_COLORS.warning} />
          <Text style={styles.noDataText}>אין נתונים למשחקים פתוחים בתקופה זו</Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Summary Stats */}
          <View style={styles.statCardsContainer}>
            {/* 1. מספר משחקים */}
            <StatCard
              title=""
              value={gamesCount}
              inlineSubtitle="משחקים"
              icon="cards"
              format="integer"
              size="medium"
              style={[styles.statCard, styles.compactCard]}
              iconPosition="right"
              alignRight={true}
            />
            
            {/* 2. מספר משחקים פתוחים */}
            <StatCard
              title=""
              value={stats.totalOpenGames || 0}
              inlineSubtitle="משחקים פתוחים"
              icon="cards-playing-outline"
              format="integer"
              size="medium"
              style={[styles.statCard, styles.compactCard]}
              iconPosition="right"
              alignRight={true}
            />
            
            {/* 3. ממוצע משחקים פתוחים למשחק */}
            <StatCard
              title=""
              value={stats.averageOpenGamesPerGame || 0}
              inlineSubtitle="ממוצע למשחק"
              icon="calculator"
              format="integer"
              size="medium"
              style={[styles.statCard, styles.compactCard]}
              iconPosition="right"
              alignRight={true}
            />
            
            {/* 4. מספר זוכים במשחקים */}
            <StatCard
              title=""
              value={(stats.topWinners && stats.topWinners.length) || 0}
              inlineSubtitle="זוכים"
              icon="account-group"
              format="integer"
              size="medium"
              style={[styles.statCard, styles.compactCard]}
              iconPosition="right"
              alignRight={true}
            />
            
            {/* 5. הזוכה בהכי הרבה משחקים פתוחים */}
            <TouchableOpacity 
              style={[styles.statCard, styles.compactCard]}
              onPress={(stats.topWinners && stats.topWinners.length > 0 && stats.topWinners[0].playerId) ? 
                () => router.push(`/statistics/playerStats?playerId=${stats.topWinners[0].playerId}`) : undefined}
              activeOpacity={0.7}
            >
              {/* שורה עליונה: אייקון מימין, מספר זכיות משמאל */}
              <View style={styles.winnerRow}>
                <Icon name="crown" size="medium" color={CASINO_COLORS.gold} />
                <Text style={styles.winnerAmount}>
                  {(stats.topWinners && stats.topWinners.length > 0) ? 
                    `${stats.topWinners[0].winCount} זכיות` : ''}
                </Text>
              </View>
              
              {/* שורה תחתונה: שם השחקן */}
              <Text style={styles.winnerName}>
                {(stats.topWinners && stats.topWinners.length > 0) ? 
                  stats.topWinners[0].playerName : 'אין נתונים'}
              </Text>
            </TouchableOpacity>
            
            {/* 6. הזוכה בהכי הרבה כסף במשחקים פתוחים */}
            <TouchableOpacity 
              style={[styles.statCard, styles.compactCard]}
              onPress={(stats.topWinners && stats.topWinners.length > 0) ? 
                () => {
                  const topMoneyWinner = [...stats.topWinners].sort((a, b) => b.totalWon - a.totalWon)[0];
                  router.push(`/statistics/playerStats?playerId=${topMoneyWinner.playerId}`);
                } : undefined}
              activeOpacity={0.7}
            >
              {/* שורה עליונה: אייקון מימין, סכום כסף משמאל */}
              <View style={styles.winnerRow}>
                <Icon name="cash" size="medium" color={CASINO_COLORS.gold} />
                <Text style={styles.winnerAmount}>
                  {(stats.topWinners && stats.topWinners.length > 0) ? 
                    formatCurrency([...stats.topWinners].sort((a, b) => b.totalWon - a.totalWon)[0].totalWon) : ''}
                </Text>
              </View>
              
              {/* שורה תחתונה: שם השחקן */}
              <Text style={styles.winnerName}>
                {(stats.topWinners && stats.topWinners.length > 0) ? 
                  [...stats.topWinners].sort((a, b) => b.totalWon - a.totalWon)[0].playerName : 'אין נתונים'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Top Winners Chart & List - Combined with Toggle */}
          {stats.topWinners && stats.topWinners.length > 0 && (
            <Card style={styles.card}>
              <View style={styles.titleContainer}>
                <View style={styles.titleWithIcon}>
                  <Icon 
                    name="crown" 
                    size="medium" 
                    color={CASINO_COLORS.gold} 
                    style={styles.titleIcon} 
                  />
                  <Text style={styles.cardTitle}>מנצחים במשחקים פתוחים</Text>
                </View>
              </View>
              
              {/* Toggle Buttons for Sorting */}
              <View style={styles.toggleContainer}>
                <TouchableOpacity 
                  style={[styles.toggleButton, sortBy === 'wins' && styles.toggleButtonActive]} 
                  onPress={() => setSortBy('wins')}
                >
                  <Text style={[styles.toggleText, sortBy === 'wins' && styles.toggleTextActive]}>
                    לפי מספר זכיות
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.toggleButton, sortBy === 'money' && styles.toggleButtonActive]} 
                  onPress={() => setSortBy('money')}
                >
                  <Text style={[styles.toggleText, sortBy === 'money' && styles.toggleTextActive]}>
                    לפי סכום זכיות
                  </Text>
                </TouchableOpacity>
              </View>
              
              {/* Combined List */}
              <StatisticsList
                title={sortBy === 'wins' ? "מנצחים - לפי מספר זכיות" : "מנצחים - לפי סכום זכיות"}
                items={
                  sortBy === 'wins'
                    ? stats.topWinners.map((winner, index) => ({
                        id: winner.playerId,
                        title: winner.playerName,
                        value: `${winner.winCount} זכיות`,
                        subtitle: `${formatCurrency(winner.totalWon)}`,
                        icon: index < 3 ? 'trophy' : undefined,
                        valueColor: CASINO_COLORS.gold
                      }))
                    : [...stats.topWinners]
                        .sort((a, b) => b.totalWon - a.totalWon)
                        .map((winner, index) => ({
                          id: `${winner.playerId}-money`,
                          title: winner.playerName,
                          value: formatCurrency(winner.totalWon),
                          subtitle: `${winner.winCount} זכיות`,
                          valueColor: CASINO_COLORS.success
                        }))
                }
                showRank={true}
                alignRight={true}
                rankPrefix=""
                onItemPress={(item) => router.push(`/statistics/playerStats?playerId=${item.id.split('-')[0]}`)}
              />
            </Card>
          )}
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
    padding: 16,
    backgroundColor: CASINO_COLORS.surface,
  },
  headerTitle: {
    color: CASINO_COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  backButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  statsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  cardContainer: {
    marginBottom: 16,
  },
  filtersContainer: {
    padding: 16,
    backgroundColor: CASINO_COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  filterRow: {
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
  filterControl: {
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
    fontSize: 16,
    textAlign: 'center',
    margin: 20,
  },
  noDataText: {
    color: CASINO_COLORS.warning,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    color: CASINO_COLORS.text,
    fontWeight: 'bold',
    marginBottom: 12,
    marginTop: 16,
  },
  statValue: {
    fontSize: 32,
    color: CASINO_COLORS.gold,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: CASINO_COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  statCard: {
    width: '48%',
    marginBottom: 16,
    minHeight: 120,
    backgroundColor: CASINO_COLORS.surface,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
  },
  compactCard: {
    minHeight: 90,
    padding: 12,
  },
  moneyWinnerCard: {
    minHeight: 120,
    padding: 16,
  },
  winnerRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  winnerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: CASINO_COLORS.gold,
    textAlign: 'right',
  },
  winnerAmount: {
    fontSize: 16,
    color: CASINO_COLORS.text,
    textAlign: 'left',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyStateText: {
    color: CASINO_COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  statCardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: 10,
    marginTop: 16,
  },
  card: {
    backgroundColor: CASINO_COLORS.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
  },
  titleContainer: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  titleWithIcon: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  titleIcon: {
    marginLeft: 8,
  },
  cardTitle: {
    color: CASINO_COLORS.gold,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  toggleContainer: {
    flexDirection: 'row-reverse',
    marginBottom: 16, 
    backgroundColor: CASINO_COLORS.background,
    borderRadius: 8,
    overflow: 'hidden',
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: CASINO_COLORS.primary,
  },
  toggleText: {
    color: CASINO_COLORS.text,
    fontSize: 14,
  },
  toggleTextActive: {
    color: CASINO_COLORS.gold,
    fontWeight: 'bold',
  },
  chartSubtitle: {
    color: CASINO_COLORS.textSecondary,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});