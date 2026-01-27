/**
 * חישובי מגמות וחלוקה לפי זמן
 */

import { Game, GameDate } from '../../models/Game';
import { CalculationFunction } from '../core/types';
import { CacheManager } from '../cache/CacheManager';
import { CACHE_CATEGORIES, CACHE_TTL } from '../core/constants';
import { createCalculationResult, filterGames } from '../core/utils';

/**
 * יחידות זמן לקיבוץ
 */
export type TimeUnit = 'day' | 'week' | 'month' | 'quarter' | 'year';

/**
 * פרמטרים לחישוב מגמות זמן
 */
export interface TimeTrendParams {
  games?: Game[];              // רשימת משחקים (אופציונלי)
  userId?: string;             // מזהה שחקן (אופציונלי)
  groupId?: string;            // מזהה קבוצה (אופציונלי)
  startDate?: GameDate;        // תאריך התחלה (אופציונלי)
  endDate?: GameDate;          // תאריך סיום (אופציונלי)
  timeUnit: TimeUnit;          // יחידת הזמן לקיבוץ
  metric: 'profit' | 'games' | 'investment' | 'winRate'; // המדד לחישוב
}

/**
 * פריט מגמת זמן
 */
export interface TimeTrendItem {
  periodStart: Date;          // תחילת תקופה
  periodEnd: Date;            // סוף תקופה
  periodLabel: string;        // תווית תקופה
  value: number;              // ערך המדד
  gamesCount: number;         // מספר משחקים בתקופה
}

/**
 * תוצאת חישוב מגמות זמן
 */
export interface TimeTrendResult {
  items: TimeTrendItem[];     // פריטי מגמה
  metric: string;             // המדד שחושב
  timeUnit: TimeUnit;         // יחידת הזמן שנבחרה
  totalPeriods: number;       // סך כל התקופות
  average: number;            // ממוצע ערך המדד
  maxValue: number;           // הערך הגבוה ביותר
  minValue: number;           // הערך הנמוך ביותר
  trend: 'up' | 'down' | 'stable'; // מגמה כללית
}

/**
 * חישוב מגמות זמן
 * 
 * @param params פרמטרים לחישוב
 * @param options אפשרויות חישוב
 * @returns תוצאת חישוב מגמות זמן
 */
