// src/app/statistics/index.tsx

import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Text } from '@/components/common/Text';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { Button } from '@/components/common/Button';
import { Dropdown } from '@/components/common/Dropdown';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import StatCard from '@/components/statistics/StatCard';
import StatisticsChart from '@/components/statistics/StatisticsChart';
import StatisticsList from '@/components/statistics/StatisticsList';
import PlayersRanking from '@/components/statistics/PlayersRanking';
import { getStatsSummary, getTopPlayers } from '@/services/statistics/statisticsService';
import { getGameMetricsOverTime } from '@/services/statistics/statisticsService';
import { getMoneyFlowStats } from '@/services/statistics/moneyStatistics';
import { getWinnersLosersStatistics } from '@/services/statistics/playerStatistics';
import { StatisticsFilter, GroupStats } from '@/models/Statistics';
import { useGroups } from '@/hooks/useAppStore';
import { useUsers } from '@/hooks/useAppStore';
import { formatCurrency } from '@/utils/formatters/currencyFormatter';

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

// Statistics category definitions
const STAT_CATEGORIES = [
  {
    id: 'games',
    icon: 'cards',
    title: 'סטטיסטיקת משחקים',
    description: 'כמות משחקים, סכומי כסף במשחקים לפי קבוצה ותקופה'
  },
  {
    id: 'openGames',
    icon: 'cards-playing-outline',
    title: 'סטטיסטיקת משחקים פתוחים',
    description: 'שחקנים עם מספר הזכיות הגבוה ביותר במשחקים פתוחים'
  },
  {
    id: 'players',
    icon: 'account-group',
    title: 'סטטיסטיקת שחקנים',
    description: 'ביצועי שחקנים, דירוגים, ושיעורי הצלחה'
  },
  {
    id: 'rebuys',
    icon: 'refresh',
    title: 'סטטיסטיקת ריבאיים',
    description: 'מספר ריבאיים והשקעה מקסימלית במשחק יחיד'
  },
  {
    id: 'participation',
    icon: 'account-check',
    title: 'סטטיסטיקת השתתפות',
    description: 'כמה משחקים כל שחקן השתתף, השתתפות לפי קבוצות'
  },
  {
    id: 'winnersLosers',
    icon: 'trophy',
    title: 'מנצחים ומפסידים',
    description: 'זכיות והפסדים מקסימליים, שחקנים עם הכי הרבה ניצחונות/הפסדים'
  }
];

