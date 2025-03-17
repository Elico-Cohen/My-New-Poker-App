// src/services/statistics/gameStatistics.ts

import { Game } from '@/models/Game';
import { Group } from '@/models/Group';
import { StatisticsFilter } from '@/models/Statistics';
import { fetchAllGames, filterGames, statsCache, CACHE_EXPIRY } from './statisticsService';
import { store } from '@/store/AppStore';
import { formatShortDate } from '@/utils/formatters/dateFormatter';
import { formatCurrency } from '@/utils/formatters/currencyFormatter';
import { getAllActiveGroups } from '@/services/groups';
import { getAllUsers } from '@/services/users';

/**
 * Aggregated game statistics response type
 */
export interface GameStatisticsResponse {
  monthlyStats: { month: string; games: number; money: number; avgPlayers: number }[];
  groupStats?: { name: string; games: number; totalMoney: number; avgMoneyPerGame: number }[];
  playerDistribution: { playerCount: number; gameCount: number }[];
  gameByDayOfWeek: { day: string; count: number }[];
  gameByHourOfDay?: { hour: string; count: number }[];
  rebuyDistribution: { rebuyCount: number; frequency: number }[];
  investmentDistribution: { range: string; count: number }[];
  averagePlayersPerGame: number;
  topGames: {
    id: string;
    date: string;
    players: number;
    totalMoney: number;
    groupName: string;
  }[];
}

/**
 * חישוב סטטיסטיקות חודשיות
 */
const calculateMonthlyStats = (games: Game[]): { month: string; games: number; money: number; avgPlayers: number }[] => {
  const monthlyStatsMap = new Map<string, { 
    games: number; 
    money: number; 
    players: number;
  }>();
  
  games.forEach(game => {
    // Process date for monthly stats
    const date = game.date;
    let monthKey = 'unknown';
    
    if (date && typeof date.month === 'number' && typeof date.year === 'number') {
      monthKey = `${String(date.month).padStart(2, '0')}/${date.year}`;
    } else if (game.createdAt) {
      const createdDate = new Date(game.createdAt);
      monthKey = `${String(createdDate.getMonth() + 1).padStart(2, '0')}/${createdDate.getFullYear()}`;
    }
    
    // Update monthly stats
    const existingMonthStats = monthlyStatsMap.get(monthKey) || { 
      games: 0, 
      money: 0,
      players: 0
    };
    existingMonthStats.games += 1;
    
    // Calculate money
    let gameMoney = 0;
    game.players?.forEach(player => {
      const buyInCount = (player as any).buyInCount || 0;
      const rebuyCount = (player as any).rebuyCount || 0;
      
      const buyInTotal = buyInCount * 
        ((game.buyInSnapshot && game.buyInSnapshot.amount) || 0);
      const rebuyTotal = rebuyCount * 
        ((game.rebuySnapshot && game.rebuySnapshot.amount) || 0);
      
      gameMoney += buyInTotal + rebuyTotal;
    });
    
    // Update monthly money and players
    existingMonthStats.money += gameMoney;
    existingMonthStats.players += game.players?.length || 0;
    monthlyStatsMap.set(monthKey, existingMonthStats);
  });
  
  // Convert map to array for monthly stats
  return Array.from(monthlyStatsMap.entries()).map(([month, stats]) => ({
    month,
    games: stats.games,
    money: stats.money,
    avgPlayers: stats.games > 0 ? stats.players / stats.games : 0
  })).sort((a, b) => {
    // Parse month strings (MM/YYYY)
    const [aMonth, aYear] = a.month.split('/').map(Number);
    const [bMonth, bYear] = b.month.split('/').map(Number);
    
    if (aYear !== bYear) return aYear - bYear;
    return aMonth - bMonth;
  });
};

/**
 * חישוב סטטיסטיקות לפי קבוצה
 */
