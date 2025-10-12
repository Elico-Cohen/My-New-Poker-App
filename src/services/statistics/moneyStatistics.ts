// src/services/statistics/moneyStatistics.ts

import { Game, PlayerInGame } from '@/models/Game';
import { StatisticsFilter } from '@/models/Statistics';
import { fetchAllGames, filterGames } from './statisticsService';
import { getAllUsers } from '@/services/users';
import { getAllActiveGroups } from '@/services/groups';

// Cache for expensive operations
const statsCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Detailed money statistics for players
 */
export interface PlayerMoneyStats {
  playerId: string;
  playerName: string;
  totalInvestment: number;
  totalEarnings: number;
  netProfit: number;
  roi: number; // Return on Investment as percentage
  profitPerGame: number;
  gamesPlayed: number;
  profitableGames: number;
  profitability: number; // Percentage of profitable games
}

/**
 * Money flow statistics
 */
export interface MoneyFlowStats {
  totalMoneyInvested: number;
  buyInTotal: number;
  rebuyTotal: number;
  buyInRebuyRatio: number;
  averageInvestmentPerPlayer: number;
  averageInvestmentPerGame: number;
  largestSingleGamePool: {
    gameId: string;
    date: string;
    amount: number;
    playerCount: number;
  };
  monthlyInvestment: {
    month: string;
    amount: number;
    buyIn: number;
    rebuy: number;
  }[];
  investmentByGroup?: {
    groupId: string;
    groupName: string;
    totalInvestment: number;
    averagePerGame: number;
  }[];
}

/**
 * Get detailed money statistics for players
 */
export const getPlayerMoneyStats = async (
  filter: StatisticsFilter = { timeFilter: 'all' }
): Promise<PlayerMoneyStats[]> => {
  try {
    // Create a cache key based on filter
    const cacheKey = `playerMoneyStats_${JSON.stringify(filter)}`;
    const cachedData = statsCache.get(cacheKey);
    
    if (cachedData && (Date.now() - cachedData.timestamp < CACHE_EXPIRY)) {
      console.log('Using cached player money stats');
      return cachedData.data;
    }
    
    const allGames = await fetchAllGames();
    const filteredGames = filterGames(allGames, filter);
    const allUsers = await getAllUsers();
    
    // קבלת השחקנים הקבועים של הקבוצה אם יש סינון לפי קבוצה
    let permanentPlayersInGroup: Set<string> | null = null;
    if (filter.groupId && filter.groupId !== 'all') {
      const allGroups = await getAllActiveGroups();
      const group = allGroups.find(g => g.id === filter.groupId);
      if (group && group.permanentPlayers) {
        permanentPlayersInGroup = new Set(group.permanentPlayers);
        console.log(`getPlayerMoneyStats: מסנן לפי קבוצה ${group.name}, שחקנים קבועים: ${group.permanentPlayers.length}`);
      }
    }
    
    // Track statistics for each player
    const playerStatsMap = new Map<string, {
      playerId: string;
      playerName: string;
      totalInvestment: number;
      totalEarnings: number;
      gamesPlayed: number;
      profitableGames: number;
    }>();
    
    // Process each game
    filteredGames.forEach(game => {
      game.players?.forEach(player => {
        const playerId = player.userId || player.id;
        if (!playerId) return;
        
        // אם יש סינון לפי קבוצה, כלול רק שחקנים קבועים
        if (permanentPlayersInGroup && !permanentPlayersInGroup.has(playerId)) {
          return; // דלג על שחקן שאינו קבוע בקבוצה
        }
        
        // Get player name
        const playerName = player.name || 
          allUsers.find(u => u.id === playerId)?.name || 
          'לא ידוע';
        
        // Get or initialize player stats
        const playerStats = playerStatsMap.get(playerId) || {
          playerId,
          playerName,
          totalInvestment: 0,
          totalEarnings: 0,
          gamesPlayed: 0,
          profitableGames: 0
        };
        
        // Calculate investment for this game
        const buyInAmount = (player.buyInCount || 0) * (game.buyInSnapshot?.amount || 0);
        const rebuyAmount = (player.rebuyCount || 0) * (game.rebuySnapshot?.amount || 0);
        const gameInvestment = buyInAmount + rebuyAmount;
        
        // Add to total investment
        playerStats.totalInvestment += gameInvestment;
        
        // Calculate earnings (final result + investment)
        const finalResult = player.finalResultMoney || 0;
        const gameEarnings = finalResult + gameInvestment;
        
        // Add to total earnings
        playerStats.totalEarnings += gameEarnings;
        
        // Count games and profitable games
        playerStats.gamesPlayed++;
        if (finalResult > 0) {
          playerStats.profitableGames++;
        }
        
        // Update player stats
        playerStatsMap.set(playerId, playerStats);
      });
    });
    
    // Calculate derived statistics and convert to array
    const playerStats = Array.from(playerStatsMap.values())
      .map(stats => {
        const netProfit = stats.totalEarnings - stats.totalInvestment;
        const roi = stats.totalInvestment > 0 ? 
          (netProfit / stats.totalInvestment) * 100 : 0;
        const profitPerGame = stats.gamesPlayed > 0 ? 
          netProfit / stats.gamesPlayed : 0;
        const profitability = stats.gamesPlayed > 0 ? 
          (stats.profitableGames / stats.gamesPlayed) * 100 : 0;
        
        return {
          ...stats,
          netProfit,
          roi,
          profitPerGame,
          profitability
        };
      })
      .sort((a, b) => b.netProfit - a.netProfit);
    
    // Cache the result
    statsCache.set(cacheKey, {
      data: playerStats,
      timestamp: Date.now()
    });
    
    return playerStats;
  } catch (error) {
    console.error('Error getting player money statistics:', error);
    throw error;
  }
};

