/**
 * קובץ: src/services/gameDataManager.ts
 * הסבר: מודול מרכזי לניהול נתוני משחקים עבור כל המסכים באפליקציה.
 * במקום לייבא את אותם נתונים מרובה פעמים, נטען אותם פעם אחת לזיכרון.
 */

import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Game, GameDate } from '../models/Game';

// שימוש במטמון קיים מהסטטיסטיקה
import { statsCache, CACHE_EXPIRY } from './statistics/statisticsService';

import { Group } from '@/models/Group';
import { getAllActiveGroups } from '@/services/groups';

/**
 * פונקציה ראשית להבאת כל המשחקים. 
 * יכולה לשמש הן את מסך ההיסטוריה והן את מסכי הסטטיסטיקה.
 */
export const fetchAllGames = async (options: {
  skipCache?: boolean;
  onlyCompleted?: boolean;  // האם להחזיר רק משחקים שהושלמו
} = {}): Promise<Game[]> => {
  const { skipCache = false, onlyCompleted = true } = options;  // ברירת המחדל: רק משחקים שהושלמו

  try {
    // בדיקה אם קיים מטמון תקף - משתמש במטמון של הסטטיסטיקות
    const cacheKey = onlyCompleted ? 'all_completed_games' : 'all_games';
    const cachedData = statsCache.get(cacheKey);
    
    if (!skipCache && cachedData && (Date.now() - cachedData.timestamp < CACHE_EXPIRY)) {
      console.log(`GameDataManager: שימוש בנתוני משחקים מהמטמון (${cacheKey})`);
      return cachedData.data;
    }

    console.log('GameDataManager: טוען נתוני משחקים מ-Firestore');
    
    // הגדרת השאילתה בהתאם לבקשה
    const queryConstraints = [];
    if (onlyCompleted) {
      queryConstraints.push(where('status', '==', 'completed'));
    }
    queryConstraints.push(orderBy('updatedAt', 'desc'));
    
    const gamesQuery = query(
      collection(db, 'games'),
      ...queryConstraints
    );
    
    const snapshot = await getDocs(gamesQuery);
    const games: Game[] = [];
    
    const queryType = onlyCompleted ? 'שהושלמו' : '';
    console.log(`GameDataManager: Firebase החזיר ${snapshot.size} משחקים ${queryType}`);
    
    // עיבוד המשחקים וטיפול בפורמט תאריך אחיד
    snapshot.forEach(doc => {
      try {
        const gameData = { id: doc.id, ...doc.data() } as any;
        
        // וידוא שיש מערכים
        gameData.players = Array.isArray(gameData.players) ? gameData.players : [];
        gameData.payments = Array.isArray(gameData.payments) ? gameData.payments : [];
        gameData.openGames = Array.isArray(gameData.openGames) ? gameData.openGames : [];
        gameData.rebuyLogs = Array.isArray(gameData.rebuyLogs) ? gameData.rebuyLogs : [];
        
        // טיפול בעקביות של שדות התאריך
        const dateSource = gameData.gameDate || gameData.date;
        
        if (!dateSource || typeof dateSource !== 'object') {
          // אם אין שדה תאריך תקין, ניצור אחד מ-createdAt
          if (typeof gameData.createdAt === 'number') {
            const createdDate = new Date(gameData.createdAt);
            gameData.date = {
              day: createdDate.getDate(),
              month: createdDate.getMonth() + 1,
              year: createdDate.getFullYear(),
              timestamp: gameData.createdAt
            };
          }
        } else {
          // וידוא שיש שדה date בפורמט אחיד
          gameData.date = {
            day: typeof dateSource.day === 'number' ? dateSource.day : 1,
            month: typeof dateSource.month === 'number' ? dateSource.month : 1,
            year: typeof dateSource.year === 'number' ? dateSource.year : new Date().getFullYear(),
            timestamp: typeof dateSource.timestamp === 'number' ? dateSource.timestamp : gameData.createdAt
          };
        }
        
        games.push(gameData as Game);
      } catch (err) {
        console.error(`GameDataManager: שגיאה בעיבוד משחק ${doc.id}:`, err);
      }
    });
    
    // הורדת כל הקבוצות לצורך מיפוי שמות
    try {
      // שליפת כל הקבוצות הפעילות
      const groups = await getAllActiveGroups();
      const groupMap = new Map<string, string>();
      
      // יצירת מיפוי של מזהה קבוצה לשם קבוצה
      groups.forEach(group => {
        groupMap.set(group.id, group.name);
      });
      
      // עדכון שמות הקבוצות במשחקים
      games.forEach(game => {
        // עדיפות ראשונה: שימוש ב-groupNameSnapshot אם קיים
        if (!game.groupNameSnapshot && game.groupId) {
          // אם אין groupNameSnapshot אבל יש groupId, ננסה למצוא את שם הקבוצה
          const groupName = groupMap.get(game.groupId);
          if (groupName) {
            game.groupNameSnapshot = groupName;
          }
        }
      });
      
      console.log(`GameDataManager: מופו שמות קבוצות ל-${games.length} משחקים`);
    } catch (err) {
      console.error('GameDataManager: שגיאה במיפוי שמות קבוצות:', err);
    }
    
    // מיון המשחקים לפי תאריך (החדשים ביותר תחילה)
    const sortedGames = games.sort((a, b) => {
      // המרה לתאריך JS אם יש שדה date
      const getTimestamp = (game: Game): number => {
        if (game.date?.timestamp) {
          return game.date.timestamp;
        }
        if (game.date) {
          // המר את מבנה GameDate לתאריך JS
          const jsDate = new Date(game.date.year, game.date.month - 1, game.date.day);
          return jsDate.getTime();
        }
        return game.createdAt || 0;
      };
      
      const aTime = getTimestamp(a);
      const bTime = getTimestamp(b);
      return bTime - aTime;
    });

    console.log(`GameDataManager: מוינו ${sortedGames.length} משחקים לפי תאריך`);
    
    // אחסון במטמון הקיים של הסטטיסטיקות
    statsCache.set(cacheKey, { 
      data: sortedGames, 
      timestamp: Date.now() 
    });
    
    return sortedGames;
  } catch (error) {
    console.error('GameDataManager: שגיאה בהבאת נתוני משחקים:', error);
    // במקרה של שגיאה, החזר מערך ריק
    return [];
  }
};

