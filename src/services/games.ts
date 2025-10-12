// src/services/games.ts
import { collection, doc, getDocs, addDoc, updateDoc, query, where, getDoc, orderBy, limit, deleteDoc } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { 
  Game, 
  GameStatus, 
  RebuyLog, 
  PlayerInGame, 
  OpenGame, 
  Payment,
  GameDate 
} from '@/models/Game';
import { Group } from '@/models/Group';
import { getGroupById } from './groups';
import { verifyAccessControl } from '@/utils/securityAudit';
import { getLocalGames } from './gameSnapshot';

// Collection reference
const gamesCollection = collection(db, 'games');

// Create a new game
export const createGame = async (
  groupId: string,
  date: GameDate,
  userId?: string
): Promise<string> => {
  const group = await getGroupById(groupId);
  if (!group) throw new Error('Group not found');
  
  const now = Date.now();
  const currentUser = auth.currentUser;
  
  if (!currentUser) {
    console.error('No authenticated user found when trying to create game!');
    throw new Error('המשתמש לא מחובר. יש להתחבר מחדש ולנסות שוב');
  }
  
  console.log('Creating game with authenticated user:', currentUser.uid);
  
  // בדיקת הרשאות - אם המשתמש הוא אדמין או סופר, לוודא את זה לפני יצירת המשחק
  // כאן אנחנו בודקים רק את ה-UID כרגע
  console.log(`User attempting to create game: ${currentUser.uid}`);
  if (!currentUser.uid) {
    console.error('User has no UID, this is unexpected');
    throw new Error('זיהוי המשתמש חסר. אנא התחבר/י מחדש');
  }
  
  try {
    // בדיקה בשכבת האבטחה
    const hasPermission = await verifyAccessControl(currentUser.uid, 'games', 'write');
    console.log(`User ${currentUser.uid} permission to create game: ${hasPermission}`);
    
    if (!hasPermission) {
      console.error('User does not have permission to create games according to security matrix');
      throw new Error('אין הרשאות מתאימות ליצירת משחק');
    }
  } catch (error) {
    console.error('Error checking permissions:', error);
    // Continue anyway to see if it's a different issue
  }
  
  const newGame: Omit<Game, 'id'> = {
    groupId,
    groupNameSnapshot: group.name,
    date,
    status: 'active',
    buyInSnapshot: { ...group.buyIn },
    rebuySnapshot: { ...group.rebuy },
    players: [],
    playerUids: [],
    rebuyLogs: [],
    createdAt: now,
    updatedAt: now,
    createdBy: userId || currentUser.uid,
    // העברת נתוני חוק 80% מהקבוצה – הערכים הללו קיימים במסמך הקבוצה (Group)
    useRoundingRule: group.useRoundingRule,
    roundingRulePercentage: group.roundingRulePercentage || 0,
    openGamesCount: 0,
    totalWins: 0,
    totalLosses: 0,
  };
  
  try {
    const docRef = await addDoc(gamesCollection, newGame);
    console.log('Game created successfully with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating game:', error);
    console.log('Game data attempted to create:', JSON.stringify(newGame));
    throw error;
  }
};

