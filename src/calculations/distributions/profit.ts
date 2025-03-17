/**
 * חישובי התפלגות רווחים
 */

import { Game } from '../../models/Game';
import { CalculationFunction } from '../core/types';
import { CacheManager } from '../cache/CacheManager';
import { CACHE_CATEGORIES, CACHE_TTL, DISTRIBUTION_RANGES } from '../core/constants';
import { createCalculationResult, filterGames } from '../core/utils';

/**
 * פרמטרים לחישוב התפלגות רווחים
 */
export interface ProfitDistributionParams {
  games?: Game[];        // רשימת משחקים (אופציונלי)
  userId?: string;       // מזהה שחקן (אופציונלי)
  timeFilter?: string;   // סינון לפי זמן
  groupId?: string;      // סינון לפי קבוצה
}

/**
 * פריט התפלגות רווחים
 */
export interface ProfitDistributionItem {
  range: {                // טווח ההתפלגות
    label: string;         // תווית הטווח
    min?: number;          // מינימום
    max?: number;          // מקסימום
  };
  count: number;          // מספר המשחקים בטווח
  percentage: number;     // אחוז מסך הכל
}

/**
 * תוצאת חישוב התפלגות רווחים
 */
export interface ProfitDistributionResult {
  items: ProfitDistributionItem[];   // פריטי ההתפלגות
  totalGames: number;               // סך הכל משחקים
}

/**
 * חישוב התפלגות רווחים
 * 
 * @param params פרמטרים לחישוב
 * @param options אפשרויות חישוב
 * @returns תוצאת חישוב התפלגות רווחים
 */
export const calculateProfitDistribution: CalculationFunction<
  ProfitDistributionParams, 
  ProfitDistributionResult
> = (params, options = {}) => {
  const { games: inputGames, userId, timeFilter, groupId } = params;
  const { useCache = true, forceRefresh = false } = options;
  
  // יצירת מפתח מטמון
  const cacheKey = `profitDist:${userId || 'all'}:${timeFilter || 'all'}:${groupId || 'all'}`;
  
  // בדיקה במטמון אם מאופשר וללא דרישה לרענון
  if (useCache && !forceRefresh) {
    const cached = CacheManager.get<ProfitDistributionResult>(CACHE_CATEGORIES.DISTRIBUTIONS, cacheKey);
    
    if (cached) {
      return createCalculationResult(cached, ['cache'], true, params);
    }
  }
  
  // השג את המשחקים או השתמש במשחקים שסופקו
  const games = inputGames || []; // בקוד האמיתי, נשתמש ב-API
  
  // סינון המשחקים
  const filteredGames = filterGames(games, {
    userId,
    groupId,
    timeFilter: timeFilter as any,
    status: ['completed', 'closed']
  });
  
  // הכנת טווחי ההתפלגות
  const profitRanges = DISTRIBUTION_RANGES.PROFIT;
  
  // יצירת מפתח עבור ספירת משחקים בכל טווח
  const rangeCountMap = new Map<string, number>();
  profitRanges.forEach(range => {
    rangeCountMap.set(range.label, 0);
  });
  
  // ספירת משחקים בכל טווח רווח
  let totalGamesWithProfits = 0;
  
  filteredGames.forEach(game => {
    if (!game.players) return;
    
    // אם יש userId, בדוק רק את הרווחים של אותו שחקן
    if (userId) {
      const player = game.players.find(p => p.userId === userId);
      if (!player) return;
      
      const profit = player.finalResultMoney || player.resultBeforeOpenGames || 0;
      totalGamesWithProfits++;
      
      // מצא את הטווח המתאים
      for (const range of profitRanges) {
        if ((range.min === undefined || profit >= range.min) && 
            (range.max === undefined || profit <= range.max)) {
          rangeCountMap.set(range.label, (rangeCountMap.get(range.label) || 0) + 1);
          break;
        }
      }
    } else {
      // אחרת, הסתכל על התפלגות הרווחים של כל השחקנים בכל המשחקים
      game.players.forEach(player => {
        const profit = player.finalResultMoney || player.resultBeforeOpenGames || 0;
        totalGamesWithProfits++;
        
        // מצא את הטווח המתאים
        for (const range of profitRanges) {
          if ((range.min === undefined || profit >= range.min) && 
              (range.max === undefined || profit <= range.max)) {
            rangeCountMap.set(range.label, (rangeCountMap.get(range.label) || 0) + 1);
            break;
          }
        }
      });
    }
  });
  
  // יצירת פריטי התפלגות
  const items: ProfitDistributionItem[] = profitRanges.map(range => {
    const count = rangeCountMap.get(range.label) || 0;
    const percentage = totalGamesWithProfits > 0 ? (count / totalGamesWithProfits) * 100 : 0;
    
    return {
      range: {
        label: range.label,
        min: range.min,
        max: range.max
      },
      count,
      percentage
    };
  });
  
  // יצירת תוצאה סופית
  const result: ProfitDistributionResult = {
    items,
    totalGames: totalGamesWithProfits
  };
  
  // שמירה במטמון
  if (useCache) {
    CacheManager.set(CACHE_CATEGORIES.DISTRIBUTIONS, cacheKey, result, CACHE_TTL.MEDIUM);
  }
  
  return createCalculationResult(result, ['games'], false, params);
};

