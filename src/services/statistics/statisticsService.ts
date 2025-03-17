// src/services/statistics/statisticsService.ts

import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Game, GameDate, PlayerInGame } from '@/models/Game';
import { Group } from '@/models/Group';
import { UserProfile } from '@/models/UserProfile';
import { 
  GameStatsSummary, 
  PlayerStats,
  GroupStats,
  RebuyStats,
  OpenGamesStats,
  ParticipationStats,
  WinnersLosersStats,
  StatisticsFilter
} from '@/models/Statistics';
import { getAllUsers } from '@/services/users';
import { getAllActiveGroups } from '@/services/groups';
import gameDataManager from '../gameDataManager';
import { store } from '@/store/AppStore';
import { syncService } from '@/store/SyncService';
import { formatShortDate, formatLongDate } from '@/utils/formatters/dateFormatter';
import { formatCurrency } from '@/utils/formatters/currencyFormatter';
import { 
  calculateTotalProfit,
  calculateGamesPlayed,
  calculateGamesWon,
  calculateWinPercentage,
  calculateAverageProfitPerGame,
  calculateTotalRebuys,
  calculateAverageRebuysPerGame,
  calculatePlayerRankingByProfit
} from '@/utils/calculators/statisticsCalculator';

// Cache for expensive operations
interface CacheData {
  data: any;
  timestamp: number;
}
type CacheStore = Map<string, CacheData>;

// Export the cache and expiry time
export const statsCache: CacheStore = new Map();
export const CACHE_EXPIRY = 15 * 60 * 1000; // 15 minutes in ms

/**
 * מביא את כל המשחקים מהמאגר המרכזי
 * 
 * השימוש במאגר הנתונים המרכזי מבטיח שנתוני המשחקים נטענים פעם אחת בלבד 
 * והמידע זמין לכל חלקי האפליקציה ללא צורך בקריאות חוזרות ל-Firebase
 * 
 * שים לב: כעת הפונקציה מחזירה את כל המשחקים בכל המצבים, כולל active, ended, payments, וכו'
 * זה שינוי מהגרסה הקודמת שהחזירה רק משחקים במצבים completed, final_results ו-open_games
 */
export const fetchAllGames = async (skipCache: boolean = false): Promise<Game[]> => {
  try {
    console.log('statisticsService: מביא משחקים מהמאגר המרכזי');
    
    // אם צריך לרענן את המטמון, נאלץ את שירות הסנכרון לרענן את הנתונים
    if (skipCache) {
      console.log('statisticsService: מאלץ רענון נתונים מהשרת');
      await syncService.forceRefresh();
    }
    
    // קבלת כל המשחקים מהמאגר המרכזי
    const allGames = store.getGames();
    
    // אם אין משחקים במאגר או יש מעט מדי, ננסה לרענן בכל מקרה
    if (allGames.length === 0) {
      console.log('statisticsService: אין משחקים במאגר המרכזי, מרענן נתונים');
      await syncService.forceRefresh();
      // מנסה שוב לקבל משחקים לאחר הרענון
      const refreshedGames = store.getGames();
      console.log(`statisticsService: לאחר רענון יש ${refreshedGames.length} משחקים במאגר המרכזי`);
      
      if (refreshedGames.length === 0) {
        console.warn('statisticsService: גם לאחר רענון אין משחקים במאגר המרכזי');
      }
      
      return refreshedGames;
    }
    
    // מחזיר את כל המשחקים ללא סינון - כדי לאפשר הצגת משחקים בכל המצבים
    console.log(`statisticsService: מחזיר את כל ${allGames.length} המשחקים מהמאגר המרכזי, ללא סינון לפי מצב`);
    
    // מציג סטטיסטיקה של מצבי המשחקים השונים
    const completedCount = allGames.filter(g => g.status === 'completed').length;
    const finalResultsCount = allGames.filter(g => g.status === 'final_results').length;
    const openGamesCount = allGames.filter(g => g.status === 'open_games').length;
    const paymentsCount = allGames.filter(g => g.status === 'payments').length;
    const activeCount = allGames.filter(g => g.status === 'active').length;
    const endedCount = allGames.filter(g => g.status === 'ended').length;
    const deletedCount = allGames.filter(g => g.status === 'deleted').length;
    const otherCount = allGames.filter(g => !['completed', 'final_results', 'open_games', 'payments', 'active', 'ended', 'deleted'].includes(g.status || '')).length;
    
    console.log(`statisticsService: פילוג לפי סטטוס: completed=${completedCount}, final_results=${finalResultsCount}, open_games=${openGamesCount}, payments=${paymentsCount}, active=${activeCount}, ended=${endedCount}, deleted=${deletedCount}, אחר=${otherCount}`);
    
    return allGames;
  } catch (error) {
    console.error('שגיאה בטעינת משחקים:', error);
    return [];
  }
};