// Get game by ID
export const getGameById = async (gameId: string): Promise<Game | null> => {
  const docRef = doc(db, 'games', gameId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  return {
    id: docSnap.id,
    ...docSnap.data()
  } as Game;
};

// Get recent games
export const getRecentGames = async (limitCount: number = 5): Promise<Game[]> => {
  try {
    // קבלת משחקים מפיירבייס
    const gamesQuery = query(
      gamesCollection,
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(gamesQuery);
    const firebaseGames = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Game));
    
    // קבלת משחקים מקומיים
    const localGames = await getLocalGames();
    
    // מיזוג ומיון
    const allGames = [...firebaseGames, ...localGames];
    
    // מיון לפי תאריך יצירה - חדש לישן
    allGames.sort((a, b) => {
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    
    // החזרת מספר המשחקים המבוקש
    return allGames.slice(0, limitCount);
  } catch (error) {
    console.error('Error getting recent games:', error);
    
    // במקרה של שגיאה, ננסה להחזיר לפחות את המשחקים המקומיים
    try {
      return await getLocalGames();
    } catch (localError) {
      console.error('Error getting local games:', localError);
      return [];
    }
  }
};

// Get games by group
export const getGamesByGroup = async (groupId: string): Promise<Game[]> => {
  const q = query(
    gamesCollection,
    where('groupId', '==', groupId)
  );
  
  const querySnapshot = await getDocs(q);
  const games = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Game));
  
  // מיון המשחקים לפי תאריך (timestamp) בסדר יורד
  return games.sort((a, b) => (b.date?.timestamp || 0) - (a.date?.timestamp || 0));
};

// Add player to game
export const addPlayerToGame = async (
  gameId: string,
  userId: string,
  playerName: string
): Promise<void> => {
  const game = await getGameById(gameId);
  if (!game) throw new Error('Game not found');
  
  if (game.status !== 'active') {
    throw new Error('Cannot add players to non-active game');
  }
  
  const currentPlayers = game.players || [];
  const currentPlayerUids = game.playerUids || [];

  if (!currentPlayers.some(p => p.userId === userId)) {
    const newPlayer: PlayerInGame = {
      userId,
      name: playerName,
      buyInCount: 1,
      rebuyCount: 0
    };
    
    const gameRef = doc(db, 'games', gameId);
    await updateDoc(gameRef, {
      players: [...currentPlayers, newPlayer],
      playerUids: [...currentPlayerUids, userId],
      updatedAt: Date.now()
    });
  }
};

// Add rebuy for player
export const addRebuy = async (gameId: string, playerId: string): Promise<void> => {
  const game = await getGameById(gameId);
  if (!game) throw new Error('Game not found for addRebuy');
  
  // Initialize players to an empty array if undefined
  const players = game.players || [];
  
  if (game.status !== 'active') {
    throw new Error('Cannot add rebuy to non-active game');
  }
  
  const gameRef = doc(db, 'games', gameId);
  const playerIndex = players.findIndex(p => p.userId === playerId);
  
  if (playerIndex === -1) {
    throw new Error('Player not found in game');
  }

  const rebuyLog: RebuyLog = {
    id: `${gameId}-${playerId}-${Date.now()}`,
    playerId,
    action: 'add',
    timestamp: Date.now()
  };

  const updatedPlayers = [...players];
  updatedPlayers[playerIndex] = {
    ...updatedPlayers[playerIndex],
    rebuyCount: (updatedPlayers[playerIndex].rebuyCount || 0) + 1
  };

  await updateDoc(gameRef, {
    players: updatedPlayers,
    rebuyLogs: [...(game.rebuyLogs || []), rebuyLog],
    updatedAt: Date.now()
  });
};

// Remove rebuy from player
export const removeRebuy = async (gameId: string, playerId: string): Promise<void> => {
  const game = await getGameById(gameId);
  if (!game) throw new Error('Game not found');
  
  if (game.status !== 'active') {
    throw new Error('Cannot remove rebuy from non-active game');
  }
  
  const gameRef = doc(db, 'games', gameId);
  const players = game.players || [];
  const playerIndex = players.findIndex(p => p.userId === playerId);
  
  if (playerIndex === -1) {
    throw new Error('Player not found in game');
  }
  
  if (!players[playerIndex].rebuyCount) {
    throw new Error('Player has no rebuys to remove');
  }
  
  // Create remove rebuy log entry
  const rebuyLog: RebuyLog = {
    id: `${gameId}-${playerId}-${Date.now()}`,
    playerId,
    action: 'remove',
    timestamp: Date.now()
  };
  
  // Update player's rebuy count
  const updatedPlayers = [...players];
  updatedPlayers[playerIndex] = {
    ...updatedPlayers[playerIndex],
    rebuyCount: updatedPlayers[playerIndex].rebuyCount - 1
  };
  
  // Update game document
  await updateDoc(gameRef, {
    players: updatedPlayers,
    rebuyLogs: [...(game.rebuyLogs || []), rebuyLog],
    updatedAt: Date.now()
  });
};
  