/**
 * Get money flow statistics
 */
export const getMoneyFlowStats = async (
  filter: StatisticsFilter = { timeFilter: 'all' }
): Promise<MoneyFlowStats> => {
  try {
    // Create a cache key based on filter
    const cacheKey = `moneyFlowStats_${JSON.stringify(filter)}`;
    const cachedData = statsCache.get(cacheKey);
    
    if (cachedData && (Date.now() - cachedData.timestamp < CACHE_EXPIRY)) {
      console.log('Using cached money flow stats');
      return cachedData.data;
    }
    
    const allGames = await fetchAllGames();
    const filteredGames = filterGames(allGames, filter);
    const groups = await getAllActiveGroups();
    
    // Initialize statistics
    let totalMoneyInvested = 0;
    let buyInTotal = 0;
    let rebuyTotal = 0;
    let playerInvestmentCount = 0;
    let largestSingleGamePool = {
      gameId: '',
      date: '',
      amount: 0,
      playerCount: 0
    };
    
    // Track monthly investment
    const monthlyInvestmentMap = new Map<string, {
      amount: number;
      buyIn: number;
      rebuy: number;
    }>();
    
    // Track investment by group
    const groupInvestmentMap = new Map<string, {
      groupId: string;
      groupName: string;
      totalInvestment: number;
      gameCount: number;
    }>();
    
    // Initialize group tracking
    groups.forEach(group => {
      groupInvestmentMap.set(group.id, {
        groupId: group.id,
        groupName: group.name,
        totalInvestment: 0,
        gameCount: 0
      });
    });
    
    // Process each game
    filteredGames.forEach(game => {
      // Get month key
      let monthKey = 'unknown';
      let gameDate = '';
      
      if (game.date?.month && game.date?.year) {
        monthKey = `${String(game.date.month).padStart(2, '0')}/${game.date.year}`;
        gameDate = `${game.date.day}/${game.date.month}/${game.date.year}`;
      } else if (game.createdAt) {
        const date = new Date(game.createdAt);
        monthKey = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
        gameDate = date.toLocaleDateString('he-IL');
      }
      
      // Get or initialize monthly investment
      const monthlyInvestment = monthlyInvestmentMap.get(monthKey) || {
        amount: 0,
        buyIn: 0,
        rebuy: 0
      };
      
      // Calculate game investment
      let gameInvestment = 0;
      let gameBuyIn = 0;
      let gameRebuy = 0;
      
      game.players?.forEach(player => {
        const buyInAmount = (player.buyInCount || 0) * (game.buyInSnapshot?.amount || 0);
        const rebuyAmount = (player.rebuyCount || 0) * (game.rebuySnapshot?.amount || 0);
        
        gameInvestment += buyInAmount + rebuyAmount;
        gameBuyIn += buyInAmount;
        gameRebuy += rebuyAmount;
        
        // Add to totals
        totalMoneyInvested += buyInAmount + rebuyAmount;
        buyInTotal += buyInAmount;
        rebuyTotal += rebuyAmount;
        playerInvestmentCount++;
      });
      
      // Update monthly investment
      monthlyInvestment.amount += gameInvestment;
      monthlyInvestment.buyIn += gameBuyIn;
      monthlyInvestment.rebuy += gameRebuy;
      monthlyInvestmentMap.set(monthKey, monthlyInvestment);
      
      // Update group investment if applicable
      if (game.groupId) {
        const groupInvestment = groupInvestmentMap.get(game.groupId);
        if (groupInvestment) {
          groupInvestment.totalInvestment += gameInvestment;
          groupInvestment.gameCount++;
        }
      }
      
      // Check if this is the largest game pool
      if (gameInvestment > largestSingleGamePool.amount) {
        largestSingleGamePool = {
          gameId: game.id,
          date: gameDate,
          amount: gameInvestment,
          playerCount: game.players?.length || 0
        };
      }
    });
    
    // Convert monthly investment to array and sort
    const monthlyInvestment = Array.from(monthlyInvestmentMap.entries())
      .map(([month, stats]) => ({
        month,
        amount: stats.amount,
        buyIn: stats.buyIn,
        rebuy: stats.rebuy
      }))
      .sort((a, b) => {
        // Parse month strings (MM/YYYY)
        const [aMonth, aYear] = a.month.split('/').map(Number);
        const [bMonth, bYear] = b.month.split('/').map(Number);
        
        if (aYear !== bYear) return aYear - bYear;
        return aMonth - bMonth;
      });
    
    // Convert group investment to array, calculate averages, and sort
    const investmentByGroup = Array.from(groupInvestmentMap.values())
      .filter(stats => stats.gameCount > 0)
      .map(stats => ({
        groupId: stats.groupId,
        groupName: stats.groupName,
        totalInvestment: stats.totalInvestment,
        averagePerGame: stats.gameCount > 0 ? 
          stats.totalInvestment / stats.gameCount : 0
      }))
      .sort((a, b) => b.totalInvestment - a.totalInvestment);
    
    // Calculate averages
    const averageInvestmentPerPlayer = playerInvestmentCount > 0 ? 
      totalMoneyInvested / playerInvestmentCount : 0;
    
    const averageInvestmentPerGame = filteredGames.length > 0 ? 
      totalMoneyInvested / filteredGames.length : 0;
    
    const buyInRebuyRatio = buyInTotal > 0 ? 
      rebuyTotal / buyInTotal : 0;
    
    const result: MoneyFlowStats = {
      totalMoneyInvested,
      buyInTotal,
      rebuyTotal,
      buyInRebuyRatio,
      averageInvestmentPerPlayer,
      averageInvestmentPerGame,
      largestSingleGamePool,
      monthlyInvestment,
      investmentByGroup: !filter.groupId ? investmentByGroup : undefined
    };
    
    // Cache the result
    statsCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    return result;
  } catch (error) {
    console.error('Error getting money flow statistics:', error);
    throw error;
  }
};

