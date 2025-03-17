// src/app/statistics/participation.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Text } from '@/components/common/Text';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { Button } from '@/components/common/Button';
import { Dropdown } from '@/components/common/Dropdown';
import { getParticipationStatistics } from '@/services/statistics/playerStatistics';
import { ParticipationStats, StatisticsFilter } from '@/models/Statistics';
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
  error: '#ef4444'
};

export default function ParticipationScreen() {
  const router = useRouter();
  
  // הוקים לגישה לנתונים
  const { groups, loading: groupsLoading } = useGroups();
  
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ParticipationStats | null>(null);
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [groupOptions, setGroupOptions] = useState<{ label: string, value: string }[]>([]);
  const [groupFilter, setGroupFilter] = useState<string>('all');
  
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
  
  // טעינת נתונים לפי סינון
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('ParticipationScreen: מנקה מטמון ומרענן נתונים');
      clearStatsCache();
      await syncService.forceRefresh();
      
      // יצירת אובייקט הסינון עם הערכים הנוכחיים
      const filter: StatisticsFilter = {
        timeFilter: timeFilter as 'all' | 'month' | 'quarter' | 'year',
        groupId: groupFilter !== 'all' ? groupFilter : undefined,
        statuses: ['completed', 'final_results']
      };
      
      console.log('ParticipationScreen: מבקש סטטיסטיקות השתתפות עם פילטר:', filter);
      
      // קבלת הנתונים מהשירות
      const stats = await getParticipationStatistics(filter);
      setStats(stats);
      
      console.log('ParticipationScreen: התקבלו נתוני השתתפות בהצלחה');
    } catch (error) {
      console.error('שגיאה בטעינת סטטיסטיקות השתתפות:', error);
      setError('שגיאה בטעינת הנתונים. נסה שוב.');
    } finally {
      setLoading(false);
    }
  };
  
  // טעינת הנתונים כאשר משתנים הפילטרים
  useEffect(() => {
    if (!groupsLoading) {
      loadData();
    }
  }, [timeFilter, groupFilter, groupsLoading]);
  
  // פונקציית רענון
  const handleRefresh = () => {
    loadData();
  };
  
  // חזרה למסך הסטטיסטיקה הראשי
  const handleBack = () => {
    router.back();
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
        onBackPress={handleBack}
      />
      
      {/* Filters and refresh button */}
      <View style={styles.filtersContainer}>
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>קבוצה:</Text>
          <View style={styles.filterControl}>
            <Dropdown
              value={groupFilter}
              onSelect={setGroupFilter}
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
        
        {/* Refresh button */}
        <Button 
          title="רענון נתונים" 
          icon="refresh" 
          onPress={handleRefresh}
          style={styles.refreshButton}
        />
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
      ) : (
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
        >
          {/* רק טבלת השחקנים - הסרנו את הכרטיסים, התרשימים והגרפים */}
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <Icon name="account-group" size="medium" color={CASINO_COLORS.gold} />
              <Text style={styles.cardTitle}>רשימת השתתפות במשחקים</Text>
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
              <Text style={styles.noDataText}>אין נתונים זמינים</Text>
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
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  scrollViewContent: {
    paddingBottom: 20, // מרווח תחתון (הוקטן בחצי)
  },
  card: {
    backgroundColor: CASINO_COLORS.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    color: CASINO_COLORS.gold,
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
    textAlign: 'center',
  },
  noDataText: {
    color: CASINO_COLORS.textSecondary,
    textAlign: 'center',
    padding: 16,
  },
  bottomSpacer: {
    height: 10, // מרווח נוסף בתחתית (הוקטן בחצי)
  },
  refreshButton: {
    width: 120,
    height: 40,
    borderRadius: 20,
    backgroundColor: CASINO_COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
});