// Get rebuy history for a game
export const getGameRebuyHistory = async (gameId: string): Promise<RebuyLog[]> => {
  const game = await getGameById(gameId);
  if (!game) throw new Error('Game not found');
  
  return game.rebuyLogs || [];
};
  
// Get player's current rebuy count
export const getPlayerRebuyCount = async (gameId: string, playerId: string): Promise<number> => {
  const game = await getGameById(gameId);
  if (!game) throw new Error('Game not found');
  
  const players = game.players || [];
  const player = players.find(p => p.userId === playerId);
  if (!player) throw new Error('Player not found in game');
  
  return player.rebuyCount || 0;
};

// Calculate player's entitled rebuys based on remaining chips
const calculateEntitledRebuys = (
  remainingChips: number,
  rebuyChips: number,
  useRoundingRule: boolean,
  roundingRulePercentage: number
): number => {
  // Calculate how many complete rebuys the player is entitled to
  const completeRebuys = Math.floor(remainingChips / rebuyChips);
  
  // Calculate remaining chips after complete rebuys
  const remainingChipsAfterComplete = remainingChips % rebuyChips;
  
  if (!useRoundingRule) {
    return completeRebuys;
  }

  // If using rounding rule, check if remaining chips qualify for an additional rebuy
  const threshold = rebuyChips * (roundingRulePercentage / 100);
  const additionalRebuys = remainingChipsAfterComplete >= threshold ? 1 : 0;
  
  return completeRebuys + additionalRebuys;
};
  
// Calculate initial results
export const calculateInitialResults = async (
  gameId: string, 
  playerChips: { playerId: string; remainingChips: number; }[]
): Promise<void> => {
  const game = await getGameById(gameId);
  if (!game) throw new Error('Game not found');
  
  if (game.status !== 'active') {
    throw new Error('Cannot calculate results for non-active game');
  }

  // הדפסה לבדיקת הנתונים במיכל (GameData)
  console.log("Game Data before calculation:", game);
  console.log("Snapshot rounding settings:", {
    useRoundingRule: game.useRoundingRule,
    roundingRulePercentage: game.roundingRulePercentage,
  });
  console.log("Buy-In Snapshot:", game.buyInSnapshot, "Rebuy Snapshot:", game.rebuySnapshot);

  // שימוש בערכים שנשמרו במיכל
  const useRoundingRule = game.useRoundingRule;
  const roundingRulePercentage = game.roundingRulePercentage;
  console.log('Using game snapshot settings for rounding rule:', {
    useRoundingRule,
    roundingRulePercentage,
  });

  // Update players with remaining chips and calculate exact values
  const players = game.players || [];
  const updatedPlayers = players.map(player => {
    const playerResult = playerChips.find(p => p.playerId === player.userId);
    if (!playerResult) {
      throw new Error(`Missing chips data for player ${player.name}`);
    }
  
    // Calculate entitled rebuys based on remaining chips using game.rebuySnapshot and snapshot settings
    const completeRebuys = Math.floor(playerResult.remainingChips / game.rebuySnapshot.chips);
    const remainingChipsAfterComplete = playerResult.remainingChips % game.rebuySnapshot.chips;
    
    let entitledRebuys = completeRebuys;
    if (useRoundingRule) {
      const threshold = game.rebuySnapshot.chips * (roundingRulePercentage / 100);
      if (remainingChipsAfterComplete >= threshold) {
        entitledRebuys += 1;
      }
    }
  
    // Calculate money result before open games
    const totalInvestment = (
      (game.buyInSnapshot.amount * player.buyInCount) + 
      (game.rebuySnapshot.amount * player.rebuyCount)
    );
    
    const totalWin = game.rebuySnapshot.amount * entitledRebuys;
    const resultBeforeOpenGames = totalWin - totalInvestment;
  
    return {
      ...player,
      remainingChips: playerResult.remainingChips,
      exactChipsValue: playerResult.remainingChips / game.rebuySnapshot.chips,
      roundedRebuysCount: entitledRebuys,
      resultBeforeOpenGames
    };
  });
  
  // Calculate totals
  const totalLosses = Math.abs(
    updatedPlayers
      .filter(p => p.resultBeforeOpenGames < 0)
      .reduce((sum, p) => sum + p.resultBeforeOpenGames, 0)
  );
  
  const totalWins = updatedPlayers
    .filter(p => p.resultBeforeOpenGames > 0)
    .reduce((sum, p) => sum + p.resultBeforeOpenGames, 0);
  
  // Calculate required open games based on difference
  const difference = Math.abs(totalLosses - totalWins);
  const openGamesCount = difference > 0 
    ? Math.ceil(difference / game.rebuySnapshot.amount) 
    : 0;
  
  // Update game status and results
  const gameRef = doc(db, 'games', gameId);
  await updateDoc(gameRef, {
    status: openGamesCount > 0 ? 'open_games' : 'completed',
    players: updatedPlayers,
    totalWins,
    totalLosses,
    openGamesCount,
    updatedAt: Date.now()
  });
};