const calculateGroupStats = (
  games: Game[], 
  groups: Group[]
): { name: string; games: number; totalMoney: number; avgMoneyPerGame: number }[] | undefined => {
  // Skip if filtering by specific group
  if (games.length > 0 && games.every(game => game.groupId === games[0].groupId)) {
    return undefined;
  }
  
  const groupStatsMap = new Map<string, { 
    name: string; 
    games: number; 
    totalMoney: number;
  }>();
  
  games.forEach(game => {
    if (!game.groupId || !game.groupNameSnapshot) return;
    
    const groupStats = groupStatsMap.get(game.groupId) || { 
      name: game.groupNameSnapshot,
      games: 0,
      totalMoney: 0
    };
    groupStats.games += 1;
    
    // Calculate money
    let gameMoney = 0;
    game.players?.forEach(player => {
      const buyInCount = (player as any).buyInCount || 0;
      const rebuyCount = (player as any).rebuyCount || 0;
      
      const buyInTotal = buyInCount * 
        ((game.buyInSnapshot && game.buyInSnapshot.amount) || 0);
      const rebuyTotal = rebuyCount * 
        ((game.rebuySnapshot && game.rebuySnapshot.amount) || 0);
      
      gameMoney += buyInTotal + rebuyTotal;
    });
    
    groupStats.totalMoney += gameMoney;
    groupStatsMap.set(game.groupId, groupStats);
  });
  
  // Convert map to array and calculate averages for group stats
  return Array.from(groupStatsMap.values())
    .map(g => ({
      name: g.name,
      games: g.games,
      totalMoney: g.totalMoney,
      avgMoneyPerGame: g.games > 0 ? g.totalMoney / g.games : 0
    }))
    .sort((a, b) => b.games - a.games);
};

/**
 * חישוב התפלגות מספר שחקנים במשחקים
 */
const calculatePlayerDistribution = (games: Game[]): { playerCount: number; gameCount: number }[] => {
  const playerDistributionMap = new Map<number, number>();
  
  games.forEach(game => {
    const playerCount = game.players?.length || 0;
    playerDistributionMap.set(
      playerCount, 
      (playerDistributionMap.get(playerCount) || 0) + 1
    );
  });
  
  return Array.from(playerDistributionMap.entries())
    .map(([playerCount, gameCount]) => ({ playerCount, gameCount }))
    .sort((a, b) => a.playerCount - b.playerCount);
};

/**
 * חישוב התפלגות משחקים לפי יום בשבוע
 */
const calculateDayOfWeekDistribution = (games: Game[]): { day: string; count: number }[] => {
  const dayOfWeekMap = new Map<number, number>();
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  
  games.forEach(game => {
    const date = game.date;
    let dayOfWeek = 0;
    
    if (date && typeof date.month === 'number' && typeof date.year === 'number') {
      // Create date object for day of week
      const gameDate = new Date(date.year, date.month - 1, date.day || 1);
      dayOfWeek = gameDate.getDay(); // 0 = Sunday, 6 = Saturday
    } else if (game.createdAt) {
      const createdDate = new Date(game.createdAt);
      dayOfWeek = createdDate.getDay();
    }
    
    dayOfWeekMap.set(
      dayOfWeek,
      (dayOfWeekMap.get(dayOfWeek) || 0) + 1
    );
  });
  
  return Array.from(dayOfWeekMap.entries())
    .map(([day, count]) => ({ day: dayNames[day], count }))
    .sort((a, b) => dayNames.indexOf(a.day) - dayNames.indexOf(b.day));
};

/**
 * חישוב התפלגות משחקים לפי שעה ביום
 */
const calculateHourOfDayDistribution = (games: Game[]): { hour: string; count: number }[] | undefined => {
  const hourOfDayMap = new Map<number, number>();
  
  games.forEach(game => {
    if (game.createdAt) {
      const hour = new Date(game.createdAt).getHours();
      hourOfDayMap.set(
        hour,
        (hourOfDayMap.get(hour) || 0) + 1
      );
    }
  });
  
  return hourOfDayMap.size > 0 ? 
    Array.from(hourOfDayMap.entries())
      .map(([hour, count]) => ({ hour: `${hour}:00`, count }))
      .sort((a, b) => parseInt(a.hour) - parseInt(b.hour)) : undefined;
};

