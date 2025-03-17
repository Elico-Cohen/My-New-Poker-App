// src/services/statistics/openGamesStatistics.ts

import { Game } from '@/models/Game';
import { OpenGamesStats, StatisticsFilter } from '@/models/Statistics';
import { filterGames, fetchAllGames } from '../statistics/statisticsService';
import { getAllUsers } from '@/services/users';

/**
 * Get open games statistics
 */
export const getOpenGamesStatistics = async (
  filter: StatisticsFilter = { timeFilter: 'all' }
): Promise<OpenGamesStats> => {
  try {
    console.log('openGamesStatistics: התחלת חישוב סטטיסטיקות משחקים פתוחים');
    
    // @ts-ignore - דילוג על הקאש בכל פעם שמחשבים סטטיסטיקות
    const skipCache = filter._refreshToken ? true : false;
    
    // טוען את כל המשחקים
    console.log('openGamesStatistics: מביא את כל המשחקים מהמאגר המרכזי');
    const allGames = await fetchAllGames(skipCache);
    
    // מוודא שאנחנו לא מסננים לפי סטטוס כדי לקבל את כל המשחקים
    // גם כאלה שבסטטוס 'completed' או 'final_results' שיכולים להכיל משחקים פתוחים
    const filterWithOpenGames: StatisticsFilter = {
      ...filter,
      includeAllStatuses: true // חשוב! אפשר לכלול משחקים בכל הסטטוסים
    };
    
    console.log('openGamesStatistics: מסנן משחקים לפי פילטר (ללא סינון סטטוס):', filterWithOpenGames);
    const filteredGames = filterGames(allGames, filterWithOpenGames);
    
    // לאחר הסינון הראשוני, נסנן רק משחקים שיש להם משחקים פתוחים
    console.log(`openGamesStatistics: התקבלו ${filteredGames.length} משחקים אחרי סינון ראשוני`);
    const gamesWithOpenGames = filteredGames.filter(game => 
      game.openGames && game.openGames.length > 0
    );
    
    console.log(`openGamesStatistics: נמצאו ${gamesWithOpenGames.length} משחקים עם משחקים פתוחים`);
    
    // טעינת כל המשתמשים
    const allUsers = await getAllUsers();
    
    // מיפוי המשתמשים לפי מזהה - להקלה על החיפוש
    const usersMap = new Map<string, any>();
    allUsers.forEach(user => {
      usersMap.set(user.id, user);
    });
    
    // חישוב תאריך מינימלי לפי הפילטר
    const now = new Date();
    let minDate = new Date(0); // תאריך התחלתי - 1970-01-01
    
    if (filter.timeFilter === 'month') {
      minDate = new Date();
      minDate.setDate(now.getDate() - 30);
    } else if (filter.timeFilter === 'quarter') {
      minDate = new Date();
      minDate.setDate(now.getDate() - 90);
    } else if (filter.timeFilter === 'year') {
      minDate = new Date();
      minDate.setDate(now.getDate() - 365);
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
          console.log(`openGamesStatistics: משחק פתוח ללא מנצח במשחק ${game.id}, משחק פתוח ${openGame.id}`);
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
    
    console.log(`openGamesStatistics: נמצאו ${totalOpenGames} משחקים פתוחים בסה"כ ב-${gamesWithOpenGamesCount} משחקים שונים`);
    
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
    
    return {
      totalOpenGames,
      topWinners,
      averageOpenGamesPerGame,
      gamesCount: filteredGames.length // מספר המשחקים הכולל שעברו את הפילטר
    };
  } catch (error) {
    console.error('Error getting open games statistics:', error);
    throw error;
  }
};