// Add open game winner
export const addOpenGameWinner = async (gameId: string, openGameId: number, winnerId: string): Promise<void> => {
  const game = await getGameById(gameId);
  if (!game) throw new Error('Game not found for addOpenGameWinner');
  
  const players = game.players || [];
  
  if (game.status !== 'open_games') {
    throw new Error('Game is not in open games stage');
  }
  
  // Create new open game record
  const openGameEntry: OpenGame = {
    id: openGameId,
    winner: winnerId,
    createdAt: Date.now()
  };
  
  // Update player's open game wins count
  const updatedPlayers = players.map(player => ({
    ...player,
    openGameWins: player.userId === winnerId 
      ? (player.openGameWins || 0) + 1 
      : (player.openGameWins || 0)
  }));
  
  // Check if all open games are completed
  const currentOpenGames = [...(game.openGames || []), openGameEntry];
  const allOpenGamesCompleted = currentOpenGames.length === (game.openGamesCount || 0);
  
  // Update game
  const gameRef = doc(db, 'games', gameId);
  await updateDoc(gameRef, {
    players: updatedPlayers,
    openGames: currentOpenGames,
    status: allOpenGamesCompleted ? 'completed' : 'open_games',
    updatedAt: Date.now()
  });
  
  // If all open games completed, calculate final results
  if (allOpenGamesCompleted) {
    await calculateFinalResults(gameId);
  }
};
  
