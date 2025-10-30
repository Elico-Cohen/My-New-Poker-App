// src/contexts/GameContext.tsx
import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { GameDate, Game, PlayerInGame } from '@/models/Game';  // Import the needed types
import { 
  saveOrUpdateActiveGame, 
  getActiveGameById, 
  getLocalActiveGame, 
  clearLocalActiveGame,
  syncLocalActiveGameToFirestore
} from '@/services/gameSnapshot';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { auth } from '@/config/firebase';
import { getAllUsers } from '@/services/users';
import { clearGamesCache } from '@/services/gameDataManager';
import { setGlobalWaitForActiveSaves, setGlobalClearActiveGame, useAuth } from './AuthContext';

// מפתח לזיהוי המשחק הפעיל ב-AsyncStorage
const ACTIVE_GAME_ID_KEY = 'active_game_id';
// מרווח זמן מינימלי בין שמירות אוטומטיות (במילישניות)
const AUTO_SAVE_DEBOUNCE = 500;

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
  | 'completed'     // הושלם - אחרי שמירת המשחק
  | 'deleted';      // נמחק - לא בשימוש באפליקציה החדשה

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
 * טיפוס לנתוני המשחק - מותאם לשימוש בקונטקסט
 */
export interface GameData {
  // מזהה המשחק
  id?: string;

  // נתוני משחק בסיסיים
  gameDate: GameDate;           // תאריך המשחק
  status: GameStatus;           // סטטוס המשחק
  
  // נתוני קבוצה
  groupId: string;               // מזהה הקבוצה
  groupNameSnapshot: string;     // שם הקבוצה בזמן המשחק
  buyInSnapshot: ChipsConfig;    // הגדרות Buy-In בזמן המשחק
  rebuySnapshot: ChipsConfig;    // הגדרות Rebuy בזמן המשחק
  useRoundingRule: boolean;      // האם להשתמש בחוק העיגול
  roundingRulePercentage: number; // אחוז העיגול
  
  // שחקנים ולוגים
  players: Player[];             // רשימת שחקנים
  rebuyLogs: RebuyLogEntry[];    // לוג ריבאיים
  
  // נתוני משחקים פתוחים
  openGames?: OpenGame[];        // רשימת משחקים פתוחים
  
  // נתוני תשלומים
  payments?: Payment[];          // רשימת תשלומים
  
  // סיכומים
  totalWins: number;             // סך כל הזכיות
  totalLosses: number;           // סך כל ההפסדים
  difference: number;            // ההפרש בין זכיות להפסדים
  openGamesCount: number;        // מספר המשחקים הפתוחים
  
