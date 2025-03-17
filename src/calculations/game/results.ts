/**
 * חישובי תוצאות משחק
 */

import { Game } from '../../models/Game';
import { CalculationFunction } from '../core/types';
import { CacheManager } from '../cache/CacheManager';
import { CACHE_CATEGORIES, CACHE_TTL } from '../core/constants';
import { createCalculationResult } from '../core/utils';

/**
 * פרמטרים לחישוב סיכום משחק
 */
export interface GameSummaryParams {
  gameId: string;      // מזהה המשחק
  game?: Game;         // אובייקט המשחק (אופציונלי)
}

/**
 * תוצאת סיכום המשחק
 */
export interface GameSummaryResult {
  gameId: string;               // מזהה המשחק
  totalPlayers: number;         // מספר שחקנים
  totalInvestment: number;      // סך ההשקעה
  totalInitialBuyIns: number;   // סך ה-buy-ins הראשוניים
  totalRebuys: number;          // סך הריבאיים
  averageRebuysPerPlayer: number; // ממוצע ריבאיים לשחקן
  finishedDate?: Date;          // תאריך סיום
  duration?: number;            // משך הזמן בדקות
  profitDistribution: {         // התפלגות הרווחים
    winners: number;           // מספר זוכים
    losers: number;            // מספר מפסידים
    breakevenPlayers: number;  // מספר שחקנים שהגיעו לאיזון
    topWinAmount: number;      // הרווח הגבוה ביותר
    topLossAmount: number;     // ההפסד הגדול ביותר
  }
}

/**
 * חישוב סיכום משחק
 * 
 * מאחד את הפונקציות המקוריות:
 * - calculateGameSummary
 * - getGameStatistics
 * - summarizeGameResults
 * 
 * @param params פרמטרים לחישוב
 * @param options אפשרויות חישוב
 * @returns תוצאת סיכום המשחק
 */
export const calculateGameSummary: CalculationFunction<GameSummaryParams, GameSummaryResult> = 
  (params, options = {}) => {
    const { gameId, game: inputGame } = params;
    const { useCache = true, forceRefresh = false } = options;
    
    // בדיקה במטמון אם מאופשר וללא דרישה לרענון
    if (useCache && !forceRefresh) {
      const cacheKey = `game:${gameId}`;
      const cached = CacheManager.get<GameSummaryResult>(CACHE_CATEGORIES.GAME_STATS, cacheKey);
      
      if (cached) {
        return createCalculationResult(cached, ['cache'], true, { gameId });
      }
    }
    
    // השג את המשחק אם לא סופק
    // בקוד האמיתי, זה יהיה בדרך כלל קריאת API
    const game = inputGame || { id: gameId } as Game;
    
    // אם אין נתוני משחק מלאים, החזר שגיאה או תוצאה ריקה
    if (!game || !game.players || game.players.length === 0) {
      const emptyResult: GameSummaryResult = {
        gameId,
        totalPlayers: 0,
        totalInvestment: 0,
        totalInitialBuyIns: 0,
        totalRebuys: 0,
        averageRebuysPerPlayer: 0,
        profitDistribution: {
          winners: 0,
          losers: 0,
          breakevenPlayers: 0,
          topWinAmount: 0,
          topLossAmount: 0
        }
      };
      
      return createCalculationResult(emptyResult, ['games'], false, { gameId });
    }
    
    // חישוב מספר שחקנים
    const totalPlayers = game.players.length;
    
    // חישוב השקעות
    const buyInAmount = game.buyInSnapshot?.amount || 0;
    const rebuyAmount = game.rebuySnapshot?.amount || 0;
    
    let totalInitialBuyIns = 0;
    let totalRebuys = 0;
    
    game.players.forEach(player => {
      totalInitialBuyIns += player.buyInCount || 1;
      totalRebuys += player.rebuyCount || 0;
    });
    
    const totalInvestment = (buyInAmount * totalInitialBuyIns) + (rebuyAmount * totalRebuys);
    const averageRebuysPerPlayer = totalPlayers > 0 ? totalRebuys / totalPlayers : 0;
    
    // חישוב משך זמן המשחק
    let duration;
    if (game.startTime && game.endTime) {
      const startTime = new Date(game.startTime).getTime();
      const endTime = new Date(game.endTime).getTime();
      duration = Math.floor((endTime - startTime) / (1000 * 60)); // במספר דקות
    }
    
    // חישוב התפלגות רווחים
    let winners = 0;
    let losers = 0;
    let breakevenPlayers = 0;
    let topWinAmount = 0;
    let topLossAmount = 0;
    
    game.players.forEach(player => {
      const profit = player.finalResultMoney || player.resultBeforeOpenGames || 0;
      
      if (profit > 0) {
        winners++;
        topWinAmount = Math.max(topWinAmount, profit);
      } else if (profit < 0) {
        losers++;
        topLossAmount = Math.min(topLossAmount, profit);
      } else {
        breakevenPlayers++;
      }
    });
    
    // יצירת תוצאת הסיכום
    const result: GameSummaryResult = {
      gameId,
      totalPlayers,
      totalInvestment,
      totalInitialBuyIns,
      totalRebuys,
      averageRebuysPerPlayer,
      finishedDate: game.endTime ? new Date(game.endTime) : undefined,
      duration,
      profitDistribution: {
        winners,
        losers,
        breakevenPlayers,
        topWinAmount,
        topLossAmount: Math.abs(topLossAmount) // המרה לערך חיובי לנוחות
      }
    };
    
    // שמירה במטמון
    if (useCache) {
      const cacheKey = `game:${gameId}`;
      CacheManager.set(CACHE_CATEGORIES.GAME_STATS, cacheKey, result, CACHE_TTL.LONG);
    }
    
    return createCalculationResult(result, ['games'], false, { gameId });
  };

