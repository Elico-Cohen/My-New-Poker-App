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
import { formatShortDate, formatLongDate } from '@/utils/formatters/dateFormatter';
import { formatCurrency } from '@/utils/formatters/currencyFormatter';
import { 
  calculateTotalProfit,
  calculateGamesPlayed,
  calculateGamesWon,
  calculateWinPercentage,
  calculateAverageProfitPerGame,
  calculatePlayerRankingByProfit,
  calculateTotalRebuys,
  calculateAverageRebuysPerGame
} from '@/calculations/legacy';
import { getGameStatistics as importedGetGameStatistics } from './gameStatistics';
import { GameStatisticsResponse } from './gameStatistics';

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
    
    // הסרנו את השימוש ב-syncService כדי למנוע Require cycle
    // במקום זה נסתמך על המאגר המרכזי שמתעדכן על ידי AuthContext/SyncService
    if (skipCache) {
      console.log('statisticsService: מבקש רענון נתונים (ללא syncService)');
      // ננסה לטעון מ-store אפילו עם skipCache
    }
    
    // קבלת כל המשחקים מהמאגר המרכזי
    const allGames = store.getGames();
    console.log(`statisticsService: התקבלו ${allGames.length} משחקים מהמאגר המרכזי`);
    
    // יותר מידע על המשחקים
    if (allGames.length > 0) {
      console.log('דוגמה למשחק ראשון:', {
        id: allGames[0].id,
        groupId: allGames[0].groupId,
        status: allGames[0].status,
        hasDate: !!allGames[0].date,
        hasPlayers: !!allGames[0].players && allGames[0].players.length > 0,
        createdAt: allGames[0].createdAt ? new Date(allGames[0].createdAt).toISOString() : 'לא נקבע',
        playersCount: allGames[0].players?.length || 0
      });
    }
    
    // אם אין משחקים במאגר, נדווח על כך
    if (allGames.length === 0) {
      console.log('statisticsService: אין משחקים במאגר המרכזי');
      return [];
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
  
  // הדפסת מידע מורחב על סטטוסים של משחקים
  const statusCounts: Record<string, number> = {};
  games.forEach(game => {
    const status = game.status || 'unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  console.log('filterGames: פילוג סטטוסים של משחקים לפני סינון:', JSON.stringify(statusCounts));
  
  // בדיקה כמה משחקים יש עם שחקנים
  const gamesWithPlayers = games.filter(game => game.players && game.players.length > 0).length;
  const gamesWithoutPlayers = games.length - gamesWithPlayers;
  console.log(`filterGames: מתוך ${games.length} משחקים, ${gamesWithPlayers} עם שחקנים, ${gamesWithoutPlayers} ללא שחקנים`);
  
  // נתוני סינון
  console.log(`filterGames: פרמטרי סינון:`, 
               `timeFilter=${filter.timeFilter || 'all'}`,
               `groupId=${filter.groupId || 'all'}`,
               `playerId=${filter.playerId || 'all'}`,
               `includeAllStatuses=${filter.includeAllStatuses || false}`,
               `סטטוסים=${filter.statuses ? filter.statuses.join(',') : 'ברירת מחדל'}`);
  
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
  } else {
    console.log('filterGames: כולל את כל הסטטוסים, אין סינון לפי סטטוס');
  }
  console.log(`filterGames: לאחר סינון סטטוס נשארו ${filteredGames.length} משחקים`);
  
  // מידע על משחקים אחרי סינון סטטוס
  if (filteredGames.length > 0) {
    const filteredStatusCounts: Record<string, number> = {};
    filteredGames.forEach(game => {
      const status = game.status || 'unknown';
      filteredStatusCounts[status] = (filteredStatusCounts[status] || 0) + 1;
    });
    console.log('filterGames: פילוג סטטוסים אחרי סינון סטטוס:', JSON.stringify(filteredStatusCounts));
  }
  
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
  
  // בדיקת תקינות - כמה מהמשחקים אחרי הסינון יש להם תאריך
  const gamesWithDate = filteredGames.filter(game => game.date).length;
  const gamesWithoutDate = filteredGames.length - gamesWithDate;
  console.log(`filterGames: מתוך ${filteredGames.length} משחקים אחרי סינון, ${gamesWithDate} עם תאריך, ${gamesWithoutDate} ללא תאריך`);
  
  // הדפסת פרטי כל המשחקים לצורך דיבוג אם יש מעט משחקים
  if (filteredGames.length > 0 && filteredGames.length < 10) {
    console.log("--------- פרטי משחקים לפני סינון זמן ---------");
    filteredGames.forEach((game, index) => {
      const dateInfo = game.date 
        ? `תאריך=${game.date.day}/${game.date.month}/${game.date.year}`
        : `אין תאריך, נוצר=${game.createdAt ? new Date(game.createdAt).toLocaleString() : 'לא ידוע'}`;
      
      console.log(`משחק ${index + 1}: ${dateInfo}, סטטוס=${game.status || 'ללא סטטוס'}, מזהה=${game.id}, קבוצה=${game.groupId}, שחקנים=${game.players?.length || 0}`);
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
        // חודש אחרון = 30 יום אחורה מתאריך המערכת
        cutoffDate = new Date(now);
        cutoffDate.setMonth(now.getMonth() - 1);
        console.log(`filterGames: תאריך סף עבור חודש אחרון: ${cutoffDate.toISOString()}`);
        endDate = now;
        break;
      case 'quarter':
        // רבעון אחרון = 3 חודשים אחורה מתאריך המערכת
        cutoffDate = new Date(now);
        cutoffDate.setMonth(now.getMonth() - 3);
        console.log(`filterGames: תאריך סף עבור רבעון אחרון: ${cutoffDate.toISOString()}`);
        endDate = now;
        break;
      case 'year':
        // שנה אחרונה = שנה אחורה מתאריך המערכת
        cutoffDate = new Date(now);
        cutoffDate.setFullYear(now.getFullYear() - 1);
        console.log(`filterGames: תאריך סף עבור שנה אחרונה: ${cutoffDate.toISOString()}`);
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
    const originalCount = filteredGames.length;
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
      return isInRange;
    });
    
    console.log(`filterGames: לאחר סינון זמן נשארו ${filteredGames.length} משחקים מתוך ${originalCount}`);
    
    // הדפסת סיכום אחרי סינון זמן
    if (filteredGames.length === 0) {
      console.warn('filterGames: לא נשארו משחקים אחרי סינון זמן!');
    } else {
      // בדיקה כמה מהמשחקים הסופיים יש להם שחקנים
      const gamesWithPlayersAfterFiltering = filteredGames.filter(game => game.players && game.players.length > 0).length;
      console.log(`filterGames: מתוך ${filteredGames.length} משחקים סופיים, ${gamesWithPlayersAfterFiltering} עם שחקנים`);
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
  console.log("הפעלת פונקציית getStatsSummary - נכנסים למסך הסטטיסטיקה", filter);
  
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
    
    console.log('getStatsSummary: מביא את כל המשחקים');
    const allGames = await fetchAllGames();
    console.log(`getStatsSummary: התקבלו ${allGames.length} משחקים`);
    
    console.log('getStatsSummary: מסנן משחקים');
    const filteredGames = filterGames(allGames, filter);
    console.log(`getStatsSummary: נשארו ${filteredGames.length} משחקים אחרי סינון`);
    
    if (filteredGames.length === 0) {
      console.warn("getStatsSummary: אין משחקים אחרי סינון - מחזיר ערכי ברירת מחדל");
      const emptySummary: GameStatsSummary = {
        totalGames: 0,
        totalMoney: 0,
        totalPlayers: 0,
        totalRebuys: 0,
        averagePlayersPerGame: 0
      };
      
      // נשמור במטמון כדי למנוע קריאות חוזרות
      statsCache.set(cacheKey, {
        data: emptySummary,
        timestamp: Date.now()
      });
      
      return emptySummary;
    }
    
    // Set of unique player IDs across all games
    const uniquePlayers = new Set<string>();
    let totalMoney = 0;
    let totalRebuys = 0;
    let totalDuration = 0;
    let gamesWithDuration = 0;
    let maxPlayers = 0;
    let minPlayers = Infinity;
    let totalPlayers = 0;
    
    console.log('getStatsSummary: מחשב סטטיסטיקות מהמשחקים המסוננים');
    
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
    
    console.log('getStatsSummary: סיום חישוב סטטיסטיקות:', summary);
    
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
 * מייצא מחדש את הפונקציה המיובאת מהקובץ gameStatistics.ts
 */
export const getGameStatistics = async (filter: StatisticsFilter = { timeFilter: 'all' }) => {
  console.log('📊 statisticsService.getGameStatistics: נקראה עם פילטר -', filter);
  
  try {
    console.log('📊 statisticsService: קורא לפונקציה importedGetGameStatistics מקובץ gameStatistics.ts');
    const result = await importedGetGameStatistics(filter);
    
    if (!result) {
      console.error('❌ statisticsService.getGameStatistics: הפונקציה importedGetGameStatistics החזירה ערך ריק');
      throw new Error('לא התקבלו נתונים מהשירות');
    }
    
    console.log('📊 statisticsService: בדיקת מבנה התוצאה שהתקבלה:');
    console.log('  - monthlyStats:', result.monthlyStats ? `יש ${result.monthlyStats.length} פריטים` : 'חסר');
    console.log('  - totalGames:', result.totalGames !== undefined ? result.totalGames : 'חסר');
    console.log('  - activePlayers:', result.activePlayers !== undefined ? result.activePlayers : 'חסר');
    console.log('  - averagePlayersPerGame:', result.averagePlayersPerGame !== undefined ? result.averagePlayersPerGame : 'חסר');
    
    return result;
  } catch (error) {
    console.error('❌ statisticsService.getGameStatistics: שגיאה -', error);
    
    // במקרה של שגיאה, נחזיר אובייקט עם ערכי ברירת מחדל כדי שהממשק לא יקרוס
    const defaultResponse: GameStatisticsResponse = {
      monthlyStats: [],
      playerDistribution: [],
      gameByDayOfWeek: [],
      rebuyDistribution: [],
      investmentDistribution: [],
      averagePlayersPerGame: 0,
      topGames: [],
      totalGames: 0,
      activePlayers: 0,
      totalRebuys: 0,
      totalMoney: 0,
      averageRebuysPerGame: 0,
      averageMoneyPerGame: 0,
      averageMoneyPerPlayer: 0
    };
    
    console.log('📊 statisticsService: מחזיר ערכי ברירת מחדל עקב שגיאה');
    return defaultResponse;
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
    
    // קבלת השחקנים הקבועים של הקבוצה אם יש סינון לפי קבוצה
    let permanentPlayersInGroup: Set<string> | null = null;
    if (filter.groupId && filter.groupId !== 'all') {
      const allGroups = await getAllActiveGroups();
      const group = allGroups.find(g => g.id === filter.groupId);
      if (group && group.permanentPlayers) {
        permanentPlayersInGroup = new Set(group.permanentPlayers);
        console.log(`getTopPlayers: מסנן לפי קבוצה ${group.name}, שחקנים קבועים: ${group.permanentPlayers.length}`);
      }
    }
    
    // Map to track accumulated stats for each player
    const playerStatsMap = new Map<string, PlayerStats>();
    
    // Process all games to build player statistics
    filteredGames.forEach(game => {
      game.players?.forEach(player => {
        const playerId = player.userId || player.id;
        if (!playerId) return;
        
        // אם יש סינון לפי קבוצה, כלול רק שחקנים קבועים
        if (permanentPlayersInGroup && !permanentPlayersInGroup.has(playerId)) {
          return; // דלג על שחקן שאינו קבוע בקבוצה
        }
        
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
      
      // קבלת השחקנים הקבועים של הקבוצה
      const permanentPlayersInGroup = new Set(group.permanentPlayers || []);
      console.log(`getGroupStatistics: מעבד קבוצה ${group.name}, שחקנים קבועים: ${permanentPlayersInGroup.size}`);
      
      // Count player frequency - only permanent players
      const playerFrequency = new Map<string, number>();
      let totalPlayers = 0;
      
      groupGames.forEach(game => {
        // Count only permanent players for this game
        let permanentPlayersInThisGame = 0;
        
        game.players?.forEach(player => {
          const playerId = player.userId || player.id;
          if (!playerId) return;
          
          // כלול רק שחקנים קבועים בקבוצה
          if (!permanentPlayersInGroup.has(playerId)) {
            return; // דלג על שחקן שאינו קבוע בקבוצה
          }
          
          permanentPlayersInThisGame++;
          const count = playerFrequency.get(playerId) || 0;
          playerFrequency.set(playerId, count + 1);
        });
        
        totalPlayers += permanentPlayersInThisGame;
      });
      
      // Get most frequent players (only permanent players)
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
      
      // Calculate total money (from all players, but count will reflect permanent players focus)
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
      const lastGameDate = formatGameDate((lastGame as any).gameDate || lastGame.date);
      
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
    
    console.log(`נמצאו ${allGames.length} משחקים במערכת`);
    
    // פילוג לפי סטטוס
    const statusCounts: Record<string, number> = {};
    allGames.forEach(game => {
      const status = game.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    console.log('פילוג לפי סטטוס:', statusCounts);
    
    // פילוג לפי קבוצה
    const groupCounts: Record<string, number> = {};
    allGames.forEach(game => {
      const groupId = game.groupId || 'unknown';
      groupCounts[groupId] = (groupCounts[groupId] || 0) + 1;
    });
    console.log('פילוג לפי קבוצה:', groupCounts);
    
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
        `סטטוס=${game.status || 'לא ידוע'}, ` +
        `מספר שחקנים=${playersCount}, ` +
        `מספר משחקים פתוחים=${openGamesCount}`
      );
    });
    
    console.log("===============================================================");
  } catch (error) {
    console.error("שגיאה בהדפסת רשימת המשחקים:", error);
  }
};