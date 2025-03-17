/**
 * גשר בין פונקציות מגמות זמן ישנות לחדשות
 * 
 * מספק ממשק תואם לפונקציות הישנות תוך שימוש בפונקציות החדשות
 */

import { Game } from '../../models/Game';
import { 
  calculateTimeTrend,
  TimeTrendParams,
  TimeTrendResult
} from '../index';

/**
 * חישוב מגמת רווח לאורך זמן
 * @param games רשימת משחקים
 * @param interval מרווח זמן (יום, חודש, שנה) 
 * @param timeFilter סינון לפי זמן (אופציונלי)
 * @param groupId סינון לפי קבוצה (אופציונלי)
 * @returns מגמת רווח לאורך זמן
 */
export function getProfitTrendByTime(
  games: Game[], 
  interval: 'day' | 'month' | 'year',
  timeFilter?: string,
  groupId?: string
): TimeTrendResult {
  const params: TimeTrendParams = {
    games,
    metric: 'profit',
    interval,
    timeFilter,
    groupId
  };
  
  const result = calculateTimeTrend(params);
  return result.data;
}

/**
 * חישוב מגמת מספר משחקים לאורך זמן
 * @param games רשימת משחקים
 * @param interval מרווח זמן (יום, חודש, שנה)
 * @param timeFilter סינון לפי זמן (אופציונלי)
 * @param groupId סינון לפי קבוצה (אופציונלי)
 * @returns מגמת מספר משחקים לאורך זמן
 */
export function getGamesCountTrendByTime(
  games: Game[], 
  interval: 'day' | 'month' | 'year',
  timeFilter?: string,
  groupId?: string
): TimeTrendResult {
  const params: TimeTrendParams = {
    games,
    metric: 'games',
    interval,
    timeFilter,
    groupId
  };
  
  const result = calculateTimeTrend(params);
  return result.data;
}

/**
 * חישוב מגמת השקעה לאורך זמן
 * @param games רשימת משחקים
 * @param interval מרווח זמן (יום, חודש, שנה)
 * @param timeFilter סינון לפי זמן (אופציונלי)
 * @param groupId סינון לפי קבוצה (אופציונלי)
 * @returns מגמת השקעה לאורך זמן
 */
export function getInvestmentTrendByTime(
  games: Game[], 
  interval: 'day' | 'month' | 'year',
  timeFilter?: string,
  groupId?: string
): TimeTrendResult {
  const params: TimeTrendParams = {
    games,
    metric: 'investment',
    interval,
    timeFilter,
    groupId
  };
  
  const result = calculateTimeTrend(params);
  return result.data;
}

/**
 * חישוב מגמת אחוז ניצחונות לאורך זמן
 * @param games רשימת משחקים
 * @param interval מרווח זמן (יום, חודש, שנה)
 * @param userId מזהה שחקן
 * @param timeFilter סינון לפי זמן (אופציונלי)
 * @param groupId סינון לפי קבוצה (אופציונלי)
 * @returns מגמת אחוז ניצחונות לאורך זמן
 */
export function getWinRateTrendByTime(
  games: Game[], 
  interval: 'day' | 'month' | 'year',
  userId: string,
  timeFilter?: string,
  groupId?: string
): TimeTrendResult {
  const params: TimeTrendParams = {
    games,
    metric: 'winRate',
    interval,
    userId,
    timeFilter,
    groupId
  };
  
  const result = calculateTimeTrend(params);
  return result.data;
} 