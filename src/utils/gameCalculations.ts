// src/services/gameCalculations.ts

import { 
  ChipsConfig, 
  Player, 
  Payment,
  OpenGamesBonus,
  PlayerInvestment
} from '@/contexts/GameContext';
import { PaymentUnit } from '@/models/PaymentUnit';

/**
 * תוצאות חישוב לשחקן יחיד
 */
export interface PlayerCalculationResult extends Player {
  // נתוני השקעה
  totalInvestment: PlayerInvestment;
  
  // תוצאות חישוב
  exactChipsValue: number;        // ערך מדויק של הצ'יפים
  roundedRebuysCount: number;     // מספר ריבאיים אחרי עיגול (אם מופעל החוק)
  finalChipsValue: number;        // שווי הצ'יפים הסופי
  resultBeforeOpenGames: number;  // רווח/הפסד לפני משחקים פתוחים
  openGamesBonus?: OpenGamesBonus;// בונוס ממשחקים פתוחים
  finalResultMoney: number;       // תוצאה סופית
}

/**
 * סיכום תוצאות המשחק
 */
export interface GameSummary {
  playersResults: PlayerCalculationResult[];
  totalWins: number;           // סך כל הזכיות
  totalLosses: number;         // סך כל ההפסדים
  difference: number;          // ההפרש בין זכיות להפסדים
  openGamesCount: number;      // מספר משחקים פתוחים נדרשים
  payments?: Payment[];        // תשלומים מחושבים
}

/**
 * ישות לחישוב תשלומים - יכולה להיות שחקן בודד או יחידת תשלום
 */
interface PlayerOrUnit {
  id: string;
  type: 'player' | 'unit';
  amount: number;
  members?: string[];  // For payment units - list of player IDs
}

/**
 * חישוב סך ההשקעה של שחקן
 */
function calculatePlayerInvestment(
  player: Player,
  buyInSnapshot: ChipsConfig,
  rebuySnapshot: ChipsConfig
): PlayerInvestment {
  const buyInTotal = player.buyInCount * buyInSnapshot.amount;
  const rebuyTotal = player.rebuyCount * rebuySnapshot.amount;
  
  return {
    buyInCount: player.buyInCount,
    buyInTotal,
    rebuyCount: player.rebuyCount,
    rebuyTotal,
    overall: buyInTotal + rebuyTotal
  };
}

/**
 * חישוב תוצאות ראשוניות לשחקן יחיד
 */
export function calculateInitialPlayerResult(
  player: Player,
  buyInSnapshot: ChipsConfig,
  rebuySnapshot: ChipsConfig,
  useRoundingRule: boolean,
  roundingRulePercentage: number
): PlayerCalculationResult {
  const totalInvestment = calculatePlayerInvestment(player, buyInSnapshot, rebuySnapshot);
  const finalChips = Number(player.finalChips) || 0;
  
  // חישוב הערך המדויק
  const exactChipsValue = (finalChips / rebuySnapshot.chips) * rebuySnapshot.amount;
  
  let roundedRebuysCount = 0;
  let finalChipsValue = 0;
  
  if (useRoundingRule) {
    // חישוב לפי חוק העיגול (למשל 80%)
    const completeRebuys = Math.floor(finalChips / rebuySnapshot.chips);
    const remainderChips = finalChips % rebuySnapshot.chips;
    const threshold = rebuySnapshot.chips * (roundingRulePercentage / 100);
    roundedRebuysCount = remainderChips >= threshold ? completeRebuys + 1 : completeRebuys;
    finalChipsValue = roundedRebuysCount * rebuySnapshot.amount;
  } else {
    // חישוב ישיר ללא עיגול
    roundedRebuysCount = Math.floor(finalChips / rebuySnapshot.chips);
    finalChipsValue = Number(exactChipsValue.toFixed(2));
  }

  return {
    ...player,
    totalInvestment,
    exactChipsValue,
    roundedRebuysCount,
    finalChipsValue,
    resultBeforeOpenGames: finalChipsValue - totalInvestment.overall,
    finalResultMoney: 0, // יעודכן בהמשך
  };
}

/**
 * חישוב תוצאות סופיות לשחקן כולל משחקים פתוחים
 */
export function calculateFinalPlayerResult(
  player: PlayerCalculationResult,
  openGameWins: number,
  rebuyAmount: number
): PlayerCalculationResult {
  if (openGameWins === 0) {
    return {
      ...player,
      openGamesBonus: { winsCount: 0, bonusAmount: 0 },
      finalResultMoney: player.resultBeforeOpenGames
    };
  }

  const openGamesBonus = {
    winsCount: openGameWins,
    bonusAmount: openGameWins * rebuyAmount
  };

  return {
    ...player,
    openGamesBonus,
    finalResultMoney: player.resultBeforeOpenGames + openGamesBonus.bonusAmount
  };
}

/**
 * חישוב סיכום משחק ראשוני - לפני משחקים פתוחים
 */