export default function StatisticsScreen() {
  const router = useRouter();
  const [selectedTimeFilter, setSelectedTimeFilter] = useState('all');
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statsSummary, setStatsSummary] = useState<any>(null);
  const [topPlayers, setTopPlayers] = useState<any[]>([]);
  const [gameMetrics, setGameMetrics] = useState<any[]>([]);
  const [moneyFlowStats, setMoneyFlowStats] = useState<any>(null);
  const [groupStats, setGroupStats] = useState<GroupStats[]>([]);
  
  // שימוש בהוקים החדשים לקבלת קבוצות ומשתמשים
  const { groups, loading: groupsLoading } = useGroups();
  const { users, loading: usersLoading } = useUsers();
  
  // אפשרויות סינון זמן
  const timeFilterOptions = [
    { label: 'הכל', value: 'all' },
    { label: 'חודש אחרון', value: 'month' },
    { label: 'רבעון אחרון', value: 'quarter' },
    { label: 'שנה אחרונה', value: 'year' }
  ];
  
  // יצירת אפשרויות קבוצה לדרופדאון
  const groupOptions = [
    { label: 'כל הקבוצות', value: undefined },
    ...groups.map(group => ({
      label: group.name,
      value: group.id
    }))
  ];
  
  // פונקציה לטעינת הנתונים
  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // יצירת אובייקט פילטר
      const filter: StatisticsFilter = {
        timeFilter: selectedTimeFilter,
        groupId: selectedGroupId
      };
      
      // טעינת נתונים מהשירותים
      const [summaryData, topPlayersData, metricsData, moneyData] = await Promise.all([
        getStatsSummary(filter),
        getTopPlayers(filter),
        getGameMetricsOverTime(filter),
        getMoneyFlowStats(filter)
      ]);
      
      setStatsSummary(summaryData);
      setTopPlayers(topPlayersData);
      setGameMetrics(metricsData);
      setMoneyFlowStats(moneyData);
      
      // אם יש נתוני קבוצות בסיכום, שמור אותם
      if (summaryData && summaryData.groupStats) {
        setGroupStats(summaryData.groupStats);
      }
      
    } catch (err) {
      console.error('שגיאה בטעינת נתוני סטטיסטיקה:', err);
      setError('אירעה שגיאה בטעינת הנתונים. אנא נסה שוב מאוחר יותר.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // טעינת נתונים בעת טעינת המסך או שינוי פילטרים
  useEffect(() => {
    if (!groupsLoading && !usersLoading) {
      loadData();
    }
  }, [selectedTimeFilter, selectedGroupId, groupsLoading, usersLoading]);
  
  // ניווט לקטגוריית סטטיסטיקה
  const navigateToCategory = (categoryId: string) => {
    router.push(`/statistics/${categoryId}?timeFilter=${selectedTimeFilter}${selectedGroupId ? `&groupId=${selectedGroupId}` : ''}`);
  };
  
  // רענון נתונים
  const handleRefresh = () => {
    loadData();
  };
  
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingIndicator size="large" />
        <Text style={styles.loadingText}>טוען נתוני סטטיסטיקה...</Text>
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
      <Stack.Screen options={{ title: 'סטטיסטיקות' }} />
      
      {/* פילטרים */}
      <View style={styles.filtersContainer}>
        <View style={styles.filterItem}>
          <Text style={styles.filterLabel}>תקופה:</Text>
          <Dropdown
            options={timeFilterOptions}
            selectedValue={selectedTimeFilter}
            onValueChange={(value) => setSelectedTimeFilter(value as string)}
            placeholder="בחר תקופה"
            containerStyle={styles.dropdown}
          />
        </View>
        
        <View style={styles.filterItem}>
          <Text style={styles.filterLabel}>קבוצה:</Text>
          <Dropdown
            options={groupOptions}
            selectedValue={selectedGroupId}
            onValueChange={(value) => setSelectedGroupId(value as string)}
            placeholder="בחר קבוצה"
            containerStyle={styles.dropdown}
          />
        </View>
      </View>
      
      {/* כרטיסי סיכום */}
      {statsSummary && (
        <View style={styles.summaryCardsContainer}>
          <StatCard
            title="סה״כ משחקים"
            value={statsSummary.totalGames.toString()}
            icon="cards"
            color={CASINO_COLORS.primary}
          />
          <StatCard
            title="סה״כ כסף"
            value={formatCurrency(statsSummary.totalMoney)}
            icon="cash"
            color={CASINO_COLORS.gold}
          />
          <StatCard
            title="ממוצע שחקנים"
            value={statsSummary.avgPlayers.toFixed(1)}
            icon="account-group"
            color={CASINO_COLORS.success}
          />
        </View>
      )}
      
      {/* גרף מגמות */}
      {gameMetrics && gameMetrics.length > 0 && (
        <Card style={styles.chartCard}>
          <Text style={styles.cardTitle}>מגמות לאורך זמן</Text>
          <StatisticsChart data={gameMetrics} />
        </Card>
      )}
      
      {/* דירוג שחקנים */}
      {topPlayers && topPlayers.length > 0 && (
        <Card style={styles.rankingCard}>
          <Text style={styles.cardTitle}>דירוג שחקנים מובילים</Text>
          <PlayersRanking players={topPlayers} />
        </Card>
      )}
      
      {/* סטטיסטיקות קבוצה */}
      {groupStats && groupStats.length > 0 && !selectedGroupId && (
        <Card style={styles.listCard}>
          <Text style={styles.cardTitle}>סטטיסטיקות לפי קבוצה</Text>
          <StatisticsList
            data={groupStats.map(group => ({
              title: group.name,
              subtitle: `${group.games} משחקים`,
              value: formatCurrency(group.totalMoney)
            }))}
          />
        </Card>
      )}
      
      {/* קטגוריות סטטיסטיקה */}
      <Text style={styles.sectionTitle}>קטגוריות סטטיסטיקה</Text>
      <View style={styles.categoriesContainer}>
        {STAT_CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={styles.categoryCard}
            onPress={() => navigateToCategory(category.id)}
          >
            <Icon name={category.icon} size={32} color={CASINO_COLORS.primary} />
            <Text style={styles.categoryTitle}>{category.title}</Text>
            <Text style={styles.categoryDescription} numberOfLines={2}>
              {category.description}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
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
  filtersContainer: {
    backgroundColor: CASINO_COLORS.surface,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: CASINO_COLORS.gold,
  },
  filterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterLabel: {
    color: CASINO_COLORS.gold,
    width: 80,
    textAlign: 'right',
    marginLeft: 12,
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
    textAlign: 'center',
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
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  chartCard: {
    marginBottom: 16,
  },
  cardTitle: {
    color: CASINO_COLORS.gold,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  rankingCard: {
    marginBottom: 16,
  },
  listCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: CASINO_COLORS.gold,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    marginTop: 8,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryCard: {
    backgroundColor: CASINO_COLORS.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
    alignItems: 'center',
    width: '48%',
  },
  categoryTitle: {
    color: CASINO_COLORS.gold,
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  categoryDescription: {
    color: CASINO_COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
  refreshButton: {
    marginTop: 16,
    marginBottom: 16,
  },
});