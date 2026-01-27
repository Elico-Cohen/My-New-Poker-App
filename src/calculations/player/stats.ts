/**
 * חישובי סטטיסטיקות שחקן
 */

import { Game } from '../../models/Game';
import { CalculationFunction, CalculationOptions, CalculationResult } from '../core/types';
import { CacheManager } from '../cache/CacheManager';
import { CACHE_CATEGORIES, CACHE_TTL } from '../core/constants';
import { createCalculationResult, didPlayerWin, filterGames } from '../core/utils';

/**
 * פרמטרים לחישוב סטטיסטיקות שחקן
 */
export interface PlayerStatsParams {
  userId: string;       // מזהה השחקן
  games?: Game[];       // רשימת משחקים (אופציונלי, יכול להיות מועבר ישירות לחישוב)
  gameIds?: string[];   // מזהי משחקים לסינון (אופציונלי)
  timeFilter?: string;  // סינון לפי זמן (אופציונלי)
  groupId?: string;     // סינון לפי קבוצה (אופציונלי)
}

/**
 * תוצאות חישוב סטטיסטיקות שחקן
 */
export interface PlayerStatsResult {
  totalGames: number;           // סך כל המשחקים
  gamesWon: number;             // מספר משחקים שהשחקן ניצח
  winPercentage: number;        // אחוז ניצחונות
  totalInvestment: number;      // סך כל ההשקעה
  totalProfit: number;          // סך כל הרווח
  averageProfitPerGame: number; // רווח ממוצע למשחק
  totalRebuys: number;          // סך כל הריבאיים
  averageRebuysPerGame: number; // ממוצע ריבאיים למשחק
  biggestWin?: number;          // הזכייה הגדולה ביותר
  biggestLoss?: number;         // ההפסד הגדול ביותר
  longestWinStreak: number;     // רצף הניצחונות הארוך ביותר
  longestLossStreak: number;    // רצף ההפסדים הארוך ביותר
  roi: number;                  // תשואה על השקעה
}

/**
 * חישוב סטטיסטיקות שחקן מלאות
 * 
 * מאחד את כל החישובים השונים שהיו מפוזרים בקוד, כולל:
 * - calculateTotalProfit
 * - calculateGamesPlayed
 * - calculateGamesWon
 * - calculateWinPercentage
 * - calculateAverageProfitPerGame
 * - calculateTotalRebuys
 * - וכו'
 * 
 * @param params פרמטרים לחישוב
 * @param options אפשרויות חישוב
 * @returns תוצאת חישוב עם כל הסטטיסטיקות
 */
