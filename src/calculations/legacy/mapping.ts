/**
 * מיפוי בין פונקציות ישנות לפונקציות החדשות בשכבת החישוב
 * 
 * קובץ זה משמש כמדריך להמרה ולמעבר מהפונקציות הישנות לחדשות
 */

// יבוא פונקציות חדשות
import {
  // חישובי שחקן
  calculatePlayerStats,
  calculatePlayerRanking,

  // חישובי משחק
  calculateGameSummary,
  calculateGamePlayersResults,
  calculateOptimalPayments,

  // חישובים פיננסיים
  calculateCumulativeProfit,
  calculateExtremeProfit,

  // חישובי התפלגויות
  calculateProfitDistribution,
  calculateInvestmentDistribution,

  // חישובי מגמות זמן
  calculateTimeTrend,
} from '../index';

/**
 * 1. מיפוי פונקציות שחקן
 */
export const PLAYER_FUNCTIONS_MAPPING = {
  // פונקציות מקור בקובץ: src/utils/calculators/statisticsCalculator.ts
  'calculateTotalProfit': 'calculatePlayerStats.data.totalProfit',
  'calculateGamesPlayed': 'calculatePlayerStats.data.totalGames',
  'calculateGamesWon': 'calculatePlayerStats.data.gamesWon',
  'calculateWinPercentage': 'calculatePlayerStats.data.winPercentage',
  'calculateAverageProfitPerGame': 'calculatePlayerStats.data.averageProfitPerGame',
  'calculatePlayerRankingByProfit': 'calculatePlayerRanking (sortBy=totalProfit)',
  'calculatePlayerRankingByAverageProfit': 'calculatePlayerRanking (sortBy=averageProfit)',

  // פונקציות מקור בקובץ: src/services/statistics/playerStatistics.ts
  'getPlayerStatistics': 'calculatePlayerStats',
  'getPlayerRankings': 'calculatePlayerRanking',
};

/**
 * 2. מיפוי פונקציות משחק
 */
export const GAME_FUNCTIONS_MAPPING = {
  // פונקציות מקור בקובץ: src/utils/gameCalculations.ts
  'calculatePlayerInvestment': 'calculateGamePlayersResults → הנתונים בתוצאות השחקן',
  'calculatePlayerResults': 'calculateGamePlayersResults',
  'calculateGameSummary': 'calculateGameSummary',
  'calculateOptimalPayments': 'calculateOptimalPayments',

  // פונקציות מקור בקובץ: src/services/statistics/gameStatistics.ts
  'getGameStatistics': 'calculateGameSummary',
  'getPlayerResultsForGame': 'calculateGamePlayersResults',
  'getPaymentsForGame': 'calculateOptimalPayments',
};

/**
 * 3. מיפוי פונקציות פיננסיות
 */
export const FINANCIAL_FUNCTIONS_MAPPING = {
  // פונקציות מקור בקובץ: src/services/statistics/moneyStatistics.ts
  'getCumulativeProfitList': 'calculateCumulativeProfit',
  'getBestSingleGameProfitList': 'calculateExtremeProfit (type=best)',
  'getWorstSingleGameLossList': 'calculateExtremeProfit (type=worst)',
  'getProfitDistribution': 'calculateProfitDistribution',
  'getInvestmentDistribution': 'calculateInvestmentDistribution',
};

/**
 * 4. מיפוי פונקציות מגמות זמן
 */
export const TIME_FUNCTIONS_MAPPING = {
  // פונקציות מקור בקובץ: src/services/statistics/timeStatistics.ts
  'getProfitTrendByTime': 'calculateTimeTrend (metric=profit)',
  'getGamesCountTrendByTime': 'calculateTimeTrend (metric=games)',
  'getInvestmentTrendByTime': 'calculateTimeTrend (metric=investment)',
  'getWinRateTrendByTime': 'calculateTimeTrend (metric=winRate)',
};

/**
 * מיפוי מלא של כל הפונקציות
 */
export const FULL_FUNCTIONS_MAPPING = {
  ...PLAYER_FUNCTIONS_MAPPING,
  ...GAME_FUNCTIONS_MAPPING,
  ...FINANCIAL_FUNCTIONS_MAPPING,
  ...TIME_FUNCTIONS_MAPPING,
}; 