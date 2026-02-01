// src/app/statistics/playerStats.tsx

import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Text } from '@/components/common/Text';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { Dropdown } from '@/components/common/Dropdown';
import { getPlayerStatistics, getWinnersLosersStatistics } from '@/services/statistics/playerStatistics';
import { getOpenGamesStatistics } from '@/calculations/legacy/openGamesBridge';
import { StatisticsFilter, PlayerStats } from '@/models/Statistics';
import StatisticsList from '@/components/statistics/StatisticsList';
import { formatCurrency } from '@/utils/formatters/currencyFormatter';
import { useUsers, useGroups } from '@/hooks/useAppStore';
import { useAuth } from '@/contexts/AuthContext';
import StatisticsChart from '@/components/statistics/StatisticsChart';
import StatCard from '@/components/statistics/StatCard';
import TabBar from '@/components/common/TabBar';
import { store } from '@/store/AppStore';
import { Game } from '@/models/Game';
import { Group } from '@/models/Group';
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
  avgPlayersPerGame: number;
  
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
  const { user: currentUser } = useAuth();
  
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
  
  // עדכון אפשרויות הקבוצה
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
  }, [groups]);
  
  // עדכון אפשרויות השחקנים לפי קבוצה נבחרת
  useEffect(() => {
    console.log('useEffect: עדכון אפשרויות שחקנים. מספר שחקנים:', users.length);
    console.log('useEffect: קבוצה נבחרת:', selectedGroupId);
    
    let filteredUsers = users;
    
    // אם נבחרה קבוצה ספציפית, הצג רק שחקנים קבועים של הקבוצה
    if (selectedGroupId && selectedGroupId !== 'all' && selectedGroupId !== '') {
      const selectedGroup = groups.find(group => group.id === selectedGroupId);
      if (selectedGroup && selectedGroup.permanentPlayers) {
        console.log(`useEffect: מסנן שחקנים לפי קבוצה ${selectedGroup.name}, שחקנים קבועים: ${selectedGroup.permanentPlayers.length}`);
        filteredUsers = users.filter(user => selectedGroup.permanentPlayers.includes(user.id));
        console.log(`useEffect: לאחר סינון נשארו ${filteredUsers.length} שחקנים קבועים`);
      }
    }
    
    // בדיקת הנתונים המלאים
    console.log('useEffect: רשימת משתמשים מסוננת:', JSON.stringify(filteredUsers.map(u => ({id: u.id, name: u.name, email: u.email || 'אין אימייל'}))));
    
    const options = filteredUsers
      .map(user => ({
        label: user.name,
        value: user.id,
        email: user.email  // שמירת האימייל לצורך השוואות
      }))
      .sort((a, b) => a.label.localeCompare(b.label)); // מיון לפי סדר א'-ב'
    
    setPlayerOptions(options);
    
    // אם הרשימה השתנתה והשחקן הנוכחי לא ברשימה, בחר את הראשון
    if (options.length > 0) {
      const currentPlayerInList = options.find(option => option.value === selectedPlayerId);
      if (!currentPlayerInList) {
        console.log('useEffect: השחקן הנוכחי לא ברשימה המסוננת, בוחר את הראשון:', options[0].label);
        setSelectedPlayerId(options[0].value);
      }
    } else if (selectedGroupId && selectedGroupId !== 'all' && selectedGroupId !== '') {
      // אם אין שחקנים קבועים בקבוצה, נקה את הבחירה
      console.log('useEffect: אין שחקנים קבועים בקבוצה הנבחרת');
      setSelectedPlayerId('');
    }
    
    // מציגים מידע על המשתמש הנוכחי לדיבוג
    console.log('useEffect: המשתמש הנוכחי:', currentUser ? {
      id: currentUser.id,
      name: currentUser.name,
      role: currentUser.role,
      email: currentUser.email || 'אין אימייל'
    } : 'לא מחובר');
    
  }, [users, selectedGroupId, groups]);
  
  // מציאת המזהה מהפיירסטור בתחילת הרכיב (אם המשתמש מחובר)
  useEffect(() => {
    if (currentUser?.email) {
      console.log('useEffect: מחפש את מזהה השחקן בפיירסטור לפי אימייל', currentUser.email);
      
      // נמצא רק אם יש לנו משתמשים
      if (users && users.length > 0) {
        // חיפוש התאמה לפי אימייל
        const firestoreUser = users.find(
          u => u.email && currentUser.email && u.email.toLowerCase() === currentUser.email.toLowerCase()
        );
        
        if (firestoreUser) {
          console.log(`useEffect: נמצא משתמש בפיירסטור המתאים לאימייל: ${firestoreUser.name} (${firestoreUser.id})`);
          
          // שמירת המזהה שנמצא
          setSelectedPlayerId(firestoreUser.id);
        } else {
          console.log('useEffect: לא נמצאה התאמת אימייל בפיירסטור');
          
          // אם אין התאמה ויש שחקנים, בוחרים את הראשון
          if (users.length > 0) {
            console.log(`useEffect: בוחר את השחקן הראשון ברשימה: ${users[0].name} (${users[0].id})`);
            setSelectedPlayerId(users[0].id);
          }
        }
      } else {
        console.log('useEffect: אין עדיין רשימת משתמשים זמינה');
      }
    } else {
      console.log('useEffect: אין משתמש מחובר או אין לו אימייל');
    }
  }, [currentUser?.email, users]);
  
  // טעינת הנתונים
  const loadPlayerStats = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const filter: StatisticsFilter = {
        timeFilter: timeFilter as any,
        groupId: selectedGroupId !== 'all' ? selectedGroupId : undefined,
        playerId: undefined,
        includeAllStatuses: true
      };
      
      // קריאה עם מזהה שחקן ספציפי
      const playerStatsData = await getPlayerStatistics(selectedPlayerId, filter);

      // בנוסף, מביא סטטיסטיקות שחקנים לפי רווחים כדי לקבוע דירוג אמיתי
      const winnersLosersStats = await getWinnersLosersStatistics(users.length, filter);

      // מביא נתוני משחקים פתוחים
      const openGamesStats = await getOpenGamesStatistics(filter);
      
      // מפה לאחסון מיקום/דירוג כל שחקן בכל קטגוריה
      const rankingsMap = new Map<string, {
        profitRank: number;
        winRateRank: number;
        gamesPlayedRank: number;
      }>();
      
      // מילוי הדירוגים במפה
      winnersLosersStats.bestCumulativePlayers.forEach((player, index) => {
        const existingRanking = rankingsMap.get(player.playerId) || { profitRank: 0, winRateRank: 0, gamesPlayedRank: 0 };
        existingRanking.profitRank = index + 1; // הדירוג הוא המיקום + 1
        rankingsMap.set(player.playerId, existingRanking);
      });
      
      winnersLosersStats.bestWinRatePlayers.forEach((player, index) => {
        const existingRanking = rankingsMap.get(player.playerId) || { profitRank: 0, winRateRank: 0, gamesPlayedRank: 0 };
        existingRanking.winRateRank = index + 1; // הדירוג הוא המיקום + 1
        rankingsMap.set(player.playerId, existingRanking);
      });
      
      // מספר השחקנים האמיתי שהשתתפו במשחקים המסוננים
      const activePlayers = winnersLosersStats.bestCumulativePlayers.length;
      console.log(`PlayerStats: מספר שחקנים פעילים בפילטרים הנוכחיים: ${activePlayers}`);
      
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
        
        // מציאת נתוני המשחקים הפתוחים של השחקן הספציפי
        const playerOpenGamesStats = openGamesStats.topWinners?.find(
          winner => winner.playerId === stat.playerId
        );
        
        // חישוב ממוצע שחקנים למשחק
        const totalPlayers = playerGames.reduce((sum, game) => sum + (game.players?.length || 0), 0);
        const avgPlayersPerGame = playerGames.length > 0 ? totalPlayers / playerGames.length : 0;
        
        // יצירת רשימת המשחקים האחרונים
        const recentGames = playerGames
          .filter(game => {
            // סינון לפי קבוצה
            if (selectedGroupId !== 'all' && selectedGroupId !== '') {
              if (game.groupId !== selectedGroupId) {
                return false;
              }
            }

            // סינון לפי תקופת זמן
            if (timeFilter !== 'all') {
              const gameDate = game.date 
                ? new Date(game.date.year, game.date.month - 1, game.date.day)
                : new Date();
              const now = new Date();
              
              switch (timeFilter) {
                case 'month':
                  const monthAgo = new Date();
                  monthAgo.setMonth(now.getMonth() - 1);
                  if (gameDate < monthAgo) return false;
                  break;
                  
                case 'quarter':
                  const quarterAgo = new Date();
                  quarterAgo.setMonth(now.getMonth() - 3);
                  if (gameDate < quarterAgo) return false;
                  break;
                  
                case 'year':
                  const yearAgo = new Date();
                  yearAgo.setFullYear(now.getFullYear() - 1);
                  if (gameDate < yearAgo) return false;
                  break;
              }
            }
            
            return true;
          })
          .map(game => {
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
        
        // קבלת הדירוגים האמיתיים מהמפה שיצרנו למעלה
        const playerRankings = rankingsMap.get(stat.playerId) || { profitRank: 0, winRateRank: 0, gamesPlayedRank: 0 };
        
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
          // נתוני משחקים פתוחים מהמקור החדש
          openGames: playerOpenGamesStats?.winCount || 0,
          openGamesWon: playerOpenGamesStats?.winCount || 0,
          openGamesProfit: playerOpenGamesStats?.totalWon || 0,
          bestGameId,
          worstGameId,
          rankings: {
            // שימוש בדירוגים האמיתיים שחושבו
            profitRank: playerRankings.profitRank || 1,
            winRateRank: playerRankings.winRateRank || 1, 
            gamesPlayedRank: 1, // עדיין לא מחושב  
            totalPlayers: activePlayers
          },
          recentGames,
          avgPlayersPerGame: avgPlayersPerGame
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
    router.replace("../index");
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
      <HeaderBar
        title="סטטיסטת שחקן"
        showBack={true}
        backgroundColor={CASINO_COLORS.primary}
        textColor={CASINO_COLORS.gold}
        borderColor={CASINO_COLORS.gold}
        onBackPress={handleBack}
        leftElement={
          <TouchableOpacity onPress={handleRefresh} style={styles.headerButton}>
            <Icon name="refresh" size={24} color={CASINO_COLORS.gold} />
          </TouchableOpacity>
        }
      />
      
      {/* TabBar Component */}
      <TabBar
        tabs={TABS.map(tab => ({
          label: tab.label,
          isActive: selectedTab === tab.id,
          onPress: () => setSelectedTab(tab.id as any)
        }))}
      />
      
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
            />
          </View>
        </View>

        {/* קו הפרדה */}
        <View style={styles.separator} />

        <View style={styles.filterRow}>
          <View style={styles.filterLabelWithIcon}>
            <Icon name="account" size={24} color={CASINO_COLORS.gold} />
          </View>
          <View style={styles.filterControl}>
            <Dropdown
              value={selectedPlayerId}
              onSelect={setSelectedPlayerId}
              items={playerOptions}
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
          {/* טאב רווחים */}
          {selectedTab === 'profits' && (
            <View style={styles.tabContent}>
              {/* סיכום בסגנון כרטיסים קטנים בשורה */}
              <View style={styles.rowCardsContainer}>
                {/* כרטיס רווח מצטבר */}
                <View style={styles.simpleStatCard}>
                  <View style={styles.headerRow}>
                    <Text style={styles.simpleStatTitle}>רווח מצטבר</Text>
                  </View>
                  <Text style={[
                    styles.simpleStatValue,
                    { color: stats[0] && stats[0].netProfit >= 0 ? CASINO_COLORS.success : CASINO_COLORS.error }
                  ]}>
                    {formatCurrency(stats[0] ? stats[0].netProfit : 0)}
                  </Text>
                </View>
                
                {/* כרטיס מספר משחקים */}
                <View style={styles.simpleStatCard}>
                  <View style={styles.headerRow}>
                    <Text style={styles.simpleStatTitle}>מספר משחקים</Text>
                  </View>
                  <Text style={styles.simpleStatValue}>
                    {stats[0].totalGames || 0}
                  </Text>
                </View>
              </View>
              
              <View style={styles.rowCardsContainer}>
                {/* כרטיס רווח ממוצע למשחק */}
                <View style={styles.simpleStatCard}>
                  <View style={styles.headerRow}>
                    <Text style={styles.simpleStatTitle}>רווח ממוצע למשחק</Text>
                  </View>
                  <Text style={[
                    styles.simpleStatValue,
                    { color: stats[0].avgProfitPerGame >= 0 ? CASINO_COLORS.success : CASINO_COLORS.error }
                  ]}>
                    {(stats[0].avgProfitPerGame || 0).toFixed(1).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} ₪
                  </Text>
                </View>
                
                {/* כרטיס דירוג רווחים */}
                <View style={styles.simpleStatCard}>
                  <View style={styles.headerRow}>
                    <Text style={styles.simpleStatTitle}>דירוג רווחים</Text>
                  </View>
                  <Text style={styles.simpleStatValue}>
                    {stats[0].rankings.profitRank || 0}/{stats[0].rankings.totalPlayers || 0}
                  </Text>
                </View>
              </View>

              {/* כרטיס אחד גדול בסגנון פעילות משחקים */}
              <View style={styles.averagesCard}>
                <Text style={styles.averagesTitle}>משחקים בולטים</Text>
                <View style={styles.averagesGrid}>
                  <View style={styles.averageItem}>
                    <Text style={styles.averageLabel}>הרווח הגדול ביותר</Text>
                    <Text style={[styles.averageValue, { color: CASINO_COLORS.success }]}>
                      {formatCurrency(stats[0].bestProfit || 0)}
                    </Text>
                    <TouchableOpacity 
                      style={styles.profitViewGameButton}
                      onPress={() => router.push({
                        pathname: "/history/[id]",
                        params: { id: stats[0].bestGameId }
                      })}
                    >
                      <Text style={styles.profitViewGameButtonText}>צפה במשחק</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.averageItem}>
                    <Text style={styles.averageLabel}>ההפסד הגדול ביותר</Text>
                    <Text style={[styles.averageValue, { color: CASINO_COLORS.error }]}>
                      {formatCurrency(stats[0].worstLoss || 0)}
                    </Text>
                    <TouchableOpacity 
                      style={styles.profitViewGameButton}
                      onPress={() => router.push({
                        pathname: "/history/[id]",
                        params: { id: stats[0].worstGameId }
                      })}
                    >
                      <Text style={styles.profitViewGameButtonText}>צפה במשחק</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          )}
          
          {/* טאב כללי */}
          {selectedTab === 'general' && (
            <View style={styles.tabContent}>
              {/* כרטיס אחד גדול בסגנון פעילות כללית */}
              <View style={styles.averagesCard}>
                <Text style={styles.averagesTitle}>סטטיסטיקה כללית</Text>
                <View style={styles.averagesGrid}>
                  <View style={styles.averageItem}>
                    <Text style={styles.simpleStatTitle}>שיעור משחקים רווחיים</Text>
                    <Text style={styles.simpleStatValue}>{stats[0].winRate ? `${stats[0].winRate.toFixed(1)}%` : '0%'}</Text>
                  </View>
                  
                  <View style={styles.averageItem}>
                    <Text style={styles.simpleStatTitle}>ROI</Text>
                    <Text style={styles.simpleStatValue}>{stats[0].roi ? `${stats[0].roi.toFixed(1)}%` : '0%'}</Text>
                  </View>
                  
                  <View style={styles.averageItem}>
                    <Text style={styles.simpleStatTitle}>סך הכל השקעות</Text>
                    <Text style={styles.simpleStatValue}>{formatCurrency(stats[0].totalInvestment || 0)}</Text>
                  </View>
                  
                  <View style={styles.averageItem}>
                    <Text style={styles.simpleStatTitle}>סך החזרים</Text>
                    <Text style={styles.simpleStatValue}>{formatCurrency(stats[0].totalReturn || 0)}</Text>
                  </View>

                  <View style={styles.averageItem}>
                    <Text style={styles.simpleStatTitle}>מס׳ זכיות במשחקים פתוחים</Text>
                    <Text style={[styles.simpleStatValue, { color: CASINO_COLORS.success }]}>{stats[0].openGamesWon || 0}</Text>
                  </View>

                  <View style={styles.averageItem}>
                    <Text style={styles.simpleStatTitle}>סה״כ זכיות במשחקים פתוחים</Text>
                    <Text style={[
                      styles.simpleStatValue,
                      { color: stats[0].openGamesProfit >= 0 ? CASINO_COLORS.success : CASINO_COLORS.error }
                    ]}>{formatCurrency(stats[0].openGamesProfit || 0)}</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
          
          {/* טאב משחקים */}
          {selectedTab === 'games' && (
            <View style={styles.tabContent}>
              {/* רשימת משחקים */}
              <View style={styles.gamesListContainer}>
                <Text style={styles.gamesListTitle}>היסטוריית משחקים</Text>
                
                {stats[0].recentGames.map((game, index) => (
                  <View key={game.id} style={styles.gameRow}>
                    <Text style={styles.gameDate}>{game.date}</Text>
                    <Text style={styles.gameGroup}>{game.groupName}</Text>
                    <Text style={[
                      styles.gameResult,
                      { color: game.result >= 0 ? CASINO_COLORS.success : CASINO_COLORS.error }
                    ]}>
                      {formatCurrency(game.result)}
                    </Text>
                    <TouchableOpacity 
                      style={styles.viewGameButton}
                      onPress={() => router.push(`/history/${game.id}`)}
                    >
                      <Text style={styles.viewGameButtonText}>הצג משחק</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
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
    padding: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtersContainer: {
    backgroundColor: CASINO_COLORS.surface,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 215, 0, 0.3)',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  filterLabel: {
    color: CASINO_COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    width: 80,
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
    color: CASINO_COLORS.text,
    marginTop: 10,
  },
  tabContent: {
    padding: 16,
  },
  summaryCardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  customCard: {
    width: '48%',
    height: 70,
    marginBottom: 12,
    backgroundColor: '#0D1B1E',
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
    borderRadius: 8,
    padding: 8,
  },
  averagesCard: {
    backgroundColor: '#0D1B1E',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
    padding: 16,
    marginBottom: 16,
  },
  averagesTitle: {
    color: CASINO_COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'right',
  },
  averagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  averageItem: {
    width: '48%',
    marginBottom: 16,
    alignItems: 'flex-end',
    backgroundColor: '#0D1B1E',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
    padding: 10,
  },
  averageLabel: {
    color: CASINO_COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    textAlign: 'right',
  },
  averageValue: {
    color: CASINO_COLORS.gold,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  viewGameButton: {
    backgroundColor: CASINO_COLORS.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
    width: '30%',
  },
  viewGameButtonText: {
    color: CASINO_COLORS.gold,
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 16,
  },
  bottomPadding: {
    height: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: CASINO_COLORS.error,
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  noPlayerText: {
    color: CASINO_COLORS.gold,
    fontSize: 18,
    fontWeight: 'bold',
  },
  noDataText: {
    color: CASINO_COLORS.textSecondary,
    textAlign: 'center',
    fontSize: 16,
    padding: 16,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  // סגנונות הכרטיסים החדשים (מבוססים על rebuys.tsx)
  rowCardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  simpleStatCard: {
    flexDirection: 'column',
    backgroundColor: '#0D1B1E',
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
    padding: 12,
    borderRadius: 8,
    width: '48%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 6,
  },
  simpleStatTitle: {
    color: CASINO_COLORS.text,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  simpleStatValue: {
    color: CASINO_COLORS.gold,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'right',
    marginTop: 4,
  },
  separator: {
    height: 1,
    backgroundColor: CASINO_COLORS.gold,
    marginVertical: 12,
    opacity: 0.3,
  },
  filterLabelWithIcon: {
    width: 80,
    alignItems: 'flex-end',
  },
  gamesListContainer: {
    backgroundColor: CASINO_COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
    padding: 16,
    marginTop: 16,
  },
  gamesListTitle: {
    color: CASINO_COLORS.gold,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'right',
  },
  gameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 215, 0, 0.1)',
  },
  gameDate: {
    color: CASINO_COLORS.text,
    fontSize: 14,
    fontWeight: 'bold',
    width: '22%',
    textAlign: 'right',
  },
  gameGroup: {
    color: CASINO_COLORS.text,
    fontSize: 14,
    fontWeight: 'bold',
    width: '22%',
    textAlign: 'right',
    paddingEnd: 16,
  },
  gameResult: {
    fontSize: 14,
    fontWeight: 'bold',
    width: '22%',
    textAlign: 'left',
    paddingStart: 16,
  },
  profitViewGameButton: {
    backgroundColor: CASINO_COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
    marginTop: 8,
    width: '100%',
  },
  profitViewGameButtonText: {
    color: CASINO_COLORS.gold,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});