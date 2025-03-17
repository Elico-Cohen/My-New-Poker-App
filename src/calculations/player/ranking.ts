/**
 * חישובי דירוג שחקנים
 */

import { Game } from '../../models/Game';
import { UserProfile } from '../../models/UserProfile';
import { CalculationFunction } from '../core/types';
import { CacheManager } from '../cache/CacheManager';
import { CACHE_CATEGORIES, CACHE_TTL } from '../core/constants';
import { createCalculationResult, filterGames } from '../core/utils';

/**
 * פרמטרים לחישוב דירוג שחקנים
 */
export interface PlayerRankingParams {
  games?: Game[];           // רשימת משחקים (אופציונלי)
  users?: UserProfile[];    // רשימת שחקנים (אופציונלי)
  userIds?: string[];       // רשימת מזהי שחקנים (אופציונלי)
  gameIds?: string[];       // רשימת מזהי משחקים (אופציונלי)
  timeFilter?: string;      // סינון לפי זמן
  groupId?: string;         // סינון לפי קבוצה
  sortBy?: 'totalProfit' | 'averageProfit' | 'winRate' | 'gamesPlayed';  // מיון לפי
  order?: 'asc' | 'desc';   // סדר מיון
  limit?: number;           // הגבלת מספר תוצאות
}

/**
 * תוצאת דירוג שחקן
 */
export interface PlayerRankingResult {
  userId: string;           // מזהה שחקן
  name: string;             // שם שחקן
  gamesPlayed: number;      // מספר משחקים ששוחקו
  gamesWon: number;         // מספר משחקים שנוצחו
  winRate: number;          // אחוז ניצחון
  totalProfit: number;      // רווח כולל
  averageProfit: number;    // רווח ממוצע למשחק
  totalInvestment: number;  // השקעה כוללת
  roi: number;              // תשואה על השקעה
  rank: number;             // דירוג
}

/**
 * חישוב דירוג שחקנים
 * 
 * מאחד את הפונקציות:
 * - calculatePlayerRankingByProfit
 * - calculatePlayerRankingByAverageProfit
 * - getPlayerRankings
 * - getTopPlayers
 *
 * @param params פרמטרים לחישוב הדירוג
 * @param options אפשרויות חישוב
 * @returns רשימת שחקנים מדורגת
 */
export const calculatePlayerRanking: CalculationFunction<
  PlayerRankingParams, 
  PlayerRankingResult[]
