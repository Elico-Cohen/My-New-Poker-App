// src/app/statistics/playerStats.tsx

import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Text } from '@/components/common/Text';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { Dropdown } from '@/components/common/Dropdown';
import { getPlayerStatistics } from '@/services/statistics/playerStatistics';
import { StatisticsFilter, PlayerStats } from '@/models/Statistics';
import StatisticsList from '@/components/statistics/StatisticsList';
import { formatCurrency } from '@/utils/formatters/currencyFormatter';
import { useUsers, useGroups } from '@/hooks/useAppStore';
import StatisticsChart from '@/components/statistics/StatisticsChart';
import StatCard from '@/components/statistics/StatCard';

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

export default function PlayerStatsScreen() {
  const router = useRouter();
  
  // הוקים לגישה לנתונים
  const { users, loading: usersLoading } = useUsers();
  const { groups, loading: groupsLoading } = useGroups();
  
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<PlayerStats[] | null>(null);
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('all');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [playerOptions, setPlayerOptions] = useState<{ label: string, value: string }[]>([]);
  const [groupOptions, setGroupOptions] = useState<{ label: string, value: string }[]>([]);
  
  // Time filter options
  const timeFilterOptions = [
    { label: 'כל הזמנים', value: 'all' },
    { label: 'חודש אחרון', value: 'month' },
    { label: 'רבעון אחרון', value: 'quarter' },
    { label: 'שנה אחרונה', value: 'year' }
  ];
  
  // עדכון אפשרויות הקבוצה והשחקנים מהנתונים שהתקבלו מההוקים
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
    
    if (users && users.length > 0) {
      const options = [
        { label: 'כל השחקנים', value: 'all' },
        ...users.map(user => ({
          label: user.name,
          value: user.id
        }))
      ];
      setPlayerOptions(options);
    }
  }, [groups, users]);
  
  // טעינת הנתונים
  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const filter: StatisticsFilter = {
        timeFilter: timeFilter as any,
        groupId: selectedGroupId !== 'all' ? selectedGroupId : undefined,
        playerId: selectedPlayerId !== 'all' ? selectedPlayerId : undefined
      };
      
      // בדיקה אם נדרש שחקן ספציפי
      if (selectedPlayerId !== 'all') {
        // קריאה עם מזהה שחקן ספציפי
        const playerStatsData = await getPlayerStatistics(selectedPlayerId, filter);
        setStats(Array.isArray(playerStatsData) ? playerStatsData : [playerStatsData]);
      } else {
        // קריאה לקבלת כל השחקנים
        const playerStatsData = await getPlayerStatistics(filter);
        setStats(Array.isArray(playerStatsData) ? playerStatsData : [playerStatsData]);
      }
    } catch (err) {
      console.error('Error loading player statistics:', err);
      setError('שגיאה בטעינת נתוני שחקנים');
    } finally {
      setLoading(false);
    }
  };
  
  // טעינת הנתונים כאשר משתנים הפילטרים
  useEffect(() => {
    if (!usersLoading && !groupsLoading) {
      loadData();
    }
  }, [timeFilter, selectedPlayerId, selectedGroupId, usersLoading, groupsLoading]);
  
  // פונקציית רענון
  const handleRefresh = () => {
    loadData();
  };
  
  // חזרה למסך הסטטיסטיקה הראשי
  const handleBack = () => {
    router.back();
  };

  // Format currency
  const formatCurrency = (amount: number): string => {
    return `${amount.toLocaleString()} ₪`;
  };

  // Helper to determine performance color
  const getPerformanceColor = (value: number): string => {
    if (value > 15) return CASINO_COLORS.success;
    if (value > 0) return '#8BC34A';  // Light green
    if (value === 0) return CASINO_COLORS.gold;
    if (value > -15) return '#FF9800'; // Orange
    return CASINO_COLORS.error;
  };

  return (
    <View style={styles.container}>
      {/* הסרה מוחלטת של הכותרת הלבנה */}
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
        >
          <Icon name="arrow-right" size="medium" color={CASINO_COLORS.gold} />
        </TouchableOpacity>
        <Text variant="h4" style={styles.headerTitle}>
          סטטיסטיקת שחקן
        </Text>
        <View style={{ width: 40 }} />
      </View>
      
      {/* Filters */}
      <View style={styles.filtersContainer}>
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>שחקן:</Text>
          <View style={styles.filterControl}>
            <Dropdown
              value={selectedPlayerId}
              onSelect={setSelectedPlayerId}
              items={playerOptions}
            />
          </View>
        </View>
        
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>קבוצה:</Text>
          <View style={styles.filterControl}>
            <Dropdown
              value={selectedGroupId}
              onSelect={setSelectedGroupId}
              items={groupOptions}
            />
          </View>
        </View>
        
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>תקופה:</Text>
          <View style={styles.filterControl}>
            <Dropdown
              value={timeFilter}
              onSelect={setTimeFilter}
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
        </View>
      ) : !stats || stats.length === 0 ? (
        <View style={styles.errorContainer}>
          <Icon name="account-question" size="large" color={CASINO_COLORS.warning} />
          <Text style={styles.noPlayerText}>אין נתונים לשחקן זה</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView}>
          {/* Player Performance Overview */}
          <Card style={styles.overviewCard}>
            {/* Player Header */}
            <View style={styles.playerHeader}>
              <View style={styles.playerInfo}>
                <Icon name="account" size="large" color={CASINO_COLORS.gold} />
                <Text style={styles.playerName}>{stats[0].playerName}</Text>
              </View>
              
              <StatCard
                title="רווח/הפסד נקי"
                value={stats[0].netProfit}
                valueColor={stats[0].netProfit >= 0 ? CASINO_COLORS.success : CASINO_COLORS.error}
                format="currency"
                size="large"
                style={styles.profitCard}
              />
            </View>
            
            {/* Performance Metrics Cards */}
            <View style={styles.metricsContainer}>
              <StatCard
                title="משחקים"
                value={stats[0].gamesPlayed}
                icon="cards-playing-outline"
                format="integer"
                size="small"
                style={styles.metricCard}
              />
              
              <StatCard
                title="ניצחונות"
                value={stats[0].winCount}
                icon="trophy"
                format="integer"
                size="small"
                style={styles.metricCard}
              />
              
              <StatCard
                title="הפסדים"
                value={stats[0].lossCount}
                icon="emoticon-sad-outline"
                format="integer"
                size="small"
                style={styles.metricCard}
              />
              
              <StatCard
                title="אחוז ניצחון"
                value={stats[0].winRate}
                icon="percent"
                format="percentage"
                size="small"
                valueColor={getPerformanceColor(stats[0].winRate - 50)} // Compare to 50% baseline
                style={styles.metricCard}
              />
            </View>
          </Card>
          
          {/* Performance Chart */}
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>ביצועים לאורך זמן</Text>
            
            <StatisticsChart
              type="line"
              data={{
                // Simulated performance data - in a real app, this would come from historical data
                labels: ['התחלה', '', '', '', '', 'נוכחי'],
                datasets: [{
                  data: [0, 
                    stats[0].netProfit * 0.2, 
                    stats[0].netProfit * 0.4, 
                    stats[0].netProfit * 0.6, 
                    stats[0].netProfit * 0.8, 
                    stats[0].netProfit
                  ],
                  colors: [stats[0].netProfit >= 0 ? 'rgba(34, 197, 94, 1)' : 'rgba(239, 68, 68, 1)']
                }]
              }}
              yAxisSuffix=" ₪"
              height={200}
            />
            
            <View style={styles.performanceIndicators}>
              <View style={styles.indicator}>
                <Text style={styles.indicatorLabel}>תשואה להשקעה</Text>
                <Text style={[
                  styles.indicatorValue, 
                  {color: getPerformanceColor(stats[0].roi)}
                ]}>
                  {stats[0].roi.toFixed(1)}%
                </Text>
              </View>
              
              <View style={styles.indicator}>
                <Text style={styles.indicatorLabel}>רווח ממוצע למשחק</Text>
                <Text style={[
                  styles.indicatorValue, 
                  {color: stats[0].avgProfitPerGame >= 0 ? CASINO_COLORS.success : CASINO_COLORS.error}
                ]}>
                  {formatCurrency(stats[0].avgProfitPerGame)}
                </Text>
              </View>
            </View>
          </Card>
          
          {/* Investment Breakdown */}
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>ניתוח השקעה</Text>
            
            <View style={styles.investmentChartContainer}>
              {/* Investment Pie Chart */}
              <StatisticsChart
                type="pie"
                data={{
                  labels: ['Buy-Ins', 'Rebuys'],
                  datasets: [{
                    data: [
                      stats[0].totalBuyIns * (stats[0].totalInvestment / (stats[0].totalBuyIns + stats[0].totalRebuys)),
                      stats[0].totalRebuys * (stats[0].totalInvestment / (stats[0].totalBuyIns + stats[0].totalRebuys))
                    ],
                    colors: ['rgba(255, 215, 0, 1)', 'rgba(59, 130, 246, 1)']
                  }]
                }}
                height={180}
              />
              
              {/* Investment Breakdown */}
              <View style={styles.investmentDetails}>
                <StatisticsList
                  items={[
                    {
                      id: 'investment',
                      title: 'סך השקעה',
                      value: formatCurrency(stats[0].totalInvestment),
                      valueColor: CASINO_COLORS.gold
                    },
                    {
                      id: 'buyins',
                      title: 'Buy-Ins',
                      subtitle: `${stats[0].totalBuyIns} פעמים`,
                      value: formatCurrency(stats[0].totalBuyIns * (stats[0].totalInvestment / (stats[0].totalBuyIns + stats[0].totalRebuys)))
                    },
                    {
                      id: 'rebuys',
                      title: 'Rebuys',
                      subtitle: `${stats[0].totalRebuys} פעמים`,
                      value: formatCurrency(stats[0].totalRebuys * (stats[0].totalInvestment / (stats[0].totalBuyIns + stats[0].totalRebuys)))
                    },
                    {
                      id: 'return',
                      title: 'סך החזרים',
                      value: formatCurrency(stats[0].totalReturn),
                      valueColor: CASINO_COLORS.success
                    }
                  ]}
                  showDividers={true}
                />
              </View>
            </View>
          </Card>
          
          {/* Best & Worst Games */}
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>משחקים בולטים</Text>
            
            <View style={styles.recordsContainer}>
              {/* Best Game */}
              {stats[0].bestGame && (
                <View style={styles.recordCard}>
                  <Text style={styles.recordTitle}>המשחק הטוב ביותר</Text>
                  
                  <View style={[styles.recordContent, styles.bestGameRecord]}>
                    <Text style={styles.recordDate}>{stats[0].bestGame.date}</Text>
                    
                    <StatCard
                      title="רווח"
                      value={stats[0].bestGame.profit}
                      valueColor={CASINO_COLORS.success}
                      format="currency"
                      size="medium"
                      style={styles.recordStat}
                    />
                    
                    <TouchableOpacity 
                      style={styles.viewButton}
                      onPress={() => router.push(`/history/${stats[0].bestGame!.gameId}`)}
                    >
                      <Text style={styles.viewButtonText}>צפה במשחק</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              
              {/* Worst Game */}
              {stats[0].worstGame && (
                <View style={styles.recordCard}>
                  <Text style={styles.recordTitle}>המשחק הגרוע ביותר</Text>
                  
                  <View style={[styles.recordContent, styles.worstGameRecord]}>
                    <Text style={styles.recordDate}>{stats[0].worstGame.date}</Text>
                    
                    <StatCard
                      title="הפסד"
                      value={stats[0].worstGame.loss}
                      valueColor={CASINO_COLORS.error}
                      format="currency"
                      size="medium"
                      style={styles.recordStat}
                    />
                    
                    <TouchableOpacity 
                      style={styles.viewButton}
                      onPress={() => router.push(`/history/${stats[0].worstGame!.gameId}`)}
                    >
                      <Text style={styles.viewButtonText}>צפה במשחק</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </Card>
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
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterLabel: {
    color: CASINO_COLORS.gold,
    width: 80,
    textAlign: 'right',
    marginLeft: 12,
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
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  noPlayerText: {
    color: CASINO_COLORS.warning,
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  overviewCard: {
    backgroundColor: CASINO_COLORS.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
  },
  playerHeader: {
    marginBottom: 16,
  },
  playerInfo: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 16,
  },
  playerName: {
    color: CASINO_COLORS.gold,
    fontSize: 24,
    fontWeight: 'bold',
    marginRight: 12,
  },
  profitCard: {
    marginVertical: 12,
    width: '100%',
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  metricCard: {
    width: '48%',
    marginBottom: 12,
  },
  card: {
    backgroundColor: CASINO_COLORS.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
  },
  cardTitle: {
    color: CASINO_COLORS.gold,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  performanceIndicators: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 215, 0, 0.2)',
  },
  indicator: {
    alignItems: 'center',
  },
  indicatorLabel: {
    color: CASINO_COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 4,
  },
  indicatorValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  investmentChartContainer: {
    flexDirection: 'column',
  },
  investmentDetails: {
    marginTop: 16,
  },
  recordsContainer: {
    flexDirection: 'column',
  },
  recordCard: {
    marginBottom: 16,
  },
  recordTitle: {
    color: CASINO_COLORS.gold,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  recordContent: {
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  bestGameRecord: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 1,
    borderColor: CASINO_COLORS.success,
  },
  worstGameRecord: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: CASINO_COLORS.error,
  },
  recordStat: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    marginVertical: 8,
  },
  recordDate: {
    color: CASINO_COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 4,
  },
  viewButton: {
    backgroundColor: CASINO_COLORS.primary,
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
    width: '100%',
  },
  viewButtonText: {
    color: CASINO_COLORS.gold,
    fontSize: 14,
    fontWeight: 'bold',
  }
});