/**
 * מפרמט תאריך משחק למחרוזת
 */
export const formatGameDate = (gameDate: GameDate | undefined): string => {
  return formatShortDate(gameDate);
};

/**
 * Filter games based on criteria
 * פונקציה לסינון משחקים על פי קריטריונים שונים
 */
export const filterGames = (games: Game[], filter: StatisticsFilter): Game[] => {
  let filteredGames = [...games];
  console.log(`filterGames: התחלת הסינון עם ${games.length} משחקים`);
  
  // נתוני סינון
  console.log(`filterGames: פרמטרי סינון:`, 
               `timeFilter=${filter.timeFilter || 'all'}`,
               `groupId=${filter.groupId || 'all'}`,
               `playerId=${filter.playerId || 'all'}`);
  
  // Filter by status (only completed games, unless otherwise specified)
  if (filter.statuses) {
    console.log(`filterGames: מסנן לפי סטטוסים ספציפיים: ${filter.statuses.join(', ')}`);
    filteredGames = filteredGames.filter(game => 
      filter.statuses?.includes(game.status || 'unknown')
    );
  } else if (filter.includeAllStatuses !== true) {
    // ברירת מחדל - מחזיר רק משחקים בסטטוס completed בלבד
    const validStatuses = ['completed'];
    console.log(`filterGames: מסנן לפי סטטוס ברירת מחדל: ${validStatuses.join(', ')}`);
    filteredGames = filteredGames.filter(game => 
      validStatuses.includes(game.status || '')
    );
  }
  console.log(`filterGames: לאחר סינון סטטוס נשארו ${filteredGames.length} משחקים`);
  
  // Filter by group
  if (filter.groupId) {
    console.log(`filterGames: מסנן לפי קבוצה ${filter.groupId}`);
    filteredGames = filteredGames.filter(game => game.groupId === filter.groupId);
    console.log(`filterGames: לאחר סינון קבוצה נשארו ${filteredGames.length} משחקים`);
  }
  
  // Filter by player
  if (filter.playerId) {
    console.log(`filterGames: מסנן לפי שחקן ${filter.playerId}`);
    filteredGames = filteredGames.filter(game => 
      game.players?.some(player => 
        player.userId === filter.playerId || 
        player.id === filter.playerId
      )
    );
    console.log(`filterGames: לאחר סינון שחקן נשארו ${filteredGames.length} משחקים`);
  }
  
  // הדפסת פרטי כל המשחקים לצורך דיבוג אם יש מעט משחקים
  if (filteredGames.length > 0 && filteredGames.length < 10) {
    console.log("--------- פרטי משחקים לפני סינון זמן ---------");
    filteredGames.forEach((game, index) => {
      if (game.date) {
        const gameDate = `${game.date.day}/${game.date.month}/${game.date.year}`;
        const status = game.status || 'ללא סטטוס';
        const playersCount = game.players?.length || 0;
        const openGamesCount = game.openGames?.length || 0;
        console.log(`משחק ${index + 1}: תאריך=${gameDate}, סטטוס=${status}, מזהה=${game.id}, קבוצה=${game.groupId}, שם קבוצה=${game.groupNameSnapshot || 'לא ידוע'}, מספר שחקנים=${playersCount}, מספר משחקים פתוחים=${openGamesCount}`);
      } else {
        console.log(`משחק ${index + 1}: אין תאריך, מזהה=${game.id}, קבוצה=${game.groupId}, נוצר ב-${new Date(game.createdAt).toISOString()}`);
      }
    });
    console.log("-----------------------------------------------");
  }
  
  // Filter by time period
  if (filter.timeFilter !== 'all') {
    console.log(`filterGames: מסנן לפי זמן ${filter.timeFilter}`);
    
    // משתמשים בפונקציה להחזרת התאריך הנוכחי של המערכת
    const now = getCurrentSystemDate();
    console.log(`filterGames: התאריך הנוכחי של המערכת: ${now.toISOString()}`);
    
    let cutoffDate = new Date(now);
    let endDate: Date | null = null;
    
    switch (filter.timeFilter) {
      case 'month':
        // "חודש אחרון" = 30 יום אחורה מתאריך המערכת
        cutoffDate.setDate(now.getDate() - 30);
        console.log(`filterGames: תאריך סף עבור 30 ימים אחרונים: ${cutoffDate.toISOString()}`);
        endDate = now; // תאריך הסיום הוא תאריך המערכת
        break;
      case 'quarter':
        // "רבעון אחרון" = 90 יום אחורה מתאריך המערכת
        cutoffDate.setDate(now.getDate() - 90);
        console.log(`filterGames: תאריך סף עבור 90 ימים אחרונים: ${cutoffDate.toISOString()}`);
        endDate = now;
        break;
      case 'year':
        // "שנה אחרונה" = 365 יום אחורה מתאריך המערכת
        cutoffDate.setDate(now.getDate() - 365);
        console.log(`filterGames: תאריך סף עבור 365 ימים אחרונים: ${cutoffDate.toISOString()}`);
        endDate = now;
        break;
      case 'custom':
        if (filter.startDate) {
          cutoffDate = filter.startDate;
          endDate = filter.endDate || now;
        }
        break;
    }
    
    console.log(`filterGames: תאריך סף לסינון ${cutoffDate.toISOString()}`);
    if (endDate) {
      console.log(`filterGames: תאריך סיום לסינון ${endDate.toISOString()}`);
    }
    
    // סינון המשחקים לפי התאריך
    filteredGames = filteredGames.filter(game => {
      let gameDate: Date;
      let usedField = '';
      
      // המרת התאריך לאובייקט Date
      if (game.date) {
        // יש שדה date במשחק
        gameDate = new Date(game.date.year, game.date.month - 1, game.date.day);
        usedField = `date (${game.date.day}/${game.date.month}/${game.date.year})`;
      } else if (game.createdAt) {
        // אין שדה date, נשתמש ב-createdAt
        gameDate = new Date(game.createdAt);
        usedField = `createdAt (${new Date(game.createdAt).toISOString()})`;
      } else {
        // אין שום תאריך, נכלול את המשחק בכל סינון
        console.log(`filterGames: משחק ${game.id} ללא תאריך, נכלל בכל סינון`);
        return true;
      }
      
      // במקרה של סינון "all" - מחזיר את כל המשחקים
      if (filter.timeFilter === 'all') {
        return true;
      }
      
      // בדיקה האם התאריך בטווח המבוקש
      const isInRange = gameDate >= cutoffDate && (!endDate || gameDate <= endDate);
      const openGamesCount = game.openGames?.length || 0;
      
      console.log(`filterGames: בודק משחק ${game.id || 'ללא מזהה'}, תאריך ${usedField}, קבוצה=${game.groupId}, מספר משחקים פתוחים=${openGamesCount}, יעבור סינון: ${isInRange}`);
      
      return isInRange;
    });
    
    console.log(`filterGames: לאחר סינון זמן נשארו ${filteredGames.length} משחקים`);
    
    // הדפסת פרטי המשחקים שנותרו אחרי סינון לצורך דיבוג
    if (filteredGames.length > 0) {
      console.log("--------- פרטי משחקים לאחר סינון זמן ---------");
      let totalOpenGames = 0;
      filteredGames.forEach((game, index) => {
        if (game.date) {
          const gameDate = `${game.date.day}/${game.date.month}/${game.date.year}`;
          const openGamesCount = game.openGames?.length || 0;
          totalOpenGames += openGamesCount;
          console.log(`משחק ${index + 1}: תאריך=${gameDate}, מזהה=${game.id}, מספר משחקים פתוחים=${openGamesCount}`);
        } else {
          const openGamesCount = game.openGames?.length || 0;
          totalOpenGames += openGamesCount;
          console.log(`משחק ${index + 1}: אין תאריך, מזהה=${game.id}, נוצר ב-${new Date(game.createdAt).toISOString()}, מספר משחקים פתוחים=${openGamesCount}`);
        }
      });
      console.log(`סה"כ משחקים פתוחים בתקופה: ${totalOpenGames}`);
      console.log("-----------------------------------------------");
    }
  }
  
  return filteredGames;
};

