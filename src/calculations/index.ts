/**
 * מודול חישובים מרכזי
 *
 * מייצא את כל פונקציות החישוב והטיפוסים הנדרשים
 */

// ייצוא טיפוסים בסיסיים (selective to avoid duplicates)
export {
  CalculationMetadata,
  CalculationResult,
  CalculationOptions,
  TimeFilter,
  GameFilter,
  CalculationFunction,
  BaseCalculationParams,
  PlayerStatsParams,
  PlayerStatsResult,
  PlayerRankingParams,
  PlayerRankingResult,
  GameResultsParams,
  GameResultsResult,
  MoneyFlowParams,
  MoneyFlowResult,
  // Re-export model types
  Game,
  GameDate,
  PlayerInGame,
  Payment,
  RebuyLog,
  OpenGame,
  HandoffEvent,
  UserProfile,
  Group
} from './core/types';
export * from './core/constants';
export { getCacheKey, filterGames, didPlayerWin, createCalculationResult } from './core/utils';

// ייצוא מנהל מטמון
import { CacheManager } from './cache/CacheManager';
export { CacheManager };

// ייצוא פונקציות חישוב שחקן
export { calculatePlayerStats } from './player/stats';
export { calculatePlayerRanking } from './player/ranking';

// ייצוא פונקציות חישוב משחק (functions only, types defined locally in files)
export { calculateGameSummary, GameSummaryParams, GameSummaryResult } from './game/results';
export { calculateOptimalPayments, OptimalPaymentsParams, OptimalPaymentsResult } from './game/payments';

// ייצוא פונקציות חישוב פיננסי
export {
  calculateCumulativeProfit,
  calculateExtremeProfit,
  CumulativeProfitParams,
  CumulativeProfitResult,
  ExtremeProfitParams,
  ExtremeProfitResult
} from './financial/profit';

// ייצוא פונקציות חישוב התפלגויות
export {
  calculateProfitDistribution,
  calculateInvestmentDistribution,
  ProfitDistributionParams,
  ProfitDistributionResult,
  InvestmentDistributionParams,
  InvestmentDistributionResult
} from './distributions/profit';

// ייצוא פונקציות חישוב מגמות זמן
export {
  calculateTimeTrend,
  TimeTrendParams,
  TimeTrendResult
} from './time/trends';

/**
 * ניקוי כל המטמון של מערכת החישובים
 */
export function clearAllCalculationsCache(): void {
  CacheManager.invalidateAll();
}

/**
 * ניקוי מטמון לקטגוריה ספציפית
 * @param category שם הקטגוריה
 */
export function clearCategoryCache(category: string): void {
  CacheManager.invalidateCategory(category);
} 