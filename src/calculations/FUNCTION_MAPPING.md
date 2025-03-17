# מיפוי פונקציות חישוב

מסמך זה מציג את המיפוי בין פונקציות החישוב הישנות לפונקציות החדשות במערכת החישוב המשופרת.

## פונקציות שחקן

| פונקציה ישנה | נתיב | פונקציה חדשה | מיקום חדש |
|-------------|-----|--------------|-----------|
| `calculateTotalProfit` | `src/utils/calculators/statisticsCalculator.ts` | `calculatePlayerStats` | `src/calculations/player/stats.ts` |
| `calculateGamesPlayed` | `src/utils/calculators/statisticsCalculator.ts` | `calculatePlayerStats` | `src/calculations/player/stats.ts` |
| `calculateGamesWon` | `src/utils/calculators/statisticsCalculator.ts` | `calculatePlayerStats` | `src/calculations/player/stats.ts` |
| `calculateWinPercentage` | `src/utils/calculators/statisticsCalculator.ts` | `calculatePlayerStats` | `src/calculations/player/stats.ts` |
| `calculateAverageProfitPerGame` | `src/utils/calculators/statisticsCalculator.ts` | `calculatePlayerStats` | `src/calculations/player/stats.ts` |
| `calculatePlayerRankingByProfit` | `src/utils/calculators/statisticsCalculator.ts` | `calculatePlayerRanking` | `src/calculations/player/ranking.ts` |
| `calculatePlayerRankingByAverageProfit` | `src/utils/calculators/statisticsCalculator.ts` | `calculatePlayerRanking` | `src/calculations/player/ranking.ts` |
| `getPlayerStatistics` | `src/services/statistics/playerStatistics.ts` | `calculatePlayerStats` | `src/calculations/player/stats.ts` |
| `getPlayerRankings` | `src/services/statistics/playerStatistics.ts` | `calculatePlayerRanking` | `src/calculations/player/ranking.ts` |

## פונקציות משחק

| פונקציה ישנה | נתיב | פונקציה חדשה | מיקום חדש |
|-------------|-----|--------------|-----------|
| `calculatePlayerInvestment` | `src/utils/gameCalculations.ts` | `calculatePlayerInvestment` | `src/calculations/legacy/gameBridge.ts` |
| `calculateInitialPlayerResult` | `src/utils/gameCalculations.ts` | `calculateInitialPlayerResult` | `src/calculations/legacy/gameBridge.ts` |
| `calculateFinalPlayerResult` | `src/utils/gameCalculations.ts` | `calculateFinalPlayerResult` | `src/calculations/legacy/gameBridge.ts` |
| `calculateGameSummary` | `src/utils/gameCalculations.ts` | `calculateGameResults` | `src/calculations/game/results.ts` |
| `calculateOptimalPayments` | `src/utils/gameCalculations.ts` | `calculateOptimalPayments` | `src/calculations/game/payments.ts` |
| `getGameStatistics` | `src/services/statistics/gameStatistics.ts` | `calculateGameResults` | `src/calculations/game/results.ts` |
| `getPlayerResultsForGame` | `src/services/statistics/gameStatistics.ts` | `calculateGamePlayersResults` | `src/calculations/game/results.ts` |
| `getPaymentsForGame` | `src/services/statistics/gameStatistics.ts` | `calculateOptimalPayments` | `src/calculations/game/payments.ts` |

## פונקציות סטטיסטיקות פיננסיות

