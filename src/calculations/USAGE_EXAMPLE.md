# דוגמאות שימוש בשכבת החישובים החדשה

מסמך זה כולל דוגמאות לשימוש בפונקציות החישוב החדשות והמעבר מהפונקציות הישנות.

## דוגמה 1: עדכון קומפוננטת סטטיסטיקות שחקן

### לפני העדכון

```tsx
// src/components/statistics/PlayerStatistics.tsx
import React, { useEffect, useState } from 'react';
import { Game } from '../../models/Game';
import { UserProfile } from '../../models/UserProfile';
import { 
  calculateTotalProfit, 
  calculateGamesPlayed, 
  calculateWinPercentage, 
  calculateAverageProfitPerGame 
} from '../../utils/calculators/statisticsCalculator';

interface PlayerStatisticsProps {
  userId: string;
  games: Game[];
  timeFilter?: string;
  groupId?: string;
}

const PlayerStatistics: React.FC<PlayerStatisticsProps> = ({ 
  userId, 
  games, 
  timeFilter, 
  groupId 
}) => {
  const [totalProfit, setTotalProfit] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [winPercentage, setWinPercentage] = useState(0);
  const [averageProfit, setAverageProfit] = useState(0);

  useEffect(() => {
    // חישוב סטטיסטיקות בעזרת הפונקציות הישנות
    setTotalProfit(calculateTotalProfit(userId, games, timeFilter, groupId));
    setGamesPlayed(calculateGamesPlayed(userId, games, timeFilter, groupId));
    setWinPercentage(calculateWinPercentage(userId, games, timeFilter, groupId));
    setAverageProfit(calculateAverageProfitPerGame(userId, games, timeFilter, groupId));
  }, [userId, games, timeFilter, groupId]);

  // שאר הקומפוננטה...
};
```

### שימוש במודול גישור (שלב ביניים)

```tsx
// src/components/statistics/PlayerStatistics.tsx
import React, { useEffect, useState } from 'react';
import { Game } from '../../models/Game';
import { UserProfile } from '../../models/UserProfile';
import { 
  calculateTotalProfit, 
  calculateGamesPlayed, 
  calculateWinPercentage, 
  calculateAverageProfitPerGame 
} from '../../calculations/legacy'; // שינוי כאן - ייבוא מהגישור

interface PlayerStatisticsProps {
  userId: string;
  games: Game[];
  timeFilter?: string;
  groupId?: string;
}

const PlayerStatistics: React.FC<PlayerStatisticsProps> = ({ 
  userId, 
  games, 
  timeFilter, 
  groupId 
}) => {
  const [totalProfit, setTotalProfit] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [winPercentage, setWinPercentage] = useState(0);
  const [averageProfit, setAverageProfit] = useState(0);

  useEffect(() => {
    // אותו קוד, רק הפונקציות מגיעות ממקום אחר
    setTotalProfit(calculateTotalProfit(userId, games, timeFilter, groupId));
    setGamesPlayed(calculateGamesPlayed(userId, games, timeFilter, groupId));
    setWinPercentage(calculateWinPercentage(userId, games, timeFilter, groupId));
    setAverageProfit(calculateAverageProfitPerGame(userId, games, timeFilter, groupId));
  }, [userId, games, timeFilter, groupId]);

  // שאר הקומפוננטה...
};
```

### שימוש בפונקציות החדשות (שלב סופי)

```tsx
// src/components/statistics/PlayerStatistics.tsx
import React, { useEffect, useState } from 'react';
import { Game } from '../../models/Game';
import { UserProfile } from '../../models/UserProfile';
import { 
  calculatePlayerStats, 
  PlayerStatsParams 
} from '../../calculations'; // שימוש בפונקציות החדשות

interface PlayerStatisticsProps {
  userId: string;
  games: Game[];
  timeFilter?: string;
  groupId?: string;
}

const PlayerStatistics: React.FC<PlayerStatisticsProps> = ({ 
  userId, 
  games, 
  timeFilter, 
  groupId 
}) => {
  const [stats, setStats] = useState<any>({
    totalProfit: 0,
    totalGames: 0,
    winPercentage: 0,
    averageProfitPerGame: 0,
    // כעת יש לנו יותר מידע!
    gamesWon: 0,
    longestWinStreak: 0,
    longestLoseStreak: 0,
    totalInvestment: 0,
    roi: 0
  });

  useEffect(() => {
    // חישוב כל הסטטיסטיקות בבת אחת 
    const params: PlayerStatsParams = {
      userId,
      games,
      timeFilter,
      groupId
    };
    
    const result = calculatePlayerStats(params);
    setStats(result.data);
    
    // אפשר גם לבדוק אם התוצאה מגיעה מהמטמון
    console.log(`Results cached: ${result.metadata.cached}`);
    console.log(`Calculation time: ${result.metadata.executionTimeMs}ms`);
  }, [userId, games, timeFilter, groupId]);

  return (
    <div className="player-statistics">
      <h2>סטטיסטיקות שחקן</h2>
      <div className="stats-grid">
        <div className="stat-item">
          <span className="stat-label">סה"כ רווח:</span>
          <span className="stat-value">{stats.totalProfit}₪</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">משחקים:</span>
          <span className="stat-value">{stats.totalGames}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">ניצחונות:</span>
          <span className="stat-value">{stats.gamesWon} ({stats.winPercentage}%)</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">רווח ממוצע:</span>
          <span className="stat-value">{stats.averageProfitPerGame}₪</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">סך השקעה:</span>
          <span className="stat-value">{stats.totalInvestment}₪</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">ROI:</span>
          <span className="stat-value">{stats.roi}%</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">רצף ניצחונות הארוך ביותר:</span>
          <span className="stat-value">{stats.longestWinStreak}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">רצף הפסדים הארוך ביותר:</span>
          <span className="stat-value">{stats.longestLoseStreak}</span>
        </div>
      </div>
    </div>
  );
};

export default PlayerStatistics;
```