/**
 * מחשב סטטיסטיקות כלליות על כל המשחקים לפי פילטר
 */
export const getGameStatsSummary = async (filter: StatisticsFilter, skipCache: boolean = false): Promise<GameStatsSummary> => {
  // Calculate cache key based on filter
  const cacheKey = `gameSummary_${JSON.stringify(filter)}`;
  
  // Check if we have a valid cache entry
  if (!skipCache && statsCache.has(cacheKey)) {
    const cacheEntry = statsCache.get(cacheKey)!;
    if (Date.now() - cacheEntry.timestamp < CACHE_EXPIRY) {
      return cacheEntry.data as GameStatsSummary;
    }
  }

  // קבלת כל המשחקים ואז סינון לפי הפילטר
  const allGames = await fetchAllGames(skipCache);
  const filteredGames = filterGames(allGames, filter);
  
  let totalMoney = 0;
  let totalRebuys = 0;
  let totalPlayers = 0;
  let uniquePlayers = new Set<string>();
  let maxPlayers = 0;
  let minPlayers = Infinity;
  
  // עבור חישוב משך זמן ממוצע למשחק, נשתמש בתאריכי יצירה ועדכון
  let totalDuration = 0;
  let gamesWithDuration = 0;
  
  // Process each game
  filteredGames.forEach(game => {
    if (!game.players || game.players.length === 0) return;
    
    const playerCount = game.players.length;
    totalPlayers += playerCount;
    maxPlayers = Math.max(maxPlayers, playerCount);
    minPlayers = Math.min(minPlayers, playerCount);
    
    // Add unique players
    game.players.forEach(player => {
      const playerId = player.userId || player.id;
      if (playerId) uniquePlayers.add(playerId);
      
      // Calculate financial statistics
      const buyInTotal = (player.buyInCount || 0) * 
        ((game.buyInSnapshot && game.buyInSnapshot.amount) || 0);
      const rebuyTotal = (player.rebuyCount || 0) * 
        ((game.rebuySnapshot && game.rebuySnapshot.amount) || 0);
      
      totalMoney += buyInTotal + rebuyTotal;
      totalRebuys += player.rebuyCount || 0;
    });
    
    // Track game duration if available
    if (game.createdAt && game.updatedAt && game.status !== 'active') {
      // נניח שמשחק נמשך לפחות שעה אחת ולא יותר מ-12 שעות (כדי למנוע חישובים מוטעים)
      const durationMs = game.updatedAt - game.createdAt;
      const durationMin = Math.floor(durationMs / 60000); // המרה למיליון שניות וסיבוב מטה
      
      if (durationMin >= 60 && durationMin <= 720) { // בין שעה ל-12 שעות
        totalDuration += durationMin;
        gamesWithDuration++;
      }
    }
  });
  
  const summary: GameStatsSummary = {
    totalGames: filteredGames.length,
    totalMoney,
    totalPlayers: uniquePlayers.size,
    totalRebuys,
    maxPlayers: maxPlayers === 0 ? undefined : maxPlayers,
    minPlayers: minPlayers === Infinity ? undefined : minPlayers,
    averagePlayersPerGame: filteredGames.length > 0 ? totalPlayers / filteredGames.length : 0,
    averageGameDuration: gamesWithDuration > 0 ? 
      Math.round(totalDuration / gamesWithDuration) : undefined
  };
  
  // Cache the result
  statsCache.set(cacheKey, {
    data: summary,
    timestamp: Date.now()
  });
  
  return summary;
};

