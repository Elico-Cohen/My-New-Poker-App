// src/services/statistics/playerStatistics.ts

import { Game } from '@/models/Game';
import { UserProfile } from '@/models/UserProfile';
import { 
  PlayerStats,
  WinnersLosersStats,
  ParticipationStats,
  StatisticsFilter
} from '@/models/Statistics';
import { formatGameDate, fetchAllGames, filterGames } from '../statistics/statisticsService';
import { store } from '@/store/AppStore';

console.log('playerStatistics: מנקה מטמון סטטיסטיקות כדי להבטיח שהשינויים יכנסו לתוקף');

// ביטול הקריאה ל-clearStatsCache כדי למנוע Require cycle
console.log('playerStatistics: initializing module');

/**
 * Calculate statistics for a specific player
 */
export const getPlayerStatistics = async (
  playerId: string,
  filter: StatisticsFilter = { timeFilter: 'all' }
): Promise<PlayerStats | null> => {
  try {
    const allGames = store.getGames();
    const filteredGames = filterGames(allGames, { ...filter, playerId });
    const allUsers = store.getUsers();
    const user = allUsers.find((u: UserProfile) => u.id === playerId);
    
    if (!user || filteredGames.length === 0) {
      return null;
    }
    
    // Initialize player statistics
    const playerStats: PlayerStats = {
      playerId,
      playerName: user.name,
      gamesPlayed: 0,
      winCount: 0,
      lossCount: 0,
      netProfit: 0,
      totalBuyIns: 0,
      totalRebuys: 0,
      totalInvestment: 0,
      totalReturn: 0,
      winRate: 0,
      roi: 0,
      avgProfitPerGame: 0
    };
    
    // Process each game the player participated in
    filteredGames.forEach(game => {
      const playerInGame = game.players?.find(p => 
        p.userId === playerId || p.id === playerId
      );
      
      if (!playerInGame) return;
      
      // Update games played
      playerStats.gamesPlayed++;
      
      // Calculate investment
      const buyInAmount = (playerInGame.buyInCount || 0) * (game.buyInSnapshot?.amount || 0);
      const rebuyAmount = (playerInGame.rebuyCount || 0) * (game.rebuySnapshot?.amount || 0);
      const totalInvestment = buyInAmount + rebuyAmount;
      
      playerStats.totalBuyIns += playerInGame.buyInCount || 0;
      playerStats.totalRebuys += playerInGame.rebuyCount || 0;
      playerStats.totalInvestment += totalInvestment;
      
      // Calculate return and profit
      const finalResult = playerInGame.finalResultMoney || 0;
      playerStats.totalReturn += finalResult + totalInvestment; // Add investment back to get total return
      playerStats.netProfit += finalResult;
      
      // Update win/loss count
      if (finalResult > 0) {
        playerStats.winCount++;
        
        // Check if this is the best game
        if (!playerStats.bestGame || finalResult > playerStats.bestGame.profit) {
          playerStats.bestGame = {
            gameId: game.id,
            date: formatGameDate((game as any).gameDate || game.date),
            profit: finalResult
          };
        }
      } else if (finalResult < 0) {
        playerStats.lossCount++;
        
        // Check if this is the worst game
        if (!playerStats.worstGame || finalResult < playerStats.worstGame.loss) {
          playerStats.worstGame = {
            gameId: game.id,
            date: formatGameDate((game as any).gameDate || game.date),
            loss: finalResult
          };
        }
      }
    });
    
    // Calculate derived statistics
    if (playerStats.gamesPlayed > 0) {
      playerStats.winRate = (playerStats.winCount / playerStats.gamesPlayed) * 100;
      playerStats.avgProfitPerGame = playerStats.netProfit / playerStats.gamesPlayed;
    }
    
    if (playerStats.totalInvestment > 0) {
      playerStats.roi = (playerStats.netProfit / playerStats.totalInvestment) * 100;
    }
    
    return playerStats;
  } catch (error) {
    console.error('Error getting player statistics:', error);
    throw error;
  }
};

/**
 * Get winners and losers statistics
 */