## דוגמה 2: שימוש בחישוב זרימת כספים

### לפני העדכון

```tsx
// src/components/statistics/MoneyFlowNetwork.tsx
import React, { useEffect, useState } from 'react';
import { Game } from '../../models/Game';
import { getMoneyFlow, clearMoneyFlowCache } from '../../services/statistics/moneyStatistics';

interface MoneyFlowNetworkProps {
  games: Game[];
  timeFilter?: string;
  groupId?: string;
}

const MoneyFlowNetwork: React.FC<MoneyFlowNetworkProps> = ({ 
  games, 
  timeFilter, 
  groupId 
}) => {
  const [network, setNetwork] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);

    // שימוש בפונקציות הישנות
    const moneyFlow = getMoneyFlow(games, timeFilter, groupId);
    setNetwork({
      nodes: moneyFlow.nodes,
      links: moneyFlow.links
    });

    setLoading(false);
  }, [games, timeFilter, groupId]);

  const handleRefresh = () => {
    clearMoneyFlowCache();
    // חישוב מחדש...
  };

  // שאר הקומפוננטה...
};
```

### שימוש בפונקציות החדשות

```tsx
// src/components/statistics/MoneyFlowNetwork.tsx
import React, { useEffect, useState } from 'react';
import { Game } from '../../models/Game';
import { 
  calculateMoneyFlow, 
  MoneyFlowParams,
  CacheManager
} from '../../calculations';

interface MoneyFlowNetworkProps {
  games: Game[];
  timeFilter?: string;
  groupId?: string;
}

const MoneyFlowNetwork: React.FC<MoneyFlowNetworkProps> = ({ 
  games, 
  timeFilter, 
  groupId 
}) => {
  const [network, setNetwork] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(false);
  const [cacheStats, setCacheStats] = useState<any>(null);

  useEffect(() => {
    setLoading(true);

    // שימוש בפונקציות החדשות
    const params: MoneyFlowParams = {
      games,
      timeFilter,
      groupId
    };
    
    const result = calculateMoneyFlow(params);
    setNetwork({
      nodes: result.data.nodes,
      links: result.data.links
    });
    
    // נתונים נוספים שלא היו זמינים בגרסה הישנה
    setCacheStats({
      cached: result.metadata.cached,
      executionTimeMs: result.metadata.executionTimeMs,
      timestamp: result.metadata.timestamp
    });

    setLoading(false);
  }, [games, timeFilter, groupId]);

  const handleRefresh = () => {
    // ניקוי מטמון ספציפי
    CacheManager.invalidateCategory('moneyFlow');
    // חישוב מחדש...
  };

  return (
    <div className="money-flow-network">
      <div className="controls">
        <button onClick={handleRefresh}>רענון</button>
        {cacheStats && (
          <div className="cache-info">
            <span>מטמון: {cacheStats.cached ? 'כן' : 'לא'}</span>
            <span>זמן חישוב: {cacheStats.executionTimeMs}ms</span>
            <span>זמן עדכון: {new Date(cacheStats.timestamp).toLocaleString()}</span>
          </div>
        )}
      </div>
      
      {loading ? (
        <div className="loading">טוען נתונים...</div>
      ) : (
        <div className="network-visualization">
          {/* הוויזואליזציה של הרשת */}
          {network.nodes.length === 0 ? (
            <div className="no-data">אין נתונים להצגה</div>
          ) : (
            <div>
              <div>מספר שחקנים: {network.nodes.length}</div>
              <div>מספר קשרים: {network.links.length}</div>
              {/* רינדור הרשת באמצעות ספריית ויזואליזציה */}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MoneyFlowNetwork;
```

## סיכום

המעבר לשכבת החישובים החדשה מציע מספר יתרונות:

