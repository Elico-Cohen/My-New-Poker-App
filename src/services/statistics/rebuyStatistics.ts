// src/services/statistics/rebuyStatistics.ts

import { Game } from '@/models/Game';
import { RebuyStats, StatisticsFilter } from '@/models/Statistics';
import { formatGameDate, filterGames } from '../statistics/statisticsService';
import { store } from '@/store/AppStore';
import { Group } from '@/models/Group';
import { UserProfile } from '@/models/UserProfile';

/**
 * Get rebuy statistics
 * פונקציה לקבלת סטטיסטיקות של ריבאיים
 */
export const getRebuyStatistics = async (
  filter: StatisticsFilter = { timeFilter: 'all' }
): Promise<RebuyStats> => {
  try {
    console.log('===== התחלת חישוב סטטיסטיקות ריבאיים =====');
    console.log('RebuyStatistics: מביא נתונים מהמאגר המרכזי');
    console.log('RebuyStatistics: פילטר שהתקבל:', JSON.stringify(filter));
    
    // קבלת נתונים מהמאגר המרכזי במקום מפיירבייס ישירות
    const allGames = store.getGames();
    console.log(`RebuyStatistics: מספר משחקים שהתקבלו מהמאגר: ${allGames.length}`);
    
    // סינון משחקים רק לפי הקריטריונים הרלוונטיים
    // אנחנו רוצים גם משחקים במצב "final_results" וגם "completed"
    const filteredGames = filterGames(allGames, {
      ...filter,
      statuses: ['completed', 'final_results']
    });
    console.log(`RebuyStatistics: מספר משחקים אחרי סינון: ${filteredGames.length}`);
    
    if (filteredGames.length === 0) {
      console.warn('RebuyStatistics: לא נמצאו משחקים שעומדים בקריטריוני הסינון!');
      // במקרה שאין משחקים, נחזיר אובייקט ריק עם ערכים אפסיים
      return {
        totalRebuys: 0,
        totalPurchases: 0,
        averageRebuysPerGame: 0,
        averageRebuysPerPlayer: 0,
        averagePurchasesPerPlayer: 0,
        gamesCount: 0,
        groupsRebuyStats: [],
        playerWithMostRebuys: {} as any,
        playerWithMostTotalRebuys: {} as any,
        playerWithLeastTotalRebuys: {} as any,
        playerWithLowestRebuyAverage: {} as any,
        playerWithHighestTotalPurchases: {} as any,
        playerWithLowestTotalPurchases: {} as any,
        playerWithHighestSingleGamePurchase: {} as any,
        playerWithLargestSingleGameDifference: {} as any,
        playerWithLargestCumulativeDifference: {} as any,
        gameWithMostRebuys: {} as any,
        gameWithLeastRebuys: {} as any,
        gameWithMostPurchases: {} as any,
        gameWithLeastPurchases: {} as any
      };
    }
    
    const allUsers = store.getUsers();
    console.log(`RebuyStatistics: מספר משתמשים שהתקבלו מהמאגר: ${allUsers.length}`);
    
    const allGroups = store.getGroups();
    console.log(`RebuyStatistics: מספר קבוצות שהתקבלו מהמאגר: ${allGroups.length}`);
    
    // קבלת השחקנים הקבועים של הקבוצה אם יש סינון לפי קבוצה
    let permanentPlayersInGroup: Set<string> | null = null;
    if (filter.groupId && filter.groupId !== 'all') {
      const group = allGroups.find(g => g.id === filter.groupId);
      if (group && group.permanentPlayers) {
        permanentPlayersInGroup = new Set(group.permanentPlayers);
        console.log(`RebuyStatistics: מסנן לפי קבוצה ${group.name}, שחקנים קבועים: ${group.permanentPlayers.length}`);
      }
    }
    
    // בדיקה האם קיימים שדות חיוניים במשחקים
    const gamesSample = filteredGames.slice(0, Math.min(5, filteredGames.length));
    console.log('RebuyStatistics: דוגמת משחקים למבנה נתונים:');
    
    gamesSample.forEach((game, idx) => {
      console.log(`\nRebuyStatistics: משחק לדוגמה #${idx + 1}:`);
      console.log(`- מזהה: ${game.id}`);
      console.log(`- תאריך: ${formatGameDate(game.date)}`);
      console.log(`- סטטוס: ${game.status}`);
      console.log(`- מספר שחקנים: ${game.players ? game.players.length : 'לא קיים'}`);
      
      // בדיקת מבנה שחקן
      if (game.players && game.players.length > 0) {
        const playerSample = game.players[0];
        console.log('- דוגמת שחקן:');
        console.log(`  - שם: ${playerSample.name}`);
        console.log(`  - מזהה: ${playerSample.userId}`);
        console.log(`  - מספר ריבאיים: ${playerSample.rebuyCount !== undefined ? playerSample.rebuyCount : 'לא קיים'}`);
        console.log(`  - מספר באי-אין: ${playerSample.buyInCount !== undefined ? playerSample.buyInCount : 'לא קיים'}`);
      }
    });
    
    console.log(`RebuyStatistics: מעבד ${filteredGames.length} משחקים עבור סטטיסטיקת ריבאיים`);
    
    // יצירת מיפוי שם לזיהוי
    const nameToIdMap = new Map<string, string>();
    allUsers.forEach((user: UserProfile) => {
      if (user.name) {
        nameToIdMap.set(user.name, user.id);
      }
    });
    
    // קאש עבור נתוני קבוצות
    const groupCache = new Map<string, { 
      buyInAmount: number, 
      rebuyAmount: number 
    }>();
    
    // פונקציה לקבלת מחירי באי-אין וריבאי של קבוצה
    const getGroupPrices = (groupId: string) => {
      if (!groupCache.has(groupId)) {
        const group = allGroups.find((g: Group) => g.id === groupId);
        if (group) {
          groupCache.set(groupId, {
            buyInAmount: group.buyIn.amount,
            rebuyAmount: group.rebuy.amount
          });
        } else {
          groupCache.set(groupId, { buyInAmount: 0, rebuyAmount: 0 });
        }
      }
      
      return groupCache.get(groupId) || { buyInAmount: 0, rebuyAmount: 0 };
    };
    
    // פונקציה לבדיקה האם שחקן צריך להיכלל בחישובים
    const shouldIncludePlayer = (playerId: string, playerName: string): boolean => {
      // אם אין סינון לפי קבוצה, כלול את כל השחקנים
      if (!permanentPlayersInGroup) {
        return true;
      }
      
      // אם יש סינון לפי קבוצה, כלול רק שחקנים קבועים
      const playerIdToCheck = playerId || nameToIdMap.get(playerName || '');
      return permanentPlayersInGroup.has(playerIdToCheck || '');
    };
    
    // לוג מפורט של הריבאיים של כל שחקן בכל משחק
    filteredGames.forEach((game, gameIndex) => {
      console.log(`\nמשחק #${gameIndex + 1} - מזהה: ${game.id}, תאריך: ${formatGameDate(game.date)}`);
      
      if (!game.players || game.players.length === 0) {
        console.log(`  אין שחקנים במשחק זה`);
        return;
      }
      
      console.log(`  רשימת שחקנים וריבאיים:`);
      game.players.forEach((player, playerIndex) => {
        const rebuyCount = player.rebuyCount || 0;
        const buyInCount = player.buyInCount || 0;
        const playerName = player.name || '';
        const playerId = player.userId || nameToIdMap.get(playerName) || '';
        
        if (!playerName) return; // דלג על שחקנים ללא שם
        
        // בדיקה האם השחקן צריך להיכלל בחישובים (רק שחקנים קבועים בקבוצה)
        if (!shouldIncludePlayer(playerId, playerName)) {
          console.log(`RebuyStatistics: מדלג על שחקן אורח ${playerName} (${playerId}) בקבוצה מסוננת`);
          return;
        }
        
        console.log(`  ${playerIndex + 1}. ${playerName} (${playerId || 'לא מזוהה'}) - ריבאיים: ${rebuyCount}, באי-אין: ${buyInCount}`);
      });
    });
    console.log(`=======================================`);
    
    // Initialize rebuy statistics
    let totalRebuys = 0;
    let totalGamesWithRebuys = 0;
    let totalPlayers = 0;
    let totalParticipants = 0;
    let gamesCount = filteredGames.length; // מספר המשחקים הכולל
    
    // מעקב אחרי מספר המשחקים לכל קבוצה
    const groupGamesCountMap = new Map<string, number>();

    // אתחול מונה משחקים לכל קבוצה
    allGroups.forEach(group => {
      groupGamesCountMap.set(group.id, 0);
    });

    // ספירת משחקים לכל קבוצה
    filteredGames.forEach(game => {
      if (game.groupId) {
        const currentCount = groupGamesCountMap.get(game.groupId) || 0;
        groupGamesCountMap.set(game.groupId, currentCount + 1);
      }
    });
    
    // Track player and game rebuy counts - משתמש בשם ובמזהה השחקן כמפתח משולב
    const playerRebuyMap = new Map<string, {
      playerId: string;
      playerName: string;
      rebuyCount: number;
    }>();
    
    // Track player total rebuys across all games - משתמש בשם ובמזהה השחקן כמפתח משולב
    const playerTotalRebuyMap = new Map<string, {
      playerId: string;
      playerName: string;
      totalRebuyCount: number;
      gamesCount: number;
    }>();
    
    // מעקב אחרי סך כל הקניות (באי-אין + ריבאי) לכל שחקן
    const playerTotalPurchasesMap = new Map<string, {
      playerId: string;
      playerName: string;
      totalPurchaseAmount: number;
      gamesCount: number;
    }>();
    
    // מעקב אחרי סך כל התוצאות וההפרשים לכל שחקן
    const playerTotalResultsMap = new Map<string, {
      playerId: string;
      playerName: string;
      totalPurchaseAmount: number;  // סה"כ קניות
      totalFinalResult: number;     // סה"כ תוצאות
      totalDifference: number;      // ההפרש ביניהם
      gamesCount: number;           // מספר משחקים
    }>();
    
    // מעקב אחרי ריבאיים וקניות לפי קבוצה
    const groupRebuyStatsMap = new Map<string, {
      groupId: string;
      groupName: string;
      totalRebuys: number;
      totalPurchases: number;
      gamesCount: number;
    }>();
    
    // אתחול סטטיסטיקות הקבוצה עבור כל הקבוצות
    allGroups.forEach(group => {
      groupRebuyStatsMap.set(group.id, {
        groupId: group.id,
        groupName: group.name,
        totalRebuys: 0,
        totalPurchases: 0,
        gamesCount: groupGamesCountMap.get(group.id) || 0
      });
    });
    
    let gameWithMostRebuys = {
      gameId: '',
      date: '',
      rebuyCount: 0,
      playersCount: 0,
      groupName: '',
      topRebuyPlayers: [] as {
        playerId: string;
        playerName: string;
        rebuyCount: number;
      }[]
    };
    
    // הוספת משתנה חדש לחישוב המשחק עם הכי פחות ריבאיים
    // נאתחל את rebuyCount עם ערך גבוה כדי שכל משחק יוכל להחליף אותו
    let gameWithLeastRebuys = {
      gameId: '',
      date: '',
      rebuyCount: 999999, // ערך גבוה מאוד כהתחלה
      playersCount: 0,
      groupName: '',
      topRebuyPlayers: [] as {
        playerId: string;
        playerName: string;
        rebuyCount: number;
      }[]
    };
    
    // הוספת משתנה למעקב אחרי המשחק עם סה"כ הקניות הגבוה ביותר
    let gameWithMostPurchases = {
      gameId: '',
      date: '',
      purchaseAmount: 0,
      playersCount: 0,
      groupName: '',
      topPurchasePlayers: [] as {
        playerId: string;
        playerName: string;
        purchaseAmount: number;
      }[]
    };
    
    // הוספת משתנה למעקב אחרי המשחק עם סה"כ הקניות הנמוך ביותר
    let gameWithLeastPurchases = {
      gameId: '',
      date: '',
      purchaseAmount: Number.MAX_SAFE_INTEGER, // ערך גבוה מאוד כהתחלה
      playersCount: 0,
      groupName: '',
      topPurchasePlayers: [] as {
        playerId: string;
        playerName: string;
        purchaseAmount: number;
      }[]
    };
    
    // Set של שחקנים שכבר ספרנו
    const countedPlayers = new Set<string>();
    
    // מעקב אחרי השחקן עם הקנייה הגבוהה ביותר במשחק הנוכחי
    let highestPurchaseInCurrentGame = {
      playerId: '',
      playerName: '',
      purchaseAmount: 0
    };
    
    // מעקב אחרי השחקן עם הקנייה הגבוהה ביותר במשחק בודד
    let playerWithHighestSingleGamePurchase = {
      playerId: '',
      playerName: '',
      gameId: '',
      date: '',
      purchaseAmount: 0
    };
    
    // מעקב אחרי השחקן עם ההפרש הגדול ביותר בין הקניות לזכיות
    let playerWithLargestSingleGameDifference = {
      playerId: '',
      playerName: '',
      gameId: '',
      date: '',
      purchaseAmount: 0,
      finalResult: 0,
      difference: -Number.MAX_SAFE_INTEGER // מתחילים מערך מינימלי כדי שכל הפרש חיובי ייבחר
    };
    
    // מעקב אחרי השחקן עם ההפרש המצטבר הגדול ביותר בין קניות לזכיות
    let playerWithLargestCumulativeDifference = {
      playerId: '',
      playerName: '',
      totalPurchaseAmount: 0,
      totalFinalResult: 0,
      totalDifference: -Number.MAX_SAFE_INTEGER,  // מתחילים מערך מינימלי כי אנחנו מחפשים את ההפרש החיובי הגדול ביותר
      gamesCount: 0
    };
    
    // מעקב אחרי השחקנים עם הכי הרבה ריבאיים במשחק הנוכחי
    let gamePlayersWithMostRebuys: {
      playerId: string;
      playerName: string;
      rebuyCount: number;
    }[] = [];
    
    // מעקב אחרי השחקנים עם הכי הרבה קניות במשחק הנוכחי
    let gamePlayersWithMostPurchases: {
      playerId: string;
      playerName: string;
      purchaseAmount: number;
    }[] = [];
    
    // Process each game
    for (const game of filteredGames) {
      let gameRebuyCount = 0;
      
      if (!game.players || game.players.length === 0) {
        continue;
      }
      
      // השג מחירי באי-אין וריבאי לקבוצה
      const groupPrices = getGroupPrices(game.groupId);
      
      // מעקב אחרי השחקן עם הקנייה הגבוהה ביותר במשחק הנוכחי
      highestPurchaseInCurrentGame = {
        playerId: '',
        playerName: '',
        purchaseAmount: 0
      };
      
      // מעקב אחרי השחקנים עם הכי הרבה ריבאיים במשחק הנוכחי
      let gamePlayersWithMostRebuys: {
        playerId: string;
        playerName: string;
        rebuyCount: number;
      }[] = [];
      
      // מעקב אחרי השחקנים עם הכי הרבה קניות במשחק הנוכחי
      let gamePlayersWithMostPurchases: {
        playerId: string;
        playerName: string;
        purchaseAmount: number;
      }[] = [];
      
      // סטטיסטיקת קבוצות - קבלת הקבוצה הנוכחית או יצירת רשומה חדשה
      let groupStats = groupRebuyStatsMap.get(game.groupId);
      if (!groupStats) {
        groupStats = {
          groupId: game.groupId,
          groupName: game.groupNameSnapshot || 'קבוצה לא ידועה',
          totalRebuys: 0,
          totalPurchases: 0,
          gamesCount: groupGamesCountMap.get(game.groupId) || 0
        };
        groupRebuyStatsMap.set(game.groupId, groupStats);
      }
      
      // צבירת סה"כ קניות לקבוצה במשחק זה
      let gameTotalPurchases = 0;
      
      game.players.forEach(player => {
        const rebuyCount = player.rebuyCount || 0;
        const buyInCount = player.buyInCount || 0;
        const playerName = player.name || '';
        const playerId = player.userId || nameToIdMap.get(playerName) || '';
        
        if (!playerName) return; // דלג על שחקנים ללא שם
        
        // בדיקה האם השחקן צריך להיכלל בחישובים (רק שחקנים קבועים בקבוצה)
        if (!shouldIncludePlayer(playerId, playerName)) {
          console.log(`RebuyStatistics: מדלג על שחקן אורח ${playerName} (${playerId}) בקבוצה מסוננת`);
          return;
        }
        
        // מפתח ייחודי לשחקן - שם + מזהה אם קיים
        const playerKey = playerId ? `${playerName}-${playerId}` : playerName;
        
        // ספירת שחקנים ייחודיים
        if (!countedPlayers.has(playerKey)) {
          countedPlayers.add(playerKey);
          totalPlayers++;
        }
        
        // סופר כל השתתפות של שחקן במשחק
        totalParticipants++;
        
        // כל השחקנים הם בסטטיסטיקות, גם אם יש להם 0 ריבאיים
        
        // Update total rebuys
        totalRebuys += rebuyCount;
        gameRebuyCount += rebuyCount;
        
        // שמירת נתוני הריבאיים של השחקן במשחק הנוכחי
        if (rebuyCount > 0) {
          gamePlayersWithMostRebuys.push({
            playerId,
            playerName,
            rebuyCount
          });
        }
        
        // Update player rebuy map - משתמש בשם ובמזהה כמפתח משולב
        let playerRebuys = playerRebuyMap.get(playerKey);
        if (!playerRebuys) {
          playerRebuys = {
            playerId,
            playerName,
            rebuyCount: 0
          };
          playerRebuyMap.set(playerKey, playerRebuys);
        }
        
        // אם מספר הריבאיים במשחק הנוכחי גדול ממה שכבר רשום, עדכן
        if (rebuyCount > playerRebuys.rebuyCount) {
          playerRebuys.rebuyCount = rebuyCount;
        }
        
        // Update player's total rebuy count
        let playerTotalRebuys = playerTotalRebuyMap.get(playerKey);
        if (!playerTotalRebuys) {
          playerTotalRebuys = {
            playerId,
            playerName,
            totalRebuyCount: 0,
            gamesCount: 0
          };
          playerTotalRebuyMap.set(playerKey, playerTotalRebuys);
        }
        
        playerTotalRebuys.totalRebuyCount += rebuyCount;
        playerTotalRebuys.gamesCount++;

        // Calculate player's purchase in current game
        const buyInAmount = buyInCount * (groupPrices?.buyInAmount || 0);
        const rebuyAmount = rebuyCount * (groupPrices?.rebuyAmount || 0);
        const totalPurchase = buyInAmount + rebuyAmount;
        
        // עדכון סטטיסטיקה של הקבוצה - הוספת הקניות של השחקן לקבוצה
        gameTotalPurchases += totalPurchase;
        
        // Check if this player has the highest purchase in current game
        if (totalPurchase > highestPurchaseInCurrentGame.purchaseAmount) {
          highestPurchaseInCurrentGame = {
            playerId,
            playerName,
            purchaseAmount: totalPurchase
          };
        }
        
        // Update player's total purchases map
        let playerTotalPurchases = playerTotalPurchasesMap.get(playerKey);
        if (!playerTotalPurchases) {
          playerTotalPurchases = {
            playerId,
            playerName,
            totalPurchaseAmount: 0,
            gamesCount: 0
          };
          playerTotalPurchasesMap.set(playerKey, playerTotalPurchases);
        }
        
        playerTotalPurchases.totalPurchaseAmount += totalPurchase;
        playerTotalPurchases.gamesCount++;
        
        // עדכון המעקב אחרי הפרשים בין קניות לזכיות
        const finalResultMoney = player.finalResultMoney || 0;
        const difference = finalResultMoney + totalPurchase;
        
        let playerTotalResults = playerTotalResultsMap.get(playerKey);
        if (!playerTotalResults) {
          playerTotalResults = {
            playerId,
            playerName,
            totalPurchaseAmount: 0,
            totalFinalResult: 0,
            totalDifference: 0,
            gamesCount: 0
          };
          playerTotalResultsMap.set(playerKey, playerTotalResults);
        }
        
        playerTotalResults.totalPurchaseAmount += totalPurchase;
        playerTotalResults.totalFinalResult += finalResultMoney;
        playerTotalResults.totalDifference += difference;
        playerTotalResults.gamesCount++;
        
        // חישוב ההפרש בין הקניות לזכיות במשחק הנוכחי
        // מחפשים את השחקן עם ההפרש החיובי הגדול ביותר (התאוששות מהקניות)
        if (difference > 0 && difference > playerWithLargestSingleGameDifference.difference) {
          playerWithLargestSingleGameDifference = {
            playerId,
            playerName,
            gameId: game.id,
            date: formatGameDate((game as any).gameDate || game.date),
            purchaseAmount: totalPurchase,
            finalResult: finalResultMoney,
            difference
          };
        }

        // הוספת מעקב אחרי השחקן לרשימת השחקנים עם הקניות הגבוהות במשחק
        gamePlayersWithMostPurchases.push({
          playerId,
          playerName,
          purchaseAmount: totalPurchase
        });
      });
      
      // עדכון סטטיסטיקת הקבוצה
      if (groupStats) {
        groupStats.totalRebuys += gameRebuyCount;
        groupStats.totalPurchases += gameTotalPurchases;
      }
      
      // בדיקה אם יש לנו שחקן עם הקנייה הגבוהה ביותר במשחק בודד
      if (highestPurchaseInCurrentGame.purchaseAmount > (playerWithHighestSingleGamePurchase?.purchaseAmount || 0)) {
        playerWithHighestSingleGamePurchase = {
          ...highestPurchaseInCurrentGame,
          gameId: game.id,
          date: formatGameDate((game as any).gameDate || game.date)
        };
      }
      
      // If game had any rebuys, increment games with rebuys count
      if (gameRebuyCount > 0) {
        totalGamesWithRebuys++;
        
        // Check if this game had the most rebuys
        if (gameRebuyCount > gameWithMostRebuys.rebuyCount) {
          // מיון השחקנים לפי מספר הריבאיים (מהגבוה לנמוך) ולקיחת שלושת הראשונים
          const topRebuyPlayers = [...gamePlayersWithMostRebuys]
            .sort((a, b) => b.rebuyCount - a.rebuyCount)
            .slice(0, 3);
            
          // שם הקבוצה
          let groupName = '';
          const group = allGroups.find((g: Group) => g.id === game.groupId);
          if (group) {
            groupName = group.name;
          }
          
          gameWithMostRebuys = {
            gameId: game.id,
            date: formatGameDate((game as any).gameDate || game.date),
            rebuyCount: gameRebuyCount,
            playersCount: game.players.length,
            groupName: groupName,
            topRebuyPlayers: topRebuyPlayers
          };
        }

        // הוספת בדיקה לעדכון המשחק עם הכי פחות ריבאיים
        // נעדכן רק אם יש ריבאיים במשחק (כדי להימנע ממשחקים שאין בהם ריבאיים בכלל)
        if (gameRebuyCount < gameWithLeastRebuys.rebuyCount) {
          // מיון השחקנים לפי מספר הריבאיים (מהגבוה לנמוך) ולקיחת שלושת הראשונים
          const topRebuyPlayers = [...gamePlayersWithMostRebuys]
            .sort((a, b) => b.rebuyCount - a.rebuyCount)
            .slice(0, 3);
            
            // שם הקבוצה
            let groupName = '';
            const group = allGroups.find((g: Group) => g.id === game.groupId);
            if (group) {
              groupName = group.name;
            }
            
            gameWithLeastRebuys = {
              gameId: game.id,
              date: formatGameDate((game as any).gameDate || game.date),
              rebuyCount: gameRebuyCount,
              playersCount: game.players.length,
              groupName: groupName,
              topRebuyPlayers: topRebuyPlayers
            };
        }
      }

      // אחרי שנגמרה הלולאה שעוברת על השחקנים של משחק, בסביבות שורה 420, לאחר עדכון gameWithLeastRebuys
      // בדיקה אם המשחק הזה הוא עם סה"כ הקניות הגבוה ביותר
      if (gameTotalPurchases > gameWithMostPurchases.purchaseAmount) {
        // מיון השחקנים לפי סכום הקניות (מהגבוה לנמוך) ולקיחת שלושת הראשונים
        const topPurchasePlayers = [...gamePlayersWithMostPurchases]
          .sort((a, b) => b.purchaseAmount - a.purchaseAmount)
          .slice(0, 3);
          
        // שם הקבוצה
        let groupName = '';
        const group = allGroups.find((g: Group) => g.id === game.groupId);
        if (group) {
          groupName = group.name;
        }
        
        gameWithMostPurchases = {
          gameId: game.id,
          date: formatGameDate((game as any).gameDate || game.date),
          purchaseAmount: gameTotalPurchases,
          playersCount: game.players.length,
          groupName,
          topPurchasePlayers
        };
      }

      // בדיקה אם המשחק הזה הוא עם סה"כ הקניות הנמוך ביותר
      // נבדוק רק משחקים עם שחקנים וסכום קניות גדול מאפס
      if (gameTotalPurchases > 0 && game.players.length > 0 && gameTotalPurchases < gameWithLeastPurchases.purchaseAmount) {
        // מיון השחקנים לפי סכום הקניות (מהגבוה לנמוך) ולקיחת שלושת הראשונים
        const topPurchasePlayers = [...gamePlayersWithMostPurchases]
          .sort((a, b) => b.purchaseAmount - a.purchaseAmount)
          .slice(0, 3);
          
        // שם הקבוצה
        let groupName = '';
        const group = allGroups.find((g: Group) => g.id === game.groupId);
        if (group) {
          groupName = group.name;
        }
        
        gameWithLeastPurchases = {
          gameId: game.id,
          date: formatGameDate((game as any).gameDate || game.date),
          purchaseAmount: gameTotalPurchases,
          playersCount: game.players.length,
          groupName,
          topPurchasePlayers
        };
      }
    }
    
    // לוג הסיכום של מספר הריבאיים המצטבר לכל שחקן
    console.log(`\n==== סיכום מספר ריבאיים מצטבר לכל שחקן ====`);
    if (playerTotalRebuyMap.size === 0) {
      console.log(`אין שחקנים עם ריבאיים`);
    } else {
      // מיון השחקנים לפי מספר הריבאיים המצטבר (מהגבוה לנמוך)
      const sortedPlayers = Array.from(playerTotalRebuyMap.values())
        .sort((a, b) => b.totalRebuyCount - a.totalRebuyCount);
        
      sortedPlayers.forEach((player, index) => {
        console.log(`${index + 1}. ${player.playerName} - סה"כ ריבאיים: ${player.totalRebuyCount}`);
      });
    }
    
    // לוג הסיכום של סה"כ הקניות המצטבר לכל שחקן
    console.log(`\n==== סיכום סה"כ קניות מצטבר (בש"ח) לכל שחקן ====`);
    if (playerTotalPurchasesMap.size === 0) {
      console.log(`אין שחקנים עם קניות`);
    } else {
      // מיון השחקנים לפי סה"כ הקניות המצטבר (מהגבוה לנמוך)
      const sortedPlayers = Array.from(playerTotalPurchasesMap.values())
        .sort((a, b) => b.totalPurchaseAmount - a.totalPurchaseAmount);
        
      sortedPlayers.forEach((player, index) => {
        console.log(`${index + 1}. ${player.playerName} - סה"כ קניות: ${player.totalPurchaseAmount} ש"ח`);
      });
    }
    
    // לוג הסיכום של ההפרש המצטבר בין קניות לזכיות לכל שחקן
    console.log(`\n==== סיכום הפרש מצטבר בין קניות לזכיות (בש"ח) לכל שחקן ====`);
    if (playerTotalResultsMap.size === 0) {
      console.log(`אין שחקנים עם הפרשים`);
    } else {
      // מיון השחקנים לפי ההפרש המצטבר (מהגבוה לנמוך)
      const sortedPlayers = Array.from(playerTotalResultsMap.values())
        .sort((a, b) => b.totalDifference - a.totalDifference);
        
      sortedPlayers.forEach((player, index) => {
        console.log(`${index + 1}. ${player.playerName} - קניות: ${player.totalPurchaseAmount} ש"ח, זכיות: ${player.totalFinalResult} ש"ח, הפרש: ${player.totalDifference} ש"ח`);
      });
    }
    console.log(`===========================================`);
    
    // לוג סיכום סטטיסטיקות לפי קבוצה
    console.log(`\n==== סיכום ריבאיים וקניות לפי קבוצה ====`);
    groupRebuyStatsMap.forEach((stats, groupId) => {
      console.log(`קבוצה: ${stats.groupName}, סה"כ ריבאיים: ${stats.totalRebuys}, סה"כ קניות: ${stats.totalPurchases} ש"ח`);
    });
    
    // Find player with most rebuys in a single game
    let playerWithMostRebuys = {
      playerId: '',
      playerName: '',
      rebuyCount: 0
    };
    
    playerRebuyMap.forEach(player => {
      if (player.rebuyCount > playerWithMostRebuys.rebuyCount) {
        playerWithMostRebuys = { ...player };
      }
    });
    
    // Find player with most total rebuys across all games
    let playerWithMostTotalRebuys = {
      playerId: '',
      playerName: '',
      totalRebuyCount: 0,
      gamesCount: 0
    };
    
    // Find player with least total rebuys across all games (מינימום משחק אחד)
    let playerWithLeastTotalRebuys = {
      playerId: '',
      playerName: '',
      totalRebuyCount: Number.MAX_SAFE_INTEGER,
      gamesCount: 0
    };
    
    // Find player with lowest rebuy average (מינימום 3 משחקים)
    let playerWithLowestRebuyAverage = {
      playerId: '',
      playerName: '',
      rebuyAverage: Number.MAX_SAFE_INTEGER,
      totalRebuyCount: 0,
      gamesCount: 0
    };
    
    playerTotalRebuyMap.forEach(player => {
      const gamesCount = player.gamesCount || 0;
      
      if (player.totalRebuyCount > playerWithMostTotalRebuys.totalRebuyCount) {
        playerWithMostTotalRebuys = { ...player };
      }
      
      // רק שחקנים שהשתתפו לפחות במשחק אחד
      // נחפש גם את השחקנים עם 0 ריבאיים
      if (gamesCount > 0 && (player.totalRebuyCount < playerWithLeastTotalRebuys.totalRebuyCount || 
         playerWithLeastTotalRebuys.totalRebuyCount === Number.MAX_SAFE_INTEGER)) {
        playerWithLeastTotalRebuys = { 
          ...player
        };
      }
      
      // חישוב ממוצע ריבאיים למשחק - מינימום משחק אחד
      if (gamesCount > 0) {
        const rebuyAverage = player.totalRebuyCount / gamesCount;
        
        // עדכון השחקן עם ממוצע הריבאיים הנמוך ביותר
        if (rebuyAverage < playerWithLowestRebuyAverage.rebuyAverage || 
            playerWithLowestRebuyAverage.rebuyAverage === Number.MAX_SAFE_INTEGER) {
          playerWithLowestRebuyAverage = {
            playerId: player.playerId,
            playerName: player.playerName,
            rebuyAverage,
            totalRebuyCount: player.totalRebuyCount,
            gamesCount
          };
        }
      }
    });
    
    // אם לא מצאנו שחקן עם מספר ריבאיים מינימלי, אפס את הערך
    if (playerWithLeastTotalRebuys.totalRebuyCount === Number.MAX_SAFE_INTEGER) {
      playerWithLeastTotalRebuys = {
        playerId: '',
        playerName: '',
        totalRebuyCount: 0,
        gamesCount: 0
      };
    }
    
    // אם לא מצאנו שחקן עם ממוצע ריבאיים מינימלי, אפס את הערך
    if (playerWithLowestRebuyAverage.rebuyAverage === Number.MAX_SAFE_INTEGER) {
      playerWithLowestRebuyAverage = {
        playerId: '',
        playerName: '',
        rebuyAverage: 0,
        totalRebuyCount: 0,
        gamesCount: 0
      };
    } else {
      // עיגול לשתי ספרות אחרי הנקודה
      playerWithLowestRebuyAverage.rebuyAverage = parseFloat(playerWithLowestRebuyAverage.rebuyAverage.toFixed(2));
    }
    
    // Find player with highest total purchases (buyIn + rebuy) across all games
    let playerWithHighestTotalPurchases = {
      playerId: '',
      playerName: '',
      totalPurchaseAmount: 0,
      gamesCount: 0
    };
    
    // Find player with lowest total purchases (buyIn + rebuy) across all games (מינימום משחק אחד)
    let playerWithLowestTotalPurchases = {
      playerId: '',
      playerName: '',
      totalPurchaseAmount: Number.MAX_SAFE_INTEGER,
      gamesCount: 0
    };
    
    playerTotalPurchasesMap.forEach(player => {
      if (player.totalPurchaseAmount > playerWithHighestTotalPurchases.totalPurchaseAmount) {
        playerWithHighestTotalPurchases = { ...player };
      }
      
      // רק שחקנים שהשתתפו לפחות במשחק אחד
      // נחפש גם את השחקנים עם קניות מינימליות
      if (player.gamesCount > 0 && (player.totalPurchaseAmount < playerWithLowestTotalPurchases.totalPurchaseAmount || 
         playerWithLowestTotalPurchases.totalPurchaseAmount === Number.MAX_SAFE_INTEGER)) {
        playerWithLowestTotalPurchases = { 
          ...player
        };
      }
    });
    
    // אם לא מצאנו שחקן עם סכום קניות מינימלי, אפס את הערך
    if (playerWithLowestTotalPurchases.totalPurchaseAmount === Number.MAX_SAFE_INTEGER) {
      playerWithLowestTotalPurchases = {
        playerId: '',
        playerName: '',
        totalPurchaseAmount: 0,
        gamesCount: 0
      };
    }
    
    // מציאת השחקן עם ההפרש המצטבר הגדול ביותר (הרווח הגדול ביותר)
    playerTotalResultsMap.forEach(player => {
      // עדכון החישוב כדי להתייחס לקניות כמספר שלילי
      const adjustedDifference = player.totalFinalResult + player.totalPurchaseAmount;
      
      if (player.gamesCount > 0 && adjustedDifference > playerWithLargestCumulativeDifference.totalDifference) {
        playerWithLargestCumulativeDifference = { 
          ...player,
          totalDifference: adjustedDifference 
        };
      }
    });
    
    console.log(`השחקן עם מספר הריבאיים המצטבר הגבוה ביותר: ${playerWithMostTotalRebuys.playerName} (${playerWithMostTotalRebuys.totalRebuyCount} ריבאיים)`);
    console.log(`השחקן עם מספר הריבאיים המצטבר הנמוך ביותר: ${playerWithLeastTotalRebuys.playerName} (${playerWithLeastTotalRebuys.totalRebuyCount} ריבאיים, ב-${playerWithLeastTotalRebuys.gamesCount} משחקים)`);
    console.log(`השחקן עם ממוצע הריבאיים הנמוך ביותר: ${playerWithLowestRebuyAverage.playerName} (${playerWithLowestRebuyAverage.rebuyAverage.toFixed(2)} ריבאיים למשחק, סה"כ ${playerWithLowestRebuyAverage.totalRebuyCount} ריבאיים ב-${playerWithLowestRebuyAverage.gamesCount} משחקים)`);
    console.log(`השחקן עם סה"כ הקניות המצטבר הגבוה ביותר: ${playerWithHighestTotalPurchases.playerName} (${playerWithHighestTotalPurchases.totalPurchaseAmount} ש"ח)`);
    console.log(`השחקן עם סה"כ הקניות המצטבר הנמוך ביותר: ${playerWithLowestTotalPurchases.playerName} (${playerWithLowestTotalPurchases.totalPurchaseAmount} ש"ח, ב-${playerWithLowestTotalPurchases.gamesCount} משחקים)`);
    console.log(`השחקן עם סה"כ הקניות הגבוה ביותר במשחק בודד: ${playerWithHighestSingleGamePurchase.playerName} (${playerWithHighestSingleGamePurchase.purchaseAmount} ש"ח, משחק מתאריך ${playerWithHighestSingleGamePurchase.date})`);
    console.log(`השחקן עם ההפרש הגדול ביותר בין קניות לזכיות במשחק בודד: ${playerWithLargestSingleGameDifference.playerName} (הפרש: ${playerWithLargestSingleGameDifference.difference} ש"ח, קניות: ${playerWithLargestSingleGameDifference.purchaseAmount} ש"ח, תוצאה: ${playerWithLargestSingleGameDifference.finalResult} ש"ח, חישוב: ${playerWithLargestSingleGameDifference.finalResult} + ${Math.abs(playerWithLargestSingleGameDifference.purchaseAmount)} = ${playerWithLargestSingleGameDifference.difference}, משמעות: יכולת התאוששות של השחקן, משחק מתאריך ${playerWithLargestSingleGameDifference.date})`);
    console.log(`השחקן עם ההפרש המצטבר הגדול ביותר בין קניות לזכיות: ${playerWithLargestCumulativeDifference.playerName} (הפרש: ${playerWithLargestCumulativeDifference.totalDifference} ש"ח, קניות: ${playerWithLargestCumulativeDifference.totalPurchaseAmount} ש"ח, זכיות: ${playerWithLargestCumulativeDifference.totalFinalResult} ש"ח, חישוב: ${playerWithLargestCumulativeDifference.totalFinalResult} - ${playerWithLargestCumulativeDifference.totalPurchaseAmount} = ${playerWithLargestCumulativeDifference.totalDifference}, ב-${playerWithLargestCumulativeDifference.gamesCount} משחקים)`);
    
    // Calculate averages - כולל את כל השחקנים, גם אלו עם 0 ריבאיים
    const averageRebuysPerGame = filteredGames.length > 0 ?
      totalRebuys / filteredGames.length : 0;
    
    const averageRebuysPerPlayer = totalParticipants > 0 ?
      totalRebuys / totalParticipants : 0;
      
    // חישוב סה"כ הקניות של כל השחקנים
    let totalPurchases = 0;
    playerTotalPurchasesMap.forEach(player => {
      totalPurchases += player.totalPurchaseAmount;
    });
    
    console.log(`סה"כ קניות של כל השחקנים: ${totalPurchases} ש"ח`);
    
    // המרת מיפוי הקבוצות למערך לצורך החזרה
    const groupsRebuyStats = Array.from(groupRebuyStatsMap.values());
    
    // הוספת לוג בסוף הפונקציה לפני החזרת התוצאות
    // כאן נמצא הקוד המקורי שמחזיר את תוצאות החישוב:
    // Add at the end of the function just before the return statement:
    // השורות הבאות יתווספו בסוף הפונקציה, ממש לפני ה-return

    // הוספת לוג של מספר קטן של נתונים מרכזיים
    try {
      const result = {
        // השורות הבאות יתווספו בסוף הפונקציה, ממש לפני ה-return
        totalRebuys,
        totalPurchases,
        averageRebuysPerGame,
        averageRebuysPerPlayer,
        averagePurchasesPerPlayer: totalParticipants > 0 ? totalPurchases / totalParticipants : 0,
        gamesCount, // הוספת מספר המשחקים הכולל
        // הוספת בדיקה האם קיימים נתוני שיאנים
        hasMostRebuyPlayer: !!playerWithMostRebuys?.playerName,
        hasMostTotalRebuyPlayer: !!playerWithMostTotalRebuys?.playerName,
        // מספר אובייקטים במערך קבוצות
        groupsCount: groupsRebuyStats?.length || 0
      };
      
      console.log('RebuyStatistics: סיכום נתונים מרכזיים:', JSON.stringify(result));
    } catch (logError) {
      console.error('RebuyStatistics: שגיאה בלוג הסיכום:', logError);
    }
    
    // בדיקת קיום שדות חיוניים לפני החזרה
    if (!totalRebuys && totalRebuys !== 0) {
      console.warn('RebuyStatistics: חסר נתון חיוני - totalRebuys');
    }
    
    // בדיקת תקינות המבנה של gameWithMostRebuys
    if (!gameWithMostRebuys || !gameWithMostRebuys.gameId) {
      console.warn('RebuyStatistics: חסר או לא תקין - gameWithMostRebuys');
    }
    
    // בדיקת תקינות המבנה של playerWithMostRebuys
    if (!playerWithMostRebuys || !playerWithMostRebuys.playerName) {
      console.warn('RebuyStatistics: חסר או לא תקין - playerWithMostRebuys');
    }
    
    // החזרת התוצאות
    const stats: RebuyStats = {
      totalRebuys,
      totalPurchases,
      averageRebuysPerGame: totalRebuys / gamesCount,
      averageRebuysPerPlayer: totalParticipants > 0 ? totalRebuys / totalParticipants : 0,
      averagePurchasesPerPlayer: totalParticipants > 0 ? totalPurchases / totalParticipants : 0,
      gamesCount,
      groupsRebuyStats: Array.from(groupRebuyStatsMap.values()),
      playerWithMostRebuys,
      playerWithMostTotalRebuys,
      playerWithLeastTotalRebuys,
      playerWithLowestRebuyAverage,
      playerWithHighestTotalPurchases,
      playerWithLowestTotalPurchases,
      playerWithHighestSingleGamePurchase,
      playerWithLargestSingleGameDifference,
      playerWithLargestCumulativeDifference,
      gameWithMostRebuys,
      gameWithLeastRebuys,
      gameWithMostPurchases,
      gameWithLeastPurchases
    };

    return stats;
  } catch (error) {
    console.error('Error getting rebuy statistics:', error);
    throw error;
  }
};