export function calculateInitialGameSummary(
  players: Player[],
  buyInSnapshot: ChipsConfig,
  rebuySnapshot: ChipsConfig,
  useRoundingRule: boolean,
  roundingRulePercentage: number
): GameSummary {
  const playersResults = players.map((player) =>
    calculateInitialPlayerResult(
      player,
      buyInSnapshot,
      rebuySnapshot,
      useRoundingRule,
      roundingRulePercentage
    )
  );

  const totalWins = playersResults
    .filter(p => p.resultBeforeOpenGames > 0)
    .reduce((sum, p) => sum + p.resultBeforeOpenGames, 0);
  
  const totalLosses = playersResults
    .filter(p => p.resultBeforeOpenGames < 0)
    .reduce((sum, p) => sum + Math.abs(p.resultBeforeOpenGames), 0);
  
  const difference = Math.abs(totalWins - totalLosses);
  const openGamesCount = difference > 0 ? Math.ceil(difference / rebuySnapshot.amount) : 0;

  return {
    playersResults,
    totalWins,
    totalLosses,
    difference,
    openGamesCount,
  };
}

/**
 * חישוב סיכום משחק סופי - כולל משחקים פתוחים
 */
export function calculateFinalGameSummary(
  initialSummary: GameSummary,
  openGameWinners: string[],
  rebuyAmount: number,
  paymentUnits: PaymentUnit[]
): GameSummary {
  // ספירת הזכיות במשחקים פתוחים לכל שחקן
  const openGameWinCounts = openGameWinners.reduce((counts: { [key: string]: number }, winnerId) => {
    counts[winnerId] = (counts[winnerId] || 0) + 1;
    return counts;
  }, {});

  // חישוב תוצאות סופיות לכל שחקן
  const finalResults = initialSummary.playersResults.map(player => 
    calculateFinalPlayerResult(
      player,
      openGameWinCounts[player.id] || 0,
      rebuyAmount
    )
  );

  // חישוב סכומים סופיים
  const totalWins = finalResults
    .filter(p => p.finalResultMoney > 0)
    .reduce((sum, p) => sum + p.finalResultMoney, 0);
  
  const totalLosses = finalResults
    .filter(p => p.finalResultMoney < 0)
    .reduce((sum, p) => sum + Math.abs(p.finalResultMoney), 0);

  // חישוב תשלומים אופטימליים
  const payments = calculateOptimalPayments(finalResults, paymentUnits);

  return {
    playersResults: finalResults,
    totalWins,
    totalLosses,
    difference: 0, // אין הפרש בתוצאה הסופית
    openGamesCount: initialSummary.openGamesCount,
    payments
  };
}

/**
 * חישוב תשלומים אופטימליים
 */
export function calculateOptimalPayments(
  playersResults: PlayerCalculationResult[],
  paymentUnits: PaymentUnit[]
): Payment[] {
  const payments: Payment[] = [];
  
  // המרת התוצאות לרשימה משולבת של שחקנים ויחידות תשלום
  const entities: PlayerOrUnit[] = [];
  
  // מיפוי שחקנים ליחידות תשלום שלהם
  const playerToUnitMap = new Map<string, string>();
  paymentUnits.forEach(unit => {
    if (unit.isActive) { // רק יחידות תשלום פעילות
      unit.players.forEach(playerId => {
        playerToUnitMap.set(playerId, unit.id);
      });
    }
  });
  
  // איסוף תוצאות לפי יחידות תשלום
  const unitResults = new Map<string, number>();
  
  playersResults.forEach(player => {
    const unitId = playerToUnitMap.get(player.id);
    if (unitId) {
      // השחקן שייך ליחידת תשלום
      const currentAmount = unitResults.get(unitId) || 0;
      unitResults.set(unitId, currentAmount + player.finalResultMoney);
    } else {
      // שחקן בודד
      entities.push({
        id: player.id,
        type: 'player',
        amount: player.finalResultMoney
      });
    }
  });
  
  // הוספת יחידות תשלום לרשימת הישויות
  unitResults.forEach((amount, unitId) => {
    const unit = paymentUnits.find(u => u.id === unitId);
    if (unit) {
      entities.push({
        id: unitId,
        type: 'unit',
        amount: amount,
        members: unit.players
      });
    }
  });
  
  // מיון לפי רווח/הפסד
  const winners = entities
    .filter(e => e.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  
  const losers = entities
    .filter(e => e.amount < 0)
    .sort((a, b) => a.amount - b.amount);
  
  // חישוב תשלומים
  winners.forEach(winner => {
    let remainingToReceive = winner.amount;
    
    while (remainingToReceive > 0 && losers.length > 0) {
      const currentLoser = losers[0];
      const amountToPayFromLoser = Math.min(
        remainingToReceive,
        Math.abs(currentLoser.amount)
      );

      if (amountToPayFromLoser > 0) {
        payments.push({
          from: {
            userId: currentLoser.type === 'player' ? currentLoser.id : undefined,
            unitId: currentLoser.type === 'unit' ? currentLoser.id : undefined
          },
          to: {
            userId: winner.type === 'player' ? winner.id : undefined,
            unitId: winner.type === 'unit' ? winner.id : undefined
          },
          amount: Number(amountToPayFromLoser.toFixed(2))
        });

        remainingToReceive -= amountToPayFromLoser;
        currentLoser.amount += amountToPayFromLoser;

        // הסרת המפסיד אם שילם הכל
        if (currentLoser.amount === 0) {
          losers.shift();
        }
      }
    }
  });

  return payments;
}