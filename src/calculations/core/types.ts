/**
 * טיפוסים בסיסיים לשכבת החישובים
 */

import { Game, GameDate } from '../../models/Game';
import { UserProfile } from '../../models/UserProfile';
import { Group } from '../../models/Group';

/**
 * מטא-נתונים של תוצאת חישוב
 */
export interface CalculationMetadata {
  timestamp: number;          // זמן ביצוע החישוב
  source: string[];          // מקורות הנתונים (לדוגמה: 'games', 'users')
  filters?: Record<string, any>; // פילטרים שהופעלו בחישוב
}

/**
 * תוצאת חישוב גנרית
 */
export interface CalculationResult<T> {
  /** נתוני התוצאה */
  data: T;
  /** מטה-נתונים על החישוב */
  metadata: {
    /** האם התוצאה מגיעה מהמטמון */
    cached: boolean;
    /** זמן ביצוע החישוב (ms) */
    executionTimeMs: number;
    /** חותמת זמן של החישוב */
    timestamp: number;
    /** מזהה ייחודי של החישוב */
    calculationId: string;
  };
}

/**
 * אפשרויות חישוב גנריות
 */
export interface CalculationOptions {
  useCache?: boolean;        // האם להשתמש במטמון
  forceRefresh?: boolean;    // האם לחשב מחדש גם אם יש במטמון
  logger?: (message: string, data?: any) => void; // פונקציית לוג
}

/**
 * פילטר זמן
 */
export type TimeFilter = 'all' | 'month' | 'quarter' | 'year' | 'custom';

/**
 * פילטר משחקים
 */
export interface GameFilter {
  timeFilter?: TimeFilter;
  startDate?: GameDate;
  endDate?: GameDate;
  groupId?: string;
  userId?: string;
  status?: string[];
}

/**
 * פונקציית חישוב גנרית
 */
export type CalculationFunction<Params, Result> = 
  (params: Params, options?: CalculationOptions) => CalculationResult<Result>;

/**
 * פרמטרים בסיסיים משותפים לרוב החישובים
 */
export interface BaseCalculationParams {
  /** רשימת משחקים */
  games: Game[];
  /** סינון לפי זמן (אופציונלי) */
  timeFilter?: string;
  /** סינון לפי קבוצה (אופציונלי) */
  groupId?: string;
}

/**
 * פרמטרים לחישוב סטטיסטיקות שחקן
 */
export interface PlayerStatsParams extends BaseCalculationParams {
  /** מזהה השחקן */
  userId: string;
  /** מערך של מזהי משחקים (אופציונלי) */
  gameIds?: string[];
}

/**
 * תוצאת חישוב סטטיסטיקות שחקן
 */
export interface PlayerStatsResult {
  /** סך משחקים ששוחקו */
  totalGames: number;
  /** סך משחקים שנוצחו */
  gamesWon: number;
  /** אחוז ניצחונות */
  winPercentage: number;
  /** סך הכל רווח */
  totalProfit: number;
  /** רווח ממוצע למשחק */
  averageProfitPerGame: number;
  /** סך השקעה בכל המשחקים */
  totalInvestment: number;
  /** תשואה על ההשקעה (ROI) באחוזים */
  roi: number;
  /** סטיית תקן של רווח */
  profitStdDev: number;
  /** רצף ניצחונות הארוך ביותר */
  longestWinStreak: number;
  /** רצף הפסדים הארוך ביותר */
  longestLoseStreak: number;
  /** רצף ניצחונות נוכחי */
  currentWinStreak: number;
  /** המשחק עם הרווח הגבוה ביותר */
  bestGame?: {
    gameId: string;
    profit: number;
    date: string;
  };
  /** המשחק עם ההפסד הגבוה ביותר */
  worstGame?: {
    gameId: string;
    profit: number;
    date: string;
  };
}

/**
 * פרמטרים לחישוב דירוג שחקנים
 */
export interface PlayerRankingParams extends BaseCalculationParams {
  /** רשימת משתמשים */
  users: UserProfile[];
  /** שדה המיון */
  sortBy: 'totalProfit' | 'averageProfit' | 'winRate' | 'gamesPlayed';
  /** סדר המיון */
  order: 'asc' | 'desc';
  /** הגבלת מספר התוצאות */
  limit?: number;
}

/**
 * תוצאת דירוג שחקן בודד
 */
export interface PlayerRankingResult {
  userId: string;
  displayName: string;
  profilePicture?: string;
  totalProfit: number;
  averageProfit: number;
  totalGames: number;
  gamesWon: number;
  winRate: number;
  rank: number;
}

/**
 * פרמטרים לחישוב תוצאות משחק
 */