/**
 * חישוב התפלגות ריבאיים
 */
const calculateRebuyDistribution = (games: Game[]): { rebuyCount: number; frequency: number }[] => {
  const rebuyDistributionMap = new Map<number, number>();
  
  games.forEach(game => {
    game.players?.forEach(player => {
      const rebuyCount = (player as any).rebuyCount || 0;
      
      rebuyDistributionMap.set(
        rebuyCount,
        (rebuyDistributionMap.get(rebuyCount) || 0) + 1
      );
    });
  });
  
  return Array.from(rebuyDistributionMap.entries())
    .map(([rebuyCount, frequency]) => ({ rebuyCount, frequency }))
    .sort((a, b) => a.rebuyCount - b.rebuyCount);
};

/**
 * חישוב התפלגות השקעה במשחקים
 */
const calculateInvestmentDistribution = (games: Game[]): { range: string; count: number }[] => {
  const investmentRanges = [
    { min: 0, max: 50, label: '0-50 ₪' },
    { min: 50, max: 100, label: '50-100 ₪' },
    { min: 100, max: 200, label: '100-200 ₪' },
    { min: 200, max: 300, label: '200-300 ₪' },
    { min: 300, max: 500, label: '300-500 ₪' },
    { min: 500, max: Infinity, label: '500+ ₪' }
  ];
  const investmentDistributionMap = new Map<string, number>();
  
  games.forEach(game => {
    game.players?.forEach(player => {
      const buyInCount = (player as any).buyInCount || 0;
      const rebuyCount = (player as any).rebuyCount || 0;
      
      const buyInTotal = buyInCount * 
        ((game.buyInSnapshot && game.buyInSnapshot.amount) || 0);
      const rebuyTotal = rebuyCount * 
        ((game.rebuySnapshot && game.rebuySnapshot.amount) || 0);
      
      const playerInvestment = buyInTotal + rebuyTotal;
      
      const range = investmentRanges.find(r => 
        playerInvestment >= r.min && playerInvestment < r.max
      );
      if (range) {
        investmentDistributionMap.set(
          range.label,
          (investmentDistributionMap.get(range.label) || 0) + 1
        );
      }
    });
  });
  
  return investmentRanges
    .map(range => ({
      range: range.label,
      count: investmentDistributionMap.get(range.label) || 0
    }));
};

/**
 * חישוב ממוצע שחקנים למשחק
 */
const calculateAveragePlayersPerGame = (games: Game[]): number => {
  if (games.length === 0) return 0;
  
  const totalPlayers = games.reduce((sum, game) => sum + (game.players?.length || 0), 0);
  return totalPlayers / games.length;
};

/**
 * קבלת המשחקים עם הסכום הכולל הגבוה ביותר
 */
const getTopGamesByMoney = (
  games: Game[], 
  groups: Group[], 
  limit: number
): {
  id: string;
  date: string;
  players: number;
  totalMoney: number;
  groupName: string;
}[] => {
  const gamesWithMoney = games.map(game => {
    let totalMoney = 0;
    
    game.players?.forEach(player => {
      const buyInCount = (player as any).buyInCount || 0;
      const rebuyCount = (player as any).rebuyCount || 0;
      
      const buyInTotal = buyInCount * 
        ((game.buyInSnapshot && game.buyInSnapshot.amount) || 0);
      const rebuyTotal = rebuyCount * 
        ((game.rebuySnapshot && game.rebuySnapshot.amount) || 0);
      
      totalMoney += buyInTotal + rebuyTotal;
    });
    
    return {
      id: game.id,
      date: game.date ? formatShortDate(game.date) : 'תאריך לא ידוע',
      players: game.players?.length || 0,
      totalMoney,
      groupName: game.groupNameSnapshot || 'קבוצה לא ידועה'
    };
  });
  
  return gamesWithMoney
    .sort((a, b) => b.totalMoney - a.totalMoney)
    .slice(0, limit);
};

