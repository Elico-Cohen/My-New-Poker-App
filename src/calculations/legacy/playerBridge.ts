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
  PlayerRankingParams
} from '../index';
import { PlayerRankingResult as CorePlayerRankingResult } from '../core/types';

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
 * חישוב סך כל הריבאיים שהשחקן ביצע
 * @param userId מזהה השחקן
 * @param games רשימת משחקים
 * @param timeFilter סינון לפי זמן (אופציונלי)
 * @param groupId סינון לפי קבוצה (אופציונלי)
 * @returns סך כל הריבאיים
 */
export function calculateTotalRebuys(
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
  return result.data.totalRebuys;
}

/**
 * חישוב ממוצע הריבאיים למשחק
 * @param userId מזהה השחקן
 * @param games רשימת משחקים
 * @param timeFilter סינון לפי זמן (אופציונלי)
 * @param groupId סינון לפי קבוצה (אופציונלי)
 * @returns ממוצע ריבאיים למשחק
 */
export function calculateAverageRebuysPerGame(
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
  return result.data.averageRebuysPerGame;
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
): CorePlayerRankingResult[] {
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
  
  // המרה מטיפוס הישן לטיפוס החדש
  return result.data.map(player => ({
    userId: player.userId,
    displayName: player.name,  // התאמת שם השדה
    totalGames: player.gamesPlayed,  // התאמת שם השדה
    profilePicture: '',  // שדה חסר, מאתחל כריק
    totalProfit: player.totalProfit,
    averageProfit: player.averageProfit,
    gamesWon: player.gamesWon,
    winRate: player.winRate,
    rank: player.rank
  }));
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
): CorePlayerRankingResult[] {
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
  
  // המרה מטיפוס הישן לטיפוס החדש
  return result.data.map(player => ({
    userId: player.userId,
    displayName: player.name,  // התאמת שם השדה
    totalGames: player.gamesPlayed,  // התאמת שם השדה
    profilePicture: '',  // שדה חסר, מאתחל כריק
    totalProfit: player.totalProfit,
    averageProfit: player.averageProfit,
    gamesWon: player.gamesWon,
    winRate: player.winRate,
    rank: player.rank
  }));
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
  
  // התאמה לטיפוס PlayerStatsResult מהקובץ core/types.ts
  return {
    ...result.data,
    // הוספת שדות חסרים עם ערכים ברירת מחדל
    profitStdDev: 0,  // סטיית תקן של רווח - ברירת מחדל
    longestLoseStreak: result.data.longestLossStreak || 0,  // התאמה בין שמות שדות שונים
    currentWinStreak: 0  // רצף ניצחונות נוכחי - ברירת מחדל
  };
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
): CorePlayerRankingResult[] {
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
  
  // המרה מטיפוס הישן לטיפוס החדש
  return result.data.map(player => ({
    userId: player.userId,
    displayName: player.name,  // התאמת שם השדה
    totalGames: player.gamesPlayed,  // התאמת שם השדה
    profilePicture: '',  // שדה חסר, מאתחל כריק
    totalProfit: player.totalProfit,
    averageProfit: player.averageProfit,
    gamesWon: player.gamesWon,
    winRate: player.winRate,
    rank: player.rank
  }));
} 