/**
 * Get basic statistics summary
 */
export const getStatsSummary = async (filter: StatisticsFilter = { timeFilter: 'all' }): Promise<GameStatsSummary> => {
  console.log("הפעלת פונקציית getStatsSummary - נכנסים למסך הסטטיסטיקה");
  
  // קורא לפונקציית הלוג שלנו
  await logAllGames();
  
  try {
    // Create a cache key based on filter
    const cacheKey = `summary_${JSON.stringify(filter)}`;
    const cachedData = statsCache.get(cacheKey);
    
    if (cachedData && (Date.now() - cachedData.timestamp < CACHE_EXPIRY)) {
      console.log('Using cached summary data');
      return cachedData.data;
    }
    
    const allGames = await fetchAllGames();
    const filteredGames = filterGames(allGames, filter);
    
    // Set of unique player IDs across all games
    const uniquePlayers = new Set<string>();
    let totalMoney = 0;
    let totalRebuys = 0;
    let totalDuration = 0;
    let gamesWithDuration = 0;
    let maxPlayers = 0;
    let minPlayers = Infinity;
    let totalPlayers = 0;
    
    filteredGames.forEach(game => {
      // Count unique players
      game.players?.forEach(player => {
        if (player.userId) {
          uniquePlayers.add(player.userId);
        } else if (player.id) {
          uniquePlayers.add(player.id);
        }
      });
      
      // Track player count for this game
      const playerCount = game.players?.length || 0;
      totalPlayers += playerCount;
      if (playerCount > maxPlayers) maxPlayers = playerCount;
      if (playerCount < minPlayers && playerCount > 0) minPlayers = playerCount;
      
      // Sum money invested
      game.players?.forEach(player => {
        const buyInTotal = (player.buyInCount || 0) * 
          ((game.buyInSnapshot && game.buyInSnapshot.amount) || 0);
        const rebuyTotal = (player.rebuyCount || 0) * 
          ((game.rebuySnapshot && game.rebuySnapshot.amount) || 0);
          
        totalMoney += buyInTotal + rebuyTotal;
        totalRebuys += player.rebuyCount || 0;
      });
      
      // Track game duration if available
      if (game.createdAt && game.updatedAt && game.status !== 'active') {
        // נניח שמשחק נמשך לפחות שעה אחת ולא יותר מ-12 שעות (כדי למנוע חישובים מוטעים)
        const durationMs = game.updatedAt - game.createdAt;
        const durationMin = Math.floor(durationMs / 60000); // המרה למיליון שניות וסיבוב מטה
        
        if (durationMin >= 60 && durationMin <= 720) { // בין שעה ל-12 שעות
          totalDuration += durationMin;
          gamesWithDuration++;
        }
      }
    });
    
    const summary: GameStatsSummary = {
      totalGames: filteredGames.length,
      totalMoney,
      totalPlayers: uniquePlayers.size,
      totalRebuys,
      maxPlayers: maxPlayers === 0 ? undefined : maxPlayers,
      minPlayers: minPlayers === Infinity ? undefined : minPlayers,
      averagePlayersPerGame: filteredGames.length > 0 ? totalPlayers / filteredGames.length : 0,
      averageGameDuration: gamesWithDuration > 0 ? 
        Math.round(totalDuration / gamesWithDuration) : undefined
    };
    
    // Cache the result
    statsCache.set(cacheKey, {
      data: summary,
      timestamp: Date.now()
    });
    
    return summary;
  } catch (error) {
    console.error('Error getting stats summary:', error);
    throw error;
  }
};

