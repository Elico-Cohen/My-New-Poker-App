/**
 * גשר בין פונקציות פיננסיות ישנות לחדשות
 * 
 * מספק ממשק תואם לפונקציות הישנות תוך שימוש בפונקציות החדשות
 */

import { Game } from '../../models/Game';
import { 
  calculateProfitDistribution, 
  calculateMoneyFlow,
  calculateCumulativeProfit,
  calculateExtremeProfit,
  ProfitDistributionParams,
  ProfitDistributionResult,
  MoneyFlowParams,
  MoneyFlowResult,
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
): ProfitDistributionResult {
  const params: ProfitDistributionParams = {
    games,
    timeFilter,
    groupId,
    metric: 'investment'
  };
  
  const result = calculateProfitDistribution(params);
  return result.data;
}

/**
 * חישוב זרימת כספים בין שחקנים
 * @param games רשימת משחקים
 * @param timeFilter סינון לפי זמן (אופציונלי)
 * @param groupId סינון לפי קבוצה (אופציונלי)
 * @returns נתוני זרימת כספים
 */
export function calculateMoneyFlowLegacy(
  games: Game[], 
  timeFilter?: string, 
  groupId?: string
): MoneyFlowResult {
  const params: MoneyFlowParams = {
    games,
    timeFilter,
    groupId
  };
  
  const result = calculateMoneyFlow(params);
  return result.data;
}

/**
 * חישוב רווח מצטבר לאורך משחקים
 * @param games רשימת משחקים
 * @param userId מזהה שחקן
 * @param timeFilter סינון לפי זמן (אופציונלי)
 * @param groupId סינון לפי קבוצה (אופציונלי)
 * @returns רשימת רווח מצטבר
 */
export function getCumulativeProfitList(
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
 * חישוב רשימת הרווחים הגדולים ביותר במשחק בודד
 * @param games רשימת משחקים
 * @param limit מספר התוצאות המקסימלי
 * @param timeFilter סינון לפי זמן (אופציונלי)
 * @param groupId סינון לפי קבוצה (אופציונלי)
 * @returns רשימת הרווחים הגדולים ביותר
 */
export function getBestSingleGameProfitList(
  games: Game[], 
  limit: number = 5,
  timeFilter?: string, 
  groupId?: string
): ExtremeProfitResult {
  const params: ExtremeProfitParams = {
    games,
    type: 'best',
    limit,
    timeFilter,
    groupId
  };
  
  const result = calculateExtremeProfit(params);
  return result.data;
}

/**
 * חישוב רשימת ההפסדים הגדולים ביותר במשחק בודד
 * @param games רשימת משחקים
 * @param limit מספר התוצאות המקסימלי
 * @param timeFilter סינון לפי זמן (אופציונלי)
 * @param groupId סינון לפי קבוצה (אופציונלי)
 * @returns רשימת ההפסדים הגדולים ביותר
 */
export function getWorstSingleGameLossList(
  games: Game[], 
  limit: number = 5,
  timeFilter?: string, 
  groupId?: string
): ExtremeProfitResult {
  const params: ExtremeProfitParams = {
    games,
    type: 'worst',
    limit,
    timeFilter,
    groupId
  };
  
  const result = calculateExtremeProfit(params);
  return result.data;
}

/**
 * ניקוי מטמון נתוני זרימת הכספים
 */
export function clearMoneyFlowCache(): void {
  // השתמש ישירות ב-CacheManager במקום ייבוא דינמי
  CacheManager.invalidateCategory('moneyFlow');
}

/**
 * קבלת נתוני רשת זרימת כספים
 * @param games רשימת משחקים
 * @param timeFilter סינון לפי זמן (אופציונלי)
 * @param groupId סינון לפי קבוצה (אופציונלי)
 * @returns נתוני רשת זרימת כספים
 */
export function getMoneyFlowNetwork(
  games: Game[], 
  timeFilter?: string, 
  groupId?: string
): { nodes: any[], links: any[] } {
  const params: MoneyFlowParams = {
    games,
    timeFilter,
    groupId
  };
  
  const result = calculateMoneyFlow(params);
  return {
    nodes: result.data.nodes,
    links: result.data.links
  };
}

/**
 * קבלת זרימת כספים בין שחקנים 
 * @param games רשימת משחקים
 * @param timeFilter סינון לפי זמן (אופציונלי)
 * @param groupId סינון לפי קבוצה (אופציונלי)
 * @returns נתוני זרימת כספים
 */
export function getMoneyFlow(
  games: Game[], 
  timeFilter?: string, 
  groupId?: string
): MoneyFlowResult {
  return calculateMoneyFlowLegacy(games, timeFilter, groupId);
} 