1. **ביצועים משופרים** באמצעות מטמון חכם
2. **קוד נקי יותר** עם פחות שכפולים
3. **מידע עשיר יותר** בכל קריאה לפונקציה
4. **מידע על ביצועים** כחלק ממטה-נתונים
5. **יכולת הרחבה** קלה יותר עם ארכיטקטורה מודולרית

המעבר יכול להתבצע בהדרגה:
1. מעבר לשימוש במודול הגישור
2. שינוי לוגיקה בקומפוננטות להשתמש במידע הנוסף
3. מעבר לשימוש ישיר בפונקציות החדשות 

## שימוש בפונקציות ישירות

### סטטיסטיקות שחקן

```typescript
import { calculatePlayerStats, PlayerStatsParams } from '../calculations';

// שימוש בפונקציה החדשה
function getPlayerStatistics(userId: string, games: Game[]) {
  const params: PlayerStatsParams = {
    userId,
    games,
    timeFilter: 'month' // אופציונלי
  };
  
  const result = calculatePlayerStats(params);
  
  // תוצאה מלאה עם מטה-נתונים
  console.log(result.metadata.executionTimeMs); // זמן ריצה במילישניות
  console.log(result.metadata.cached); // האם התוצאה מגיעה מהמטמון
  
  // התוצאה עצמה
  const stats = result.data;
  return stats;
}
```

### תוצאות משחק

```typescript
import { calculateGameResults, GameResultsParams } from '../calculations';

function getGameSummary(gameId: string, game: Game) {
  const params: GameResultsParams = {
    gameId,
    game // העברת אובייקט המשחק חוסכת קריאת API נוספת
  };
  
  const result = calculateGameResults(params);
  return result.data;
}
```

### חישוב תשלומים

```typescript
import { calculateOptimalPayments, OptimalPaymentsParams } from '../calculations';

function getPaymentsForGame(gameId: string, game: Game) {
  const params: OptimalPaymentsParams = {
    gameId,
    game
  };
  
  const result = calculateOptimalPayments(params);
  return result.data.payments;
}
```

### התפלגות רווחים

```typescript
import { calculateProfitDistribution, ProfitDistributionParams } from '../calculations';

function getProfitDistribution(games: Game[], groupId?: string) {
  const params: ProfitDistributionParams = {
    games,
    groupId
  };
  
  const result = calculateProfitDistribution(params);
  return result.data.items;
}
```

### מגמות זמן

```typescript
import { calculateTimeTrend, TimeTrendParams } from '../calculations';

function getProfitTrendByMonth(games: Game[], userId?: string) {
  const params: TimeTrendParams = {
    games,
    userId,
    timeUnit: 'month',
    metric: 'profit'
  };
  
  const result = calculateTimeTrend(params);
  
  return {
    labels: result.data.items.map(item => item.periodLabel),
    data: result.data.items.map(item => item.value),
    trend: result.data.trend
  };
}
```

## שימוש דרך מודולי הגישור

לתמיכה בקוד קיים, ניתן להשתמש במודולי הגישור:

```typescript
import { 
  calculateTotalProfit, 
  getPlayerStatistics, 
  calculateGameSummary
} from '../calculations/legacy';

// קריאות זהות לאלו הישנות
const profit = calculateTotalProfit(userId, games);
const playerStats = getPlayerStatistics(userId, games);
const gameSummary = calculateGameSummary(game);
```

## טיפים והמלצות

1. **העדיפו להעביר את אובייקט המשחק**:
   ```typescript
   // פחות מומלץ - ייתכן ויגרום לקריאת API נוספת
   calculateGameResults({ gameId });
   
   // מומלץ - שימוש בנתונים שכבר קיימים
   calculateGameResults({ gameId, game });
   ```

2. **השתמשו באפשרויות המטמון**:
   ```typescript
   // חישוב מחדש גם אם קיים במטמון
   calculatePlayerStats(params, { forceRefresh: true });
   
   // ביטול המטמון לחלוטין
   calculatePlayerStats(params, { useCache: false });
   ```

3. **תכננו מראש לפי מטמון**:
   ```typescript
   // אפשר לחשב קודם את כל הנתונים הדרושים
   calculatePlayerStats({ userId, games });
   
   // ואז להשתמש בנתונים מהמטמון לשליפות נוספות
   calculatePlayerRanking({ games, users, sortBy: 'totalProfit' });
   calculatePlayerRanking({ games, users, sortBy: 'winRate' });
   ```

4. **התמודדות עם שגיאות**:
   ```typescript
   try {
     const result = calculatePlayerStats(params);
     return result.data;
   } catch (error) {
     console.error('שגיאה בחישוב סטטיסטיקות:', error);
     return defaultStats;
   }
   ```

5. **מעבר הדרגתי מפונקציות ישנות לחדשות**:
   ```typescript
   // קודם - השתמשו במודול הגישור
   import { calculateTotalProfit } from '../calculations/legacy';
   
   // אחר כך - עברו לפונקציה החדשה ישירות
   import { calculatePlayerStats } from '../calculations';
   ``` 