/**
 * Get game statistics
 * פונקציה לקבלת סטטיסטיקות של משחקים
 */
export const getGameStatistics = async (
  filter: StatisticsFilter = { timeFilter: 'all' }
): Promise<GameStatisticsResponse> => {
  try {
    console.log('GameStatistics: בודק אם יש נתונים במטמון');
    // Create a cache key based on filter
    const cacheKey = `gameStats_${JSON.stringify(filter)}`;
    const cachedData = statsCache.get(cacheKey);
    
    if (cachedData && (Date.now() - cachedData.timestamp < CACHE_EXPIRY)) {
      console.log('GameStatistics: מחזיר נתונים מהמטמון');
      return cachedData.data;
    }
    
    console.log('GameStatistics: מביא נתונים מהמאגר המרכזי');
    
    // קבלת נתונים מהמאגר המרכזי במקום מפיירבייס ישירות
    const allGames = store.getGames();
    
    // סינון משחקים לפי הקריטריונים שהועברו בפילטר
    // בברירת מחדל נשתמש בסטטוס 'completed' בלבד
    let gameFilter = { ...filter };
    
    // אם לא הוגדר includeAllStatuses ולא הוגדרו statuses, נשתמש בברירת המחדל
    if (!gameFilter.includeAllStatuses && !gameFilter.statuses) {
      gameFilter.statuses = ['completed'];
    }
    
    console.log('GameStatistics: מסנן משחקים עם פילטר:', gameFilter);
    const filteredGames = filterGames(allGames, gameFilter);
    const allGroups = store.getGroups();
    
    console.log(`GameStatistics: מעבד ${filteredGames.length} משחקים עבור סטטיסטיקת משחקים`);
    
    // מיפוי קבוצות לשימוש בקוד
    const groupMap = new Map<string, Group>();
    allGroups.forEach((group: Group) => {
      groupMap.set(group.id, group);
    });
    
    // Calculate monthly statistics
    const monthlyStats = calculateMonthlyStats(filteredGames);
    
    // Calculate group statistics
    const groupStats = calculateGroupStats(filteredGames, allGroups);
    
    // Calculate player distribution
    const playerDistribution = calculatePlayerDistribution(filteredGames);
    
    // Calculate day of week distribution
    const gameByDayOfWeek = calculateDayOfWeekDistribution(filteredGames);
    
    // Calculate hour of day distribution
    const gameByHourOfDay = calculateHourOfDayDistribution(filteredGames);
    
    // Calculate rebuy distribution
    const rebuyDistribution = calculateRebuyDistribution(filteredGames);
    
    // Calculate investment distribution
    const investmentDistribution = calculateInvestmentDistribution(filteredGames);
    
    // Calculate average players per game
    const averagePlayersPerGame = calculateAveragePlayersPerGame(filteredGames);
    
    // Get top games by money
    const topGames = getTopGamesByMoney(filteredGames, allGroups, 5);
    
    const result: GameStatisticsResponse = {
      monthlyStats,
      groupStats,
      playerDistribution,
      gameByDayOfWeek,
      gameByHourOfDay,
      rebuyDistribution,
      investmentDistribution,
      averagePlayersPerGame,
      topGames
    };
    
    // Cache results
    statsCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    console.log('GameStatistics: החזרת נתונים ואחסון במטמון');
    return result;
  } catch (error) {
    console.error('שגיאה בחישוב סטטיסטיקות משחקים:', error);
    throw error;
  }
};

/**
 * Get player count frequency data 
 * (How many games had exactly X players?)
 */