/**
 * פרמטרים לחישוב התפלגות השקעות
 */
export interface InvestmentDistributionParams {
  games?: Game[];        // רשימת משחקים (אופציונלי)
  userId?: string;       // מזהה שחקן (אופציונלי)
  timeFilter?: string;   // סינון לפי זמן
  groupId?: string;      // סינון לפי קבוצה
}

/**
 * פריט התפלגות השקעות
 */
export interface InvestmentDistributionItem {
  range: {                // טווח ההתפלגות
    label: string;         // תווית הטווח
    min?: number;          // מינימום
    max?: number;          // מקסימום
  };
  count: number;          // מספר המשחקים בטווח
  percentage: number;     // אחוז מסך הכל
  averageProfit: number;  // רווח ממוצע בטווח זה
}

/**
 * תוצאת חישוב התפלגות השקעות
 */
export interface InvestmentDistributionResult {
  items: InvestmentDistributionItem[];  // פריטי ההתפלגות
  totalGames: number;                  // סך הכל משחקים
  averageInvestment: number;           // השקעה ממוצעת
}

/**
 * חישוב התפלגות השקעות
 * 
 * @param params פרמטרים לחישוב
 * @param options אפשרויות חישוב
 * @returns תוצאת חישוב התפלגות השקעות
 */
export const calculateInvestmentDistribution: CalculationFunction<
  InvestmentDistributionParams, 
  InvestmentDistributionResult