export const calculatePlayerStats: CalculationFunction<PlayerStatsParams, PlayerStatsResult> = 
  (params, options = {}) => {
    const { userId, games: inputGames, gameIds, timeFilter, groupId } = params;
    const { useCache = true, forceRefresh = false } = options;
    
    // בדיקה במטמון אם מאופשר וללא דרישה לרענון
    if (useCache && !forceRefresh) {
      const cacheKey = `${userId}:${timeFilter || 'all'}:${groupId || 'all'}:${gameIds?.join(',') || 'all'}`;
      const cached = CacheManager.get<PlayerStatsResult>(CACHE_CATEGORIES.PLAYER_STATS, cacheKey);
      
      if (cached) {
        return createCalculationResult(cached, ['cache'], true, { userId, timeFilter, groupId });
      }
    }
    
    // השג את המשחקים או השתמש במשחקים שסופקו
    // בפרויקט האמיתי, נשתמש ב-API או שירות לקבלת המשחקים
    const games = inputGames || []; // בפרויקט האמיתי נקרא לפונקציה להבאת המשחקים
    
    // סנן את המשחקים לפי הפרמטרים
    const filteredGames = filterGames(games, {
      userId,
      groupId,
      timeFilter: timeFilter as any,
      status: ['completed', 'open_games', 'closed']
    });
    
    // אם אין משחקים, החזר תוצאה ריקה
    if (filteredGames.length === 0) {
      const emptyResult: PlayerStatsResult = {
        totalGames: 0,
        gamesWon: 0,
        winPercentage: 0,
        totalInvestment: 0,
        totalProfit: 0,
        averageProfitPerGame: 0,
        totalRebuys: 0,
        averageRebuysPerGame: 0,
        biggestWin: 0,
        biggestLoss: 0,
        longestWinStreak: 0,
        longestLossStreak: 0,
        roi: 0
      };
      
      return createCalculationResult(emptyResult, ['games'], false, { userId, timeFilter, groupId });
    }
    
    // חישוב סטטיסטיקות בסיסיות
    const totalGames = filteredGames.length;
    const gamesWithPlayer = filteredGames.filter(game => 
      game.players?.some(player => player.userId === userId));
    
    // חישוב משחקים שנוצחו
    const gamesWon = gamesWithPlayer.filter(game => didPlayerWin(game, userId)).length;
    const winPercentage = totalGames > 0 ? (gamesWon / totalGames) * 100 : 0;
    
    // חישוב השקעות, רווחים וריבאיים
    let totalInvestment = 0;
    let totalProfit = 0;
    let totalRebuys = 0;
    let biggestWin = 0;
    let biggestLoss = 0;
    
    // מעקב אחר רצפים
    let currentWinStreak = 0;
    let currentLossStreak = 0;
    let longestWinStreak = 0;
    let longestLossStreak = 0;
    
    // עבור על כל המשחקים ועדכן את הסטטיסטיקות
    gamesWithPlayer.forEach(game => {
      const player = game.players?.find(p => p.userId === userId);
      if (!player) return;
      
      // חישוב השקעה (באי-אין + ריבאיים)
      const buyInAmount = game.buyInSnapshot?.amount || 0;
      const rebuyAmount = game.rebuySnapshot?.amount || 0;
      
      const investment = (buyInAmount * (player.buyInCount || 1)) + 
                        (rebuyAmount * (player.rebuyCount || 0));
      
      totalInvestment += investment;
      totalRebuys += player.rebuyCount || 0;
      
      // חישוב רווח/הפסד
      const profit = player.finalResultMoney || player.resultBeforeOpenGames || 0;
      totalProfit += profit;
      
      // עדכון רווח/הפסד הגדול ביותר
      if (profit > biggestWin) {
        biggestWin = profit;
      }
      
      if (profit < biggestLoss) {
        biggestLoss = profit;
      }
      
      // עדכון רצפים
      if (profit > 0) {
        currentWinStreak++;
        currentLossStreak = 0;
        
        if (currentWinStreak > longestWinStreak) {
          longestWinStreak = currentWinStreak;
        }
      } else {
        currentLossStreak++;
        currentWinStreak = 0;
        
        if (currentLossStreak > longestLossStreak) {
          longestLossStreak = currentLossStreak;
        }
      }
    });
    
    // חישוב ממוצעים
    const averageProfitPerGame = totalGames > 0 ? totalProfit / totalGames : 0;
    const averageRebuysPerGame = totalGames > 0 ? totalRebuys / totalGames : 0;
    
    // חישוב תשואה על השקעה (ROI)
    const roi = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;
    
    // יצירת תוצאת הסטטיסטיקה
    const result: PlayerStatsResult = {
      totalGames,
      gamesWon,
      winPercentage,
      totalInvestment,
      totalProfit,
      averageProfitPerGame,
      totalRebuys,
      averageRebuysPerGame,
      biggestWin,
      biggestLoss,
      longestWinStreak,
      longestLossStreak,
      roi
    };
    
    // שמירה במטמון
    if (useCache) {
      const cacheKey = `${userId}:${timeFilter || 'all'}:${groupId || 'all'}:${gameIds?.join(',') || 'all'}`;
      CacheManager.set(CACHE_CATEGORIES.PLAYER_STATS, cacheKey, result, CACHE_TTL.MEDIUM);
    }
    
    return createCalculationResult(result, ['games', 'players'], false, { userId, timeFilter, groupId });
  }; 