export const getPlayerCountDistribution = async (
  filter: StatisticsFilter = { timeFilter: 'all' }
): Promise<{ playerCount: number; frequency: number }[]> => {
  try {
    const allGames = await fetchAllGames();
    const filteredGames = filterGames(allGames, filter);
    
    // Count how many games had each number of players
    const distribution = new Map<number, number>();
    
    filteredGames.forEach(game => {
      const playerCount = game.players?.length || 0;
      distribution.set(
        playerCount,
        (distribution.get(playerCount) || 0) + 1
      );
    });
    
    // Convert to array and sort by player count
    return Array.from(distribution.entries())
      .map(([playerCount, frequency]) => ({ playerCount, frequency }))
      .sort((a, b) => a.playerCount - b.playerCount);
  } catch (error) {
    console.error('Error getting player count distribution:', error);
    throw error;
  }
};

/**
 * Get game duration statistics
 */
export const getGameDurationStats = async (
  filter: StatisticsFilter = { timeFilter: 'all' }
): Promise<{
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  durationDistribution: { range: string; count: number }[];
}> => {
  try {
    const allGames = await fetchAllGames();
    const filteredGames = filterGames(allGames, filter);
    
    // חישוב משך זמן המשחק לפי זמן היצירה והעדכון האחרון
    const gamesWithDuration = filteredGames.filter(game => {
      if (game.createdAt && game.updatedAt && game.status !== 'active') {
        const durationMs = game.updatedAt - game.createdAt;
        const durationMin = Math.floor(durationMs / 60000); // המרה למיליון שניות וסיבוב מטה
        return durationMin >= 60 && durationMin <= 720; // בין שעה ל-12 שעות
      }
      return false;
    });
    
    if (gamesWithDuration.length === 0) {
      return {
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        durationDistribution: []
      };
    }
    
    // חישוב סטטיסטיקות בסיסיות
    const durations = gamesWithDuration.map(game => {
      const durationMs = game.updatedAt - game.createdAt;
      return Math.floor(durationMs / 60000); // המרה למיליון שניות וסיבוב מטה
    });
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const averageDuration = totalDuration / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    
    // Create distribution ranges
    const durationRanges = [
      { min: 0, max: 120, label: 'עד שעתיים' },
      { min: 120, max: 180, label: '2-3 שעות' },
      { min: 180, max: 240, label: '3-4 שעות' },
      { min: 240, max: 300, label: '4-5 שעות' },
      { min: 300, max: 360, label: '5-6 שעות' },
      { min: 360, max: Infinity, label: '6+ שעות' }
    ];
    
    // Count games in each duration range
    const distribution = new Map<string, number>();
    
    durationRanges.forEach(range => {
      distribution.set(range.label, 0); // Initialize with 0
    });
    
    durations.forEach(duration => {
      const range = durationRanges.find(r => 
        duration >= r.min && duration < r.max
      );
      if (range) {
        distribution.set(
          range.label,
          (distribution.get(range.label) || 0) + 1
        );
      }
    });
    
    // Convert to expected return format
    const durationDistribution = Array.from(distribution.entries())
      .map(([range, count]) => ({ range, count }));
    
    return {
      averageDuration,
      minDuration,
      maxDuration,
      durationDistribution
    };
  } catch (error) {
    console.error('Error getting game duration statistics:', error);
    throw error;
  }
};

/**
 * Calculate game day preferences
 */
export const getGameDayPreferences = async (
  filter: StatisticsFilter = { timeFilter: 'all' }
): Promise<{ 
  day: string; 
  count: number; 
  percentage: number;
}[]> => {
  try {
    const allGames = await fetchAllGames();
    const filteredGames = filterGames(allGames, filter);
    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    
    // Count games by day of week
    const dayCount = new Map<number, number>();
    
    // Initialize all days with 0
    for (let i = 0; i < 7; i++) {
      dayCount.set(i, 0);
    }
    
    // Count games for each day
    filteredGames.forEach(game => {
      let dayOfWeek = 0;
      
      if (game.date?.year && game.date?.month && game.date?.day) {
        const gameDate = new Date(game.date.year, game.date.month - 1, game.date.day);
        dayOfWeek = gameDate.getDay();
      } else if (game.createdAt) {
        dayOfWeek = new Date(game.createdAt).getDay();
      }
      
      dayCount.set(
        dayOfWeek,
        (dayCount.get(dayOfWeek) || 0) + 1
      );
    });
    
    // Convert to array with percentages
    const totalGames = filteredGames.length;
    const dayPreferences = Array.from(dayCount.entries())
      .map(([day, count]) => ({
        day: dayNames[day],
        count,
        percentage: totalGames > 0 ? (count / totalGames) * 100 : 0
      }));
    
    return dayPreferences;
  } catch (error) {
    console.error('Error getting game day preferences:', error);
    throw error;
  }
};