  // מטה-דאטה מורחבת לסנכרון חכם
  createdAt?: number;            // זמן יצירת המשחק
  updatedAt?: number;            // זמן עדכון אחרון בשרת
  createdBy?: string;            // מזהה המשתמש שיצר את המשחק
  lastSyncAt?: number;           // זמן סנכרון אחרון עם השרת  
  localModifiedAt?: number;      // זמן שינוי מקומי אחרון
  syncVersion?: number;          // גרסת סנכרון למניעת קונפליקטים
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
  gameDate: getCurrentGameDate(),
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
  saveActiveGame: () => Promise<string>;
  loadActiveGame: (gameId: string) => Promise<boolean>;
  clearActiveGame: () => Promise<void>;
  refreshActiveGameStatus: () => Promise<void>;
  isGameActive: boolean;
  isLoadingGame: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  isNetworkConnected: boolean;
  waitForActiveSaves: () => Promise<void>;
  // פונקציות חדשות לטיפול בהרשאות וניווט
  determineCorrectGameScreen: (gameStatus: GameStatus, userPermissions: { canContinue: boolean; canViewOnly: boolean }, gameId?: string) => string;
  canUserContinueThisGame: (gameData: GameData) => boolean;
  shouldUpdateStatus: (currentStatus: GameStatus, newStatus: GameStatus) => boolean;
  // פונקציות חדשות לסנכרון חכם
  hasLocalChanges: (gameData: GameData) => boolean;
  isGameOutdated: (localGame: GameData, serverUpdatedAt: number) => boolean;
  markLocalModification: () => void;
  markSyncCompleted: (serverUpdatedAt?: number) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const [gameData, setGameData] = useState<GameData>(defaultGameData);
  const [isGameActive, setIsGameActive] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoadingGame, setIsLoadingGame] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isNetworkConnected, setIsNetworkConnected] = useState<boolean>(true);
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const [needsSaving, setNeedsSaving] = useState<boolean>(false);
  const [activeSavePromise, setActiveSavePromise] = useState<Promise<void> | null>(null);

  // Get user from AuthContext
  const { user } = useAuth();

  // מעקב אחרי זמן הסנכרון האחרון למניעת עומס - using ref to avoid recreating listener
  const lastNetworkSyncTimeRef = React.useRef<number>(0);
  const NETWORK_SYNC_COOLDOWN = 5000; // 5 שניות בין ניסיונות סנכרון

  // Track active save operation with ref for better race condition handling
  const activeSavePromiseRef = React.useRef<Promise<string> | null>(null);
  const isSavingRef = React.useRef<boolean>(false);

  // Internal setGameData that doesn't update timestamps (for loading from server)
  const setGameDataInternal = useCallback((data: GameData | ((prevData: GameData) => GameData)) => {
    setGameData(prevData => {
      const newData = typeof data === 'function' ? data(prevData) : data;
      
      // Only set game as active if it's not the default game data (i.e., has actual game content)
      const hasGameContent = newData.groupId !== '' || newData.players.length > 0 || newData.id;
      if (hasGameContent) {
        setIsGameActive(true);
      }
      
      return newData;
    });
  }, []);

  // Wrapper for setGameData that also sets isGameActive to true and updates timestamps
  const wrappedSetGameData = useCallback((data: GameData | ((prevData: GameData) => GameData)) => {
    setGameData(prevData => {
      const newData = typeof data === 'function' ? data(prevData) : data;
      
      // Only set game as active if it's not the default game data (i.e., has actual game content)
      const hasGameContent = newData.groupId !== '' || newData.players.length > 0 || newData.id;
      if (hasGameContent) {
        setIsGameActive(true);
        
        // עדכון חכם של timestamps וסימון לשמירה
        const now = Date.now();
        const enhancedData = {
          ...newData,
          localModifiedAt: now,
          updatedAt: now
        };
        
        // רק אם באמת יש שינוי משמעותי
        const hasSignificantChange = !prevData.id || 
                                   prevData.status !== newData.status ||
                                   prevData.players.length !== newData.players.length ||
                                   prevData.totalWins !== newData.totalWins ||
                                   prevData.totalLosses !== newData.totalLosses ||
                                   prevData.openGamesCount !== newData.openGamesCount ||
                                   JSON.stringify(prevData.players) !== JSON.stringify(newData.players) ||
                                   JSON.stringify(prevData.rebuyLogs) !== JSON.stringify(newData.rebuyLogs);
        
        if (hasSignificantChange) {
          setNeedsSaving(true);
          console.log(`GameContext: Significant change detected, marking for save. Game ID: ${enhancedData.id || 'new'}, Status: ${enhancedData.status}`);
        } else {
          console.log(`GameContext: Minor change detected, not triggering save. Game ID: ${enhancedData.id || 'new'}`);
        }
        return enhancedData;
      }
      
      return newData;
    });
  }, []); // No dependencies to avoid infinite loops

  // עדיקת חיבור לרשת
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = state.isConnected ?? false;
      setIsNetworkConnected(connected);

      // כאשר חוזרים לחיבור, ננסה לסנכרן משחק מקומי לענן
      // אבל רק אם המשתמש מחובר ולא במצב הושלם
      if (connected && isGameActive && auth.currentUser && gameData.status !== 'completed') {
        // בדיקת cooldown - אם עברו פחות מ-5 שניות מהסנכרון האחרון, דלג
        const now = Date.now();
        if (now - lastNetworkSyncTimeRef.current < NETWORK_SYNC_COOLDOWN) {
          console.log(`Network sync skipped - cooldown active (${Math.round((NETWORK_SYNC_COOLDOWN - (now - lastNetworkSyncTimeRef.current)) / 1000)}s remaining)`);
          return;
        }

        // עדכון זמן הסנכרון האחרון
        lastNetworkSyncTimeRef.current = now;

        // בדיקה נוספת - אם המשחק נמחק בעבר, לא נסנכרן אותו
        const checkIfGameWasDeleted = async () => {
          try {
            if (gameData.id) {
              const handledGameKey = `handled_deleted_game_${gameData.id}`;
              const wasDeleted = await AsyncStorage.getItem(handledGameKey);
              if (wasDeleted) {
                console.log(`Game ${gameData.id} was previously deleted, skipping sync`);
                return true;
              }
            }
            return false;
          } catch (error) {
            console.error('Error checking if game was deleted:', error);
            return false;
          }
        };

        checkIfGameWasDeleted()
          .then(wasDeleted => {
            if (!wasDeleted) {
              console.log('Network reconnected - syncing local game to Firestore');
              return syncLocalActiveGameToFirestore()
                .then(gameId => {
                  if (gameId && gameId !== gameData.id) {
                    // אם התקבל מזהה חדש, נעדכן את המזהה במשחק הפעיל
                    setGameData(prev => ({
                      ...prev,
                      id: gameId
                    }));
                  }
                  console.log('Network sync completed successfully');
                })
                .catch(error => {
                  console.error('Error syncing local game to Firestore:', error);
                  // Don't throw - game is still saved locally
                  // Will retry on next network reconnection
                });
            }
          })
          .catch(error => {
            console.error('Error checking if game was deleted:', error);
            // Non-critical error, continue without syncing
          });
      }
    });

    return () => {
      console.log('GameContext: Cleaning up NetInfo listener');
      unsubscribe();
    };
  }, [isGameActive]); // Removed lastNetworkSyncTime - using ref instead

  // טעינת משחק פעיל בעת הפעלת האפליקציה
  useEffect(() => {
    const loadSavedGameId = async () => {
      try {
        const savedGameId = await AsyncStorage.getItem(ACTIVE_GAME_ID_KEY);
        if (savedGameId) {
          await loadActiveGame(savedGameId);
        }
      } catch (error) {
        console.error('Error loading saved game:', error);
      }
    };
    
    loadSavedGameId();
  }, []);

  // עדכון שחקן במשחק
  const updatePlayer = (playerId: string, updatedData: Partial<Player>) => {
    const now = Date.now();
    setGameData(prev => ({
      ...prev,
      players: prev.players.map(p =>
        p.id === playerId ? { ...p, ...updatedData } : p
      ),
      updatedAt: now,
      localModifiedAt: now
    }));
    setNeedsSaving(true); // Mark as needing save
  };

  // הוספת לוג ריבאיי
  const addRebuyLog = (log: RebuyLogEntry) => {
    const now = Date.now();
    setGameData(prev => ({
      ...prev,
      rebuyLogs: [log, ...prev.rebuyLogs],
      updatedAt: now,
      localModifiedAt: now
    }));
    setNeedsSaving(true); // Mark as needing save
  };

  // עדכון סטטוס המשחק
  const updateGameStatus = (newStatus: GameStatus) => {
    const now = Date.now();
    setGameData(prev => ({
      ...prev,
      status: newStatus,
      updatedAt: now,
      localModifiedAt: now
    }));
    setNeedsSaving(true); // Mark as needing save
  };

  // המרת GameData ל-Game (לשימוש ב-Firestore)
  const gameDataToGame = (data: GameData): Omit<Game, 'id'> | (Game & { id: string }) => {
    const { gameDate, difference, ...rest } = data;
    const now = Date.now();
    
    // נשתמש ב-Game מלא אם יש id, אחרת Omit<Game, 'id'>
    const baseGame = {
      ...rest,
      date: gameDate,
      players: rest.players.map(p => ({
        // המרה מ-Player (GameContext) ל-PlayerInGame (Game model)
        userId: p.id,
        id: p.id, // לשמירת התאימות עם קוד קיים
        name: p.name,
        buyInCount: p.buyInCount,
        rebuyCount: p.rebuyCount,
        // המרה מ-finalChips (string) ל-remainingChips (number) עם טיהור הטקסט
        remainingChips: p.finalChips ? parseInt(p.finalChips.trim().replace(/\D/g, ''), 10) : undefined,
        // העברת נתונים מחושבים
        exactChipsValue: p.exactChipsValue,
        roundedRebuysCount: p.roundedRebuysCount,
        resultBeforeOpenGames: p.resultBeforeOpenGames,
        openGameWins: p.openGameWins,
        finalResultMoney: p.finalResultMoney
      })) as PlayerInGame[],
      rebuyLogs: rest.rebuyLogs.map(log => {
        const { playerName, time, ...rebuyData } = log;
        return {
          ...rebuyData,
          timestamp: new Date(time).getTime() || Date.now()
        };
      }),
      // וידוא שכל השדות החובה קיימים
      openGamesCount: rest.openGamesCount || 0,
      totalWins: rest.totalWins || 0,
      totalLosses: rest.totalLosses || 0,
      createdAt: rest.createdAt || now,
      updatedAt: rest.updatedAt || now,
      useRoundingRule: rest.useRoundingRule,
      roundingRulePercentage: rest.roundingRulePercentage,
      // וידוא שיש createdBy - אם לא, השתמש במשתמש הנוכחי
      createdBy: rest.createdBy || user?.id || auth.currentUser?.uid
    };
    
    if (data.id) {
      return {
        ...baseGame,
        id: data.id
      } as Game & { id: string };
    } else {
      return baseGame as Omit<Game, 'id'>;
    }
  };
  
  // המרת Game ל-GameData (לשימוש בקונטקסט)
  const gameToGameData = (game: Game): GameData => {
    const { date, players, rebuyLogs, ...rest } = game;
    
    // המרת הנתונים
    const result = {
      ...rest,
      gameDate: date, // ממיר date ל-gameDate
      difference: (rest.totalWins || 0) - (rest.totalLosses || 0),  // חישוב הפרש
      players: (players || []).map(p => {
        const convertedPlayer = {
          id: p.userId || p.id || '',
          name: p.name || '',
          buyInCount: p.buyInCount || 0,
          rebuyCount: p.rebuyCount || 0,
          finalChips: (p.remainingChips !== null && p.remainingChips !== undefined) ? 
            p.remainingChips.toString().trim() : undefined,
          exactChipsValue: (p.exactChipsValue !== null && p.exactChipsValue !== undefined) ? p.exactChipsValue : undefined,
          roundedRebuysCount: (p.roundedRebuysCount !== null && p.roundedRebuysCount !== undefined) ? p.roundedRebuysCount : undefined,
          resultBeforeOpenGames: (p.resultBeforeOpenGames !== null && p.resultBeforeOpenGames !== undefined) ? p.resultBeforeOpenGames : undefined,
          openGameWins: (p.openGameWins !== null && p.openGameWins !== undefined) ? p.openGameWins : undefined,
          finalResultMoney: (p.finalResultMoney !== null && p.finalResultMoney !== undefined) ? p.finalResultMoney : (p.finalResult !== null && p.finalResult !== undefined) ? p.finalResult : undefined
        };
        
        return convertedPlayer;
      }),
      rebuyLogs: (rebuyLogs || []).map(log => {
        // מציאת שם השחקן על ידי חיפוש ברשימת השחקנים
        const player = (players || []).find(p => p.userId === log.playerId || p.id === log.playerId);
        const playerName = player?.name || '';
        
        // המרת הזמן לפורמט HH:MM
        const date = new Date(log.timestamp);
        const time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        
        return {
          id: log.id,
          playerId: log.playerId,
          playerName,
          action: log.action,
          time
        };
      }),
      // השלמת שדות חובה
      totalWins: rest.totalWins || 0,
      totalLosses: rest.totalLosses || 0,
      openGamesCount: rest.openGamesCount || 0
    };
    
    return result;
  };

  // שמירת משחק פעיל
  const saveActiveGame = async (): Promise<string> => {
    try {
      console.log('💾 === SAVE ACTIVE GAME STARTED === 💾');
      console.log('Game ID:', gameData.id || 'NEW GAME');
      console.log('Game status:', gameData.status);
      console.log('Needs saving:', needsSaving);
      console.log('Is game active:', isGameActive);
      
      // הגנה נגד שמירות מקבילות - using ref for immediate check
      if (isSavingRef.current || isSaving) {
        console.log('Save already in progress, waiting for completion...');
        if (activeSavePromiseRef.current) {
          console.log('Reusing existing save promise');
          return await activeSavePromiseRef.current;
        }
        // אם אין promise פעיל אבל isSaving true, מחכים ומנסים שוב
        await new Promise(resolve => setTimeout(resolve, 100));
        if (isSavingRef.current) {
          console.warn('Another save operation is still in progress after waiting');
          return gameData.id || '';
        }
      }

      // Create a promise that we'll track to prevent concurrent saves
      const savePromise = (async (): Promise<string> => {
        isSavingRef.current = true;
        setIsSaving(true);

        // בדיקה שהמשתמש מחובר לפני שמירה - אבל נאפשר המשך אם השמירה כבר התחילה
        if (!auth.currentUser) {
          throw new Error('המשתמש לא מחובר. יש להתחבר מחדש ולנסות שוב');
        }
      
      console.log('User authenticated:', auth.currentUser.uid);
      
      // אם המשחק לא פעיל, הפעל אותו
      if (!isGameActive) {
        console.log('Activating game...');
        setIsGameActive(true);
      }
      
      // בדיקה חכמה האם באמת צריך לשמור
      if (!hasLocalChanges(gameData) && gameData.id) {
        console.log('No local changes detected, returning existing ID:', gameData.id);
        return gameData.id;
      }
      
      console.log('Converting game data for Firestore...');
      // המרת הנתונים למבנה הנדרש לפיירבייס
      const gameForFirestore = gameDataToGame(gameData);
      console.log('Game for Firestore:', {
        id: ('id' in gameForFirestore) ? gameForFirestore.id : 'NEW',
        status: gameForFirestore.status,
        createdBy: gameForFirestore.createdBy,
        playersCount: gameForFirestore.players?.length
      });
      
      console.log('Calling saveOrUpdateActiveGame...');
      const gameId = await saveOrUpdateActiveGame(gameForFirestore, user?.id);
      console.log('Received game ID from save:', gameId);
      
      // עדכון המזהה במשחק הפעיל אם זו שמירה ראשונה
      if (!gameData.id) {
        console.log('First time save - updating GameData with new ID');
        const now = Date.now();
        setGameData(prev => ({
          ...prev,
          id: gameId,
          createdBy: prev.createdBy || user?.id, // וידוא שיש createdBy גם ב-GameData
          createdAt: prev.createdAt || now,
          updatedAt: now,
          lastSyncAt: now,
          syncVersion: 1
        }));
      } else {
        // עדכון timestamps של סנכרון מוצלח
        markSyncCompleted();
      }
      
      console.log('Saving game ID to AsyncStorage...');
      // שמירת המזהה ב-AsyncStorage
      await AsyncStorage.setItem(ACTIVE_GAME_ID_KEY, gameId);
      
      // סימון שאין צורך בשמירה נוספת
      setNeedsSaving(false);
      
      console.log('✅ Save active game completed successfully');
      console.log('💾 === SAVE ACTIVE GAME ENDED === 💾');
      return gameId;
    } catch (error) {
      console.error('Error saving active game:', error);
      
      // אם המשחק נמחק מהשרת, ננסה ליצור מסמך חדש אוטומטית
      if (error instanceof Error && error.message && error.message.includes('No document to update')) {
        console.log('Game was deleted from server during save, creating new document automatically');
        
        try {
          // נמחק את המזהה הישן כדי שייווצר מסמך חדש
          const updatedGameData = { ...gameData };
          delete updatedGameData.id;
          
          setGameData(updatedGameData);
          setNeedsSaving(true); // יכריח שמירה מחדש עם מזהה חדש
          
          console.log('Game recreated automatically after server deletion');
          return 'recreated'; // החזרת מזהה מיוחד לסימון שהמשחק נוצר מחדש
        } catch (innerError) {
          console.error('Error recreating game automatically:', innerError);
          
          // אם הטיפול האוטומטי נכשל, נציג הודעה למשתמש
          Alert.alert(
            "בעיית סנכרון",
            "המשחק שלך לא סונכרן כראוי. האם ברצונך לנסות שוב?",
            [
              {
                text: "נסה שוב",
                onPress: async () => {
                  setNeedsSaving(true);
                }
              },
              {
                text: "מחק את המשחק",
                onPress: async () => {
                  await clearActiveGame();
                },
                style: "destructive"
              }
            ]
          );
        }
      }

        throw error;
      } finally {
        isSavingRef.current = false;
        activeSavePromiseRef.current = null;
        setIsSaving(false);
      }
      })();

      // Track the promise to prevent concurrent saves
      activeSavePromiseRef.current = savePromise;

      return await savePromise;
    } catch (error) {
      console.error('Error in saveActiveGame wrapper:', error);
      throw error;
    }
  };

  // טעינת משחק פעיל
  const loadActiveGame = async (gameId: string): Promise<boolean> => {
    try {
      setIsLoadingGame(true);
      
      // טעינת המשחק מ-Firestore או מקומית
      const game = await getActiveGameById(gameId);
      
      if (game) {
        // המרת Game ל-GameData לפני שמירה בקונטקסט
        const convertedGameData = gameToGameData(game);
        
        // בדיקה אם יש משחק מקומי עם שינויים לא שמורים
        const currentLocalGame = gameData;
        if (currentLocalGame.id === game.id && hasLocalChanges(currentLocalGame)) {
          console.log('Found local changes for the same game, checking for conflicts...');
          
          // בדיקה מיוחדת למשחקים ישנים - אם אין timestamps, לא נציג קונפליקט
          const isLegacyGame = !currentLocalGame.localModifiedAt && !currentLocalGame.lastSyncAt;
          
          if (isLegacyGame) {
            console.log('Legacy game detected - updating timestamps and loading server version');
            const enhancedGameData = {
              ...convertedGameData,
              lastSyncAt: Date.now(),
              syncVersion: 1
            };
            setGameDataInternal(enhancedGameData);
            setNeedsSaving(false);
          } else if (isGameOutdated(currentLocalGame, game.updatedAt || 0)) {
            console.log('Version conflict detected, asking user for resolution...');
            const resolvedGameData = await resolveVersionConflict(currentLocalGame, game);
            setGameDataInternal(resolvedGameData);
            setNeedsSaving(hasLocalChanges(resolvedGameData));
          } else {
            // השינויים המקומיים חדשים יותר, נשמור אותם
            console.log('Local changes are newer, keeping them');
            setNeedsSaving(true);
          }
        } else {
          // אין קונפליקט, פשוט נטען את המשחק מהשרת
          const enhancedGameData = {
            ...convertedGameData,
            lastSyncAt: Date.now(),
            syncVersion: (convertedGameData.syncVersion || 0) + 1
          };
          setGameDataInternal(enhancedGameData);
          setNeedsSaving(false); // טעינת משחק קיים לא דורשת שמירה מחדש
        }
        
        // שמירת המזהה ב-AsyncStorage
        await AsyncStorage.setItem(ACTIVE_GAME_ID_KEY, game.id);
        
        return true;
      }
      
      // אם לא מצאנו משחק ב-Firestore, ננסה לטעון מקומית
      const localGame = await getLocalActiveGame();
      
      if (localGame) {
        // אם המשחק המקומי הושלם, פשוט נמחק אותו ולא נשאל את המשתמש
        if (localGame.status === 'completed') {
          console.log('Local game is completed, clearing it automatically');
          await AsyncStorage.removeItem(ACTIVE_GAME_ID_KEY);
          await clearLocalActiveGame();
          return false;
        }
        
        // בדיקה האם מדובר בניסיון לטעון משחק ספציפי
        if (gameId !== 'local_temp_id' && localGame.id !== gameId) {
          // אם המזהים לא תואמים, סביר להניח שהמשחק הספציפי נמחק
          console.log(`Game with ID ${gameId} not found, but local game exists with different ID`);
          // נשאל את המשתמש אם הוא רוצה לטעון את המשחק המקומי במקום
          Alert.alert(
            "המשחק לא נמצא",
            "המשחק המבוקש לא נמצא בשרת. האם ברצונך לטעון את המשחק המקומי האחרון במקום?",
            [
              {
                text: "כן",
                onPress: () => {
                  const convertedGameData = gameToGameData(localGame);
                  setGameDataInternal(convertedGameData);
                  setNeedsSaving(true); // סימון לשמירה כדי ליצור מסמך חדש בשרת
                  AsyncStorage.setItem(ACTIVE_GAME_ID_KEY, localGame.id);
                }
              },
              {
                text: "לא",
                onPress: () => {
                  // נקה את המשחק המקומי והמזהה
                  clearLocalActiveGame();
                  AsyncStorage.removeItem(ACTIVE_GAME_ID_KEY);
                },
                style: "cancel"
              }
            ]
          );
          return false;
        }
        
        // המרת Game ל-GameData לפני שמירה בקונטקסט
        const convertedGameData = gameToGameData(localGame);
        setGameDataInternal(convertedGameData);
        setNeedsSaving(true); // סימון לשמירה כדי ליצור מסמך חדש בשרת במקרה הצורך
        
        // שמירת המזהה ב-AsyncStorage
        await AsyncStorage.setItem(ACTIVE_GAME_ID_KEY, localGame.id);
        
        return true;
      }
      
      // אם לא מצאנו משחק בכלל, נקה את המזהה השמור
      await AsyncStorage.removeItem(ACTIVE_GAME_ID_KEY);
      
      // אם לא מצאנו משחק בכלל
      return false;
    } catch (error) {
      console.error('Error loading active game:', error);
      return false;
    } finally {
      setIsLoadingGame(false);
    }
  };

  // ניקוי משחק פעיל
  const clearActiveGame = async (): Promise<void> => {
    // הגנה מפני קריאות כפולות
    if (!isGameActive && !gameData.id) {
      console.log('clearActiveGame: No active game to clear, skipping');
      return;
    }

    try {
      console.log('clearActiveGame: Starting cleanup process');
      
      // עצירת כל התהליכים הפעילים
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        setSaveTimeout(null);
      }
      
      // המתנה לסיום שמירות פעילות
      if (activeSavePromise) {
        console.log('clearActiveGame: Waiting for active save to complete');
        try {
          await activeSavePromise;
        } catch (error) {
          console.log('clearActiveGame: Active save failed, but continuing with cleanup');
        }
      }
      
      // איפוס המצב מיד
      setIsGameActive(false);
      setNeedsSaving(false);
      setSaveStatus('idle');
      setIsSaving(false);
      
      // ניקוי מטמון המשחקים תחילה
      clearGamesCache();
      
      // שמירת מזהה המשחק לניקוי זיכרון
      const currentGameId = gameData.id;
      
      // איפוס הנתונים
      setGameDataInternal(defaultGameData);
      
      // ניקוי האחסון המקומי
      await AsyncStorage.removeItem(ACTIVE_GAME_ID_KEY);
      await clearLocalActiveGame();
      
      // ניקוי זיכרון של משחקים שטופלו
      if (currentGameId) {
        const handledGameKey = `handled_deleted_game_${currentGameId}`;
        await AsyncStorage.removeItem(handledGameKey);
      }
      
      console.log('clearActiveGame: Cleanup completed successfully');
    } catch (error) {
      console.error('clearActiveGame: Error during cleanup:', error);
      // גם במקרה של שגיאה, נוודא שהמצב מאופס
      setIsGameActive(false);
      setNeedsSaving(false);
      setSaveStatus('idle');
      setIsSaving(false);
      setGameData(defaultGameData);
    }
  };

  // רענון מצב המשחק הפעיל - לשימוש כאשר חוזרים למסך
  const refreshActiveGameStatus = async (): Promise<void> => {
    try {
      const savedGameId = await AsyncStorage.getItem(ACTIVE_GAME_ID_KEY);
      
      if (!savedGameId) {
        // אין משחק שמור, נוודא שהמצב מאופס
        if (isGameActive) {
          setIsGameActive(false);
          setGameDataInternal(defaultGameData);
        }
        return;
      }
      
      // בדיקה אם המשחק שמור בקונטקסט תואם למה שב-AsyncStorage
      if (gameData.id && gameData.id !== savedGameId) {
        // יש חוסר התאמה, נטען מחדש
        await loadActiveGame(savedGameId);
      } else if (!isGameActive && gameData.id === savedGameId) {
        // המשחק נמצא בקונטקסט אבל לא מסומן כפעיל
        setIsGameActive(true);
      }
    } catch (error) {
      console.error('Error refreshing active game status:', error);
    }
  };

  // פונקציה חדשה לחכות לסיום שמירות פעילות
  const waitForActiveSaves = useCallback(async (): Promise<void> => {
    console.log('Waiting for active saves to complete...');
    
    // חכה לטיימר פעיל של שמירה אוטומטית
    if (saveTimeout) {
      console.log('Clearing pending auto-save timeout');
      clearTimeout(saveTimeout);
      setSaveTimeout(null);
    }
    
    // חכה לשמירה פעילה אם יש
    if (activeSavePromise) {
      console.log('Waiting for active save operation to complete');
      try {
        await activeSavePromise;
        console.log('Active save completed successfully');
      } catch (error) {
        console.error('Active save failed, but continuing with logout:', error);
      }
    }
    
    // חכה עוד קצת לוודא שכל התהליכים הסתיימו
    if (isSaving) {
      console.log('Still saving, waiting a bit more...');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('All saves completed, ready for logout');
  }, [saveTimeout, activeSavePromise, isSaving]);

  // רישום הפונקציה בגלובל כשה-GameProvider נטען
  useEffect(() => {
    setGlobalWaitForActiveSaves(waitForActiveSaves);
    setGlobalClearActiveGame(clearActiveGame);
    
    // ניקוי הרישום כשה-component נמחק
    return () => {
      setGlobalWaitForActiveSaves(null);
      setGlobalClearActiveGame(null);
    };
  }, []); // תיקון: הסרת dependencies שגרמו לעדכונים מיותרים

  // פונקציה לקביעת המסך הנכון לפי סטטוס המשחק והרשאות המשתמש
  const determineCorrectGameScreen = (gameStatus: GameStatus, userPermissions: { canContinue: boolean; canViewOnly: boolean }, gameId?: string): string => {
    // אם המשתמש אינו יכול להמשיך את המשחק - הפניה למצב צפייה בלבד בהיסטוריה
    if (!userPermissions.canContinue && userPermissions.canViewOnly && gameId) {
      return `/history/${gameId}`;
    }
    
    // אם המשתמש יכול להמשיך - ניווט לפי הסטטוס הנוכחי של המשחק
    switch (gameStatus) {
      case 'active':
        return '/gameFlow/GameManagement';
      case 'ended':
        return '/gameFlow/InitialResults';
      case 'open_games':
        return '/gameFlow/OpenGames';
      case 'final_results':
        return '/gameFlow/FinalResults';
      case 'payments':
        return '/gameFlow/PaymentCalculations';
      case 'completed':
        return gameId ? `/history/${gameId}` : '/gameFlow/GameManagement'; // משחק שהושלם - צפייה בהיסטוריה
      default:
        return '/gameFlow/GameManagement'; // ברירת מחדל
    }
  };

  // פונקציה לבדיקה האם המשתמש יכול להמשיך את המשחק הנוכחי
  const canUserContinueThisGame = (gameData: GameData): boolean => {
    if (!user) return false;
    
    // אדמין יכול להמשיך כל משחק
    if (user.role === 'admin') return true;
    
    // סופר יוזר יכול להמשיך רק משחקים שהוא יצר
    if (user.role === 'super' && gameData.createdBy === user.id) return true;
    
    // מקרה מיוחד: אם המשחק נמצא על ידי fallback search (אותו אימייל, UID שונה)
    // ואנחנו יודעים שהמשתמש הנוכחי הוא זה שיצר את המשחק
    if (user.role === 'super' && gameData.createdBy && gameData.createdBy !== user.id) {
      // אם המשחק הגיע דרך מנגנון ה-fallback, זה אומר שהוא של אותו משתמש
      // (כי ה-fallback מתבסס על השוואת אימיילים)
      console.log(`canUserContinueThisGame: Detected fallback-loaded game - allowing continuation`);
      console.log(`canUserContinueThisGame: Original creator: ${gameData.createdBy}, Current user: ${user.id}`);
      return true;
    }
    
    // משתמש רגיל לא יכול להמשיך משחקים
    return false;
  };

  // פונקציה לבדיקה האם יש לעדכן את הסטטוס של המשחק
  const shouldUpdateStatus = (currentStatus: GameStatus, newStatus: GameStatus): boolean => {
    // הגדרת סדר השלבים במחזור חיי המשחק
    const statusOrder: GameStatus[] = [
      'active',
      'ended', 
      'open_games',
      'final_results',
      'payments',
      'completed'
    ];
    
    const currentIndex = statusOrder.indexOf(currentStatus);
    const newIndex = statusOrder.indexOf(newStatus);
    
    // אל תאפשר חזרה אחורה בשלבים (חוץ מאדמין)
    if (newIndex < currentIndex && user?.role !== 'admin') {
      console.log(`shouldUpdateStatus: Preventing backward transition from ${currentStatus} to ${newStatus}`);
      return false;
    }
    
    // אל תעדכן לאותו סטטוס
    if (currentStatus === newStatus) {
      return false;
    }
    
    return true;
  };

  // פונקציות חדשות לסנכרון חכם ומניעת קונפליקטים

  // בדיקה האם יש שינויים מקומיים שלא נשמרו
  const hasLocalChanges = (gameData: GameData): boolean => {
    if (!gameData.localModifiedAt || !gameData.lastSyncAt) {
      // עבור משחקים ישנים, רק אם באמת יש שינויים שצריכים שמירה
      return needsSaving && gameData.status !== 'completed';
    }
    return gameData.localModifiedAt > gameData.lastSyncAt;
  };

  // בדיקה האם המשחק בשרת חדש יותר מהגרסה המקומית
  const isGameOutdated = (localGame: GameData, serverUpdatedAt: number): boolean => {
    if (!localGame.lastSyncAt) {
      // אם אין זמן סנכרון, בדוק אם זה משחק ישן (לפני התיקונים)
      // משחקים ישנים לא יחשבו כמיושנים אם אין הבדל משמעותי בזמן
      const timeDifference = Math.abs(serverUpdatedAt - (localGame.updatedAt || 0));
      const isOldGame = timeDifference < 60000; // פחות מדקה הבדל
      return !isOldGame;
    }
    return serverUpdatedAt > localGame.lastSyncAt;
  };

  // עדכון טיימסטמפ של שינוי מקומי
  const markLocalModification = () => {
    const now = Date.now();
    setGameDataInternal(prev => ({
      ...prev,
      localModifiedAt: now,
      updatedAt: now
    }));
  };

  // עדכון טיימסטמפ של סנכרון עם השרת
  const markSyncCompleted = (serverUpdatedAt?: number) => {
    const now = Date.now();
    setGameDataInternal(prev => ({
      ...prev,
      lastSyncAt: now,
      syncVersion: (prev.syncVersion || 0) + 1,
      // אם יש updatedAt מהשרת, השתמש בו, אחרת השתמש בזמן הנוכחי
      updatedAt: serverUpdatedAt || now
    }));
  };

  // פונקציה לזיהוי ופתרון קונפליקטי גרסאות
  const resolveVersionConflict = async (localGame: GameData, serverGame: Game): Promise<GameData> => {
    return new Promise((resolve) => {
      Alert.alert(
        "קונפליקט גרסאות",
        "המשחק שונה גם במכשיר וגם בשרת. איך ברצונך לטפל בזה?",
        [
          {
            text: "השתמש בגרסה מהשרת",
            onPress: () => {
              console.log("User chose server version for conflict resolution");
              const serverGameData = gameToGameData(serverGame);
              resolve({
                ...serverGameData,
                lastSyncAt: Date.now(),
                syncVersion: (localGame.syncVersion || 0) + 1
              });
            }
          },
          {
            text: "השתמש בגרסה המקומית",
            onPress: () => {
              console.log("User chose local version for conflict resolution");
              resolve({
                ...localGame,
                localModifiedAt: Date.now() // סמן שיש שינויים שצריכים שמירה
              });
            },
            style: "default"
          },
          {
            text: "צור גרסה משולבת",
            onPress: () => {
              console.log("User chose to merge versions");
              // במקרה זה, נשתמש בנתונים מקומיים אבל נעדכן מטה-דאטה מהשרת
              resolve({
                ...localGame,
                updatedAt: serverGame.updatedAt || Date.now(),
                syncVersion: Math.max((localGame.syncVersion || 0), ((serverGame as any).syncVersion || 0)) + 1,
                localModifiedAt: Date.now()
              });
            }
          }
        ]
      );
    });
  };

  // שמירה אוטומטית של המשחק כאשר יש שינויים
  useEffect(() => {
    // שמור רק אם המשחק פעיל, צריך שמירה, לא נמצא כרגע בתהליך שמירה
    if (isGameActive && needsSaving && !isSaving) {
      // ביטול טיימר קודם אם יש
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }

      // אם זה משחק חדש (אין מזהה), תן זמן מספיק לשמירה כדי למנוע כפילויות
      const debounceTime = gameData.id ? AUTO_SAVE_DEBOUNCE : 1000;

      // מעקב אחרי כל ה-timeouts שנוצרים כדי לנקות אותם
      let statusResetTimeoutId: NodeJS.Timeout | null = null;
      let isCancelled = false; // דגל לסימון ביטול

      // הגדרת טיימר חדש לשמירה מושהית
      const timeoutId = setTimeout(async () => {
        // בדיקה אם הפעולה בוטלה
        if (isCancelled) {
          console.log('Auto-save cancelled: Component unmounted');
          return;
        }

        // בדיקה שהמשתמש מחובר בתחילת השמירה
        const userWasConnectedAtStart = !!auth.currentUser;
        if (!userWasConnectedAtStart) {
          console.log('Auto-save cancelled: User not authenticated at start');
          if (!isCancelled) setSaveStatus('idle');
          return;
        }

        try {
          // בדיקה נוספת שהמשחק עדיין פעיל
          if (!isGameActive || !needsSaving) {
            console.log('Auto-save cancelled: Game no longer active or does not need saving');
            return;
          }

          if (!isCancelled) setSaveStatus('saving');
          console.log(`Auto-save triggered for game ${gameData.id || 'new'} with status ${gameData.status}`);

          // יצירת Promise לשמירה ומעקב אחריו
          const savePromise = saveActiveGame().then((savedGameId) => {
            // בדיקה שהפעולה לא בוטלה
            if (isCancelled) return;

            // בדיקה שהקומפוננט עדיין קיים לפני עדכון state
            if (setSaveStatus && setActiveSavePromise) {
              setSaveStatus('saved');
              setActiveSavePromise(null);
              console.log(`Auto-save completed successfully for game ${savedGameId}`);

              // איפוס הסטטוס חזרה ל-idle אחרי 3 שניות
              // שמירת ה-timeoutId כדי לנקות אותו בעת הצורך
              statusResetTimeoutId = setTimeout(() => {
                if (!isCancelled && setSaveStatus) {
                  setSaveStatus('idle');
                }
              }, 3000);
            }
          }).catch((error) => {
            // בדיקה שהפעולה לא בוטלה
            if (isCancelled) return;

            console.error('Error auto-saving game:', error);
            // בדיקה שהקומפוננט עדיין קיים לפני עדכון state
            if (setSaveStatus && setActiveSavePromise) {
              setSaveStatus('error');
              setActiveSavePromise(null);
            }
          });

          if (!isCancelled) setActiveSavePromise(savePromise);
          await savePromise;

        } catch (error) {
          // בדיקה שהפעולה לא בוטלה
          if (isCancelled) return;

          console.error('Error in auto-save process:', error);
          // בדיקה שהקומפוננט עדיין קיים
          if (setSaveStatus) {
            setSaveStatus('error');
          }
        }
      }, debounceTime);

      setSaveTimeout(timeoutId);

      // פונקציית cleanup שמנקה את כל ה-timeouts
      return () => {
        console.log('Auto-save useEffect cleanup: cancelling pending operations');
        isCancelled = true; // סימון שהפעולה בוטלה

        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        // ניקוי timeout של איפוס הסטטוס
        if (statusResetTimeoutId) {
          clearTimeout(statusResetTimeoutId);
        }
      };
    }
  }, [isGameActive, isSaving, needsSaving]);

  return (
    <GameContext.Provider value={{ 
      gameData, 
      setGameData: wrappedSetGameData, 
      updatePlayer, 
      addRebuyLog,
      updateGameStatus,
      saveActiveGame,
      loadActiveGame,
      clearActiveGame,
      refreshActiveGameStatus,
      isGameActive,
      isLoadingGame,
      saveStatus,
      isNetworkConnected,
      waitForActiveSaves,
      // פונקציות חדשות
      determineCorrectGameScreen,
      canUserContinueThisGame,
      shouldUpdateStatus,
      // פונקציות סנכרון חכם
      hasLocalChanges,
      isGameOutdated,
      markLocalModification,
      markSyncCompleted
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