/**
 * Get money distribution statistics
 */
export const getMoneyDistributionStats = async (
  filter: StatisticsFilter = { timeFilter: 'all' }
): Promise<{
  buyInRebuyDistribution: { type: string; amount: number }[];
  investmentRanges: { range: string; count: number; percentage: number }[];
  earningsRanges: { range: string; count: number; percentage: number }[];
  profitabilityDistribution: { profitability: string; count: number }[];
}> => {
  try {
    // Create a cache key based on filter
    const cacheKey = `moneyDistributionStats_${JSON.stringify(filter)}`;
    const cachedData = statsCache.get(cacheKey);
    
    if (cachedData && (Date.now() - cachedData.timestamp < CACHE_EXPIRY)) {
      console.log('Using cached money distribution stats');
      return cachedData.data;
    }
    
    const allGames = await fetchAllGames();
    const filteredGames = filterGames(allGames, filter);
    
    // Initialize statistics
    let buyInTotal = 0;
    let rebuyTotal = 0;
    
    // Define ranges for investment
    const investmentRanges = [
      { min: 0, max: 25, label: '0-25 ₪' },
      { min: 25, max: 50, label: '25-50 ₪' },
      { min: 50, max: 75, label: '50-75 ₪' },
      { min: 75, max: 100, label: '75-100 ₪' },
      { min: 100, max: 150, label: '100-150 ₪' },
      { min: 150, max: 200, label: '150-200 ₪' },
      { min: 200, max: Infinity, label: '200+ ₪' }
    ];
    const investmentDistributionMap = new Map<string, number>();
    
    // Define ranges for earnings (include negative ranges)
    const earningsRanges = [
      { min: -Infinity, max: -200, label: 'הפסד 200+ ₪' },
      { min: -200, max: -100, label: 'הפסד 100-200 ₪' },
      { min: -100, max: -50, label: 'הפסד 50-100 ₪' },
      { min: -50, max: 0, label: 'הפסד 0-50 ₪' },
      { min: 0, max: 50, label: 'רווח 0-50 ₪' },
      { min: 50, max: 100, label: 'רווח 50-100 ₪' },
      { min: 100, max: 200, label: 'רווח 100-200 ₪' },
      { min: 200, max: Infinity, label: 'רווח 200+ ₪' }
    ];
    const earningsDistributionMap = new Map<string, number>();
    
    // Define profitability ranges
    const profitabilityRanges = [
      { min: -Infinity, max: -50, label: 'הפסד יותר מ-50%' },
      { min: -50, max: -20, label: 'הפסד 20-50%' },
      { min: -20, max: 0, label: 'הפסד 0-20%' },
      { min: 0, max: 20, label: 'רווח 0-20%' },
      { min: 20, max: 50, label: 'רווח 20-50%' },
      { min: 50, max: 100, label: 'רווח 50-100%' },
      { min: 100, max: Infinity, label: 'רווח יותר מ-100%' }
    ];
    const profitabilityDistributionMap = new Map<string, number>();
    
    // Initialize ranges
    investmentRanges.forEach(range => {
      investmentDistributionMap.set(range.label, 0);
    });
    
    earningsRanges.forEach(range => {
      earningsDistributionMap.set(range.label, 0);
    });
    
    profitabilityRanges.forEach(range => {
      profitabilityDistributionMap.set(range.label, 0);
    });
    
    // Process each game
    filteredGames.forEach(game => {
      game.players?.forEach(player => {
        const buyInAmount = (player.buyInCount || 0) * (game.buyInSnapshot?.amount || 0);
        const rebuyAmount = (player.rebuyCount || 0) * (game.rebuySnapshot?.amount || 0);
        const finalResult = player.finalResultMoney || 0;
        
        // Add to buy-in and rebuy totals
        buyInTotal += buyInAmount;
        rebuyTotal += rebuyAmount;
        
        // Track investment distribution
        const investment = buyInAmount + rebuyAmount;
        const investmentRange = investmentRanges.find(r => 
          investment >= r.min && investment < r.max
        );
        if (investmentRange) {
          investmentDistributionMap.set(
            investmentRange.label,
            (investmentDistributionMap.get(investmentRange.label) || 0) + 1
          );
        }
        
        // Track earnings distribution
        const earningsRange = earningsRanges.find(r => 
          finalResult >= r.min && finalResult < r.max
        );
        if (earningsRange) {
          earningsDistributionMap.set(
            earningsRange.label,
            (earningsDistributionMap.get(earningsRange.label) || 0) + 1
          );
        }
        
        // Track profitability distribution (ROI)
        if (investment > 0) {
          const roi = (finalResult / investment) * 100;
          const profitabilityRange = profitabilityRanges.find(r => 
            roi >= r.min && roi < r.max
          );
          if (profitabilityRange) {
            profitabilityDistributionMap.set(
              profitabilityRange.label,
              (profitabilityDistributionMap.get(profitabilityRange.label) || 0) + 1
            );
          }
        }
      });
    });
    
    // Calculate total counts for percentages
    const totalInvestmentCount = Array.from(investmentDistributionMap.values())
      .reduce((sum, count) => sum + count, 0);
    
    const totalEarningsCount = Array.from(earningsDistributionMap.values())
      .reduce((sum, count) => sum + count, 0);
    
    // Convert to arrays with percentages
    const investmentRangesResult = Array.from(investmentDistributionMap.entries())
      .map(([range, count]) => ({
        range,
        count,
        percentage: totalInvestmentCount > 0 ? 
          (count / totalInvestmentCount) * 100 : 0
      }));
    
    const earningsRangesResult = Array.from(earningsDistributionMap.entries())
      .map(([range, count]) => ({
        range,
        count,
        percentage: totalEarningsCount > 0 ? 
          (count / totalEarningsCount) * 100 : 0
      }));
    
    const profitabilityDistributionResult = Array.from(profitabilityDistributionMap.entries())
      .map(([profitability, count]) => ({
        profitability,
        count
      }));
    
    const result = {
      buyInRebuyDistribution: [
        { type: 'Buy-In', amount: buyInTotal },
        { type: 'Rebuy', amount: rebuyTotal }
      ],
      investmentRanges: investmentRangesResult,
      earningsRanges: earningsRangesResult,
      profitabilityDistribution: profitabilityDistributionResult
    };
    
    // Cache the result
    statsCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    return result;
  } catch (error) {
    console.error('Error getting money distribution statistics:', error);
    throw error;
  }
};

