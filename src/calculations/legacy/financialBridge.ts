/**
 * גשר בין פונקציות פיננסיות ישנות לחדשות
 *
 * מספק ממשק תואם לפונקציות הישנות תוך שימוש בפונקציות החדשות
 */

import { Game } from '../../models/Game';
import {
  calculateProfitDistribution,
  calculateInvestmentDistribution as calcInvestmentDist,
  calculateCumulativeProfit,
  calculateExtremeProfit,
  ProfitDistributionParams,
  ProfitDistributionResult,
  InvestmentDistributionParams,
  InvestmentDistributionResult,
  CumulativeProfitParams,
  CumulativeProfitResult,
  ExtremeProfitParams,
  ExtremeProfitResult,
  CacheManager
} from '../index';

/**
 * חישוב התפלגות רווח עבור קבוצת משחקים
 * @param games רשימת משחקים
 * @param timeFilter סינון לפי זמן (אופציונלי)
 * @param groupId סינון לפי קבוצה (אופציונלי)
 * @returns התפלגות רווח
 */
export function calculateProfitDistributionLegacy(
  games: Game[],
  timeFilter?: string,
  groupId?: string
): ProfitDistributionResult {
  const params: ProfitDistributionParams = {
    games,
    timeFilter,
    groupId
  };

  const result = calculateProfitDistribution(params);
  return result.data;
}

/**
 * קבלת התפלגות רווח
 * @param games רשימת משחקים
 * @param timeFilter סינון לפי זמן (אופציונלי)
 * @param groupId סינון לפי קבוצה (אופציונלי)
 * @returns התפלגות רווח
 */
export function getProfitDistribution(
  games: Game[],
  timeFilter?: string,
  groupId?: string
): ProfitDistributionResult {
  return calculateProfitDistributionLegacy(games, timeFilter, groupId);
}

/**
 * חישוב התפלגות השקעה עבור קבוצת משחקים
 * @param games רשימת משחקים
 * @param timeFilter סינון לפי זמן (אופציונלי)
 * @param groupId סינון לפי קבוצה (אופציונלי)
 * @returns התפלגות השקעה
 */
export function calculateInvestmentDistribution(
  games: Game[],
  timeFilter?: string,
  groupId?: string
): InvestmentDistributionResult {
  const params: InvestmentDistributionParams = {
    games,
    timeFilter,
    groupId
  };

  const result = calcInvestmentDist(params);
  return result.data;
}

/**
 * חישוב זרימת כספים בין שחקנים
 * Note: calculateMoneyFlow is not implemented in the new calculation module
 * This function is a stub that returns empty data
 * @param games רשימת משחקים
 * @param timeFilter סינון לפי זמן (אופציונלי)
 * @param groupId סינון לפי קבוצה (אופציונלי)
 * @returns נתוני זרימת כספים (empty stub)
 */
export function calculateMoneyFlowLegacy(
  games: Game[],
  timeFilter?: string,
  groupId?: string
): { nodes: any[]; links: any[]; totalFlowAmount: number } {
  // Stub implementation - money flow calculation not yet implemented
  console.warn('calculateMoneyFlowLegacy: Not yet implemented in new calculation module');
  return {
    nodes: [],
    links: [],
    totalFlowAmount: 0
  };
}

/**
 * קבלת זרימת כספים
 * @param games רשימת משחקים
 * @param timeFilter סינון לפי זמן (אופציונלי)
 * @param groupId סינון לפי קבוצה (אופציונלי)
 * @returns נתוני זרימת כספים
 */
export function getMoneyFlow(
  games: Game[],
  timeFilter?: string,
  groupId?: string
): { nodes: any[]; links: any[]; totalFlowAmount: number } {
  return calculateMoneyFlowLegacy(games, timeFilter, groupId);
}

/**
 * חישוב רווח מצטבר לשחקן
 * @param games רשימת משחקים
 * @param userId מזהה שחקן
 * @param timeFilter סינון לפי זמן (אופציונלי)
 * @param groupId סינון לפי קבוצה (אופציונלי)
 * @returns רשימת רווחים מצטברים
 */
export function calculateCumulativeProfitLegacy(
  games: Game[],
  userId: string,
  timeFilter?: string,
  groupId?: string
): CumulativeProfitResult {
  const params: CumulativeProfitParams = {
    games,
    userId,
    timeFilter,
    groupId
  };

  const result = calculateCumulativeProfit(params);
  return result.data;
}

/**
 * קבלת רווח מצטבר
 * @param games רשימת משחקים
 * @param userId מזהה שחקן
 * @param timeFilter סינון לפי זמן (אופציונלי)
 * @param groupId סינון לפי קבוצה (אופציונלי)
 * @returns רשימת רווחים מצטברים
 */
export function getCumulativeProfit(
  games: Game[],
  userId: string,
  timeFilter?: string,
  groupId?: string
): CumulativeProfitResult {
  return calculateCumulativeProfitLegacy(games, userId, timeFilter, groupId);
}

/**
 * חישוב המשחקים עם הרווח/הפסד הגבוה ביותר
 * @param games רשימת משחקים
 * @param type סוג חישוב - 'best' או 'worst'
 * @param limit מספר תוצאות מקסימלי
 * @param timeFilter סינון לפי זמן (אופציונלי)
 * @param groupId סינון לפי קבוצה (אופציונלי)
 * @returns רשימת משחקים קיצוניים
 */
export function calculateExtremeProfitLegacy(
  games: Game[],
  type: 'best' | 'worst',
  limit: number = 5,
  timeFilter?: string,
  groupId?: string
): ExtremeProfitResult {
  const params: ExtremeProfitParams = {
    games,
    type,
    limit,
    timeFilter,
    groupId
  };

  const result = calculateExtremeProfit(params);
  return result.data;
}

/**
 * קבלת המשחקים עם הרווח הגבוה ביותר
 * @param games רשימת משחקים
 * @param limit מספר תוצאות מקסימלי
 * @param timeFilter סינון לפי זמן (אופציונלי)
 * @param groupId סינון לפי קבוצה (אופציונלי)
 * @returns רשימת משחקים עם רווח מקסימלי
 */
export function getBestProfitGames(
  games: Game[],
  limit: number = 5,
  timeFilter?: string,
  groupId?: string
): ExtremeProfitResult {
  return calculateExtremeProfitLegacy(games, 'best', limit, timeFilter, groupId);
}

/**
 * קבלת המשחקים עם ההפסד הגבוה ביותר
 * @param games רשימת משחקים
 * @param limit מספר תוצאות מקסימלי
 * @param timeFilter סינון לפי זמן (אופציונלי)
 * @param groupId סינון לפי קבוצה (אופציונלי)
 * @returns רשימת משחקים עם הפסד מקסימלי
 */
export function getWorstProfitGames(
  games: Game[],
  limit: number = 5,
  timeFilter?: string,
  groupId?: string
): ExtremeProfitResult {
  return calculateExtremeProfitLegacy(games, 'worst', limit, timeFilter, groupId);
}

/**
 * ניקוי מטמון התפלגות רווחים
 */
export function clearProfitDistributionCache(): void {
  CacheManager.invalidateCategory('distributions');
}

/**
 * ניקוי מטמון חישובים פיננסיים
 */
export function clearFinancialCalculationsCache(): void {
  CacheManager.invalidateCategory('financial');
}