| פונקציה ישנה | נתיב | פונקציה חדשה | מיקום חדש |
|-------------|-----|--------------|-----------|
| `getProfitDistribution` | `src/services/statistics/moneyStatistics.ts` | `calculateProfitDistribution` | `src/calculations/distributions/profit.ts` |
| `getMoneyFlow` | `src/services/statistics/moneyStatistics.ts` | `calculateMoneyFlow` | `src/calculations/financial/profit.ts` |
| `clearMoneyFlowCache` | `src/services/statistics/moneyStatistics.ts` | `CacheManager.invalidateCategory('moneyFlow')` | `src/calculations/cache/CacheManager.ts` |
| `getCumulativeProfitList` | `src/services/statistics/moneyStatistics.ts` | `calculateCumulativeProfit` | `src/calculations/financial/profit.ts` |
| `getBestSingleGameProfitList` | `src/services/statistics/moneyStatistics.ts` | `calculateExtremeProfit (type=best)` | `src/calculations/financial/profit.ts` |
| `getWorstSingleGameLossList` | `src/services/statistics/moneyStatistics.ts` | `calculateExtremeProfit (type=worst)` | `src/calculations/financial/profit.ts` |

## פונקציות מגמות זמן

| פונקציה ישנה | נתיב | פונקציה חדשה | מיקום חדש |
|-------------|-----|--------------|-----------|
| `getProfitTrendByTime` | `src/services/statistics/timeStatistics.ts` | `calculateTimeTrend (metric=profit)` | `src/calculations/time/trends.ts` |
| `getGamesCountTrendByTime` | `src/services/statistics/timeStatistics.ts` | `calculateTimeTrend (metric=games)` | `src/calculations/time/trends.ts` |
| `getInvestmentTrendByTime` | `src/services/statistics/timeStatistics.ts` | `calculateTimeTrend (metric=investment)` | `src/calculations/time/trends.ts` |
| `getWinRateTrendByTime` | `src/services/statistics/timeStatistics.ts` | `calculateTimeTrend (metric=winRate)` | `src/calculations/time/trends.ts` |

## פונקציות עזר וסינון

| פונקציה ישנה | נתיב | פונקציה חדשה | מיקום חדש |
|-------------|-----|--------------|-----------|
| `filterGames` | `src/services/statistics/statisticsService.ts` | `filterGames` | `src/calculations/core/utils.ts` |
| `createGameDate` | `src/utils/dateUtils.ts` | נשארת במקומה המקורי | `src/utils/dateUtils.ts` |
| `formatCurrency` | `src/utils/currencyFormatter.ts` | נשארת במקומה המקורי | `src/utils/currencyFormatter.ts` |

## יתרונות השכבה החדשה

1. **אחידות**: פונקציות דומות קובצו למודולים לוגיים
2. **מטמון מרכזי**: מערכת מטמון אחידה לכל הפונקציות
3. **תוצאות עקביות**: פורמט תוצאה אחיד עם מטה-נתונים
4. **התרחבות**: קל להוסיף פונקציות חדשות
5. **תחזוקה**: קל לעדכן לוגיקה מבלי לשבור ממשקים קיימים

## שימוש באמצעות מודול גישור

לשם תמיכה בקוד הקיים, נוצר מודול גישור שמייצא פונקציות עם שמות זהים לפונקציות הישנות.
ניתן להשתמש בפונקציות אלו כדי להחליף בהדרגה את הפונקציות הישנות:

```typescript
// במקום
import { calculateTotalProfit } from '../utils/calculators/statisticsCalculator';

// השתמש ב
import { calculateTotalProfit } from '../calculations/legacy';
```

## מעבר לפונקציות החדשות

מומלץ לעבור בהדרגה לפונקציות החדשות. לדוגמה:

```typescript
// במקום (בגישור)
export function calculateTotalProfit(userId: string, games: Game[], timeFilter?: string, groupId?: string): number {
  const params: PlayerStatsParams = { userId, games, timeFilter, groupId };
  const result = calculatePlayerStats(params);
  return result.data.totalProfit;
}

// השתמש ישירות בפונקציה החדשה
import { calculatePlayerStats, PlayerStatsParams } from '../calculations';

const params: PlayerStatsParams = { userId, games, timeFilter, groupId };
const result = calculatePlayerStats(params);
const totalProfit = result.data.totalProfit;
// בנוסף, מקבלים מידע נוסף כמו משחקים שנוצחו, אחוז ניצחונות, וכו'
``` 