/**
 * Get money transfer network
 * This generates data for visualizing money flow between players
 */
export const getMoneyTransferNetwork = async (
  filter: StatisticsFilter = { timeFilter: 'all' },
  minTransactions: number = 3
): Promise<{
  nodes: { id: string; name: string; netProfit: number }[];
  links: { source: string; target: string; value: number }[];
}> => {
  try {
    // Create a cache key based on filter
    const cacheKey = `moneyNetwork_${minTransactions}_${JSON.stringify(filter)}`;
    const cachedData = statsCache.get(cacheKey);
    
    if (cachedData && (Date.now() - cachedData.timestamp < CACHE_EXPIRY)) {
      console.log('Using cached money network data');
      return cachedData.data;
    }
    
    const allGames = await fetchAllGames();
    const filteredGames = filterGames(allGames, filter);
    const allUsers = await getAllUsers();
    
    // Track players and their transactions
    const players = new Map<string, {
      id: string;
      name: string;
      netProfit: number;
    }>();
    
    const transactions = new Map<string, Map<string, number>>();
    
    // Process each game with payments
    filteredGames
      .filter(game => game.payments && game.payments.length > 0)
      .forEach(game => {
        // Process each payment
        game.payments?.forEach(payment => {
          const fromId = payment.from.userId || payment.from.unitId;
          const toId = payment.to.userId || payment.to.unitId;
          
          if (!fromId || !toId) return;
          
          // Get player names
          let fromName = '';
          let toName = '';
          
          if (payment.from.userId) {
            // Find from player
            const fromPlayer = game.players?.find(p => 
              p.userId === payment.from.userId || p.id === payment.from.userId
            );
            fromName = fromPlayer?.name || 
              allUsers.find(u => u.id === payment.from.userId)?.name || 
              'לא ידוע';
          } else {
            fromName = `יחידה ${payment.from.unitId}`;
          }
          
          if (payment.to.userId) {
            // Find to player
            const toPlayer = game.players?.find(p => 
              p.userId === payment.to.userId || p.id === payment.to.userId
            );
            toName = toPlayer?.name || 
              allUsers.find(u => u.id === payment.to.userId)?.name || 
              'לא ידוע';
          } else {
            toName = `יחידה ${payment.to.unitId}`;
          }
          
          // Update or create players
          if (!players.has(fromId)) {
            players.set(fromId, { id: fromId, name: fromName, netProfit: 0 });
          }
          
          if (!players.has(toId)) {
            players.set(toId, { id: toId, name: toName, netProfit: 0 });
          }
          
          // Update net profit
          const fromPlayer = players.get(fromId)!;
          const toPlayer = players.get(toId)!;
          
          fromPlayer.netProfit -= payment.amount;
          toPlayer.netProfit += payment.amount;
          
          // Update transactions
          if (!transactions.has(fromId)) {
            transactions.set(fromId, new Map<string, number>());
          }
          
          const fromTransactions = transactions.get(fromId)!;
          const currentAmount = fromTransactions.get(toId) || 0;
          fromTransactions.set(toId, currentAmount + payment.amount);
        });
      });
    
    // Convert to nodes and links for network visualization
    const nodes = Array.from(players.values());
    
    // Filter links to only include significant transactions
    const links: { source: string; target: string; value: number }[] = [];
    
    transactions.forEach((targets, source) => {
      targets.forEach((amount, target) => {
        // Only include transactions meeting minimum threshold
        if (amount >= minTransactions) {
          links.push({
            source,
            target,
            value: amount
          });
        }
      });
    });
    
    const result = { nodes, links };
    
    // Cache the result
    statsCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    return result;
  } catch (error) {
    console.error('Error getting money transfer network:', error);
    throw error;
  }
};

/**
 * Clear the money statistics cache
 */
export const clearMoneyStatsCache = (): void => {
  statsCache.clear();
  console.log('Money statistics cache cleared');
};