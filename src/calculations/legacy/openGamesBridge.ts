/**
 * גשר בין פונקציות משחקים פתוחים ישנות לחדשות
 * 
 * מספק ממשק תואם לפונקציות הישנות תוך שימוש בפונקציות החדשות
 */

import { Game } from '../../models/Game';
import { UserProfile } from '../../models/UserProfile';
import { OpenGamesStats, StatisticsFilter } from '../../models/Statistics';
import { CacheManager } from '../cache/CacheManager';
// הסרת הייבוא הישיר למניעת מעגל תלויות
// import { getOpenGamesStatistics as originalGetOpenGamesStatistics } from '../../services/statistics/openGamesStatistics';

// ייבוא שירותים הנדרשים לביצוע החישוב בעצמו
import { filterGames, fetchAllGames, clearStatsCache } from '../../services/statistics/statisticsService';
import { getAllUsers } from '../../services/users';
import { store } from '../../store/AppStore';

// שמירת מספר המשחקים האחרון שהיה בחישוב לזיהוי שינויים
let lastProcessedGamesCount = 0;
// מאגר של תוצאות קודמות לפי מפתח הפילטר
const resultsCache = new Map<string, { timestamp: number, data: OpenGamesStats }>();
// זמן תפוגה של המטמון בדקות
const CACHE_EXPIRY_MINUTES = 15;

/**
 * יצירת מפתח ייחודי לפילטר
 * @param filter פילטר הסטטיסטיקה
 * @returns מחרוזת מפתח ייחודית
 */
function createFilterKey(filter: StatisticsFilter): string {
  return `openGames_${filter.timeFilter || 'all'}_${filter.groupId || 'all'}_${filter.playerId || 'all'}`;
}

/**
 * חישוב סטטיסטיקות משחקים פתוחים
 * @param filter פילטרים לחישוב
 * @returns סטטיסטיקות משחקים פתוחים
 */
