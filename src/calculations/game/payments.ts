/**
 * חישובי תשלומים למשחק
 */

import { Game } from '../../models/Game';
import { CalculationFunction } from '../core/types';
import { CacheManager } from '../cache/CacheManager';
import { CACHE_CATEGORIES, CACHE_TTL } from '../core/constants';
import { createCalculationResult } from '../core/utils';

/**
 * פרמטרים לחישוב תשלומים אופטימליים
 */
export interface OptimalPaymentsParams {
  gameId: string;    // מזהה המשחק
  game?: Game;       // אובייקט המשחק (אופציונלי)
}

/**
 * תשלום בין שחקנים
 */
export interface Payment {
  fromUserId: string;   // שחקן משלם
  fromName: string;     // שם שחקן משלם
  toUserId: string;     // שחקן מקבל
  toName: string;       // שם שחקן מקבל
  amount: number;       // סכום התשלום
}

/**
 * תוצאת חישוב תשלומים אופטימליים
 */
export interface OptimalPaymentsResult {
  gameId: string;       // מזהה המשחק
  payments: Payment[];  // רשימת תשלומים
  totalTransferred: number; // סך הכסף המועבר
  playersInvolved: number;  // מספר שחקנים מעורבים
}

/**
 * חישוב תשלומים אופטימליים
 * 
 * מאחד את הפונקציות המקוריות:
 * - calculateOptimalPayments
 * - optimizePayments
 * - getPaymentsForGame
 * 
 * האלגוריתם מאפשר למזער את מספר התשלומים הנדרשים
 * כדי לסגור את כל החובות הפיננסיים בין השחקנים.
 * 
 * @param params פרמטרים לחישוב
 * @param options אפשרויות חישוב
 * @returns תוצאת חישוב תשלומים אופטימליים
 */
export const calculateOptimalPayments: CalculationFunction<OptimalPaymentsParams, OptimalPaymentsResult> = 
  (params, options = {}) => {
    const { gameId, game: inputGame } = params;
    const { useCache = true, forceRefresh = false } = options;
    
    // בדיקה במטמון אם מאופשר וללא דרישה לרענון
    if (useCache && !forceRefresh) {
      const cacheKey = `payments:${gameId}`;
      const cached = CacheManager.get<OptimalPaymentsResult>(CACHE_CATEGORIES.GAME_STATS, cacheKey);
      
      if (cached) {
        return createCalculationResult(cached, ['cache'], true, { gameId });
      }
    }
    
    // השג את המשחק אם לא סופק
    // בקוד האמיתי, זה יהיה בדרך כלל קריאת API
    const game = inputGame || { id: gameId } as Game;
    
    // אם אין נתוני משחק מלאים, החזר שגיאה או תוצאה ריקה
    if (!game || !game.players || game.players.length === 0) {
      const emptyResult: OptimalPaymentsResult = {
        gameId,
        payments: [],
        totalTransferred: 0,
        playersInvolved: 0
      };
      
      return createCalculationResult(emptyResult, ['games'], false, { gameId });
    }
    
    // יצירת רשימת שחקנים עם סכומים
    type PlayerBalance = {
      userId: string;
      name: string;
      balance: number; // חיובי למי שהרוויח, שלילי למי שהפסיד
    };
    
    const playerBalances: PlayerBalance[] = game.players.map(player => ({
      userId: player.userId,
      name: player.name || player.userId,
      balance: player.finalResultMoney || player.resultBeforeOpenGames || 0
    }));
    
    // סינון שחקנים עם יתרה שאינה אפס
    const nonZeroBalances = playerBalances.filter(player => player.balance !== 0);
    
    // מיון: מפסידים (שלילי) בתחילה, מרוויחים (חיובי) בסוף
    nonZeroBalances.sort((a, b) => a.balance - b.balance);
    
    // חישוב התשלומים האופטימליים
    const payments: Payment[] = [];
    
    // כל עוד יש לנו גם מפסידים וגם מרוויחים
    while (nonZeroBalances.length > 1 && nonZeroBalances[0].balance < 0 && nonZeroBalances[nonZeroBalances.length - 1].balance > 0) {
      const debtor = nonZeroBalances[0]; // השחקן המפסיד עם החוב הגדול ביותר
      const creditor = nonZeroBalances[nonZeroBalances.length - 1]; // השחקן המרוויח עם הרווח הגדול ביותר
      
      // חישוב הסכום שיועבר (המינימום בין החוב לרווח בערך מוחלט)
      const amount = Math.min(Math.abs(debtor.balance), creditor.balance);
      
      // הוספת התשלום
      payments.push({
        fromUserId: debtor.userId,
        fromName: debtor.name,
        toUserId: creditor.userId,
        toName: creditor.name,
        amount
      });
      
      // עדכון היתרות
      debtor.balance += amount;
      creditor.balance -= amount;
      
      // הסרת שחקנים עם יתרה אפס
      if (Math.abs(debtor.balance) < 0.01) { // כדי להתמודד עם בעיות דיוק בנקודה צפה
        nonZeroBalances.shift();
      }
      
      if (Math.abs(creditor.balance) < 0.01) {
        nonZeroBalances.pop();
      }
      
      // מיון מחדש במקרה שהסדר השתנה
      nonZeroBalances.sort((a, b) => a.balance - b.balance);
    }
    
    // חישוב סטטיסטיקות
    const totalTransferred = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const playersInvolvedSet = new Set<string>();
    
    payments.forEach(payment => {
      playersInvolvedSet.add(payment.fromUserId);
      playersInvolvedSet.add(payment.toUserId);
    });
    
    // יצירת תוצאה סופית
    const result: OptimalPaymentsResult = {
      gameId,
      payments,
      totalTransferred,
      playersInvolved: playersInvolvedSet.size
    };
    
    // שמירה במטמון
    if (useCache) {
      const cacheKey = `payments:${gameId}`;
      CacheManager.set(CACHE_CATEGORIES.GAME_STATS, cacheKey, result, CACHE_TTL.LONG);
    }
    
    return createCalculationResult(result, ['games'], false, { gameId });
  }; 