/**
 * Get detailed game statistics including monthly data
 */
export const getGameStatistics = async (
  filter: StatisticsFilter = { timeFilter: 'all' }
): Promise<{
  monthlyStats: { month: string; games: number; money: number }[];
  groupStats?: { name: string; games: number; totalMoney: number }[];
  averagePlayersPerGame: number;
  buyInRebuyRatio: number;
}> => {
  try {
    // Create a cache key based on filter
    const cacheKey = `gameStats_${JSON.stringify(filter)}`;
    const cachedData = statsCache.get(cacheKey);
    
    if (cachedData && (Date.now() - cachedData.timestamp < CACHE_EXPIRY)) {
      console.log('Using cached game stats data');
      return cachedData.data;
    }
    
    const allGames = await fetchAllGames();
    const filteredGames = filterGames(allGames, filter);
    
    // Monthly statistics
    const monthlyStatsMap = new Map<string, { games: number; money: number }>();
    
    // Group statistics (only if not filtering by specific group)
    const groupStatsMap = new Map<string, { name: string; games: number; totalMoney: number }>();
    
    // Track total players for average calculation
    let totalPlayers = 0;
    let totalBuyIns = 0;
    let totalRebuys = 0;
    
    // Process each game
    filteredGames.forEach(game => {
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
      const existingMonthStats = monthlyStatsMap.get(monthKey) || { games: 0, money: 0 };
      existingMonthStats.games += 1;
      
      // Track group stats if not filtering by specific group
      if (!filter.groupId && game.groupId && game.groupNameSnapshot) {
        const existingGroupStats = groupStatsMap.get(game.groupId) || { 
          name: game.groupNameSnapshot,
          games: 0,
          totalMoney: 0
        };
        existingGroupStats.games += 1;
        
        // Update group stats
        groupStatsMap.set(game.groupId, existingGroupStats);
      }
      
      // Calculate money and track players
      let gameMoney = 0;
      game.players?.forEach(player => {
        const buyInCount = player.buyInCount || 0;
        const rebuyCount = player.rebuyCount || 0;
        
        const buyInTotal = buyInCount * 
          ((game.buyInSnapshot && game.buyInSnapshot.amount) || 0);
        const rebuyTotal = rebuyCount * 
          ((game.rebuySnapshot && game.rebuySnapshot.amount) || 0);
          
        gameMoney += buyInTotal + rebuyTotal;
        
        totalBuyIns += buyInCount;
        totalRebuys += rebuyCount;
      });
      
      // Update monthly money
      existingMonthStats.money += gameMoney;
      monthlyStatsMap.set(monthKey, existingMonthStats);
      
      // Update group money if tracking groups
      if (!filter.groupId && game.groupId) {
        const groupStats = groupStatsMap.get(game.groupId);
        if (groupStats) {
          groupStats.totalMoney += gameMoney;
        }
      }
      
      // Track total players
      totalPlayers += game.players?.length || 0;
    });
    
    // Convert map to array for monthly stats
    const monthlyStats = Array.from(monthlyStatsMap.entries()).map(([month, stats]) => ({
      month,
      games: stats.games,
      money: stats.money
    }));
    
    // Convert map to array and sort by games count for group stats
    const groupStats = Array.from(groupStatsMap.values())
      .sort((a, b) => b.games - a.games);
    
    const result = {
      monthlyStats,
      groupStats: !filter.groupId ? groupStats : undefined,
      averagePlayersPerGame: filteredGames.length > 0 ? totalPlayers / filteredGames.length : 0,
      buyInRebuyRatio: totalBuyIns > 0 ? totalRebuys / totalBuyIns : 0
    };
    
    // Cache the result
    statsCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    return result;
  } catch (error) {
    console.error('Error getting game statistics:', error);
    throw error;
  }
};