export const getWinnersLosersStatistics = async (
  limit: number = 5,
  filter: StatisticsFilter = { timeFilter: 'all' }
): Promise<WinnersLosersStats> => {
  try {
    console.log('PlayerStatistics: מביא נתוני מנצחים ומפסידים מהמאגר המרכזי');
    const allGames = store.getGames();
    const filteredGames = filterGames(allGames, filter);
    const allUsers = store.getUsers();
    
    console.log(`PlayerStatistics: מעבד ${filteredGames.length} משחקים עבור סטטיסטת מנצחים/מפסידים`);
    
    // קבלת השחקנים הקבועים של הקבוצה אם יש סינון לפי קבוצה
    let permanentPlayersInGroup: Set<string> | null = null;
    if (filter.groupId && filter.groupId !== 'all') {
      const group = store.getGroup(filter.groupId);
      if (group && group.permanentPlayers) {
        permanentPlayersInGroup = new Set(group.permanentPlayers);
        console.log(`PlayerStatistics: מסנן לפי קבוצה ${group.name}, שחקנים קבועים: ${group.permanentPlayers.length}`);
      }
    }
    
    // מפה לשמירת כל הנתונים של כל שחקן
    const playerStatsMap = new Map<string, {
      playerId: string;
      playerName: string;
      gamesPlayed: number;
      gamesWon: number;
      bestSingleGameProfit: number;
      bestSingleGameId: string;
      bestSingleGameDate: string;
      cumulativeProfit: number;
      winRate: number;
    }>();
    
    // עיבוד המשחקים
    filteredGames.forEach(game => {
      game.players?.forEach(player => {
        const playerId = player.userId || player.id;
        if (!playerId) return;
        
        // אם יש סינון לפי קבוצה, כלול רק שחקנים קבועים
        if (permanentPlayersInGroup && !permanentPlayersInGroup.has(playerId)) {
          return; // דלג על שחקן שאינו קבוע בקבוצה
        }
        
        const playerName = player.name || 
          allUsers.find(u => u.id === playerId)?.name || 
          'לא ידוע';
        
        const finalResult = player.finalResultMoney || 0;
        
        // יצירת או עדכון נתוני השחקן
        let playerStats = playerStatsMap.get(playerId);
        if (!playerStats) {
          playerStats = {
            playerId,
            playerName,
            gamesPlayed: 0,
            gamesWon: 0,
            bestSingleGameProfit: -Infinity,
            bestSingleGameId: '',
            bestSingleGameDate: '',
            cumulativeProfit: 0,
            winRate: 0
          };
          playerStatsMap.set(playerId, playerStats);
        }
        
        // עדכון הנתונים
        playerStats.gamesPlayed++;
        playerStats.cumulativeProfit += finalResult;
        
        if (finalResult > 0) {
          playerStats.gamesWon++;
          if (finalResult > playerStats.bestSingleGameProfit) {
            playerStats.bestSingleGameProfit = finalResult;
            playerStats.bestSingleGameId = game.id;
            playerStats.bestSingleGameDate = formatGameDate(game.date);
          }
        }
        else if (finalResult < 0) {
          if (playerStats.bestSingleGameProfit === -Infinity || finalResult > playerStats.bestSingleGameProfit) {
            playerStats.bestSingleGameProfit = finalResult;
            playerStats.bestSingleGameId = game.id;
            playerStats.bestSingleGameDate = formatGameDate(game.date);
          }
        }
        else {
          if (playerStats.bestSingleGameProfit === -Infinity || 0 > playerStats.bestSingleGameProfit) {
            playerStats.bestSingleGameProfit = 0;
            playerStats.bestSingleGameId = game.id;
            playerStats.bestSingleGameDate = formatGameDate(game.date);
          }
        }
        
        // חישוב אחוז הצלחה - מתוך המשחקים שהשחקן שיחק
        playerStats.winRate = (playerStats.gamesWon / playerStats.gamesPlayed) * 100;
      });
    });
    
    // המרת המפה לרשימות ממוינות
    const allPlayers = Array.from(playerStatsMap.values());
    
    // מיון לפי רווח במשחק בודד
    const bestSingleGamePlayers = [...allPlayers]
      .sort((a, b) => b.bestSingleGameProfit - a.bestSingleGameProfit);
    
    // מיון לפי רווח מצטבר
    const bestCumulativePlayers = [...allPlayers]
      .sort((a, b) => b.cumulativeProfit - a.cumulativeProfit);
    
    // מיון לפי מספר משחקים ברווח
    const mostWinningGamesPlayers = [...allPlayers]
      .sort((a, b) => b.gamesWon - a.gamesWon);
    
    // מיון לפי אחוז משחקים ברווח
    const bestWinRatePlayers = [...allPlayers]
      .sort((a, b) => b.winRate - a.winRate);
    
    return {
      bestSingleGamePlayers,
      bestCumulativePlayers,
      mostWinningGamesPlayers,
      bestWinRatePlayers,
      totalPlayers: allPlayers.length,
      totalGames: filteredGames.length
    };
  } catch (error) {
    console.error('Error getting winners/losers statistics:', error);
    throw error;
  }
};

