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
            date: formatGameDate(game.date),
            profit: finalResult
          };
        }
      } else if (finalResult < 0) {
        playerStats.lossCount++;
        
        // Check if this is the worst game
        if (!playerStats.worstGame || finalResult < playerStats.worstGame.loss) {
          playerStats.worstGame = {
            gameId: game.id,
            date: formatGameDate(game.date),
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
    // קבלת נתונים מהמאגר המרכזי במקום מפיירבייס ישירות
    const allGames = store.getGames();
    const filteredGames = filterGames(allGames, filter);
    const allUsers = store.getUsers();
    
    console.log(`PlayerStatistics: מעבד ${filteredGames.length} משחקים עבור סטטיסטיקת מנצחים/מפסידים`);
    
    // Maps to track accumulated stats for each player
    const playerWinningsMap = new Map<string, {
      playerId: string;
      playerName: string;
      netProfit: number;
      gamesPlayed: number;
      winsCount: number;
    }>();
    
    const playerLossesMap = new Map<string, {
      playerId: string;
      playerName: string;
      netLoss: number;
      gamesPlayed: number;
      lossesCount: number;
    }>();
    
    // Track biggest single game win/loss
    let biggestWin = { playerId: '', playerName: '', gameId: '', date: '', amount: 0 };
    let biggestLoss = { playerId: '', playerName: '', gameId: '', date: '', amount: 0 };
    
    // Process games
    filteredGames.forEach(game => {
      game.players?.forEach(player => {
        const playerId = player.userId || player.id;
        if (!playerId) return;
        
        const playerName = player.name || 
          allUsers.find(u => u.id === playerId)?.name || 
          'לא ידוע';
        
        const finalResult = player.finalResultMoney || 0;
        
        // Update player in appropriate map
        if (finalResult > 0) {
          // Handle winners
          let playerWinnings = playerWinningsMap.get(playerId);
          if (!playerWinnings) {
            playerWinnings = { 
              playerId, 
              playerName, 
              netProfit: 0, 
              gamesPlayed: 0,
              winsCount: 0
            };
            playerWinningsMap.set(playerId, playerWinnings);
          }
          
          playerWinnings.netProfit += finalResult;
          playerWinnings.gamesPlayed++;
          playerWinnings.winsCount++;
          
          // Check if this is the biggest win
          if (finalResult > biggestWin.amount) {
            biggestWin = {
              playerId,
              playerName,
              gameId: game.id,
              date: formatGameDate(game.date),
              amount: finalResult
            };
          }
        } else if (finalResult < 0) {
          // Handle losers
          let playerLosses = playerLossesMap.get(playerId);
          if (!playerLosses) {
            playerLosses = { 
              playerId, 
              playerName, 
              netLoss: 0, 
              gamesPlayed: 0,
              lossesCount: 0
            };
            playerLossesMap.set(playerId, playerLosses);
          }
          
          playerLosses.netLoss += Math.abs(finalResult);
          playerLosses.gamesPlayed++;
          playerLosses.lossesCount++;
          
          // Check if this is the biggest loss
          if (Math.abs(finalResult) > biggestLoss.amount) {
            biggestLoss = {
              playerId,
              playerName,
              gameId: game.id,
              date: formatGameDate(game.date),
              amount: Math.abs(finalResult)
            };
          }
        }
      });
    });
    
    // Sort and limit winners and losers
    const topWinners = Array.from(playerWinningsMap.values())
      .map(player => ({
        playerId: player.playerId,
        playerName: player.playerName,
        netProfit: player.netProfit,
        winRate: player.gamesPlayed > 0 ? 
          (player.winsCount / player.gamesPlayed) * 100 : 0
      }))
      .sort((a, b) => b.netProfit - a.netProfit)
      .slice(0, limit);
    
    const topLosers = Array.from(playerLossesMap.values())
      .map(player => ({
        playerId: player.playerId,
        playerName: player.playerName,
        netLoss: player.netLoss,
        lossRate: player.gamesPlayed > 0 ? 
          (player.lossesCount / player.gamesPlayed) * 100 : 0
      }))
      .sort((a, b) => b.netLoss - a.netLoss)
      .slice(0, limit);
    
    return {
      topWinners,
      topLosers,
      biggestWin,
      biggestLoss
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
    const allGames = store.getGames();
    const filteredGames = filterGames(allGames, filter);
    const allUsers = store.getUsers();
    
    // Maps to track player participation
    const playerParticipationMap = new Map<string, {
      playerId: string;
      playerName: string;
      gamesPlayed: number;
      buyInCount: number;
      rebuyCount: number;
      totalMoney: number;
      attendanceRate: number;
    }>();
    
    // Initialize map with all players
    allUsers.forEach((user: UserProfile) => {
      playerParticipationMap.set(user.id, {
        playerId: user.id,
        playerName: user.name || 'Unknown',
        gamesPlayed: 0,
        buyInCount: 0,
        rebuyCount: 0,
        totalMoney: 0,
        attendanceRate: 0
      });
    });
    
    // Count game participation
    filteredGames.forEach(game => {
      game.players?.forEach(player => {
        const playerId = player.userId || player.id;
        if (!playerId) return;
        
        const participation = playerParticipationMap.get(playerId);
        if (participation) {
          participation.gamesPlayed++;
          participation.buyInCount += player.buyInCount || 0;
          participation.rebuyCount += player.rebuyCount || 0;
          participation.totalMoney += player.finalResultMoney || 0;
        } else {
          // Handle players that might not be in allUsers
          playerParticipationMap.set(playerId, {
            playerId,
            playerName: player.name || 'לא ידוע',
            gamesPlayed: 1,
            buyInCount: player.buyInCount || 0,
            rebuyCount: player.rebuyCount || 0,
            totalMoney: player.finalResultMoney || 0,
            attendanceRate: 0
          });
        }
      });
    });
    
    // Calculate participation rates and sort
    const totalGames = filteredGames.length;
    const playerParticipation = Array.from(playerParticipationMap.values())
      .filter(player => player.gamesPlayed > 0) // Only include players who played at least one game
      .map(player => ({
        playerId: player.playerId,
        playerName: player.playerName,
        gamesCount: player.gamesPlayed,
        participationRate: totalGames > 0 ? 
          (player.gamesPlayed / totalGames) * 100 : 0
      }))
      .sort((a, b) => b.gamesCount - a.gamesCount);
    
    // Find most and least active player counts
    const mostActivePlayerCount = playerParticipation.length > 0 ? 
      playerParticipation[0].gamesCount : 0;
    
    const leastActivePlayerCount = playerParticipation.length > 0 ? 
      playerParticipation[playerParticipation.length - 1].gamesCount : 0;
    
    return {
      playerParticipation,
      mostActivePlayerCount,
      leastActivePlayerCount
    };
  } catch (error) {
    console.error('Error getting participation statistics:', error);
    throw error;
  }
};