> = (params, options = {}) => {
  const { games: inputGames, userId, timeFilter, groupId } = params;
  const { useCache = true, forceRefresh = false } = options;
  
  // יצירת מפתח מטמון
  const cacheKey = `investDist:${userId || 'all'}:${timeFilter || 'all'}:${groupId || 'all'}`;
  
  // בדיקה במטמון אם מאופשר וללא דרישה לרענון
  if (useCache && !forceRefresh) {
    const cached = CacheManager.get<InvestmentDistributionResult>(CACHE_CATEGORIES.DISTRIBUTIONS, cacheKey);
    
    if (cached) {
      return createCalculationResult(cached, ['cache'], true, params);
    }
  }
  
  // השג את המשחקים או השתמש במשחקים שסופקו
  const games = inputGames || []; // בקוד האמיתי, נשתמש ב-API
  
  // סינון המשחקים
  const filteredGames = filterGames(games, {
    userId,
    groupId,
    timeFilter: timeFilter as any,
    status: ['completed', 'closed']
  });
  
  // הכנת טווחי ההתפלגות
  const investmentRanges = DISTRIBUTION_RANGES.INVESTMENT;
  
  // מבנה לאיסוף נתונים בכל טווח
  interface RangeData {
    count: number;
    totalInvestment: number;
    totalProfit: number;
  }
  
  // יצירת מפתח עבור איסוף נתונים בכל טווח
  const rangeDataMap = new Map<string, RangeData>();
  investmentRanges.forEach(range => {
    rangeDataMap.set(range.label, { count: 0, totalInvestment: 0, totalProfit: 0 });
  });
  
  // איסוף נתונים בכל טווח השקעה
  let totalGamesWithInvestments = 0;
  let totalInvestmentAll = 0;
  
  filteredGames.forEach(game => {
    if (!game.players) return;
    
    const buyInAmount = game.buyInSnapshot?.amount || 0;
    const rebuyAmount = game.rebuySnapshot?.amount || 0;
    
    // אם יש userId, בדוק רק את ההשקעות של אותו שחקן
    if (userId) {
      const player = game.players.find(p => p.userId === userId);
      if (!player) return;
      
      const investment = (buyInAmount * (player.buyInCount || 1)) + 
                        (rebuyAmount * (player.rebuyCount || 0));
      
      const profit = player.finalResultMoney || player.resultBeforeOpenGames || 0;
      
      totalGamesWithInvestments++;
      totalInvestmentAll += investment;
      
      // מצא את הטווח המתאים
      for (const range of investmentRanges) {
        if ((range.min === undefined || investment >= range.min) && 
            (range.max === undefined || investment <= range.max)) {
          const data = rangeDataMap.get(range.label) || { count: 0, totalInvestment: 0, totalProfit: 0 };
          data.count++;
          data.totalInvestment += investment;
          data.totalProfit += profit;
          rangeDataMap.set(range.label, data);
          break;
        }
      }
    } else {
      // אחרת, הסתכל על התפלגות ההשקעות של כל השחקנים בכל המשחקים
      game.players.forEach(player => {
        const investment = (buyInAmount * (player.buyInCount || 1)) + 
                          (rebuyAmount * (player.rebuyCount || 0));
        
        const profit = player.finalResultMoney || player.resultBeforeOpenGames || 0;
        
        totalGamesWithInvestments++;
        totalInvestmentAll += investment;
        
        // מצא את הטווח המתאים
        for (const range of investmentRanges) {
          if ((range.min === undefined || investment >= range.min) && 
              (range.max === undefined || investment <= range.max)) {
            const data = rangeDataMap.get(range.label) || { count: 0, totalInvestment: 0, totalProfit: 0 };
            data.count++;
            data.totalInvestment += investment;
            data.totalProfit += profit;
            rangeDataMap.set(range.label, data);
            break;
          }
        }
      });
    }
  });
  
  // יצירת פריטי התפלגות
  const items: InvestmentDistributionItem[] = investmentRanges.map(range => {
    const data = rangeDataMap.get(range.label) || { count: 0, totalInvestment: 0, totalProfit: 0 };
    const count = data.count;
    const percentage = totalGamesWithInvestments > 0 ? (count / totalGamesWithInvestments) * 100 : 0;
    const averageProfit = count > 0 ? data.totalProfit / count : 0;
    
    return {
      range: {
        label: range.label,
        min: range.min,
        max: range.max
      },
      count,
      percentage,
      averageProfit
    };
  });
  
  // יצירת תוצאה סופית
  const result: InvestmentDistributionResult = {
    items,
    totalGames: totalGamesWithInvestments,
    averageInvestment: totalGamesWithInvestments > 0 ? totalInvestmentAll / totalGamesWithInvestments : 0
  };
  
  // שמירה במטמון
  if (useCache) {
    CacheManager.set(CACHE_CATEGORIES.DISTRIBUTIONS, cacheKey, result, CACHE_TTL.MEDIUM);
  }
  
  return createCalculationResult(result, ['games'], false, params);
}; 