import { UserProfile } from '@/models/UserProfile';
import { Game } from '@/models/Game';
import { Group } from '@/models/Group';
import { PaymentUnit } from '@/models/PaymentUnit';

// מבנה נתונים של המערכת כולה
export interface AppState {
  users: Map<string, UserProfile>;
  games: Map<string, Game>;
  groups: Map<string, Group>;
  paymentUnits: Map<string, PaymentUnit>;
  lastSyncTimestamp: number;
  dataStatus: {
    users: { loading: boolean; error: string | null; lastUpdated: number };
    games: { loading: boolean; error: string | null; lastUpdated: number };
    groups: { loading: boolean; error: string | null; lastUpdated: number };
    paymentUnits: { loading: boolean; error: string | null; lastUpdated: number };
  };
}

// קבוע לזמן תפוגת מטמון - 24 שעות (משמש כגיבוי בלבד למנגנון ההאזנה)
export const CACHE_EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 שעות במילישניות

// טיפוסי נתונים עבור המטמון
export type DataType = 'users' | 'games' | 'groups' | 'paymentUnits';

// סינגלטון של ה-Store
class AppStore {
  private static instance: AppStore;
  
  private state: AppState = {
    users: new Map(),
    games: new Map(),
    groups: new Map(),
    paymentUnits: new Map(),
    lastSyncTimestamp: 0,
    dataStatus: {
      users: { loading: false, error: null, lastUpdated: 0 },
      games: { loading: false, error: null, lastUpdated: 0 },
      groups: { loading: false, error: null, lastUpdated: 0 },
      paymentUnits: { loading: false, error: null, lastUpdated: 0 },
    }
  };
  
  // מבנה נתונים למאזינים עם תמיכה בטיפוסי נתונים ספציפיים
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  
  // מקשיבים להתחברות/התנתקות
  private unsubscribeFunctions: { [key: string]: () => void } = {};
  
  // רשימת שינויים ממתינים - משמש לצבירת שינויים לפני הודעה למאזינים
  private pendingUpdates: Map<string, Set<string>> = new Map([
    ['users', new Set()],
    ['games', new Set()],
    ['groups', new Set()],
    ['paymentUnits', new Set()]
  ]);
  
  // סימן שמציין האם יש עדכון ממתין לביצוע
  private hasPendingNotification = false;
  
  private constructor() {}
  
  public static getInstance(): AppStore {
    if (!AppStore.instance) {
      AppStore.instance = new AppStore();
    }
    return AppStore.instance;
  }
  
  // === פונקציות גישה לנתונים ===
  
  // קבלת כל המשתמשים עם אפשרות סינון
  public getUsers(options: { activeOnly?: boolean } = {}): UserProfile[] {
    const { activeOnly = false } = options;
    const users = Array.from(this.state.users.values());
    
    // החזרת כל המשתמשים או רק פעילים לפי הדרישה
    return activeOnly ? users.filter(user => user.isActive) : users;
  }
  
  // קבלת משתמש לפי מזהה
  public getUser(id: string): UserProfile | undefined {
    return this.state.users.get(id);
  }
  
  // קבלת כל המשחקים עם אפשרויות סינון
  public getGames(options: { 
    completedOnly?: boolean,
    afterDate?: Date,
    groupId?: string
  } = {}): Game[] {
    const { completedOnly = false, afterDate, groupId } = options;
    let games = Array.from(this.state.games.values());
    
    // סינון לפי סטטוס השלמה
    if (completedOnly) {
      games = games.filter(game => game.status === 'completed');
    }
    
    // סינון לפי תאריך
    if (afterDate) {
      games = games.filter(game => {
        if (!game.date) return false;
        const gameDate = new Date(game.date.year, game.date.month - 1, game.date.day);
        return gameDate >= afterDate;
      });
    }
    
    // סינון לפי קבוצה
    if (groupId) {
      games = games.filter(game => game.groupId === groupId);
    }
    
    return games;
  }
  
