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
import TabBar from '@/components/common/TabBar';
import { store } from '@/store/AppStore';
import { Game } from '@/models/Game';
import { Group } from '@/models/Group';

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

// הגדרת טאבים
const TABS = [
  { id: 'profits', label: 'רווחים' },
  { id: 'general', label: 'כללי' },
  { id: 'games', label: 'משחקים' }
];

// הוספת פרופרטיז חסרות לממשק PlayerStats
export interface ExtendedPlayerStats extends PlayerStats {
  // נתונים בסיסיים
  profitHistory: number[];
  bestProfit: number;
  worstLoss: number;
  gamesWithProfit: number;
  gamesWithLoss: number;
  totalGames: number;
  
  // נתוני משחקים פתוחים
  openGames: number;
  openGamesWon: number;
  openGamesProfit: number;
  
  // מידע על רווחים לפי קבוצות
  groupProfits: { id: string; title: string; value: number }[];
  
  // קישורים למשחקים עם רווח/הפסד מקסימליים
  bestGameId: string;
  worstGameId: string;
  
  // דירוגים ביחס לשחקנים אחרים
  rankings: {
    profitRank: number;
    winRateRank: number;
    gamesPlayedRank: number;
    totalPlayers: number;
  };
  
  // רשימת משחקים אחרונים
  recentGames: {
    id: string;
    date: string;
    groupName: string;
    result: number;
    buyIn: number;
    rebuys: number;
    players: number;
    isOutlier: boolean;
  }[];
}