export const calculateTimeTrend: CalculationFunction<TimeTrendParams, TimeTrendResult> = 
  (params, options = {}) => {
    const { 
      games: inputGames, 
      userId, 
      groupId, 
      startDate, 
      endDate,
      timeUnit, 
      metric 
    } = params;
    const { useCache = true, forceRefresh = false } = options;
    
    // יצירת מפתח מטמון
    const cacheKey = `trend:${timeUnit}:${metric}:${userId || 'all'}:${groupId || 'all'}:${startDate ? JSON.stringify(startDate) : 'all'}:${endDate ? JSON.stringify(endDate) : 'all'}`;
    
    // בדיקה במטמון אם מאופשר וללא דרישה לרענון
    if (useCache && !forceRefresh) {
      const cached = CacheManager.get<TimeTrendResult>(CACHE_CATEGORIES.TIME_TRENDS, cacheKey);
      
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
      startDate,
      endDate,
      status: ['completed', 'closed']
    });
    
    // אם אין משחקים, החזר תוצאה ריקה
    if (filteredGames.length === 0) {
      const emptyResult: TimeTrendResult = {
        items: [],
        metric,
        timeUnit,
        totalPeriods: 0,
        average: 0,
        maxValue: 0,
        minValue: 0,
        trend: 'stable'
      };
      
      return createCalculationResult(emptyResult, ['games'], false, params);
    }
    
    // קביעת טווח התאריכים
    const sortedGames = [...filteredGames].sort((a, b) => {
      if (a.date && b.date) {
        const dateA = new Date(a.date.year, a.date.month - 1, a.date.day);
        const dateB = new Date(b.date.year, b.date.month - 1, b.date.day);
        return dateA.getTime() - dateB.getTime();
      }
      return 0;
    });
    
    const firstGame = sortedGames[0];
    const lastGame = sortedGames[sortedGames.length - 1];
    
    let periodStart: Date;
    let periodEnd: Date;
    
    if (firstGame.date) {
      periodStart = new Date(firstGame.date.year, firstGame.date.month - 1, firstGame.date.day);
    } else {
      periodStart = new Date();
      periodStart.setFullYear(periodStart.getFullYear() - 1);
    }
    
    if (lastGame.date) {
      periodEnd = new Date(lastGame.date.year, lastGame.date.month - 1, lastGame.date.day);
    } else {
      periodEnd = new Date();
    }
    
    // יצירת תקופות זמן
    const periods: {start: Date, end: Date, label: string}[] = [];
    
    switch (timeUnit) {
      case 'day':
        // יצירת תקופות יומיות
        const currentDay = new Date(periodStart);
        while (currentDay <= periodEnd) {
          const dayStart = new Date(currentDay);
          const dayEnd = new Date(currentDay);
          dayEnd.setHours(23, 59, 59, 999);
          
          const dayLabel = `${dayStart.getDate()}/${dayStart.getMonth() + 1}/${dayStart.getFullYear()}`;
          
          periods.push({
            start: dayStart,
            end: dayEnd,
            label: dayLabel
          });
          
          currentDay.setDate(currentDay.getDate() + 1);
        }
        break;
        
      case 'week':
        // יצירת תקופות שבועיות
        const getWeekNumber = (date: Date): number => {
          const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
          const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
          return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
        };
        
        const weekStart = new Date(periodStart);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekStart.getDay() === 0 ? -6 : 1)); // קביעת תחילת שבוע ליום שני
        
        const currentWeek = new Date(weekStart);
        while (currentWeek <= periodEnd) {
          const weekStartDate = new Date(currentWeek);
          const weekEndDate = new Date(currentWeek);
          weekEndDate.setDate(weekEndDate.getDate() + 6);
          weekEndDate.setHours(23, 59, 59, 999);
          
          const weekNumber = getWeekNumber(weekStartDate);
          const weekLabel = `שבוע ${weekNumber}, ${weekStartDate.getFullYear()}`;
          
          periods.push({
            start: weekStartDate,
            end: weekEndDate,
            label: weekLabel
          });
          
          currentWeek.setDate(currentWeek.getDate() + 7);
        }
        break;
        
      case 'month':
        // יצירת תקופות חודשיות
        const monthNames = [
          'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
          'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
        ];
        
        const currentMonth = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1);
        while (currentMonth <= periodEnd) {
          const monthStart = new Date(currentMonth);
          const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
          monthEnd.setHours(23, 59, 59, 999);
          
          const monthLabel = `${monthNames[monthStart.getMonth()]} ${monthStart.getFullYear()}`;
          
          periods.push({
            start: monthStart,
            end: monthEnd,
            label: monthLabel
          });
          
          currentMonth.setMonth(currentMonth.getMonth() + 1);
        }
        break;
        
      case 'quarter':
        // יצירת תקופות רבעוניות
        const quarterStartMonths = [0, 3, 6, 9]; // ינואר, אפריל, יולי, אוקטובר
        
        const getQuarterStartMonth = (month: number): number => {
          return quarterStartMonths[Math.floor(month / 3)];
        };
        
        const getQuarterNumber = (month: number): number => {
          return Math.floor(month / 3) + 1;
        };
        
        const quarterStart = new Date(periodStart.getFullYear(), getQuarterStartMonth(periodStart.getMonth()), 1);
        const currentQuarter = new Date(quarterStart);
        
        while (currentQuarter <= periodEnd) {
          const qStart = new Date(currentQuarter);
          const qEnd = new Date(currentQuarter.getFullYear(), currentQuarter.getMonth() + 3, 0);
          qEnd.setHours(23, 59, 59, 999);
          
          const quarterNumber = getQuarterNumber(qStart.getMonth());
          const quarterLabel = `רבעון ${quarterNumber}, ${qStart.getFullYear()}`;
          
          periods.push({
            start: qStart,
            end: qEnd,
            label: quarterLabel
          });
          
          currentQuarter.setMonth(currentQuarter.getMonth() + 3);
        }
        break;
        
      case 'year':
        // יצירת תקופות שנתיות
        const currentYear = new Date(periodStart.getFullYear(), 0, 1);
        while (currentYear <= periodEnd) {
          const yearStart = new Date(currentYear);
          const yearEnd = new Date(currentYear.getFullYear(), 11, 31);
          yearEnd.setHours(23, 59, 59, 999);
          
          const yearLabel = `${yearStart.getFullYear()}`;
          
          periods.push({
            start: yearStart,
            end: yearEnd,
            label: yearLabel
          });
          
          currentYear.setFullYear(currentYear.getFullYear() + 1);
        }
        break;
    }
    
    // חישוב ערכי המדד לכל תקופה
    const items: TimeTrendItem[] = periods.map(period => {
      // סינון משחקים לתקופה
      const periodGames = sortedGames.filter(game => {
        if (!game.date) return false;
        
        const gameDate = new Date(game.date.year, game.date.month - 1, game.date.day);
        return gameDate >= period.start && gameDate <= period.end;
      });
      
      let value = 0;
      
      switch (metric) {
        case 'games':
          // מספר משחקים
          value = periodGames.length;
          break;
          
        case 'profit':
          // רווח
          if (userId) {
            // רווח של שחקן ספציפי
            periodGames.forEach(game => {
              if (!game.players) return;
              
              const player = game.players.find(p => p.userId === userId);
              if (player) {
                value += player.finalResultMoney || player.resultBeforeOpenGames || 0;
              }
            });
          } else {
            // רווח כולל (סכום כל הרווחים החיוביים)
            periodGames.forEach(game => {
              if (!game.players) return;
              
              game.players.forEach(player => {
                const profit = player.finalResultMoney || player.resultBeforeOpenGames || 0;
                if (profit > 0) {
                  value += profit;
                }
              });
            });
          }
          break;
          
        case 'investment':
          // השקעה
          periodGames.forEach(game => {
            if (!game.players) return;
            
            const buyInAmount = game.buyInSnapshot?.amount || 0;
            const rebuyAmount = game.rebuySnapshot?.amount || 0;
            
            if (userId) {
              // השקעה של שחקן ספציפי
              const player = game.players.find(p => p.userId === userId);
              if (player) {
                value += (buyInAmount * (player.buyInCount || 1)) + 
                        (rebuyAmount * (player.rebuyCount || 0));
              }
            } else {
              // השקעה כוללת
              game.players.forEach(player => {
                value += (buyInAmount * (player.buyInCount || 1)) + 
                        (rebuyAmount * (player.rebuyCount || 0));
              });
            }
          });
          break;
          
        case 'winRate':
          // אחוז ניצחונות
          if (userId) {
            // אחוז ניצחונות לשחקן ספציפי
            let wins = 0;
            
            periodGames.forEach(game => {
              if (!game.players) return;
              
              const player = game.players.find(p => p.userId === userId);
              if (player && (player.finalResultMoney || player.resultBeforeOpenGames || 0) > 0) {
                wins++;
              }
            });
            
            value = periodGames.length > 0 ? (wins / periodGames.length) * 100 : 0;
          } else {
            // אחוז ניצחונות ממוצע לכל השחקנים
            let totalPlayers = 0;
            let totalWins = 0;
            
            periodGames.forEach(game => {
              if (!game.players) return;
              
              totalPlayers += game.players.length;
              
              game.players.forEach(player => {
                if ((player.finalResultMoney || player.resultBeforeOpenGames || 0) > 0) {
                  totalWins++;
                }
              });
            });
            
            value = totalPlayers > 0 ? (totalWins / totalPlayers) * 100 : 0;
          }
          break;
      }
      
      return {
        periodStart: period.start,
        periodEnd: period.end,
        periodLabel: period.label,
        value,
        gamesCount: periodGames.length
      };
    });
    
    // חישוב סטטיסטיקות
    const nonEmptyItems = items.filter(item => item.gamesCount > 0);
    const totalPeriods = nonEmptyItems.length;
    
    if (totalPeriods === 0) {
      const emptyResult: TimeTrendResult = {
        items,
        metric,
        timeUnit,
        totalPeriods: 0,
        average: 0,
        maxValue: 0,
        minValue: 0,
        trend: 'stable'
      };
      
      return createCalculationResult(emptyResult, ['games'], false, params);
    }
    
    const values = nonEmptyItems.map(item => item.value);
    const average = values.reduce((sum, val) => sum + val, 0) / totalPeriods;
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    
    // ניתוח מגמה
    let trend: 'up' | 'down' | 'stable' = 'stable';
    
    if (nonEmptyItems.length >= 3) {
      // שימוש ברגרסיה ליניארית פשוטה לזיהוי מגמה
      const n = nonEmptyItems.length;
      const indices = Array.from({length: n}, (_, i) => i + 1);
      
      // חישוב מקדם השיפוע
      const sumX = indices.reduce((sum, val) => sum + val, 0);
      const sumY = values.reduce((sum, val) => sum + val, 0);
      const sumXY = indices.reduce((sum, val, i) => sum + val * values[i], 0);
      const sumX2 = indices.reduce((sum, val) => sum + val * val, 0);
      
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      
      // קביעת מגמה על פי השיפוע
      const slopeThreshold = 0.05 * average; // סף 5% מהממוצע
      
      if (slope > slopeThreshold) {
        trend = 'up';
      } else if (slope < -slopeThreshold) {
        trend = 'down';
      }
    }
    
    // יצירת תוצאה סופית
    const result: TimeTrendResult = {
      items,
      metric,
      timeUnit,
      totalPeriods,
      average,
      maxValue,
      minValue,
      trend
    };
    
    // שמירה במטמון
    if (useCache) {
      CacheManager.set(CACHE_CATEGORIES.TIME_TRENDS, cacheKey, result, CACHE_TTL.MEDIUM);
    }
    
    return createCalculationResult(result, ['games'], false, params);
  }; 