  // קבלת משחק לפי מזהה
  public getGame(id: string): Game | undefined {
    return this.state.games.get(id);
  }
  
  // קבלת כל הקבוצות עם אפשרות סינון
  public getGroups(options: { activeOnly?: boolean } = {}): Group[] {
    const { activeOnly = false } = options;
    const groups = Array.from(this.state.groups.values());
    
    // החזרת כל הקבוצות או רק פעילות לפי הדרישה
    return activeOnly ? groups.filter(group => group.isActive) : groups;
  }
  
  // קבלת קבוצה לפי מזהה
  public getGroup(id: string): Group | undefined {
    return this.state.groups.get(id);
  }
  
  // קבלת כל יחידות התשלום עם אפשרות סינון
  public getPaymentUnits(options: { activeOnly?: boolean } = {}): PaymentUnit[] {
    const { activeOnly = false } = options;
    const paymentUnits = Array.from(this.state.paymentUnits.values());
    
    // החזרת כל יחידות התשלום או רק פעילות לפי הדרישה
    return activeOnly ? paymentUnits.filter(unit => unit.isActive) : paymentUnits;
  }
  
  // קבלת יחידת תשלום לפי מזהה
  public getPaymentUnit(id: string): PaymentUnit | undefined {
    return this.state.paymentUnits.get(id);
  }
  
  /**
   * קבלת סטטוס טעינה של סוג נתונים מסוים
   * @param type סוג הנתונים
   */
  public getDataStatus(type: DataType) {
    return this.state.dataStatus[type];
  }
  
  // בדיקה האם המטמון של סוג נתונים מסוים תקף (לא פג תוקף)
  public isCacheValid(type: DataType): boolean {
    const lastUpdated = this.state.dataStatus[type].lastUpdated;
    const now = Date.now();
    
    // אם המטמון לא עודכן מעולם, הוא לא תקף
    if (lastUpdated === 0) return false;
    
    // בדיקה אם לא עברו יותר מ-24 שעות מהעדכון האחרון
    return (now - lastUpdated) < CACHE_EXPIRY_TIME;
  }
  
  // === פונקציות עדכון נתונים ===
  