/**
 * Get top players by profit
 */
export const getTopPlayers = async (
  limit: number = 5, 
  filter: StatisticsFilter = { timeFilter: 'all' }
): Promise<PlayerStats[]> => {
  try {
    // Create a cache key based on filter and limit
    const cacheKey = `topPlayers_${limit}_${JSON.stringify(filter)}`;
    const cachedData = statsCache.get(cacheKey);
    
    if (cachedData && (Date.now() - cachedData.timestamp < CACHE_EXPIRY)) {
      console.log('Using cached top players data');
      return cachedData.data;
    }
    
    const allGames = await fetchAllGames();
    const filteredGames = filterGames(allGames, filter);
    const allUsers = await getAllUsers();
    
    // Map to track accumulated stats for each player
    const playerStatsMap = new Map<string, PlayerStats>();
    
    // Process all games to build player statistics
    filteredGames.forEach(game => {
      game.players?.forEach(player => {
        const playerId = player.userId || player.id;
        if (!playerId) return;
        
        const playerName = player.name || 
          allUsers.find(u => u.id === playerId)?.name || 
          'לא ידוע';
        
        // Get or initialize player stats
        let playerStats = playerStatsMap.get(playerId);
        if (!playerStats) {
          playerStats = {
            playerId,
            playerName,
            gamesPlayed: 0,
            winCount: 0,
            lossCount: 0,
            netProfit: 0,
            totalBuyIns: 0,
            totalRebuys: 0,
            totalInvestment: 0,
            totalReturn: 0,
            winRate: 0,
            roi: 0,
            avgProfitPerGame: 0
          };
          playerStatsMap.set(playerId, playerStats);
        }
        
        // Update games played
        playerStats.gamesPlayed++;
        
        // Calculate investment
        const buyInAmount = (player.buyInCount || 0) * (game.buyInSnapshot?.amount || 0);
        const rebuyAmount = (player.rebuyCount || 0) * (game.rebuySnapshot?.amount || 0);
        const totalInvestment = buyInAmount + rebuyAmount;
        
        playerStats.totalBuyIns += player.buyInCount || 0;
        playerStats.totalRebuys += player.rebuyCount || 0;
        playerStats.totalInvestment += totalInvestment;
        
        // Calculate return and profit
        const finalResult = player.finalResultMoney || 0;
        playerStats.totalReturn += finalResult + totalInvestment; // Add investment back to get total return
        playerStats.netProfit += finalResult;
        
        // Update win/loss count
        if (finalResult > 0) {
          playerStats.winCount++;
          
          // Check if this is the best game
          if (!playerStats.bestGame || finalResult > playerStats.bestGame.profit) {
            playerStats.bestGame = {
              gameId: game.id,
              date: formatGameDate(game.date),
              profit: finalResult
            };
          }
        } else if (finalResult < 0) {
          playerStats.lossCount++;
          
          // Check if this is the worst game
          if (!playerStats.worstGame || finalResult < playerStats.worstGame.loss) {
            playerStats.worstGame = {
              gameId: game.id,
              date: formatGameDate(game.date),
              loss: finalResult
            };
          }
        }
      });
    });
    
    // Calculate derived statistics and finalize
    for (const playerStats of playerStatsMap.values()) {
      if (playerStats.gamesPlayed > 0) {
        playerStats.winRate = (playerStats.winCount / playerStats.gamesPlayed) * 100;
        playerStats.avgProfitPerGame = playerStats.netProfit / playerStats.gamesPlayed;
      }
      
      if (playerStats.totalInvestment > 0) {
        playerStats.roi = (playerStats.netProfit / playerStats.totalInvestment) * 100;
      }
    }
    
    // Convert to array, sort by net profit, and limit
    const sortedPlayers = Array.from(playerStatsMap.values())
      .sort((a, b) => b.netProfit - a.netProfit)
      .slice(0, limit);
    
    // Cache the result
    statsCache.set(cacheKey, {
      data: sortedPlayers,
      timestamp: Date.now()
    });
    
    return sortedPlayers;
  } catch (error) {
    console.error('Error getting top players:', error);
    throw error;
  }
};

