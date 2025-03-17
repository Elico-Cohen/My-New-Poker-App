/**
 * חישובי רווח פיננסיים
 */

import { Game } from '../../models/Game';
import { CalculationFunction, GameFilter } from '../core/types';
import { CacheManager } from '../cache/CacheManager';
import { CACHE_CATEGORIES, CACHE_TTL } from '../core/constants';
import { createCalculationResult, filterGames } from '../core/utils';

/**
 * פרמטרים לחישוב רווח מצטבר
 */
export interface CumulativeProfitParams {
  games?: Game[];        // רשימת משחקים (אופציונלי)
  userId?: string;       // מזהה שחקן (אופציונלי)
  timeFilter?: string;   // סינון לפי זמן
  groupId?: string;      // סינון לפי קבוצה
}

/**
 * פריט רווח מצטבר
 */
export interface CumulativeProfitItem {
  gameId: string;        // מזהה משחק
  gameName?: string;     // שם משחק
  gameDate: Date;        // תאריך משחק
  profit: number;        // רווח במשחק
  cumulativeProfit: number; // רווח מצטבר
}

/**
 * תוצאת חישוב רווח מצטבר
 */
export interface CumulativeProfitResult {
  items: CumulativeProfitItem[];  // פריטי הרווח המצטבר
  totalGames: number;             // סך כל המשחקים
  totalProfit: number;            // סך כל הרווח
  averageProfitPerGame: number;   // ממוצע רווח למשחק
}

/**
 * חישוב רווח מצטבר
 * 
 * מאחד את הפונקציות:
 * - calculateCumulativeProfit
 * - getCumulativeProfitList
 * 
 * @param params פרמטרים לחישוב
 * @param options אפשרויות חישוב
 * @returns תוצאת חישוב רווח מצטבר
 */
export const calculateCumulativeProfit: CalculationFunction<CumulativeProfitParams, CumulativeProfitResult> = 
  (params, options = {}) => {
    const { games: inputGames, userId, timeFilter, groupId } = params;
    const { useCache = true, forceRefresh = false } = options;
    
    // יצירת מפתח מטמון
    const cacheKey = `cumulative:${userId || 'all'}:${timeFilter || 'all'}:${groupId || 'all'}`;
    
    // בדיקה במטמון אם מאופשר וללא דרישה לרענון
    if (useCache && !forceRefresh) {
      const cached = CacheManager.get<CumulativeProfitResult>(CACHE_CATEGORIES.FINANCIAL, cacheKey);
      
      if (cached) {
        return createCalculationResult(cached, ['cache'], true, params);
      }
    }
    
    // השג את המשחקים או השתמש במשחקים שסופקו
    const games = inputGames || []; // בקוד האמיתי, נשתמש ב-API
    
    // סינון המשחקים
    const filter: GameFilter = {
      userId,
      groupId,
      timeFilter: timeFilter as any,
      status: ['completed', 'closed']
    };
    
    const filteredGames = filterGames(games, filter);
    
    // מיון המשחקים לפי תאריך
    const sortedGames = [...filteredGames].sort((a, b) => {
      // הנחה שיש לנו מבנה של gameDate שהוא אובייקט עם שדות year, month, day
      if (a.gameDate && b.gameDate) {
        const dateA = new Date(a.gameDate.year, a.gameDate.month - 1, a.gameDate.day);
        const dateB = new Date(b.gameDate.year, b.gameDate.month - 1, b.gameDate.day);
        return dateA.getTime() - dateB.getTime();
      }
      return 0;
    });
    
    // חישוב הרווח המצטבר
    let cumulativeProfit = 0;
    const items: CumulativeProfitItem[] = [];
    
    sortedGames.forEach(game => {
      if (!game.players) return;
      
      // אם יש userId, חשב את הרווח של אותו שחקן
      let profit = 0;
      if (userId) {
        const player = game.players.find(p => p.userId === userId);
        if (player) {
          profit = player.finalResultMoney || player.resultBeforeOpenGames || 0;
        }
      } else {
        // אחרת, סכום את כל הרווחים החיוביים (זהו הרווח הכולל של המשחק)
        game.players.forEach(player => {
          const playerProfit = player.finalResultMoney || player.resultBeforeOpenGames || 0;
          if (playerProfit > 0) {
            profit += playerProfit;
          }
        });
      }
      
      cumulativeProfit += profit;
      
      // יצירת תאריך משחק
      const gameDate = game.gameDate ? 
        new Date(game.gameDate.year, game.gameDate.month - 1, game.gameDate.day) : 
        new Date();
      
      items.push({
        gameId: game.id,
        gameName: game.name,
        gameDate,
        profit,
        cumulativeProfit
      });
    });
    
    // חישוב סטטיסטיקות נוספות
    const totalGames = items.length;
    const totalProfit = cumulativeProfit;
    const averageProfitPerGame = totalGames > 0 ? totalProfit / totalGames : 0;
    
    // יצירת תוצאה סופית
    const result: CumulativeProfitResult = {
      items,
      totalGames,
      totalProfit,
      averageProfitPerGame
    };
    
    // שמירה במטמון
    if (useCache) {
      CacheManager.set(CACHE_CATEGORIES.FINANCIAL, cacheKey, result, CACHE_TTL.MEDIUM);
    }
    
    return createCalculationResult(result, ['games'], false, params);
  };

/**
 * פרמטרים לחישוב משחקים עם רווח/הפסד הגבוה ביותר
 */
export interface ExtremeProfitParams {
  games?: Game[];        // רשימת משחקים (אופציונלי)
  userId?: string;       // מזהה שחקן (אופציונלי)
  timeFilter?: string;   // סינון לפי זמן
  groupId?: string;      // סינון לפי קבוצה
  limit?: number;        // מספר תוצאות להחזרה
  type: 'best' | 'worst'; // סוג החיפוש - הרווח הגבוה ביותר או ההפסד הגדול ביותר
}