// Calculate final results including payments
export const calculateFinalResults = async (gameId: string): Promise<void> => {
  const game = await getGameById(gameId);
  if (!game) throw new Error('Game not found for calculateFinalResults');
  
  const players = game.players || [];
  
  // Calculate final results for each player
  const playersWithFinalResults = players.map(player => {
    const openGameWinnings = (player.openGameWins || 0) * (game.rebuySnapshot?.amount || 0);
    return {
      ...player,
      finalResultMoney: (player.resultBeforeOpenGames || 0) + openGameWinnings
    };
  });
  
  // Sort players by final results (winners first, losers last)
  const sortedPlayers = [...playersWithFinalResults].sort(
    (a, b) => (b.finalResultMoney || 0) - (a.finalResultMoney || 0)
  );
  
  // Calculate optimal payments
  const payments: Payment[] = [];
  let winners = sortedPlayers.filter(p => (p.finalResultMoney || 0) > 0);
  let losers = sortedPlayers.filter(p => (p.finalResultMoney || 0) < 0);
  
  winners.forEach(winner => {
    let remainingToReceive = winner.finalResultMoney || 0;
    
    while (remainingToReceive > 0 && losers.length > 0) {
      const currentLoser = losers[0];
      const amountToPayFromLoser = Math.min(
        remainingToReceive,
        Math.abs(currentLoser.finalResultMoney || 0)
      );
  
      if (amountToPayFromLoser > 0) {
        payments.push({
          from: { userId: currentLoser.userId },
          to: { userId: winner.userId },
          amount: amountToPayFromLoser
        });
        remainingToReceive -= amountToPayFromLoser;
        currentLoser.finalResultMoney = (currentLoser.finalResultMoney || 0) + amountToPayFromLoser;
  
        if (Math.abs(currentLoser.finalResultMoney || 0) < 0.001) { // Check if effectively zero
          losers = losers.slice(1);
        }
      } else {
        break; // Avoid infinite loop if amountToPayFromLoser is 0
      }
    }
  });
  
  // Update game with final results
  const gameRef = doc(db, 'games', gameId);
  await updateDoc(gameRef, {
    players: playersWithFinalResults,
    payments,
    status: 'completed',
    updatedAt: Date.now()
  });
};

// Check if player has active games
export const hasPlayerActiveGames = async (playerId: string): Promise<boolean> => {
  const q = query(
    gamesCollection,
    where('status', 'in', ['active', 'ending', 'open_games']),
    where('playerUids', 'array-contains', playerId) // Query directly on playerUids
  );
  
  const querySnapshot = await getDocs(q);
  return !querySnapshot.empty; // If any documents are returned, the player has active games
};

// Delete game by ID
export const deleteGame = async (gameId: string): Promise<void> => {
  const game = await getGameById(gameId);
  if (!game) throw new Error('Game not found');
  
  try {
    // 1. מחיקת המשחק מה-Firestore
    const gameRef = doc(db, 'games', gameId);
    await deleteDoc(gameRef);
    
    // 2. עדכון רשימת המשחקים האחרונים בקבוצה אם צריך
    if (game.groupId) {
      await updateGroupRecentGames(game.groupId, gameId, true);
    }
  } catch (error) {
    console.error('Error deleting game:', error);
    throw new Error('Failed to delete game');
  }
};

// Update group's recent games list after game deletion
export const updateGroupRecentGames = async (groupId: string, gameId: string, gameDeleted: boolean = false): Promise<void> => {
  try {
    const groupRef = doc(db, 'groups', groupId);
    const groupSnap = await getDoc(groupRef);
    
    if (groupSnap.exists()) {
      const groupData = groupSnap.data() as Group;
      
      // Check if the deleted game was in the recent games list
      let recentGames = groupData.recentGames || [];
      if (gameDeleted) {
        recentGames = recentGames.filter((id: string) => id !== gameId);
      } else {
        if (!recentGames.includes(gameId)) {
          recentGames = [gameId, ...recentGames];
        }
      }
        
        // If we need to replace it with a new game
      if (recentGames.length > 5) {
        // Remove the oldest game
        recentGames = recentGames.slice(0, 5);
        }
        
        // Update the group document
      await updateDoc(groupRef, { recentGames });
    }
  } catch (error) {
    console.error('Error updating group recent games:', error);
  }
};

// Get games by status
export const getGamesByStatus = async (status: GameStatus | GameStatus[], count?: number): Promise<Game[]> => {
  const statuses = Array.isArray(status) ? status : [status];
  let q = query(gamesCollection, where('status', 'in', statuses), orderBy('date.timestamp', 'desc'));
  if (count) {
    q = query(q, limit(count));
  }
  const querySnapshot = await getDocs(q);
  // Ensure date and timestamp exist for sorting, provide a default if not.
  return querySnapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data()
  } as Game)).sort((a, b) => {
    const timeA = a.date?.timestamp || 0;
    const timeB = b.date?.timestamp || 0;
    return timeB - timeA;
  });
};