export interface GameResultsParams {
  /** מזהה משחק */
  gameId: string;
  /** אובייקט המשחק (אופציונלי) */
  game?: Game;
}

/**
 * תוצאת חישוב משחק
 */
export interface GameResultsResult {
  /** סך הכל buy-ins */
  totalBuyins: number;
  /** סך הכל rebuys */
  totalRebuys: number;
  /** סך הכל השקעה */
  totalInvestment: number;
  /** תוצאות שחקנים */
  playerResults: any[];
}

/**
 * פרמטרים לחישוב תוצאות שחקני משחק
 */
export interface GamePlayersResultsParams {
  /** מזהה משחק */
  gameId: string;
  /** אובייקט המשחק (אופציונלי) */
  game?: Game;
}

/**
 * תוצאת חישוב תוצאות שחקני משחק
 */
export interface GamePlayersResultsResult {
  gameId: string;
  playerResults: any[];
}

/**
 * פרמטרים לחישוב תשלומים אופטימליים
 */
export interface OptimalPaymentsParams {
  /** תוצאות השחקנים */
  playerResults: any[];
}

/**
 * תוצאת חישוב תשלומים אופטימליים
 */
export interface OptimalPaymentsResult {
  /** מזהה המשחק */
  gameId: string;
  /** סך הכל כסף שעבר */
  totalTransferred: number;
  /** מספר שחקנים מעורבים */
  playersInvolved: number;
  /** רשימת תשלומים */
  payments: {
    from: string;
    to: string;
    amount: number;
  }[];
}

/**
 * פרמטרים לחישוב התפלגות רווח/השקעה
 */
export interface ProfitDistributionParams extends BaseCalculationParams {
  /** מדד לחישוב */
  metric?: 'profit' | 'investment';
}

/**
 * תוצאות חישוב התפלגות רווח/השקעה
 */
export interface ProfitDistributionResult {
  labels: string[];
  data: number[];
  total: number;
  average: number;
}

/**
 * פרמטרים לחישוב זרימת כספים
 */
export interface MoneyFlowParams extends BaseCalculationParams {
  /** האם לכלול קשרים מתחת לסף מסוים */
  includeSmallFlows?: boolean;
  /** סף מינימלי לקשרים (כמות כסף) */
  minFlowAmount?: number;
}

/**
 * תוצאת חישוב זרימת כספים
 */
export interface MoneyFlowResult {
  nodes: {
    id: string;
    name: string;
    value: number;
    netProfit: number;
  }[];
  links: {
    source: string;
    target: string;
    value: number;
  }[];
  totalFlowAmount: number;
}

/**
 * פרמטרים לחישוב רווח מצטבר
 */
export interface CumulativeProfitParams extends BaseCalculationParams {
  /** מזהה שחקן */
  userId: string;
}

/**
 * תוצאת חישוב רווח מצטבר
 */
export interface CumulativeProfitResult {
  dates: string[];
  profits: number[];
  cumulativeProfits: number[];
}

/**
 * פרמטרים לחישוב רווח/הפסד קיצוני
 */
export interface ExtremeProfitParams extends BaseCalculationParams {
  /** סוג החישוב - רווח מקסימלי או הפסד מקסימלי */
  type: 'best' | 'worst';
  /** הגבלת מספר התוצאות */
  limit?: number;
}

/**
 * תוצאת חישוב רווח/הפסד קיצוני
 */
export interface ExtremeProfitResult {
  games: {
    gameId: string;
    date: string;
    userId: string;
    playerName: string;
    profit: number;
  }[];
}

/**
 * פרמטרים לחישוב מגמת זמן
 */
export interface TimeTrendParams extends BaseCalculationParams {
  /** מדד לחישוב */
  metric: 'profit' | 'games' | 'investment' | 'winRate';
  /** מרווח זמן */
  interval: 'day' | 'month' | 'year';
  /** מזהה שחקן (נדרש רק עבור חישוב winRate) */
  userId?: string;
}

/**
 * תוצאת חישוב מגמת זמן
 */
export interface TimeTrendResult {
  labels: string[];
  data: number[];
  trend: 'up' | 'down' | 'stable';
  changePercentage: number;
}

// טיפוסים לייבוא ממודלים אחרים (גישור)
export interface Game {
  id: string;
  gameDate?: string;
  players?: Player[];
  groupId?: string;
  status?: string;
}

export interface Player {
  userId: string;
  buyin?: number;
  rebuys?: Rebuy[];
  finalChips?: number;
  payments?: Payment[];
  result?: number;
}

export interface UserProfile {
  id: string;
  displayName: string;
  profilePicture?: string;
}

interface Rebuy {
  amount: number;
  timestamp?: number;
}

interface Payment {
  to: string;
  from: string;
  amount: number;
  timestamp?: number;
} 