/**
 * גשר בין פונקציות משחק ישנות לחדשות
 * 
 * מספק ממשק תואם לפונקציות הישנות תוך שימוש בפונקציות החדשות
 */

import { Game } from '../../models/Game';
import { Player } from '../../models/Player';
import { 
  calculateGameResults, 
  calculateGamePlayersResults,
  calculateOptimalPayments,
  GameResultsParams,
  GamePlayersResultsParams,
  OptimalPaymentsParams,
  GameResultsResult,
  GamePlayersResultsResult,
  OptimalPaymentsResult
} from '../index';

/**
 * חישוב השקעת שחקן במשחק
 * @param player השחקן
 * @returns סכום ההשקעה של השחקן
 */
export function calculatePlayerInvestment(player: Player): number {
  return (player.buyin || 0) + (player.rebuys?.reduce((acc: number, rebuy: any) => acc + rebuy.amount, 0) || 0);
}

/**
 * חישוב הרווח/הפסד ההתחלתי של שחקן
 * @param player השחקן
 * @returns הרווח/הפסד ההתחלתי
 */
export function calculateInitialPlayerResult(player: Player): number {
  if (!player) return 0;
  const investment = calculatePlayerInvestment(player);
  const finalChips = player.finalChips || 0;
  return finalChips - investment;
}

/**
 * חישוב הרווח/הפסד הסופי של שחקן
 * @param player השחקן
 * @returns הרווח/הפסד הסופי
 */
export function calculateFinalPlayerResult(player: Player): number {
  if (!player) return 0;
  
  const initialResult = calculateInitialPlayerResult(player);
  const payments = player.payments || [];
  const paymentAmount = payments.reduce((sum: number, payment: any) => sum + payment.amount, 0);
  
  return initialResult + paymentAmount;
}

/**
 * חישוב סיכום משחק
 * @param game המשחק
 * @returns סיכום המשחק
 */
export function calculateGameSummary(game: Game): GameResultsResult {
  if (!game) {
    return { 
      totalBuyins: 0, 
      totalRebuys: 0, 
      totalInvestment: 0, 
      playerResults: [] 
    };
  }
  
  const params: GameResultsParams = {
    gameId: game.id,
    game
  };
  
  const result = calculateGameResults(params);
  return result.data;
}

/**
 * חישוב תשלומים אופטימליים
 * @param playerResults תוצאות השחקנים
 * @returns רשימת תשלומים מומלצים
 */
export function calculateOptimalPaymentsLegacy(playerResults: any[]): OptimalPaymentsResult {
  const params: OptimalPaymentsParams = {
    playerResults
  };
  
  const result = calculateOptimalPayments(params);
  return result.data;
}

/**
 * חישוב תשלומים אופטימליים למשחק
 * @param game המשחק
 * @returns רשימת תשלומים מומלצים
 */
export function calculateGameOptimalPayments(game: Game): OptimalPaymentsResult {
  if (!game) {
    return { 
      gameId: '',
      totalTransferred: 0,
      playersInvolved: 0,
      payments: []
    };
  }
  
  // קודם חשב את תוצאות המשחק
  const gameSummary = calculateGameSummary(game);
  
  // אז חשב את התשלומים האופטימליים
  const params: OptimalPaymentsParams = {
    playerResults: gameSummary.playerResults
  };
  
  const result = calculateOptimalPayments(params);
  return result.data;
}

/**
 * קבלת סטטיסטיקות משחק
 * @param game המשחק
 * @returns סטטיסטיקות המשחק
 */
export function getGameStatistics(game: Game): GameResultsResult {
  return calculateGameSummary(game);
}

/**
 * קבלת תוצאות שחקנים עבור משחק
 * @param gameId מזהה המשחק
 * @param game המשחק
 * @returns תוצאות השחקנים
 */
export function getPlayerResultsForGame(gameId: string, game?: Game): GamePlayersResultsResult {
  const params: GamePlayersResultsParams = {
    gameId,
    game
  };
  
  const result = calculateGamePlayersResults(params);
  return result.data;
}

/**
 * קבלת תשלומים עבור משחק
 * @param game המשחק
 * @returns תשלומים מומלצים
 */
export function getPaymentsForGame(game: Game): OptimalPaymentsResult {
  return calculateGameOptimalPayments(game);
} 