/**
 * Get investment per player statistics
 */
export const getPlayerInvestmentStats = async (
  filter: StatisticsFilter = { timeFilter: 'all' }
): Promise<{
  averageInvestment: number;
  maxInvestment: { playerId: string; playerName: string; amount: number };
  investmentDistribution: { range: string; count: number }[];
}> => {
  try {
    const allGames = await fetchAllGames();
    const filteredGames = filterGames(allGames, filter);
    const allUsers = await getAllUsers();
    
    // Track total investment and player investments
    let totalInvestment = 0;
    let totalPlayers = 0;
    const playerInvestments: { playerId: string; playerName: string; amount: number }[] = [];
    
    // Investment distribution ranges
    const investmentRanges = [
      { min: 0, max: 50, label: '0-50 ₪' },
      { min: 50, max: 100, label: '50-100 ₪' },
      { min: 100, max: 200, label: '100-200 ₪' },
      { min: 200, max: 300, label: '200-300 ₪' },
      { min: 300, max: 500, label: '300-500 ₪' },
      { min: 500, max: Infinity, label: '500+ ₪' }
    ];
    
    const distributionMap = new Map<string, number>();
    
    // Initialize ranges with 0
    investmentRanges.forEach(range => {
      distributionMap.set(range.label, 0);
    });
    
    // Process each game
    filteredGames.forEach(game => {
      game.players?.forEach(player => {
        const buyInAmount = (player.buyInCount || 0) * (game.buyInSnapshot?.amount || 0);
        const rebuyAmount = (player.rebuyCount || 0) * (game.rebuySnapshot?.amount || 0);
        const investment = buyInAmount + rebuyAmount;
        
        totalInvestment += investment;
        totalPlayers++;
        
        // Track player investment
        const playerId = player.userId || player.id;
        if (playerId) {
          const playerName = player.name || 
            allUsers.find(u => u.id === playerId)?.name || 
            'לא ידוע';
          
          playerInvestments.push({ playerId, playerName, amount: investment });
        }
        
        // Track investment distribution
        const range = investmentRanges.find(r => 
          investment >= r.min && investment < r.max
        );
        if (range) {
          distributionMap.set(
            range.label,
            (distributionMap.get(range.label) || 0) + 1
          );
        }
      });
    });
    
    // Find max investment
    const maxInvestment = playerInvestments.length > 0 ?
      playerInvestments.reduce((max, curr) => 
        curr.amount > max.amount ? curr : max
      , playerInvestments[0]) :
      { playerId: '', playerName: 'אין נתונים', amount: 0 };
    
    // Convert distribution to array
    const investmentDistribution = Array.from(distributionMap.entries())
      .map(([range, count]) => ({ range, count }));
    
    return {
      averageInvestment: totalPlayers > 0 ? totalInvestment / totalPlayers : 0,
      maxInvestment,
      investmentDistribution
    };
  } catch (error) {
    console.error('Error getting player investment statistics:', error);
    throw error;
  }
};

/**
 * Get group performance comparison
 */