  // עדכון משתמשים - תומך בעדכון בודד או מספר משתמשים
  public updateUsers(users: UserProfile | UserProfile[]): void {
    const usersArray = Array.isArray(users) ? users : [users];
    let hasChanges = false;
    
    usersArray.forEach(user => {
      // שמירת העותק הקודם לצורך השוואה
      const existingUser = this.state.users.get(user.id);
      
      // אם המשתמש חדש או השתנה, מעדכנים אותו
      if (!existingUser || JSON.stringify(existingUser) !== JSON.stringify(user)) {
        this.state.users.set(user.id, user);
        this.pendingUpdates.get('users')?.add(user.id);
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      this.state.dataStatus.users.lastUpdated = Date.now();
      this.scheduleNotification('users');
    }
  }
  
  // עדכון משחקים - תומך בעדכון בודד או מספר משחקים
  public updateGames(games: Game | Game[]): void {
    const gamesArray = Array.isArray(games) ? games : [games];
    let hasChanges = false;
    
    gamesArray.forEach(game => {
      // שמירת העותק הקודם לצורך השוואה
      const existingGame = this.state.games.get(game.id);
      
      // אם המשחק חדש או השתנה, מעדכנים אותו
      if (!existingGame || JSON.stringify(existingGame) !== JSON.stringify(game)) {
        this.state.games.set(game.id, game);
        this.pendingUpdates.get('games')?.add(game.id);
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      this.state.dataStatus.games.lastUpdated = Date.now();
      this.scheduleNotification('games');
    }
  }
  
  // עדכון קבוצות - תומך בעדכון בודד או מספר קבוצות
  public updateGroups(groups: Group | Group[]): void {
    const groupsArray = Array.isArray(groups) ? groups : [groups];
    let hasChanges = false;
    
    groupsArray.forEach(group => {
      // שמירת העותק הקודם לצורך השוואה
      const existingGroup = this.state.groups.get(group.id);
      
      // אם הקבוצה חדשה או השתנתה, מעדכנים אותה
      if (!existingGroup || JSON.stringify(existingGroup) !== JSON.stringify(group)) {
        this.state.groups.set(group.id, group);
        this.pendingUpdates.get('groups')?.add(group.id);
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      this.state.dataStatus.groups.lastUpdated = Date.now();
      this.scheduleNotification('groups');
    }
  }
  
  // עדכון יחידות תשלום - תומך בעדכון בודד או מספר יחידות
  public updatePaymentUnits(paymentUnits: PaymentUnit | PaymentUnit[]): void {
    const unitsArray = Array.isArray(paymentUnits) ? paymentUnits : [paymentUnits];
    let hasChanges = false;
    
    unitsArray.forEach(unit => {
      // שמירת העותק הקודם לצורך השוואה
      const existingUnit = this.state.paymentUnits.get(unit.id);
      
      // אם היחידה חדשה או השתנתה, מעדכנים אותה
      if (!existingUnit || JSON.stringify(existingUnit) !== JSON.stringify(unit)) {
        this.state.paymentUnits.set(unit.id, unit);
        this.pendingUpdates.get('paymentUnits')?.add(unit.id);
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      this.state.dataStatus.paymentUnits.lastUpdated = Date.now();
      this.scheduleNotification('paymentUnits');
    }
  }
  
  // תזמון התראה למאזינים
  private scheduleNotification(type: string): void {
    if (this.hasPendingNotification) return;
    
    this.hasPendingNotification = true;
    
    // שימוש ב-setTimeout כדי לאפשר צבירת שינויים נוספים לפני הודעה למאזינים
    setTimeout(() => {
      this.processPendingNotifications();
    }, 0);
  }
  
  // עיבוד התראות ממתינות
  private processPendingNotifications(): void {
    // רשימת סוגי הנתונים שהשתנו
    const changedTypes: string[] = [];
    
    // בדיקה אילו סוגי נתונים השתנו
    this.pendingUpdates.forEach((updates, type) => {
      if (updates.size > 0) {
        changedTypes.push(type);
        updates.clear(); // ניקוי העדכונים הממתינים
      }
    });
    
    // הודעה למאזינים על כל סוג נתונים שהשתנה
    changedTypes.forEach(type => {
      this.notifyListeners(type);
    });
    
    this.hasPendingNotification = false;
  }
  
  // === ניהול סטטוס טעינה ===
  
  // הגדרת מצב טעינה
  public setLoading(type: DataType, loading: boolean): void {
    this.state.dataStatus[type].loading = loading;
    this.notifyListeners(`${type}Status`);
  }
  
  // הגדרת שגיאה
  public setError(type: DataType, error: string | null): void {
    this.state.dataStatus[type].error = error;
    this.notifyListeners(`${type}Status`);
  }
  
  // === ניהול מאזינים ===
  
  // הוספת מאזין לשינויים - תומך בפילטור לפי מזהים ספציפיים
  public subscribe(type: string, callback: (data: any) => void, options: { ids?: string[] } = {}): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    
    const callbacks = this.listeners.get(type)!;
    
    // שמירת מידע על הפילטור יחד עם הקולבק
    const wrappedCallback = {
      callback,
      options
    } as any;
    
    callbacks.add(wrappedCallback);
    
    // החזרת פונקציית ביטול הרשמה
    return () => {
      callbacks.delete(wrappedCallback);
    };
  }
  
  // יידוע מאזינים על שינויים
  private notifyListeners(type: string): void {
    if (!this.listeners.has(type)) return;
    
    const callbacks = this.listeners.get(type)!;
    if (callbacks.size === 0) return;
    
    // הכנת הנתונים לפי סוג
    let allData: any[] = [];
    
    switch (type) {
      case 'users':
        allData = Array.from(this.state.users.values());
        break;
      case 'games':
        allData = Array.from(this.state.games.values());
        break;
      case 'groups':
        allData = Array.from(this.state.groups.values());
        break;
      case 'paymentUnits':
        allData = Array.from(this.state.paymentUnits.values());
        break;
      case 'usersStatus':
      case 'gamesStatus':
      case 'groupsStatus':
      case 'paymentUnitsStatus':
        const statusType = type.replace('Status', '') as DataType;
        const statusData = this.state.dataStatus[statusType];
        
        // קריאה לכל המאזינים עם נתוני הסטטוס
        callbacks.forEach(callback => {
          try {
            (callback as any).callback(statusData);
          } catch (error) {
            console.error(`שגיאה במאזין ${type}:`, error);
          }
        });
        return;
      default:
        console.warn(`סוג לא מוכר למאזינים: ${type}`);
        return;
    }
    
    // קריאה לכל המאזינים עם הנתונים הרלוונטיים
    callbacks.forEach(callbackObj => {
      try {
        const { callback, options } = callbackObj as any;
        
        // פילטור לפי מזהים ספציפיים אם הוגדרו
        const filteredData = options.ids ? 
          allData.filter(item => options.ids.includes(item.id)) : 
          allData;
        
        callback(filteredData);
      } catch (error) {
        console.error(`שגיאה במאזין ${type}:`, error);
      }
    });
  }
  
  // === ניהול האזנה לפיירבייס ===
  
  // שמירת פונקציות הביטול להאזנה לפיירבייס
  public setUnsubscribeFunction(key: string, unsubscribe: () => void): void {
    // ביטול האזנה קודמת אם קיימת
    if (this.unsubscribeFunctions[key]) {
      this.unsubscribeFunctions[key]();
    }
    
    this.unsubscribeFunctions[key] = unsubscribe;
  }
  
  // איפוס הסטור (בהתנתקות משתמש)
  public reset(): void {
    // ניקוי כל הנתונים
    this.state.users.clear();
    this.state.games.clear();
    this.state.groups.clear();
    this.state.paymentUnits.clear();
    
    // ביטול כל ההאזנות לפיירבייס
    Object.values(this.unsubscribeFunctions).forEach(unsubscribe => {
      unsubscribe();
    });
    this.unsubscribeFunctions = {};
    
    // איפוס חותמת זמן הסנכרון האחרון
    this.state.lastSyncTimestamp = 0;
    
    // איפוס מצב טעינה ושגיאה
    Object.keys(this.state.dataStatus).forEach(key => {
      const dataType = key as DataType;
      this.state.dataStatus[dataType].loading = false;
      this.state.dataStatus[dataType].error = null;
      this.state.dataStatus[dataType].lastUpdated = 0;
    });
    
    // ניקוי העדכונים הממתינים
    this.pendingUpdates.forEach(updates => updates.clear());
    
    // יידוע מאזינים על איפוס
    ['users', 'games', 'groups', 'paymentUnits'].forEach(type => {
      this.notifyListeners(type);
      this.notifyListeners(`${type}Status`);
    });
  }
  
  // בדיקה אם נדרש רענון נתונים של סוג מסוים
  public needsRefresh(type: DataType): boolean {
    // בדיקה ראשית אם המטמון תקף
    if (!this.isCacheValid(type)) return true;
    
    // בדיקה שנייה אם יש נתונים בכלל
    switch (type) {
      case 'users':
        return this.state.users.size === 0;
      case 'games':
        return this.state.games.size === 0;
      case 'groups':
        return this.state.groups.size === 0;
      case 'paymentUnits':
        return this.state.paymentUnits.size === 0;
      default:
        return true;
    }
  }
}

// יצוא הסינגלטון
export const store = AppStore.getInstance(); 