/**
 * פרמטרים לחישוב תוצאות שחקנים במשחק
 */
export interface GamePlayersResultsParams {
  gameId: string;      // מזהה המשחק
  game?: Game;         // אובייקט המשחק (אופציונלי)
}

/**
 * תוצאת שחקן במשחק
 */
export interface PlayerGameResult {
  userId: string;              // מזהה שחקן
  name: string;                // שם שחקן
  initialBuyIn: number;        // מספר קניות ראשוניות
  rebuys: number;              // מספר ריבאיים
  totalInvestment: number;     // סך השקעה
  finalResult: number;         // תוצאה סופית
  profit: number;              // רווח/הפסד
  roi: number;                 // תשואה על השקעה
  rank: number;                // דירוג במשחק
}

/**
 * תוצאת חישוב תוצאות שחקנים במשחק
 */
export interface GamePlayersResultsResult {
  gameId: string;               // מזהה המשחק
  playerResults: PlayerGameResult[]; // תוצאות לכל שחקן
}

/**
 * חישוב תוצאות שחקנים במשחק
 * 
 * מאחד את הפונקציות המקוריות:
 * - calculatePlayerResults
 * - calculatePlayerInvestment
 * - getPlayerResultsForGame
 * 
 * @param params פרמטרים לחישוב
 * @param options אפשרויות חישוב
 * @returns תוצאות שחקנים במשחק
 */
export const calculateGamePlayersResults: CalculationFunction<
  GamePlayersResultsParams, 
  GamePlayersResultsResult
> = (params, options = {}) => {
  const { gameId, game: inputGame } = params;
  const { useCache = true, forceRefresh = false } = options;
  
  // בדיקה במטמון אם מאופשר וללא דרישה לרענון
  if (useCache && !forceRefresh) {
    const cacheKey = `playersResults:${gameId}`;
    const cached = CacheManager.get<GamePlayersResultsResult>(CACHE_CATEGORIES.GAME_STATS, cacheKey);
    
    if (cached) {
      return createCalculationResult(cached, ['cache'], true, { gameId });
    }
  }
  
  // השג את המשחק אם לא סופק
  // בקוד האמיתי, זה יהיה בדרך כלל קריאת API
  const game = inputGame || { id: gameId } as Game;
  
  // אם אין נתוני משחק מלאים, החזר שגיאה או תוצאה ריקה
  if (!game || !game.players || game.players.length === 0) {
    const emptyResult: GamePlayersResultsResult = {
      gameId,
      playerResults: []
    };
    
    return createCalculationResult(emptyResult, ['games'], false, { gameId });
  }
  
  // חישוב תוצאות לכל שחקן
  const playerResults: PlayerGameResult[] = game.players.map(player => {
    // חישוב השקעה
    const buyInAmount = game.buyInSnapshot?.amount || 0;
    const rebuyAmount = game.rebuySnapshot?.amount || 0;
    const initialBuyIn = player.buyInCount || 1;
    const rebuys = player.rebuyCount || 0;
    const totalInvestment = (buyInAmount * initialBuyIn) + (rebuyAmount * rebuys);
    
    // חישוב תוצאות
    const finalResult = player.finalResultMoney || player.resultBeforeOpenGames || 0;
    const profit = finalResult;
    const roi = totalInvestment > 0 ? (profit / totalInvestment) * 100 : 0;
    
    return {
      userId: player.userId,
      name: player.name || player.userId,
      initialBuyIn,
      rebuys,
      totalInvestment,
      finalResult,
      profit,
      roi,
      rank: 0 // יוגדר לאחר המיון
    };
  });
  
  // מיון לפי רווח
  playerResults.sort((a, b) => b.profit - a.profit);
  
  // הגדרת דירוג
  playerResults.forEach((result, index) => {
    result.rank = index + 1;
  });
  
  // יצירת תוצאה סופית
  const result: GamePlayersResultsResult = {
    gameId,
    playerResults
  };
  
  // שמירה במטמון
  if (useCache) {
    const cacheKey = `playersResults:${gameId}`;
    CacheManager.set(CACHE_CATEGORIES.GAME_STATS, cacheKey, result, CACHE_TTL.LONG);
  }
  
  return createCalculationResult(result, ['games'], false, { gameId });
}; 