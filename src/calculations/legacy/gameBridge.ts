/**
 * גשר בין פונקציות משחק ישנות לחדשות
 *
 * מספק ממשק תואם לפונקציות הישנות תוך שימוש בפונקציות החדשות
 */

import { Game } from '../../models/Game';
import {
  calculateGameSummary,
  calculateOptimalPayments,
  GameSummaryParams,
  GameSummaryResult,
  OptimalPaymentsParams,
  OptimalPaymentsResult
} from '../index';

// ייבוא ישיר של פונקציית calculateInitialGameSummary מהמודול המקורי
import { calculateInitialGameSummary as originalCalculateInitialGameSummary } from '../../utils/gameCalculations';

// ייצוא מחדש של הפונקציה המקורית - עד שתיושם בשכבה החדשה
export const calculateInitialGameSummary = originalCalculateInitialGameSummary;

// Type aliases for backward compatibility
export type GameResultsParams = GameSummaryParams;
export type GameResultsResult = {
  totalBuyins: number;
  totalRebuys: number;
  totalInvestment: number;
  playerResults: any[];
};
export type GamePlayersResultsParams = {
  gameId: string;
  game?: Game;
};
export type GamePlayersResultsResult = {
  gameId: string;
  playerResults: any[];
};

/**
 * חישוב השקעת שחקן במשחק
 * @param player השחקן
 * @returns סכום ההשקעה של השחקן
 */
export function calculatePlayerInvestment(player: any): number {
  return (player.buyin || 0) + (player.rebuys?.reduce((acc: number, rebuy: any) => acc + rebuy.amount, 0) || 0);
}

/**
 * חישוב הרווח/הפסד ההתחלתי של שחקן
 * @param player השחקן
 * @returns הרווח/הפסד ההתחלתי
 */
export function calculateInitialPlayerResult(player: any): number {
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
export function calculateFinalPlayerResult(player: any): number {
  if (!player) return 0;

  const initialResult = calculateInitialPlayerResult(player);
  const payments = player.payments || [];
  const paymentAmount = payments.reduce((sum: number, payment: any) => sum + payment.amount, 0);

  return initialResult + paymentAmount;
}

/**
 * חישוב סיכום משחק (legacy wrapper)
 * @param game המשחק
 * @returns סיכום המשחק
 */
export function calculateGameResults(game: Game): GameResultsResult {
  if (!game) {
    return {
      totalBuyins: 0,
      totalRebuys: 0,
      totalInvestment: 0,
      playerResults: []
    };
  }

  const params: GameSummaryParams = {
    gameId: game.id,
    game
  };

  const result = calculateGameSummary(params);
  // Convert GameSummaryResult to legacy GameResultsResult format
  return {
    totalBuyins: result.data.totalInitialBuyIns,
    totalRebuys: result.data.totalRebuys,
    totalInvestment: result.data.totalInvestment,
    playerResults: [] // Players array would need to be extracted from game
  };
}

/**
 * חישוב תוצאות שחקנים למשחק (legacy wrapper)
 * @param params פרמטרים
 * @returns תוצאות שחקנים
 */
export function calculateGamePlayersResults(params: GamePlayersResultsParams): { data: GamePlayersResultsResult } {
  const { gameId, game } = params;
  const playerResults = game?.players?.map(player => ({
    ...player,
    profit: player.finalResultMoney || player.resultBeforeOpenGames || 0
  })) || [];

  return {
    data: {
      gameId,
      playerResults
    }
  };
}

/**
 * חישוב תשלומים אופטימליים (legacy wrapper)
 * @param playerResults תוצאות השחקנים (ignored - uses gameId instead)
 * @param gameId מזהה המשחק
 * @returns רשימת תשלומים מומלצים
 */
export function calculateOptimalPaymentsLegacy(playerResults: any[], gameId: string = 'unknown'): OptimalPaymentsResult {
  const params: OptimalPaymentsParams = {
    gameId
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

  const params: OptimalPaymentsParams = {
    gameId: game.id,
    game
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
  return calculateGameResults(game);
}

/**
 * קבלת תוצאות שחקנים עבור משחק
 * @param gameId מזהה המשחק
 * @param game המשחק
 * @returns תוצאות השחקנים
 */
export function getPlayerResultsForGame(gameId: string, game?: Game): GamePlayersResultsResult {
  const result = calculateGamePlayersResults({ gameId, game });
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