/**
 * Get group statistics
 */
export const getGroupStatistics = async (
  groupId?: string,
  filter: StatisticsFilter = { timeFilter: 'all' }
): Promise<GroupStats[]> => {
  try {
    // Create a cache key based on groupId and filter
    const cacheKey = `groupStats_${groupId || 'all'}_${JSON.stringify(filter)}`;
    const cachedData = statsCache.get(cacheKey);
    
    if (cachedData && (Date.now() - cachedData.timestamp < CACHE_EXPIRY)) {
      console.log('Using cached group stats data');
      return cachedData.data;
    }
    
    const allGames = await fetchAllGames();
    const allGroups = await getAllActiveGroups();
    
    // Filter to specific group if provided
    const relevantGroups = groupId ? 
      allGroups.filter(g => g.id === groupId) : allGroups;
    
    const groupStatsArray: GroupStats[] = [];
    
    // Process each group
    for (const group of relevantGroups) {
      // Apply filter but force groupId
      const groupFilter = { ...filter, groupId: group.id };
      const groupGames = filterGames(allGames, groupFilter);
      
      // Skip if no games
      if (groupGames.length === 0) continue;
      
      // Count player frequency
      const playerFrequency = new Map<string, number>();
      let totalPlayers = 0;
      
      groupGames.forEach(game => {
        const playerCount = game.players?.length || 0;
        totalPlayers += playerCount;
        
        game.players?.forEach(player => {
          const playerId = player.userId || player.id;
          if (!playerId) return;
          
          const count = playerFrequency.get(playerId) || 0;
          playerFrequency.set(playerId, count + 1);
        });
      });
      
      // Get most frequent players
      const frequentPlayers = Array.from(playerFrequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([playerId, count]) => {
          const player = groupGames
            .flatMap(g => g.players || [])
            .find(p => (p.userId || p.id) === playerId);
          
          return {
            playerId,
            playerName: player?.name || 'לא ידוע',
            gamesCount: count
          };
        });
      
      // Calculate total money
      let totalMoney = 0;
      groupGames.forEach(game => {
        game.players?.forEach(player => {
          const buyInTotal = (player.buyInCount || 0) * (game.buyInSnapshot?.amount || 0);
          const rebuyTotal = (player.rebuyCount || 0) * (game.rebuySnapshot?.amount || 0);
          totalMoney += buyInTotal + rebuyTotal;
        });
      });
      
      // Find last game date
      const lastGame = groupGames[0]; // Assuming already sorted by date
      const lastGameDate = formatGameDate(lastGame.date);
      
      // Create group stats
      const groupStats: GroupStats = {
        groupId: group.id,
        groupName: group.name,
        gamesPlayed: groupGames.length,
        totalMoney,
        averagePlayersPerGame: groupGames.length > 0 ? totalPlayers / groupGames.length : 0,
        mostFrequentPlayers: frequentPlayers,
        lastGameDate
      };
      
      groupStatsArray.push(groupStats);
    }
    
    // Sort by most games
    const sortedStats = groupStatsArray.sort((a, b) => b.gamesPlayed - a.gamesPlayed);
    
    // Cache the result
    statsCache.set(cacheKey, {
      data: sortedStats,
      timestamp: Date.now()
    });
    
    return sortedStats;
  } catch (error) {
    console.error('Error getting group statistics:', error);
    throw error;
  }
};

/**
 * Get game metrics over time (for trend analysis)
 */