/**
 * Get player participation statistics
 */
export const getParticipationStatistics = async (
  filter: StatisticsFilter = { timeFilter: 'all' }
): Promise<ParticipationStats> => {
  try {
    console.log('playerStatistics: התחלת חישוב סטטיסטיקות השתתפות');
    console.log('playerStatistics: פילטר שהתקבל:', JSON.stringify(filter));
    console.log('playerStatistics: ערכי פילטר ספציפיים:', {
      timeFilter: filter.timeFilter,
      groupId: filter.groupId,
      statuses: filter.statuses
    });
    
    console.log('playerStatistics: מביא משחקים מהמאגר המרכזי');
    const allGames = store.getGames();
    console.log(`playerStatistics: התקבלו ${allGames.length} משחקים מהמאגר המרכזי`);
    
    // בדיקה מהירה של הנתונים שהתקבלו
    if (allGames.length === 0) {
      console.error('playerStatistics: לא התקבלו משחקים מהמאגר המרכזי');
      return {
        playerParticipation: [],
        mostActivePlayerCount: 0,
        leastActivePlayerCount: 0
      };
    }
    
    console.log('playerStatistics: מפעיל סינון משחקים עם הפילטרים:', {
      timeFilter: filter.timeFilter,
      groupId: filter.groupId ? `${filter.groupId} (יסנן רק משחקים של הקבוצה הזו)` : 'ללא סינון קבוצה',
      statuses: filter.statuses ? filter.statuses.join(',') : 'ברירת מחדל'
    });
    
    // ודא שפילטר עם ערכים תקינים מועבר לפונקציית filterGames
    const filterToApply: StatisticsFilter = {
      ...filter,
      // אם לא סופק timeFilter, השתמש ב-'all' כברירת מחדל
      timeFilter: filter.timeFilter || 'all',
      // אם groupId הוא 'all', שלח undefined כדי לקבל את כל הקבוצות
      groupId: filter.groupId === 'all' ? undefined : filter.groupId,
      // ודא שיש סטטוסים לסינון
      statuses: filter.statuses || ['completed', 'final_results']
    };
    
    console.log('playerStatistics: פילטר מתוקן שמועבר לפונקציית filterGames:', JSON.stringify(filterToApply));
    const filteredGames = filterGames(allGames, filterToApply);
    console.log(`playerStatistics: לאחר סינון נשארו ${filteredGames.length} משחקים`);
    
    // בדיקת המשחקים שנשארו אחרי הסינון
    if (filteredGames.length > 0 && filteredGames.length < 10) {
      console.log("playerStatistics: פרטי המשחקים שנשארו אחרי הסינון:");
      filteredGames.forEach((game, index) => {
        const dateStr = game.date 
          ? `${game.date.day}/${game.date.month}/${game.date.year}` 
          : 'ללא תאריך';
        console.log(`משחק ${index + 1}: ID=${game.id}, תאריך=${dateStr}, קבוצה=${game.groupId || 'ללא קבוצה'}, שחקנים=${game.players?.length || 0}`);
      });
    }
    
    // בדיקה מהירה של הנתונים שהתקבלו אחרי סינון
    if (filteredGames.length === 0) {
      console.warn('playerStatistics: לא נשארו משחקים אחרי סינון, מחזיר מידע ריק');
      return {
        playerParticipation: [],
        mostActivePlayerCount: 0,
        leastActivePlayerCount: 0
      };
    }
    
    console.log('playerStatistics: מביא רשימת שחקנים מהמאגר המרכזי');
    const allUsers = store.getUsers();
    console.log(`playerStatistics: התקבלו ${allUsers.length} שחקנים מהמאגר המרכזי`);
    
    // אם יש סינון לפי קבוצה, צריך להביא את רשימת השחקנים בקבוצה
    const relevantGroups = filter.groupId 
      ? [store.getGroup(filter.groupId)].filter(Boolean) 
      : [];
    
    // מערך שחקנים רלוונטיים לקבוצה - ריק אם אין סינון לפי קבוצה
    const groupPlayerIds: Set<string> = new Set();
    
    // אם סוננו לפי קבוצה, קבל את כל השחקנים בקבוצה
    if (filter.groupId && relevantGroups.length > 0) {
      const group = relevantGroups[0];
      if (group) {  // וודא שה-group אינו undefined
        console.log(`playerStatistics: סינון לפי קבוצה ${group.name} (${group.id})`);
        
        // הוסף רק שחקנים קבועים בקבוצה (לא אורחים)
        if (group.permanentPlayers) {
          group.permanentPlayers.forEach(playerId => groupPlayerIds.add(playerId));
          console.log(`playerStatistics: נוספו ${group.permanentPlayers.length} שחקנים קבועים לקבוצה`);
        }
        
        console.log(`playerStatistics: נמצאו ${groupPlayerIds.size} שחקנים קבועים בקבוצה`);
      } else {
        console.warn(`playerStatistics: לא נמצאה קבוצה עם מזהה ${filter.groupId}`);
      }
    }
    
    // יצירת מפה של השתתפות שחקנים
    const playerParticipationMap = new Map<string, {
      playerId: string;
      playerName: string;
      gamesPlayed: number;
      buyInCount: number;
      rebuyCount: number;
      totalMoney: number;
      attendanceRate: number;
      isActiveInGroup: boolean; // האם שחקן פעיל בקבוצה הנבחרת
    }>();
    
    // אתחול המפה עם כל השחקנים או רק שחקני הקבוצה אם יש סינון
    const relevantUsers = filter.groupId
      ? allUsers.filter(user => groupPlayerIds.has(user.id))
      : allUsers;
    
    if (filter.groupId) {
      console.log(`playerStatistics: אתחול שחקנים - ${relevantUsers.length} שחקנים רלוונטיים לקבוצה מתוך ${allUsers.length} סה"כ`);
    } else {
      console.log(`playerStatistics: אתחול כל השחקנים - ${allUsers.length}`);
    }
    
    relevantUsers.forEach(user => {
      playerParticipationMap.set(user.id, {
        playerId: user.id,
        playerName: user.name,
        gamesPlayed: 0,
        buyInCount: 0,
        rebuyCount: 0,
        totalMoney: 0,
        attendanceRate: 0,
        isActiveInGroup: filter.groupId ? groupPlayerIds.has(user.id) : false
      });
    });
    
    // מעקב אחר שחקנים שהשתתפו במשחקים של הקבוצה אך לא מוגדרים כחלק ממנה
    const playersInGames = new Set<string>();
    
    // Count game participation
    filteredGames.forEach((game, index) => {
      if (!game.players || game.players.length === 0) {
        console.warn(`playerStatistics: משחק ${game.id} ללא שחקנים, מדלג`);
        return;
      }
      
      console.log(`playerStatistics: מעבד משחק ${index + 1}/${filteredGames.length}, מזהה: ${game.id}, מספר שחקנים: ${game.players.length}`);
      
      game.players.forEach(player => {
        const playerId = player.userId || player.id;
        if (!playerId) {
          console.warn('playerStatistics: שחקן ללא מזהה במשחק, מדלג');
          return;
        }
        
        // רשום ששחקן זה השתתף במשחק, לשימוש בסינון לאחר מכן
        playersInGames.add(playerId);
        
        const participation = playerParticipationMap.get(playerId);
        if (participation) {
          participation.gamesPlayed++;
          participation.buyInCount += player.buyInCount || 0;
          participation.rebuyCount += player.rebuyCount || 0;
          participation.totalMoney += player.finalResultMoney || 0;
        } else if (filter.groupId) {
          // במקרה של סינון לפי קבוצה, נוסיף שחקנים שהשתתפו במשחקים גם אם לא חלק מהקבוצה
          console.log(`playerStatistics: נמצא שחקן שהשתתף במשחקי הקבוצה אך לא מוגדר בה: ${player.name || playerId}`);
          playerParticipationMap.set(playerId, {
            playerId,
            playerName: player.name || 'לא ידוע',
            gamesPlayed: 1,
            buyInCount: player.buyInCount || 0,
            rebuyCount: player.rebuyCount || 0,
            totalMoney: player.finalResultMoney || 0,
            attendanceRate: 0,
            isActiveInGroup: false
          });
        } else {
          // שחקן שלא נמצא במערכת אך השתתף במשחקים
          console.log(`playerStatistics: נמצא שחקן שאינו ברשימת השחקנים המרכזית: ${player.name || playerId}`);
          playerParticipationMap.set(playerId, {
            playerId,
            playerName: player.name || 'לא ידוע',
            gamesPlayed: 1,
            buyInCount: player.buyInCount || 0,
            rebuyCount: player.rebuyCount || 0,
            totalMoney: player.finalResultMoney || 0,
            attendanceRate: 0,
            isActiveInGroup: false
          });
        }
      });
    });
    
    // בסינון לפי קבוצה - וודא שמצוינים רק שחקנים רלוונטיים:
    // - שחקנים השייכים לקבוצה (קבועים או אורחים)
    // - שחקנים שהשתתפו במשחקי הקבוצה
    if (filter.groupId) {
      // סנן שחקנים לא רלוונטיים
      for (const [playerId, data] of playerParticipationMap.entries()) {
        if (!data.isActiveInGroup && !playersInGames.has(playerId)) {
          console.log(`playerStatistics: מסיר שחקן ${data.playerName} שאינו פעיל בקבוצה ולא השתתף במשחקים`);
          playerParticipationMap.delete(playerId);
        }
      }
      console.log(`playerStatistics: לאחר סינון נשארו ${playerParticipationMap.size} שחקנים רלוונטיים`);
    }
    
    console.log('playerStatistics: מחשב אחוזי השתתפות וממיין תוצאות');
    // Calculate participation rates and sort
    const totalGames = filteredGames.length;
    const playerParticipation = Array.from(playerParticipationMap.values())
      .map(participation => ({
        playerId: participation.playerId,
        playerName: participation.playerName,
        gamesCount: participation.gamesPlayed,
        participationRate: totalGames > 0 ? (participation.gamesPlayed / totalGames) * 100 : 0
      }))
      .sort((a, b) => b.gamesCount - a.gamesCount);
    
    // Calculate most and least active player counts
    const mostActivePlayerCount = playerParticipation.length > 0 ? 
      playerParticipation[0].gamesCount : 0;
    const leastActivePlayerCount = playerParticipation.length > 0 ? 
      playerParticipation[playerParticipation.length - 1].gamesCount : 0;
    
    console.log(`playerStatistics: סיום חישוב סטטיסטיקות - ${playerParticipation.length} שחקנים`);
    return {
      playerParticipation,
      mostActivePlayerCount,
      leastActivePlayerCount
    };
  } catch (error) {
    console.error('playerStatistics: שגיאה בחישוב סטטיסטיקות השתתפות:', error);
    throw error;
  }
};