/**
 * פריט רווח/הפסד קיצוני
 */
export interface ExtremeProfitItem {
  gameId: string;        // מזהה משחק
  gameName?: string;     // שם משחק
  gameDate: Date;        // תאריך משחק
  profit: number;        // רווח/הפסד
  investment: number;    // השקעה
  roi: number;           // תשואה על השקעה
}

/**
 * תוצאת חישוב רווח/הפסד קיצוני
 */
export interface ExtremeProfitResult {
  items: ExtremeProfitItem[];    // פריטי רווח/הפסד קיצוני
  type: 'best' | 'worst';        // סוג התוצאה
}

/**
 * חישוב משחקים עם רווח/הפסד הגבוה ביותר
 * 
 * מאחד את הפונקציות:
 * - getBestSingleGameProfitList
 * - getWorstSingleGameLossList
 * 
 * @param params פרמטרים לחישוב
 * @param options אפשרויות חישוב
 * @returns תוצאת חישוב רווח/הפסד קיצוני
 */
export const calculateExtremeProfit: CalculationFunction<ExtremeProfitParams, ExtremeProfitResult> = 
  (params, options = {}) => {
    const { games: inputGames, userId, timeFilter, groupId, limit = 5, type } = params;
    const { useCache = true, forceRefresh = false } = options;
    
    // יצירת מפתח מטמון
    const cacheKey = `extreme:${type}:${userId || 'all'}:${timeFilter || 'all'}:${groupId || 'all'}:${limit}`;
    
    // בדיקה במטמון אם מאופשר וללא דרישה לרענון
    if (useCache && !forceRefresh) {
      const cached = CacheManager.get<ExtremeProfitResult>(CACHE_CATEGORIES.FINANCIAL, cacheKey);
      
      if (cached) {
        return createCalculationResult(cached, ['cache'], true, params);
      }
    }
    
    // השג את המשחקים או השתמש במשחקים שסופקו
    const games = inputGames || []; // בקוד האמיתי, נשתמש ב-API
    
    // סינון המשחקים
    const filter: GameFilter = {
      userId,
      groupId,
      timeFilter: timeFilter as any,
      status: ['completed', 'closed']
    };
    
    const filteredGames = filterGames(games, filter);
    
    // מיון והוספת חישובי רווח
    const profitItems: ExtremeProfitItem[] = [];
    
    filteredGames.forEach(game => {
      if (!game.players) return;
      
      if (userId) {
        // חישוב הרווח של שחקן ספציפי
        const player = game.players.find(p => p.userId === userId);
        if (!player) return;
        
        const profit = player.finalResultMoney || player.resultBeforeOpenGames || 0;
        
        // חישוב השקעה
        const buyInAmount = game.buyInSnapshot?.amount || 0;
        const rebuyAmount = game.rebuySnapshot?.amount || 0;
        const investment = (buyInAmount * (player.buyInCount || 1)) + 
                          (rebuyAmount * (player.rebuyCount || 0));
        
        // חישוב תשואה על השקעה
        const roi = investment > 0 ? (profit / investment) * 100 : 0;
        
        // יצירת תאריך משחק
        const gameDate = game.gameDate ? 
          new Date(game.gameDate.year, game.gameDate.month - 1, game.gameDate.day) : 
          new Date();
        
        profitItems.push({
          gameId: game.id,
          gameName: game.name,
          gameDate,
          profit,
          investment,
          roi
        });
      } else {
        // חישוב רווח כולל של המשחק (סכום כל הרווחים החיוביים)
        let totalProfit = 0;
        let totalInvestment = 0;
        
        game.players.forEach(player => {
          const profit = player.finalResultMoney || player.resultBeforeOpenGames || 0;
          if ((type === 'best' && profit > 0) || (type === 'worst' && profit < 0)) {
            totalProfit += profit;
          }
          
          // חישוב השקעה כוללת
          const buyInAmount = game.buyInSnapshot?.amount || 0;
          const rebuyAmount = game.rebuySnapshot?.amount || 0;
          totalInvestment += (buyInAmount * (player.buyInCount || 1)) + 
                            (rebuyAmount * (player.rebuyCount || 0));
        });
        
        // חישוב תשואה על השקעה
        const roi = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;
        
        // יצירת תאריך משחק
        const gameDate = game.gameDate ? 
          new Date(game.gameDate.year, game.gameDate.month - 1, game.gameDate.day) : 
          new Date();
        
        if (totalProfit !== 0) { // רק אם יש רווח או הפסד
          profitItems.push({
            gameId: game.id,
            gameName: game.name,
            gameDate,
            profit: totalProfit,
            investment: totalInvestment,
            roi
          });
        }
      }
    });
    
    // מיון לפי רווח/הפסד
    profitItems.sort((a, b) => {
      if (type === 'best') {
        return b.profit - a.profit; // מיון יורד לרווחים הגבוהים ביותר
      } else {
        return a.profit - b.profit; // מיון עולה להפסדים הגדולים ביותר
      }
    });
    
    // הגבלת התוצאות
    const limitedItems = profitItems.slice(0, limit);
    
    // יצירת תוצאה סופית
    const result: ExtremeProfitResult = {
      items: limitedItems,
      type
    };
    
    // שמירה במטמון
    if (useCache) {
      CacheManager.set(CACHE_CATEGORIES.FINANCIAL, cacheKey, result, CACHE_TTL.MEDIUM);
    }
    
    return createCalculationResult(result, ['games'], false, params);
  }; 