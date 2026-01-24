/**
 * קובץ: src/models/Game.ts
 * הסבר:
 * מייצג משחק פוקר מסוים.
 * כולל הגדרת סטטוסים, תיעוד Rebuy, תוצאות וכו'.
 */

import { ChipsConfig } from './Group';

/** סטטוסים אפשריים למשחק */
export type GameStatus =
    | 'active'           // משחק פעיל - מרגע ההתחלה ועד ללחיצה על "סיים משחק"
    | 'ended'            // משחק הסתיים - לאחר לחיצה על "סיים משחק" בעמוד GameManagement
    | 'open_games'       // במשחקים פתוחים - כאשר יש הפרש בין זכיות להפסדים וחוק 80% מופעל
    | 'final_results'    // תוצאות סופיות - לאחר חישוב סופי כולל משחקים פתוחים
    | 'payments'         // חישוב תשלומים - במהלך חישוב וארגון התשלומים
    | 'completed'        // הושלם - לאחר שמירת המשחק ותיעוד התשלומים
    | 'deleted';         // מחיקת המשחק ממסך ההסטוריה

/** לוג ריבאיי בודד */
export interface RebuyLog {
    id: string;              // מזהה ייחודי של הרישום
    playerId: string;        // מזהה השחקן (UserProfile.id)
    action: 'add' | 'remove';// האם זה הוספה או הסרה
    timestamp: number;       // מתי בוצעה הפעולה (Date.now())
}

/** משחק פתוח (אם נוצרת אי התאמה בין סך הזכיות וההפסדים) */
export interface OpenGame {
    id: number;              // מספר משחק פתוח (1,2,3...)
    winner?: string;         // userId של המנצח
    createdAt: number;
}

/** שחקן בתוך המשחק */
export interface PlayerInGame {
    userId: string;          // userId של השחקן
    id?: string;             // לאפשר שימוש ב-id במקום userId
    name: string;            // שם השחקן (לצורך snapshot)
    buyInCount: number;      // בכמה פעמים השחקן עשה Buy-In
    rebuyCount: number;      // כמה Rebuy-ים השחקן לקח
    remainingChips?: number; // צ'יפים בסוף המשחק
    
    // תוצאות חישוב ראשוני
    exactChipsValue?: number;    // הערך המדויק של הצ'יפים (לפני עיגול)
    roundedRebuysCount?: number; // כמה ריבאיים מגיעים אחרי עיגול (אם מופעל החוק)
    resultBeforeOpenGames?: number; // רווח/הפסד לפני משחקים פתוחים
    
    // תוצאות סופיות
    openGameWins?: number;       // כמה משחקים פתוחים ניצח
    finalResultMoney?: number;   // רווח/הפסד סופי אחרי משחקים פתוחים
    finalResult?: number;        // שם חלופי ל-finalResultMoney
}

/** תשלום סופי */
export interface Payment {
    from: {
        unitId?: string;       // מזהה PaymentUnit אם שייך ליחידה
        userId?: string;       // מזהה משתמש אם אין יחידת תשלום
    };
    to: {
        unitId?: string;
        userId?: string;
    };
    amount: number;          // סכום כספי להעברה
}

/** תאריך משחק */
export interface GameDate {
    day: number;            // יום בחודש
    month: number;          // חודש (1-12)
    year: number;           // שנה
    timestamp?: number;     // חותמת זמן של התאריך (מילישניות מאז 1970-01-01)
}

/** אירוע העברת שליטה במשחק */
export interface HandoffEvent {
    id: string;              // מזהה ייחודי
    fromUserId: string;      // מזהה Firestore של הבעלים הקודם
    fromUserName: string;    // שם הבעלים הקודם (snapshot)
    fromAuthUid: string;     // Auth UID של הבעלים הקודם
    toUserId: string;        // מזהה Firestore של הבעלים החדש
    toUserName: string;      // שם הבעלים החדש (snapshot)
    toAuthUid: string;       // Auth UID של הבעלים החדש
    timestamp: number;       // מתי בוצעה ההעברה
    reason?: string;         // סיבה אופציונלית להעברה
    initiatedBy: string;     // authUid של מי שיזם את ההעברה (owner או admin)
}

/** הגדרת משחק */
export interface Game {
    id: string;
    groupId: string;         // לאיזו קבוצה שייך המשחק
    groupNameSnapshot: string; // שם הקבוצה בזמן המשחק
    date: GameDate;          // תאריך המשחק במבנה מפורט
    status: GameStatus;      // מצב המשחק
    buyInSnapshot: ChipsConfig;  // צילום של ערכי ה-buyIn בזמן המשחק
    rebuySnapshot: ChipsConfig;  // צילום של ערכי ה-rebuy בזמן המשחק
    
    // נתוני המשחק
    totalWins?: number;      // סכום הזכיות הכולל
    totalLosses?: number;    // סכום ההפסדים הכולל
    openGamesCount?: number; // כמה משחקים פתוחים נדרשים
    
    // תתי-אוספים
    players?: PlayerInGame[]; // מערך שחקנים
    playerUids?: string[];   // מערך של UIDs של השחקנים המשתתפים
    rebuyLogs?: RebuyLog[];  // לוג של הוספות/הורדות Rebuy
    openGames?: OpenGame[];  // משחקים פתוחים, אם קיים הפרש
    payments?: Payment[];    // תשלומים סופיים
    
    // מטה-דאטה
    createdAt: number;       // Timestamp יצירת המסמך
    updatedAt: number;       // Timestamp עדכון
    createdBy?: string;      // מזהה המשתמש הנוכחי שבשליטה על המשחק (authUid) - יכול להשתנות בהעברת שליטה
    originalCreatedBy?: string;  // מזהה המשתמש המקורי שיצר את המשחק (authUid) - לעולם לא משתנה
    handoffLog?: HandoffEvent[]; // היסטוריית העברות שליטה במשחק

    // הגדרות חוק 80%
    useRoundingRule: boolean;    // האם להשתמש בחוק העיגול (80% או אחר)
    roundingRulePercentage: number; // האחוז לחישוב (למשל 80)
    
}