export const getGameMetricsOverTime = async (
  filter: StatisticsFilter = { timeFilter: 'all' },
  metricType: 'games' | 'money' | 'players' | 'rebuys' = 'games'
): Promise<{ label: string; value: number }[]> => {
  try {
    // Create a cache key
    const cacheKey = `metrics_${metricType}_${JSON.stringify(filter)}`;
    const cachedData = statsCache.get(cacheKey);
    
    if (cachedData && (Date.now() - cachedData.timestamp < CACHE_EXPIRY)) {
      console.log(`Using cached ${metricType} metrics data`);
      return cachedData.data;
    }
    
    const allGames = await fetchAllGames();
    const filteredGames = filterGames(allGames, filter);
    
    // Group games by month
    const monthlyMetrics = new Map<string, number>();
    
    filteredGames.forEach(game => {
      // Extract month and year from game date
      let monthYear = 'unknown';
      if (game.date?.month && game.date?.year) {
        monthYear = `${String(game.date.month).padStart(2, '0')}/${game.date.year}`;
      } else if (game.createdAt) {
        const date = new Date(game.createdAt);
        monthYear = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
      }
      
      // Get current value
      const currentValue = monthlyMetrics.get(monthYear) || 0;
      
      // Calculate metric value based on type
      let metricValue = 0;
      switch (metricType) {
        case 'games':
          metricValue = 1; // One game
          break;
        case 'money':
          // Sum all buy-ins and rebuys
          game.players?.forEach(player => {
            const buyInTotal = (player.buyInCount || 0) * (game.buyInSnapshot?.amount || 0);
            const rebuyTotal = (player.rebuyCount || 0) * (game.rebuySnapshot?.amount || 0);
            metricValue += buyInTotal + rebuyTotal;
          });
          break;
        case 'players':
          metricValue = game.players?.length || 0;
          break;
        case 'rebuys':
          // Sum all rebuys
          game.players?.forEach(player => {
            metricValue += player.rebuyCount || 0;
          });
          break;
      }
      
      // Update metric
      monthlyMetrics.set(monthYear, currentValue + metricValue);
    });
    
    // Convert to array and sort by date
    const metricsArray = Array.from(monthlyMetrics.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => {
        // Parse month strings (MM/YYYY)
        const [aMonth, aYear] = a.label.split('/').map(Number);
        const [bMonth, bYear] = b.label.split('/').map(Number);
        
        if (aYear !== bYear) return aYear - bYear;
        return aMonth - bMonth;
      });
    
    // Cache the result
    statsCache.set(cacheKey, {
      data: metricsArray,
      timestamp: Date.now()
    });
    
    return metricsArray;
  } catch (error) {
    console.error(`Error getting ${metricType} metrics over time:`, error);
    throw error;
  }
};

/**
 * מנקה את המטמון של הסטטיסטיקות
 */
export const clearStatsCache = (): void => {
  statsCache.clear();
  console.log('מטמון הסטטיסטיקות נוקה');
};

/**
 * מנקה פריטי מטמון שפג תוקפם
 */
export const purgeExpiredCache = (): number => {
  const now = Date.now();
  let expiredCount = 0;
  
  statsCache.forEach((cacheData, key) => {
    if (now - cacheData.timestamp > CACHE_EXPIRY) {
      statsCache.delete(key);
      expiredCount++;
    }
  });
  
  if (expiredCount > 0) {
    console.log(`נוקו ${expiredCount} פריטי מטמון שפג תוקפם`);
  }
  
  return expiredCount;
};

/**
 * מחזיר את תאריך המערכת הנוכחי
 */
export const getCurrentSystemDate = (): Date => {
  return new Date();
};

// פונקציה חדשה להדפסת לוג של כל המשחקים
export const logAllGames = async (): Promise<void> => {
  console.log("============ רשימת כל המשחקים בכל הקבוצות ובכל הזמנים ============");
  
  try {
    const allGames = await fetchAllGames();
    
    if (allGames.length === 0) {
      console.log("לא נמצאו משחקים במערכת");
      return;
    }
    
    allGames.forEach((game, index) => {
      const dateStr = game.date 
        ? `${game.date.day}/${game.date.month}/${game.date.year}` 
        : new Date(game.createdAt).toLocaleDateString();
      
      const playersCount = game.players?.length || 0;
      const openGamesCount = game.openGames?.length || 0;
      
      console.log(
        `משחק ${index + 1}/${allGames.length}: ` +
        `מזהה=${game.id}, ` +
        `קבוצה=${game.groupId}, ` + 
        `שם קבוצה=${game.groupNameSnapshot || 'לא ידוע'}, ` +
        `תאריך=${dateStr}, ` +
        `מספר שחקנים=${playersCount}, ` +
        `מספר משחקים פתוחים=${openGamesCount}`
      );
    });
    
    console.log("===============================================================");
  } catch (error) {
    console.error("שגיאה בהדפסת רשימת המשחקים:", error);
  }
};