export default function PlayerStatsScreen() {
  const router = useRouter();
  
  // הוקים לגישה לנתונים
  const { users, loading: usersLoading } = useUsers();
  const { groups, loading: groupsLoading } = useGroups();
  
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ExtendedPlayerStats[] | null>(null);
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('all');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [playerOptions, setPlayerOptions] = useState<{ label: string, value: string }[]>([]);
  const [groupOptions, setGroupOptions] = useState<{ label: string, value: string }[]>([]);
  const [selectedTab, setSelectedTab] = useState<'profits' | 'general' | 'games'>('profits');
  
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
        { label: 'כל הקבוצות', value: '' },
        ...groups
          .filter(group => group.isActive) // סינון רק קבוצות פעילות
          .map(group => ({
            label: group.name,
            value: group.id
          }))
      ];
      setGroupOptions(options);
    }
    
    if (users && users.length > 0) {
      const options = users
        .map(user => ({
          label: user.name,
          value: user.id
        }))
        .sort((a, b) => a.label.localeCompare(b.label)); // מיון לפי סדר א'-ב'
      
      setPlayerOptions(options);
      
      // אם זו הפעם הראשונה שטוענים שחקנים, נבחר את הראשון ברשימה
      if (selectedPlayerId === 'all' && options.length > 0) {
        setSelectedPlayerId(options[0].value);
      }
    }
  }, [groups, users, selectedPlayerId]);
  
  // טעינת הנתונים
  const loadPlayerStats = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const filter: StatisticsFilter = {
        timeFilter: timeFilter as any,
        groupId: selectedGroupId !== 'all' ? selectedGroupId : undefined,
        playerId: undefined
      };
      
      // קריאה עם מזהה שחקן ספציפי
      const playerStatsData = await getPlayerStatistics(selectedPlayerId, filter);
      
      // אם אין נתונים, נגדיר מערך ריק
      if (playerStatsData === null) {
        setStats([]);
        return;
      }
      
      // נשמור אם זה מערך או אובייקט יחיד
      const statsArray = Array.isArray(playerStatsData) ? playerStatsData : [playerStatsData];
      
      // קבלת כל המשחקים מהמאגר המרכזי
      const allGames = store.getGames();
      
      // מיון המשחקים מהחדש לישן
      const sortedGames = [...allGames].sort((a, b) => {
        const dateA = a.date ? new Date(a.date.year, a.date.month - 1, a.date.day).getTime() : 0;
        const dateB = b.date ? new Date(b.date.year, b.date.month - 1, b.date.day).getTime() : 0;
        return dateB - dateA;
      });
      
      // קבלת קבוצות מהמאגר המרכזי
      const allGroups = store.getGroups();
      
      // המרת הנתונים לטיפוס ExtendedPlayerStats
      const extendedStats: ExtendedPlayerStats[] = statsArray.map((stat: PlayerStats) => {
        // מחשב נתונים נוספים לצורך תצוגה
        const totalGames = stat.gamesPlayed || 0;
        const gamesWithProfit = stat.winCount || 0;
        const gamesWithLoss = stat.lossCount || 0;
        
        // יצירת נתוני היסטוריית רווחים על בסיס הרווח הכולל
        const profitHistory = [
          0,
          stat.netProfit * 0.2,
          stat.netProfit * 0.4,
          stat.netProfit * 0.6,
          stat.netProfit * 0.8,
          stat.netProfit
        ];
        
        // שדות משחקים פתוחים עם נתונים אמיתיים
        const playerGames = sortedGames.filter(game => {
          const playerInGame = game.players?.find(player => 
            player.userId === stat.playerId || player.id === stat.playerId
          );
          return playerInGame !== undefined;
        });
        
        // זיהוי משחקים פתוחים
        const openStatuses = ['open', 'in_progress', 'active'];
        const openGamesData = playerGames.filter(game => 
          openStatuses.includes(String(game.status))
        );
        
        // חישוב נתוני משחקים פתוחים
        const openGamesCount = openGamesData.length;
        let openGamesWonCount = 0;
        let openGamesProfit = 0;
        
        // חישוב רווחים ממשחקים פתוחים
        openGamesData.forEach(game => {
          const playerInGame = game.players?.find(player => 
            player.userId === stat.playerId || player.id === stat.playerId
          );
          if (playerInGame) {
            const result = playerInGame.finalResultMoney || 0;
            if (result > 0) {
              openGamesWonCount++;
              openGamesProfit += result;
            }
          }
        });
        
        // יצירת רשימת המשחקים האחרונים
        const recentGames = playerGames.slice(0, 10).map(game => {
          const playerInGame = game.players?.find(player => 
            player.userId === stat.playerId || player.id === stat.playerId
          );
          const group = allGroups.find(g => g.id === game.groupId);
          const finalResult = playerInGame?.finalResultMoney || 0;
          
          // חישוב אם המשחק הוא חריג - תוצאה שחורגת מהממוצע ביותר מסטיית תקן אחת
          const isResultOutlier = Math.abs(finalResult) > Math.abs(stat.avgProfitPerGame) * 2;
          
          // פורמוט תאריך
          const gameDate = game.date 
            ? new Date(game.date.year, game.date.month - 1, game.date.day)
            : new Date();
          const formattedDate = gameDate.toLocaleDateString('he-IL');
          
          return {
            id: game.id,
            date: formattedDate,
            groupName: group?.name || 'קבוצה לא ידועה',
            result: finalResult,
            buyIn: game.buyInSnapshot?.amount || 0,
            rebuys: playerInGame?.rebuyCount || 0,
            players: game.players?.length || 0,
            isOutlier: isResultOutlier
          };
        });
        
        // חישוב רווחים לפי קבוצות
        const groupProfits = allGroups
          .filter(group => group.isActive)
          .map(group => {
            // סינון משחקים של הקבוצה הנוכחית
            const groupGames = playerGames.filter(game => game.groupId === group.id);
            
            // חישוב סך הרווח בקבוצה זו
            let groupProfit = 0;
            groupGames.forEach(game => {
              const playerInGame = game.players?.find(player => 
                player.userId === stat.playerId || player.id === stat.playerId
              );
              if (playerInGame) {
                groupProfit += playerInGame.finalResultMoney || 0;
              }
            });
            
            return {
              id: group.id,
              title: group.name,
              value: groupProfit
            };
          })
          // מיון לפי רווח (מהגבוה לנמוך)
          .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
          // לקיחת 5 הקבוצות המובילות
          .slice(0, 5);
        
        // קישורים למשחקים עם רווח/הפסד מקסימלי
        const bestGameId = stat.bestGame?.gameId || '';
        const worstGameId = stat.worstGame?.gameId || '';
        
        return {
          ...stat,
          totalGames,
          gamesWithProfit,
          gamesWithLoss,
          // נתונים נוספים
          bestProfit: stat.bestGame?.profit || 0,
          worstLoss: stat.worstGame?.loss || 0,
          profitHistory,
          groupProfits,
          openGames: openGamesCount,
          openGamesWon: openGamesWonCount,
          openGamesProfit: openGamesProfit,
          bestGameId,
          worstGameId,
          rankings: {
            profitRank: 1, // יעודכן בהמשך
            winRateRank: 1, // יעודכן בהמשך
            gamesPlayedRank: 1, // יעודכן בהמשך
            totalPlayers: users.length
          },
          recentGames
        } as ExtendedPlayerStats;
      });
      
      setStats(extendedStats);
    } catch (err) {
      console.error('שגיאה בטעינת סטטיסטיקות שחקן:', err);
      setError('אירעה שגיאה בטעינת הנתונים. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };
  
  // טעינת הנתונים כאשר משתנים הפילטרים
  useEffect(() => {
    if (!usersLoading && !groupsLoading) {
      loadPlayerStats();
    }
  }, [timeFilter, selectedPlayerId, selectedGroupId, usersLoading, groupsLoading]);
  
  // פונקציית רענון
  const handleRefresh = () => {
    loadPlayerStats();
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

  // State עבור פילטור ומיון משחקים
  const [gameSort, setGameSort] = useState<'date' | 'result' | 'group'>('date');
  const [showOnlyWins, setShowOnlyWins] = useState(false);
  const [showOnlyLosses, setShowOnlyLosses] = useState(false);
  
  // פונקציה לסינון משחקים (רק ניצחונות או רק הפסדים או הכל)
  const filterGames = (games: ExtendedPlayerStats['recentGames']) => {
    if (showOnlyWins) return games.filter(game => game.result > 0);
    if (showOnlyLosses) return games.filter(game => game.result < 0);
    return games;
  };
  
  // פונקציה למיון משחקים לפי תאריך, תוצאה או קבוצה
  const sortGames = (games: ExtendedPlayerStats['recentGames']) => {
    if (gameSort === 'date') {
      // מיון לפי תאריך (מהחדש לישן)
      return [...games].sort((a, b) => {
        const dateA = new Date(a.date.split('.').reverse().join('-'));
        const dateB = new Date(b.date.split('.').reverse().join('-'));
        return dateB.getTime() - dateA.getTime();
      });
    } else if (gameSort === 'result') {
      // מיון לפי תוצאה (מהגבוה לנמוך)
      return [...games].sort((a, b) => b.result - a.result);
    } else {
      // מיון לפי קבוצה (א'-ב')
      return [...games].sort((a, b) => a.groupName.localeCompare(b.groupName));
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBack}
        >
          <Icon name="arrow-right" size="medium" color={CASINO_COLORS.gold} />
        </TouchableOpacity>
        <Text variant="h4" style={styles.headerTitle}>
          סטטיסטיקת שחקן
        </Text>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={handleRefresh}
        >
          <Icon name="refresh" size="medium" color={CASINO_COLORS.gold} />
        </TouchableOpacity>
      </View>
      
      {/* Filters */}
      <View style={styles.filtersContainer}>
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>קבוצה:</Text>
          <View style={styles.filterControl}>
            <Dropdown
              value={selectedGroupId}
              onSelect={setSelectedGroupId}
              items={groupOptions}
              placeholder="כל הקבוצות"
              rtl={true}
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
              placeholder="כל הזמנים"
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
          {/* Player Header מחוץ לכרטיס */}
          <View style={styles.playerHeader}>
            <View style={styles.playerInfo}>
              <Icon name="account" size="large" color={CASINO_COLORS.gold} />
              <View style={styles.playerDropdownContainer}>
                <Dropdown
                  value={selectedPlayerId}
                  onSelect={setSelectedPlayerId}
                  items={playerOptions}
                />
              </View>
            </View>
            
            <StatCard
              title="רווח/הפסד נקי"
              value={stats[0] ? stats[0].netProfit : 0}
              valueColor={stats[0] && stats[0].netProfit >= 0 ? CASINO_COLORS.success : CASINO_COLORS.error}
              format="currency"
              size="large"
              style={styles.profitCard}
            />
          </View>
          
          {/* TabBar Component */}
          <TabBar
            tabs={TABS.map(tab => ({
              label: tab.label,
              isActive: selectedTab === tab.id,
              onPress: () => setSelectedTab(tab.id as any)
            }))}
          />
          
          {/* טאב רווחים */}
          {selectedTab === 'profits' && (
            <View style={styles.tabContent}>
              {/* מידע על רווחים */}
              <Card style={styles.card}>
                <Text style={styles.cardTitle}>סטטיסטיקת רווחים</Text>
                {stats && stats.length > 0 && (
                  <>
                    <View style={styles.statsGrid}>
                      <StatCard 
                        title="רווח מצטבר"
                        value={stats[0].netProfit || 0}
                        valueColor={getPerformanceColor(stats[0].netProfit || 0)}
                        format="currency"
                        icon="cash-multiple"
                      />
                      <StatCard 
                        title="רווח ממשחקים פתוחים"
                        value={stats[0].openGamesProfit || 0}
                        valueColor={CASINO_COLORS.success}
                        format="currency"
                        icon="clock-outline"
                      />
                    </View>
                    
                    <View style={styles.statsGrid}>
                      <StatCard 
                        title="מספר משחקים"
                        value={stats[0].totalGames || 0}
                        icon="cards"
                      />
                      <StatCard 
                        title="רווח ממוצע למשחק"
                        value={stats[0].avgProfitPerGame || 0}
                        format="currency"
                        icon="calculator"
                        valueColor={stats[0].avgProfitPerGame >= 0 ? CASINO_COLORS.success : CASINO_COLORS.error}
                      />
                    </View>
                    
                    <View style={styles.statsGrid}>
                      <TouchableOpacity 
                        style={styles.linkCard}
                        onPress={() => stats[0].bestGameId && router.push(`/history/${stats[0].bestGameId}`)}
                      >
                        <Text style={styles.linkText}>צפייה במשחק</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </Card>
            </View>
          )}
          
          {/* טאב כללי */}
          {selectedTab === 'general' && (
            <View style={styles.tabContent}>
              {/* מידע על רווחים */}
              <Card style={styles.card}>
                <Text style={styles.cardTitle}>סטטיסטיקת רווחים</Text>
                {stats && stats.length > 0 && (
                  <>
                    <View style={styles.statsGrid}>
                      <StatCard 
                        title="רווח מצטבר"
                        value={stats[0].netProfit || 0}
                        valueColor={getPerformanceColor(stats[0].netProfit || 0)}
                        format="currency"
                        icon="cash-multiple"
                      />
                      <StatCard 
                        title="רווח ממשחקים פתוחים"
                        value={stats[0].openGamesProfit || 0}
                        valueColor={CASINO_COLORS.success}
                        format="currency"
                        icon="clock-outline"
                      />
                    </View>
                    
                    <View style={styles.statsGrid}>
                      <StatCard 
                        title="מספר משחקים"
                        value={stats[0].totalGames || 0}
                        icon="cards"
                      />
                      <StatCard 
                        title="רווח ממוצע למשחק"
                        value={stats[0].avgProfitPerGame || 0}
                        format="currency"
                        icon="calculator"
                        valueColor={stats[0].avgProfitPerGame >= 0 ? CASINO_COLORS.success : CASINO_COLORS.error}
                      />
                    </View>
                  </>
                )}
              </Card>
            </View>
          )}
          
          {/* טאב משחקים */}
          {selectedTab === 'games' && (
            <View style={styles.tabContent}>
              {/* מידע על משחקים */}
              <Card style={styles.card}>
                <Text style={styles.cardTitle}>סטטיסטיקת משחקים</Text>
                {stats && stats.length > 0 && (
                  <>
                    <View style={styles.statsGrid}>
                      <StatCard 
                        title="מספר משחקים"
                        value={stats[0].totalGames || 0}
                        icon="cards"
                      />
                      <StatCard 
                        title="רווח ממוצע למשחק"
                        value={stats[0].avgProfitPerGame || 0}
                        format="currency"
                        icon="calculator"
                        valueColor={stats[0].avgProfitPerGame >= 0 ? CASINO_COLORS.success : CASINO_COLORS.error}
                      />
                    </View>
                  </>
                )}
              </Card>
            </View>
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
    alignItems: 'center',
    padding: 10,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  refreshButton: {
    padding: 5,
  },
  filtersContainer: {
    padding: 10,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  filterLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: CASINO_COLORS.gold,
  },
  filterControl: {
    flex: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: CASINO_COLORS.gold,
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: CASINO_COLORS.gold,
    fontSize: 18,
    fontWeight: 'bold',
  },
  noPlayerText: {
    color: CASINO_COLORS.gold,
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerDropdownContainer: {
    flex: 1,
  },
  profitCard: {
    marginLeft: 10,
  },
  tabContent: {
    padding: 10,
  },
  card: {
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: CASINO_COLORS.gold,
    marginBottom: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  linkCard: {
    flex: 1,
    padding: 10,
    backgroundColor: CASINO_COLORS.surface,
    borderRadius: 5,
    alignItems: 'center',
  },
  linkText: {
    color: CASINO_COLORS.gold,
    fontSize: 16,
    fontWeight: 'bold',
  },
});