export async function getOpenGamesStatistics(
  filter: StatisticsFilter = { timeFilter: 'all' }
): Promise<OpenGamesStats> {
  console.log('openGamesBridge: חישוב סטטיסטיקות משחקים פתוחים');
  
  try {
    // הסרת שדה refreshToken מהפילטר כדי למנוע רענון כפוי לא נחוץ
    const cleanFilter = { ...filter };
    // @ts-ignore
    if (cleanFilter._refreshToken) {
      console.log('openGamesBridge: מסיר refreshToken מהפילטר למניעת רענונים מיותרים');
      // @ts-ignore
      delete cleanFilter._refreshToken;
    }
    
    // יצירת מפתח ייחודי לבדיקת מטמון
    const cacheKey = createFilterKey(cleanFilter);
    
    // בדיקה האם התוצאה כבר נמצאת במטמון ובתוקף
    const now = Date.now();
    const cachedResult = resultsCache.get(cacheKey);
    const cacheExpiry = CACHE_EXPIRY_MINUTES * 60 * 1000; // המרה לאלפיות שנייה
    
    if (cachedResult && (now - cachedResult.timestamp < cacheExpiry)) {
      console.log(`openGamesBridge: מחזיר תוצאה ממטמון עבור מפתח ${cacheKey}, גיל הנתונים: ${(now - cachedResult.timestamp) / 1000} שניות`);
      return cachedResult.data;
    }
    
    // בדיקה האם יש שינוי במספר המשחקים הכולל לעומת החישוב הקודם
    const currentGamesCount = store.getGames().length;
    
    // מחליט האם לדלג על המטמון - רק בשינוי אמיתי במספר המשחקים או כאשר הפילטר מבקש רענון מאולץ
    let skipCache = lastProcessedGamesCount !== currentGamesCount;
    
    // בודק אם הפילטר המקורי כלל דרישה לרענון מאולץ
    // @ts-ignore
    if (filter._forceRefresh === true) {
      skipCache = true;
      console.log('openGamesBridge: רענון מאולץ התבקש בפילטר');
    }
    
    if (skipCache) {
      console.log(`openGamesBridge: זוהה שינוי במספר המשחקים (היה: ${lastProcessedGamesCount}, עכשיו: ${currentGamesCount}). מרענן מטמון.`);
      // רק מנקה את המטמון אם באמת יש שינוי במספר המשחקים (לא בגלל מעבר מסך)
      if (lastProcessedGamesCount !== 0 && lastProcessedGamesCount !== currentGamesCount) {
        clearStatsCache(); // ניקוי מטמון הסטטיסטיקות
      }
    }
    
    // טוען את כל המשחקים
    console.log('openGamesBridge: מביא את כל המשחקים מהמאגר המרכזי');
    const allGames = await fetchAllGames(skipCache);
    
    // עדכון מספר המשחקים האחרון שעובד
    lastProcessedGamesCount = allGames.length;
    
    // מוודא שאנחנו לא מסננים לפי סטטוס כדי לקבל את כל המשחקים
    // גם כאלה שבסטטוס 'completed' או 'final_results' שיכולים להכיל משחקים פתוחים
    const filterWithOpenGames: StatisticsFilter = {
      ...filter,
      includeAllStatuses: true // חשוב! אפשר לכלול משחקים בכל הסטטוסים
    };
    
    console.log('openGamesBridge: מסנן משחקים לפי פילטר (ללא סינון סטטוס):', filterWithOpenGames);
    const filteredGames = filterGames(allGames, filterWithOpenGames);
    
    // לאחר הסינון הראשוני, נסנן רק משחקים שיש להם משחקים פתוחים
    console.log(`openGamesBridge: התקבלו ${filteredGames.length} משחקים אחרי סינון ראשוני`);
    const gamesWithOpenGames = filteredGames.filter(game => 
      game.openGames && game.openGames.length > 0
    );
    
    console.log(`openGamesBridge: נמצאו ${gamesWithOpenGames.length} משחקים עם משחקים פתוחים`);
    
    // טעינת כל המשתמשים
    const allUsers = await getAllUsers();
    
    // מיפוי המשתמשים לפי מזהה - להקלה על החיפוש
    const usersMap = new Map<string, any>();
    allUsers.forEach(user => {
      usersMap.set(user.id, user);
    });
    
    // חישוב תאריך מינימלי לפי הפילטר
    const nowDate = new Date();
    let minDate = new Date(0); // תאריך התחלתי - 1970-01-01
    
    if (filter.timeFilter === 'month') {
      minDate = new Date();
      minDate.setDate(nowDate.getDate() - 30);
    } else if (filter.timeFilter === 'quarter') {
      minDate = new Date();
      minDate.setDate(nowDate.getDate() - 90);
    } else if (filter.timeFilter === 'year') {
      minDate = new Date();
      minDate.setDate(nowDate.getDate() - 365);
    } else if (filter.timeFilter === 'custom' && filter.startDate) {
      minDate = filter.startDate;
    }
    
    const minTimestamp = minDate.getTime();
    
    // Initialize statistics
    let totalOpenGames = 0;
    let gamesWithOpenGamesCount = 0;
    
    // Track player wins in open games using a more accurate system
    const playerWinsMap = new Map<string, {
      playerId: string;
      playerName: string;
      winCount: number;
      totalWon: number;
    }>();
    
    // מאגר כולל של כל המשחקים הפתוחים
    const allOpenGamesArray: {
      gameId: string;
      openGameId: number;
      winnerId: string;
      winnerName: string;
      amount: number;
      date: string;
    }[] = [];
    
    // Process each game
    gamesWithOpenGames.forEach(game => {
      // טיפול במשחקים פתוחים
      const openGames = game.openGames || [];
      
      // דילוג על משחקים ללא משחקים פתוחים
      if (openGames.length === 0) {
        return;
      }
      
      const gameDate = game.date 
        ? `${game.date.day}/${game.date.month}/${game.date.year}` 
        : new Date(game.createdAt).toISOString();
      
      let openGamesInRange = 0;
      
      // טיפול בכל משחק פתוח
      openGames.forEach(openGame => {
        // בדיקה אם המשחק הפתוח עומד בפילטרים
        let isInTimeRange = true;
        if (filter.timeFilter !== 'all') {
          isInTimeRange = openGame.createdAt >= minTimestamp;
        }
        
        // אם המשחק לא בטווח הזמן, דלג עליו
        if (!isInTimeRange) {
          return;
        }
        
        openGamesInRange++;
        
        // מציאת מזהה המנצח
        const winnerId = openGame.winner;
        
        // אם אין מזהה מנצח, דלג
        if (!winnerId) {
          console.log(`openGamesBridge: משחק פתוח ללא מנצח במשחק ${game.id}, משחק פתוח ${openGame.id}`);
          return;
        }
        
        // מחפש את שם השחקן מכל מקור אפשרי
        let winnerName = 'לא ידוע';
        
        // 1. חיפוש במשתתפי המשחק
        const playerInGame = game.players?.find(p => p.userId === winnerId || p.id === winnerId);
        if (playerInGame?.name) {
          winnerName = playerInGame.name;
        } 
        // 2. חיפוש ברשימת המשתמשים
        else if (usersMap.has(winnerId)) {
          winnerName = usersMap.get(winnerId).name;
        }
        
        // חישוב סכום הזכייה
        const winAmount = game.rebuySnapshot?.amount || 0;
        
        // הוספה לרשימת המשחקים הפתוחים
        allOpenGamesArray.push({
          gameId: game.id,
          openGameId: openGame.id,
          winnerId,
          winnerName,
          amount: winAmount,
          date: gameDate
        });
        
        // עדכון המנצח במפה
        let playerWins = playerWinsMap.get(winnerId);
        if (!playerWins) {
          playerWins = {
            playerId: winnerId,
            playerName: winnerName,
            winCount: 0,
            totalWon: 0
          };
          playerWinsMap.set(winnerId, playerWins);
        }
        
        playerWins.winCount++;
        playerWins.totalWon += winAmount;
        
        // עדכון הסטטיסטיקות הכלליות
        totalOpenGames++;
      });
      
      if (openGamesInRange > 0) {
        gamesWithOpenGamesCount++;
      }
    });
    
    console.log(`openGamesBridge: נמצאו ${totalOpenGames} משחקים פתוחים בסה"כ ב-${gamesWithOpenGamesCount} משחקים שונים`);
    
    // Calculate average open games per game
    const averageOpenGamesPerGame = gamesWithOpenGamesCount > 0 ? 
      totalOpenGames / gamesWithOpenGamesCount : 0;
    
    // Sort top winners by win count
    const topWinners = Array.from(playerWinsMap.values())
      .sort((a, b) => b.winCount - a.winCount);
    
    // אם יש מספר משחקים פתוחים אבל אין מנצחים, כנראה יש בעיה
    if (topWinners.length === 0 && totalOpenGames > 0) {
      console.error(`שגיאה: נמצאו ${totalOpenGames} משחקים פתוחים אך אין מנצחים!`);
    }
    
    // שמירת התוצאה במטמון המקומי
    const result = {
      totalOpenGames,
      topWinners,
      averageOpenGamesPerGame,
      gamesCount: filteredGames.length // מספר המשחקים הכולל שעברו את הפילטר
    };
    
    // שמירה במטמון
    resultsCache.set(cacheKey, { timestamp: now, data: result });
    console.log(`openGamesBridge: שמירת תוצאה במטמון עבור מפתח ${cacheKey}`);
    
    return result;
  } catch (error) {
    console.error('Error getting open games statistics:', error);
    throw error;
  }
} 