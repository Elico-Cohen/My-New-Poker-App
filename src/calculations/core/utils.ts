/**
 * פונקציות עזר לשכבת החישובים
 */

import { Game, GameDate } from '../../models/Game';
import { TimeFilter, GameFilter } from './types';
import { CACHE_CATEGORIES, CACHE_TTL, DEFAULT_CALCULATION_OPTIONS } from './constants';

/**
 * מחזיר זיהוי מפתח למטמון המבוסס על פרמטרים
 * @param category קטגוריית המטמון
 * @param params פרמטרים לחישוב המפתח
 * @returns מחרוזת מפתח למטמון
 */
export const getCacheKey = (category: string, params: Record<string, any>): string => {
  return `${category}:${JSON.stringify(params)}`;
};

/**
 * פונקציה לסינון משחקים לפי קריטריונים
 * @param games רשימת משחקים לסינון
 * @param filter קריטריונים לסינון
 * @returns רשימת משחקים מסוננת
 */
export const filterGames = (games: Game[], filter: GameFilter): Game[] => {
  if (!games || games.length === 0) {
    return [];
  }

  return games.filter(game => {
    // סינון לפי סטטוס
    if (filter.status && filter.status.length > 0) {
      if (!filter.status.includes(game.status)) {
        return false;
      }
    }

    // סינון לפי קבוצה
    if (filter.groupId && game.groupId !== filter.groupId) {
      return false;
    }

    // סינון לפי משתמש
    if (filter.userId) {
      const playerFound = game.players.some(player => player.userId === filter.userId);
      if (!playerFound) {
        return false;
      }
    }

    // סינון לפי זמן
    if (filter.timeFilter && filter.timeFilter !== 'all') {
      const gameDate = new Date(game.gameDate.year, game.gameDate.month - 1, game.gameDate.day);
      const now = new Date();
      
      switch (filter.timeFilter) {
        case 'month':
          // החודש הנוכחי
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          return gameDate >= monthStart;
        
        case 'quarter':
          // הרבעון הנוכחי
          const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
          return gameDate >= quarterStart;
        
        case 'year':
          // השנה הנוכחית
          const yearStart = new Date(now.getFullYear(), 0, 1);
          return gameDate >= yearStart;
        
        case 'custom':
          // טווח תאריכים מותאם אישית
          if (filter.startDate) {
            const startDate = new Date(filter.startDate.year, filter.startDate.month - 1, filter.startDate.day);
            if (gameDate < startDate) {
              return false;
            }
          }
          
          if (filter.endDate) {
            const endDate = new Date(filter.endDate.year, filter.endDate.month - 1, filter.endDate.day);
            if (gameDate > endDate) {
              return false;
            }
          }
          
          return true;
      }
    }

    return true;
  });
};

/**
 * בדיקה האם שחקן ניצח במשחק
 * @param game משחק
 * @param userId מזהה משתמש
 * @returns האם השחקן ניצח
 */
export const didPlayerWin = (game: Game, userId: string): boolean => {
  const player = game.players.find(p => p.userId === userId);
  if (!player) {
    return false;
  }

  // אם יש תוצאה סופית, נשתמש בה
  if (player.finalResultMoney !== undefined) {
    return player.finalResultMoney > 0;
  }

  // אם אין תוצאה סופית, נסתכל על התוצאה לפני משחקים פתוחים
  if (player.resultBeforeOpenGames !== undefined) {
    return player.resultBeforeOpenGames > 0;
  }

  return false;
};

/**
 * יצירת תוצאת חישוב
 * @param data נתוני התוצאה
 * @param source מקורות הנתונים
 * @param cached האם התוצאה ממטמון
 * @param filters פילטרים שהופעלו
 * @returns תוצאת חישוב מובנית
 */
export const createCalculationResult = <T>(
  data: T, 
  source: string[] = [], 
  cached: boolean = false, 
  filters: Record<string, any> = {}
) => {
  return {
    data,
    metadata: {
      timestamp: Date.now(),
      source,
      filters
    },
    cached
  };
}; 