export const getGroupPerformanceComparison = async (
  filter: StatisticsFilter = { timeFilter: 'all' }
): Promise<{
  groupId: string;
  groupName: string;
  gamesCount: number;
  averagePlayers: number;
  averageInvestment: number;
  averageRebuys: number;
}[]> => {
  try {
    const allGames = await fetchAllGames();
    const filteredGames = filterGames(allGames, filter);
    const groups = await getAllActiveGroups();
    
    // Group stats tracking
    const groupStats = new Map<string, {
      groupId: string;
      groupName: string;
      gamesCount: number;
      totalPlayers: number;
      totalInvestment: number;
      totalRebuys: number;
    }>();
    
    // Initialize tracking for each group
    groups.forEach(group => {
      groupStats.set(group.id, {
        groupId: group.id,
        groupName: group.name,
        gamesCount: 0,
        totalPlayers: 0,
        totalInvestment: 0,
        totalRebuys: 0
      });
    });
    
    // Process games
    filteredGames.forEach(game => {
      if (!game.groupId) return;
      
      const stats = groupStats.get(game.groupId);
      if (!stats) return;
      
      stats.gamesCount++;
      
      // Add player count
      const playerCount = game.players?.length || 0;
      stats.totalPlayers += playerCount;
      
      // Calculate investment and rebuys
      game.players?.forEach(player => {
        const buyInAmount = (player.buyInCount || 0) * (game.buyInSnapshot?.amount || 0);
        const rebuyAmount = (player.rebuyCount || 0) * (game.rebuySnapshot?.amount || 0);
        
        stats.totalInvestment += buyInAmount + rebuyAmount;
        stats.totalRebuys += player.rebuyCount || 0;
      });
    });
    
    // Convert to array and calculate averages
    return Array.from(groupStats.values())
      .filter(stats => stats.gamesCount > 0) // Only include groups with games
      .map(stats => ({
        groupId: stats.groupId,
        groupName: stats.groupName,
        gamesCount: stats.gamesCount,
        averagePlayers: stats.totalPlayers / stats.gamesCount,
        averageInvestment: stats.totalInvestment / stats.gamesCount,
        averageRebuys: stats.totalRebuys / stats.gamesCount
      }))
      .sort((a, b) => b.gamesCount - a.gamesCount);
  } catch (error) {
    console.error('Error getting group performance comparison:', error);
    throw error;
  }
};

/**
 * Get rebuy trend over time
 */
export const getRebuyTrend = async (
  filter: StatisticsFilter = { timeFilter: 'all' }
): Promise<{
  month: string;
  averageRebuysPerPlayer: number;
  totalRebuys: number;
}[]> => {
  try {
    const allGames = await fetchAllGames();
    const filteredGames = filterGames(allGames, filter);
    
    // Track monthly trends
    const monthlyData = new Map<string, {
      playerCount: number;
      rebuyCount: number;
    }>();
    
    // Process games
    filteredGames.forEach(game => {
      // Get month key
      let monthKey = 'unknown';
      if (game.date?.month && game.date?.year) {
        monthKey = `${String(game.date.month).padStart(2, '0')}/${game.date.year}`;
      } else if (game.createdAt) {
        const date = new Date(game.createdAt);
        monthKey = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
      }
      
      // Get or initialize monthly data
      const monthData = monthlyData.get(monthKey) || { playerCount: 0, rebuyCount: 0 };
      
      // Count players and rebuys
      game.players?.forEach(player => {
        monthData.playerCount++;
        monthData.rebuyCount += player.rebuyCount || 0;
      });
      
      monthlyData.set(monthKey, monthData);
    });
    
    // Convert to array and calculate averages
    return Array.from(monthlyData.entries())
      .map(([month, data]) => ({
        month,
        averageRebuysPerPlayer: data.playerCount > 0 ? data.rebuyCount / data.playerCount : 0,
        totalRebuys: data.rebuyCount
      }))
      .sort((a, b) => {
        // Parse month strings (MM/YYYY)
        const [aMonth, aYear] = a.month.split('/').map(Number);
        const [bMonth, bYear] = b.month.split('/').map(Number);
        
        if (aYear !== bYear) return aYear - bYear;
        return aMonth - bMonth;
      });
  } catch (error) {
    console.error('Error getting rebuy trend data:', error);
    throw error;
  }
};

/**
 * Clear the game statistics cache
 */
export const clearGameStatsCache = (): void => {
  statsCache.clear();
  console.log('Game statistics cache cleared');
};