/**
 * ניקוי מטמון המשחקים
 */
export const clearGamesCache = (): void => {
  console.log('GameDataManager: ניקוי מטמון המשחקים');
  // ניקוי המטמון בסטטיסטיקות
  statsCache.delete('all_games');
  statsCache.delete('all_completed_games');
};

/**
 * פילטור משחקים לפי קריטריונים שונים
 */
export const filterGames = (
  games: Game[],
  options: {
    groupId?: string;
    timeFilter?: 'all' | 'month' | 'quarter' | 'year';
  } = {}
): Game[] => {
  const { groupId, timeFilter = 'all' } = options;
  let filtered = [...games];
  
  // סינון לפי קבוצה
  if (groupId) {
    filtered = filtered.filter(game => game.groupId === groupId);
  }
  
  // סינון לפי זמן
  if (timeFilter !== 'all') {
    const now = new Date();
    let cutoffDate: Date;
    
    switch (timeFilter) {
      case 'month':
        cutoffDate = new Date(now);
        cutoffDate.setDate(now.getDate() - 30);
        break;
      case 'quarter':
        cutoffDate = new Date(now);
        cutoffDate.setDate(now.getDate() - 90);
        break;
      case 'year':
        cutoffDate = new Date(now);
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        cutoffDate = new Date(0); // מתחילת הזמן
        break;
    }
    
    filtered = filtered.filter(game => {
      // המרת תאריך המשחק להשוואה
      if (!game.date) return false;
      
      const gameDate = new Date(game.date.year, game.date.month - 1, game.date.day);
      return gameDate >= cutoffDate;
    });
  }
  
  return filtered;
};

/**
 * החזרת התאריך הנוכחי של המערכת
 */
export const getCurrentSystemDate = (): Date => {
  return new Date();
};

export default {
  fetchAllGames,
  filterGames,
  clearGamesCache,
  getCurrentSystemDate
}; 