// src/contexts/GameContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { GameDate } from '@/models/Game';  // Import GameDate type

/**
 * הגדרות צ'יפים עבור Buy-In ו-Rebuy
 */
export interface ChipsConfig {
  chips: number;    // כמות הצ'יפים
  amount: number;   // הערך הכספי בש"ח
}

/**
 * סטטוס המשחק - מותאם לתהליך החדש
 */
export type GameStatus = 
  | 'active'        // משחק פעיל - מתחיל ב-NewGameSetup
  | 'ended'         // משחק הסתיים - אחרי GameManagement
  | 'open_games'    // במשחקים פתוחים
  | 'final_results' // בתוצאות סופיות
  | 'payments'      // בחישובי תשלומים
  | 'completed';    // הושלם - אחרי שמירת המשחק

/**
 * טיפוס לתשלום
 */
export interface Payment {
  from: {
    unitId?: string;
    userId?: string;
  };
  to: {
    unitId?: string;
    userId?: string;
  };
  amount: number;
}

/**
 * טיפוס ללוג פעולות ריבאיי
 */
export interface RebuyLogEntry {
  id: string;
  playerId: string;
  playerName: string;
  action: 'add' | 'remove';
  time: string;  // HH:MM format
}

/**
 * טיפוס למשחק פתוח
 */
export interface OpenGame {
  id: number;        // 1, 2, 3, etc.
  winner?: string;   // מזהה השחקן שזכה
  createdAt: number;
}

/**
 * נתוני ההשקעה של השחקן
 */
export interface PlayerInvestment {
  buyInCount: number;    // מספר הפעמים של Buy-In
  buyInTotal: number;    // סכום כולל של Buy-In
  rebuyCount: number;    // מספר ה-Rebuys
  rebuyTotal: number;    // סכום כולל של Rebuys
  overall: number;       // סכום כולל של ההשקעה
}

/**
 * נתוני משחקים פתוחים של השחקן
 */
export interface OpenGamesBonus {
  winsCount: number;     // מספר הזכיות במשחקים פתוחים
  bonusAmount: number;   // סכום הבונוס
}

/**
 * טיפוס לנתוני שחקן - כולל כל השדות הנדרשים
 */
export interface Player {
  // נתוני זיהוי
  id: string;
  name: string;

  // נתוני קנייה ומשחק
  buyInCount: number;
  rebuyCount: number;
  finalChips?: string;

  // נתונים מחושבים - חישוב ראשוני
  exactChipsValue?: number;      // ערך מדויק של הצ'יפים
  roundedRebuysCount?: number;   // מספר ריבאיים לאחר עיגול
  resultBeforeOpenGames?: number;// תוצאה לפני משחקים פתוחים

  // נתוני משחקים פתוחים
  openGameWins?: number;         // מספר זכיות במשחקים פתוחים
  finalResultMoney?: number;     // תוצאה סופית כולל משחקים פתוחים

  // נתונים מפורטים
  totalInvestment?: {           // פירוט ההשקעה
    buyInCount: number;
    buyInTotal: number;
    rebuyCount: number;
    rebuyTotal: number;
    overall: number;
  };
  openGamesBonus?: {            // פירוט בונוס ממשחקים פתוחים
    winsCount: number;
    bonusAmount: number;
  };
}

/**
 * טיפוס לנתוני המשחק
 */
export interface GameData {
  // נתוני משחק בסיסיים
  gameDate: GameDate;  // Changed from Date to GameDate
  status: GameStatus;
  
  // נתוני קבוצה
  groupId: string;
  groupNameSnapshot: string;
  buyInSnapshot: ChipsConfig;
  rebuySnapshot: ChipsConfig;
  useRoundingRule: boolean;
  roundingRulePercentage: number;
  
  // שחקנים ולוגים
  players: Player[];
  rebuyLogs: RebuyLogEntry[];
  
  // נתוני משחקים פתוחים
  openGames?: OpenGame[];
  
  // נתוני תשלומים
  payments?: Payment[];
  
  // סיכומים
  totalWins: number;
  totalLosses: number;
  difference: number;
  openGamesCount: number;
  
  // מטה-דאטה
  createdAt?: number;
  updatedAt?: number;
}

// Helper function to create GameDate from current date
const getCurrentGameDate = (): GameDate => {
  const now = new Date();
  return {
    day: now.getDate(),
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    timestamp: now.getTime()
  };
};

// ערכי ברירת מחדל למשחק חדש
const defaultGameData: GameData = {
  gameDate: getCurrentGameDate(),  // Using new GameDate structure
  status: 'active',
  groupId: '',
  groupNameSnapshot: '',
  buyInSnapshot: { chips: 0, amount: 0 },
  rebuySnapshot: { chips: 0, amount: 0 },
  useRoundingRule: false,
  roundingRulePercentage: 0,
  players: [],
  rebuyLogs: [],
  totalWins: 0,
  totalLosses: 0,
  difference: 0,
  openGamesCount: 0
};

interface GameContextType {
  gameData: GameData;
  setGameData: (data: GameData | ((prevData: GameData) => GameData)) => void;
  updatePlayer: (playerId: string, updatedData: Partial<Player>) => void;
  addRebuyLog: (log: RebuyLogEntry) => void;
  updateGameStatus: (newStatus: GameStatus) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const [gameData, setGameData] = useState<GameData>(defaultGameData);

  const updatePlayer = (playerId: string, updatedData: Partial<Player>) => {
    setGameData(prev => ({
      ...prev,
      players: prev.players.map(p =>
        p.id === playerId ? { ...p, ...updatedData } : p
      ),
    }));
  };

  const addRebuyLog = (log: RebuyLogEntry) => {
    setGameData(prev => ({
      ...prev,
      rebuyLogs: [log, ...prev.rebuyLogs],
    }));
  };

  const updateGameStatus = (newStatus: GameStatus) => {
    setGameData(prev => ({
      ...prev,
      status: newStatus,
      updatedAt: Date.now(),
    }));
  };

  return (
    <GameContext.Provider value={{ 
      gameData, 
      setGameData, 
      updatePlayer, 
      addRebuyLog,
      updateGameStatus
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGameContext = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGameContext must be used within a GameProvider');
  }
  return context;
};