> = (params, options = {}) => {
  const { 
    games: inputGames, 
    users: inputUsers,
    userIds,
    gameIds,
    timeFilter,
    groupId,
    sortBy = 'totalProfit',
    order = 'desc',
    limit
  } = params;
  const { useCache = true, forceRefresh = false } = options;
  
  // בדיקה במטמון אם מאופשר וללא דרישה לרענון
  if (useCache && !forceRefresh) {
    const cacheKey = `ranking:${sortBy}:${order}:${timeFilter || 'all'}:${groupId || 'all'}:${userIds?.join(',') || 'all'}:${gameIds?.join(',') || 'all'}`;
    const cached = CacheManager.get<PlayerRankingResult[]>(CACHE_CATEGORIES.RANKINGS, cacheKey);
    
    if (cached) {
      // החזר את התוצאה המוגבלת אם נדרש
      const limitedResult = limit ? cached.slice(0, limit) : cached;
      return createCalculationResult(limitedResult, ['cache'], true, params);
    }
  }
  
  // השג את המשחקים ואת המשתמשים או השתמש באלה שסופקו
  // בפרויקט האמיתי יהיו כאן קריאות API
  const games = inputGames || []; 
  const users = inputUsers || [];
  
  // סנן משחקים לפי הפרמטרים
  const filteredGames = filterGames(games, {
    userId: undefined, // נסנן ידנית לפי רשימת משתמשים
    groupId,
    timeFilter: timeFilter as any,
    status: ['completed', 'open_games', 'closed']
  });
  
  // אם אין משחקים, החזר מערך ריק
  if (filteredGames.length === 0) {
    return createCalculationResult([], ['games', 'users'], false, params);
  }
  
  // מיפוי סטטיסטיקות לכל שחקן
  const playerStats: Record<string, Omit<PlayerRankingResult, 'name' | 'rank'>> = {};
  
  // עבור על כל המשחקים ואסוף נתונים לכל שחקן
  filteredGames.forEach(game => {
    if (!game.players) return;
    
    game.players.forEach(player => {
      const userId = player.userId;
      
      // בדוק אם צריך לכלול את השחקן (אם יש רשימת userIds ספציפית)
      if (userIds && userIds.length > 0 && !userIds.includes(userId)) {
        return;
      }
      
      // יצירת רשומה חדשה לשחקן אם היא לא קיימת
      if (!playerStats[userId]) {
        playerStats[userId] = {
          userId,
          gamesPlayed: 0,
          gamesWon: 0,
          winRate: 0,
          totalProfit: 0,
          averageProfit: 0,
          totalInvestment: 0,
          roi: 0
        };
      }
      
      // חישוב סטטיסטיקות בסיסיות
      const stats = playerStats[userId];
      stats.gamesPlayed++;
      
      // חישוב השקעה
      const buyInAmount = game.buyInSnapshot?.amount || 0;
      const rebuyAmount = game.rebuySnapshot?.amount || 0;
      const investment = (buyInAmount * (player.buyInCount || 1)) + 
                        (rebuyAmount * (player.rebuyCount || 0));
      stats.totalInvestment += investment;
      
      // חישוב רווח
      const profit = player.finalResultMoney || player.resultBeforeOpenGames || 0;
      stats.totalProfit += profit;
      
      // עדכון מספר ניצחונות
      if (profit > 0) {
        stats.gamesWon++;
      }
    });
  });
  
  // חישוב נתונים נגזרים וחיבור עם מידע משתמש
  const rankings: PlayerRankingResult[] = Object.values(playerStats).map(stat => {
    // חיפוש פרטי המשתמש
    const user = users.find(u => u.id === stat.userId);
    const name = user ? user.name : stat.userId;
    
    // חישוב נתונים ממוצעים
    const gamesPlayed = stat.gamesPlayed;
    const winRate = gamesPlayed > 0 ? (stat.gamesWon / gamesPlayed) * 100 : 0;
    const averageProfit = gamesPlayed > 0 ? stat.totalProfit / gamesPlayed : 0;
    const roi = stat.totalInvestment > 0 ? (stat.totalProfit / stat.totalInvestment) * 100 : 0;
    
    return {
      ...stat,
      name,
      winRate,
      averageProfit,
      roi,
      rank: 0 // יוגדר בהמשך לאחר המיון
    };
  });
  
  // מיון התוצאות
  rankings.sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'totalProfit':
        comparison = b.totalProfit - a.totalProfit;
        break;
      case 'averageProfit':
        comparison = b.averageProfit - a.averageProfit;
        break;
      case 'winRate':
        comparison = b.winRate - a.winRate;
        break;
      case 'gamesPlayed':
        comparison = b.gamesPlayed - a.gamesPlayed;
        break;
    }
    
    // היפוך הסדר אם נדרש
    return order === 'asc' ? -comparison : comparison;
  });
  
  // הוספת דירוג
  rankings.forEach((player, index) => {
    player.rank = index + 1;
  });
  
  // שמירה במטמון
  if (useCache) {
    const cacheKey = `ranking:${sortBy}:${order}:${timeFilter || 'all'}:${groupId || 'all'}:${userIds?.join(',') || 'all'}:${gameIds?.join(',') || 'all'}`;
    CacheManager.set(CACHE_CATEGORIES.RANKINGS, cacheKey, rankings, CACHE_TTL.MEDIUM);
  }
  
  // החזרת התוצאה המוגבלת אם נדרש
  const result = limit ? rankings.slice(0, limit) : rankings;
  return createCalculationResult(result, ['games', 'users'], false, params);
}; 