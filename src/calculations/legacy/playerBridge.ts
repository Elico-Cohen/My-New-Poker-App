/**
 * גשר בין פונקציות שחקן ישנות לחדשות
 * 
 * מספק ממשק תואם לפונקציות הישנות תוך שימוש בפונקציות החדשות
 */

import { Game } from '../../models/Game';
import { UserProfile } from '../../models/UserProfile';
import { 
  calculatePlayerStats, 
  calculatePlayerRanking,
  PlayerStatsParams,
  PlayerStatsResult,
  PlayerRankingParams,
  PlayerRankingResult
} from '../index';

/**
 * חישוב סך כל הרווח של שחקן
 * @param userId מזהה השחקן
 * @param games רשימת משחקים
 * @param timeFilter סינון לפי זמן (אופציונלי)
 * @param groupId סינון לפי קבוצה (אופציונלי)
 * @returns סך כל הרווח
 */
export function calculateTotalProfit(
  userId: string, 
  games: Game[], 
  timeFilter?: string, 
  groupId?: string
): number {
  const params: PlayerStatsParams = {
    userId,
    games,
    timeFilter,
    groupId
  };
  
  const result = calculatePlayerStats(params);
  return result.data.totalProfit;
}

/**
 * חישוב מספר המשחקים ששחקן השתתף בהם
 * @param userId מזהה השחקן
 * @param games רשימת משחקים
 * @param timeFilter סינון לפי זמן (אופציונלי)
 * @param groupId סינון לפי קבוצה (אופציונלי)
 * @returns מספר המשחקים
 */
export function calculateGamesPlayed(
  userId: string, 
  games: Game[], 
  timeFilter?: string, 
  groupId?: string
): number {
  const params: PlayerStatsParams = {
    userId,
    games,
    timeFilter,
    groupId
  };
  
  const result = calculatePlayerStats(params);
  return result.data.totalGames;
}

/**
 * חישוב מספר המשחקים ששחקן ניצח בהם
 * @param userId מזהה השחקן
 * @param games רשימת משחקים
 * @param timeFilter סינון לפי זמן (אופציונלי)
 * @param groupId סינון לפי קבוצה (אופציונלי)
 * @returns מספר המשחקים שנוצחו
 */
export function calculateGamesWon(
  userId: string, 
  games: Game[], 
  timeFilter?: string, 
  groupId?: string
): number {
  const params: PlayerStatsParams = {
    userId,
    games,
    timeFilter,
    groupId
  };
  
  const result = calculatePlayerStats(params);
  return result.data.gamesWon;
}

/**
 * חישוב אחוז הניצחונות של שחקן
 * @param userId מזהה השחקן
 * @param games רשימת משחקים
 * @param timeFilter סינון לפי זמן (אופציונלי)
 * @param groupId סינון לפי קבוצה (אופציונלי)
 * @returns אחוז הניצחונות
 */
export function calculateWinPercentage(
  userId: string, 
  games: Game[], 
  timeFilter?: string, 
  groupId?: string
): number {
  const params: PlayerStatsParams = {
    userId,
    games,
    timeFilter,
    groupId
  };
  
  const result = calculatePlayerStats(params);
  return result.data.winPercentage;
}

/**
 * חישוב רווח ממוצע למשחק של שחקן
 * @param userId מזהה השחקן
 * @param games רשימת משחקים
 * @param timeFilter סינון לפי זמן (אופציונלי)
 * @param groupId סינון לפי קבוצה (אופציונלי)
 * @returns רווח ממוצע למשחק
 */
export function calculateAverageProfitPerGame(
  userId: string, 
  games: Game[], 
  timeFilter?: string, 
  groupId?: string
): number {
  const params: PlayerStatsParams = {
    userId,
    games,
    timeFilter,
    groupId
  };
  
  const result = calculatePlayerStats(params);
  return result.data.averageProfitPerGame;
}

/**
 * חישוב דירוג שחקנים לפי רווח כולל
 * @param games רשימת משחקים
 * @param users רשימת משתמשים
 * @param timeFilter סינון לפי זמן (אופציונלי)
 * @param groupId סינון לפי קבוצה (אופציונלי)
 * @param limit הגבלת מספר התוצאות (אופציונלי)
 * @returns רשימת שחקנים מדורגת לפי רווח כולל
 */
export function calculatePlayerRankingByProfit(
  games: Game[], 
  users: UserProfile[], 
  timeFilter?: string, 
  groupId?: string,
  limit?: number
): any[] {
  const params: PlayerRankingParams = {
    games,
    users,
    timeFilter,
    groupId,
    sortBy: 'totalProfit',
    order: 'desc',
    limit
  };
  
  const result = calculatePlayerRanking(params);
  return result.data;
}

/**
 * חישוב דירוג שחקנים לפי רווח ממוצע למשחק
 * @param games רשימת משחקים
 * @param users רשימת משתמשים
 * @param timeFilter סינון לפי זמן (אופציונלי)
 * @param groupId סינון לפי קבוצה (אופציונלי)
 * @param limit הגבלת מספר התוצאות (אופציונלי)
 * @returns רשימת שחקנים מדורגת לפי רווח ממוצע
 */
export function calculatePlayerRankingByAverageProfit(
  games: Game[], 
  users: UserProfile[], 
  timeFilter?: string, 
  groupId?: string,
  limit?: number
): any[] {
  const params: PlayerRankingParams = {
    games,
    users,
    timeFilter,
    groupId,
    sortBy: 'averageProfit',
    order: 'desc',
    limit
  };
  
  const result = calculatePlayerRanking(params);
  return result.data;
}

/**
 * קבלת סטטיסטיקות שחקן מלאות
 * @param userId מזהה השחקן
 * @param games רשימת משחקים
 * @param timeFilter סינון לפי זמן (אופציונלי)
 * @param groupId סינון לפי קבוצה (אופציונלי)
 * @returns סטטיסטיקות שחקן מלאות
 */
export function getPlayerStatistics(
  userId: string, 
  games: Game[], 
  timeFilter?: string, 
  groupId?: string
): PlayerStatsResult {
  const params: PlayerStatsParams = {
    userId,
    games,
    timeFilter,
    groupId
  };
  
  const result = calculatePlayerStats(params);
  return result.data;
}

/**
 * קבלת דירוג שחקנים
 * @param games רשימת משחקים
 * @param users רשימת משתמשים
 * @param sortBy שדה המיון
 * @param order סדר המיון
 * @param timeFilter סינון לפי זמן (אופציונלי)
 * @param groupId סינון לפי קבוצה (אופציונלי)
 * @param limit הגבלת מספר התוצאות (אופציונלי)
 * @returns רשימת שחקנים מדורגת
 */
export function getPlayerRankings(
  games: Game[], 
  users: UserProfile[], 
  sortBy: 'totalProfit' | 'averageProfit' | 'winRate' | 'gamesPlayed' = 'totalProfit',
  order: 'asc' | 'desc' = 'desc',
  timeFilter?: string, 
  groupId?: string,
  limit?: number
): PlayerRankingResult[] {
  const params: PlayerRankingParams = {
    games,
    users,
    sortBy,
    order,
    timeFilter,
    groupId,
    limit
  };
  
  const result = calculatePlayerRanking(params);
  return result.data;
} 