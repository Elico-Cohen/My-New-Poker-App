import { collection, doc, getDoc, getDocs, onSnapshot, query, where, orderBy, limit, QueryConstraint, Unsubscribe } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { store, DataType, CACHE_EXPIRY_TIME } from './AppStore';
import { UserProfile } from '@/models/UserProfile';
import { Game, GameDate } from '@/models/Game';
import { Group } from '@/models/Group';
import { PaymentUnit } from '@/models/PaymentUnit';
import { clearStatsCache } from '@/services/statistics/statisticsService';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { notificationService, EventType } from '@/services/NotificationService';

// זמן מינימלי בין סנכרונים רציפים (מניעת עומס)
const MIN_SYNC_INTERVAL = 1000 * 60; // דקה אחת

// זמן המתנה לפני ניסיון נוסף במקרה של כשל
const RETRY_DELAY = 1000 * 10; // 10 שניות

// מעקב אחר זמן הסנכרון האחרון
let lastSyncTimestamp = 0;

/**
 * סדרי עדיפויות לטעינה
 */
enum LoadPriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

/**
 * מצב רשת
 */
enum NetworkState {
  ONLINE = 'online',
  OFFLINE = 'offline',
  UNKNOWN = 'unknown',
}

/**
 * שירות סנכרון נתונים בזמן אמת
 * מבצע טעינה חכמה של נתונים ורישום להאזנה לשינויים בזמן אמת
 */
class SyncService {
  private static instance: SyncService;
  private isInitialized = false;
  private networkState: NetworkState = NetworkState.UNKNOWN;
  private unsubscribeNetInfo?: () => void;
  private pendingRetries: Map<DataType, NodeJS.Timeout> = new Map();
  
  private constructor() {
    // רישום לשינויים במצב הרשת
    this.initNetworkListener();
  }
  
  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }
  
  /**
   * רישום להאזנה לשינויים במצב הרשת
   */
  private initNetworkListener(): void {
    this.unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      const isConnected = state.isConnected && state.isInternetReachable !== false;
      const prevNetworkState = this.networkState;
      this.networkState = isConnected ? NetworkState.ONLINE : NetworkState.OFFLINE;
      
      if (prevNetworkState === NetworkState.OFFLINE && this.networkState === NetworkState.ONLINE) {
        console.log('SyncService: חיבור לרשת זוהה מחדש, מרענן נתונים...');
        
        // הודעה על חזרה לרשת
        notificationService.notify({
          type: EventType.NETWORK_ONLINE
        });
        
        this.handleNetworkReconnection();
      } else if (this.networkState === NetworkState.OFFLINE) {
        console.log('SyncService: זוהה ניתוק מהרשת');
        
        // הודעה על ניתוק מהרשת
        notificationService.notify({
          type: EventType.NETWORK_OFFLINE
        });
      }
    });
  }
  
  /**
   * טיפול בחיבור מחודש לרשת
   */
  private async handleNetworkReconnection(): Promise<void> {
    // אם חלף מספיק זמן מהסנכרון האחרון, מבצע רענון נתונים
    const now = Date.now();
    if (now - lastSyncTimestamp > MIN_SYNC_INTERVAL) {
      try {
        // בדיקה אילו נתונים דורשים רענון
        if (store.needsRefresh('users')) {
          await this.loadUsers({ includeInactive: true });
        }
        if (store.needsRefresh('groups')) {
          await this.loadGroups({ includeInactive: true });
        }
        if (store.needsRefresh('paymentUnits')) {
          await this.loadPaymentUnits({ includeInactive: true });
        }
        if (store.needsRefresh('games')) {
          await this.loadGames();
        }
        
        // עדכון זמן הסנכרון האחרון
        lastSyncTimestamp = now;
      } catch (error) {
        console.error('SyncService: שגיאה ברענון נתונים לאחר התחברות מחדש:', error);
      }
    }
  }
  
  /**
   * אתחול השירות - קריאה ראשונית לנתונים ורישום להאזנה בזמן אמת
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log('SyncService: מאתחל את שירות הסנכרון');
    
    try {
      // טעינה ראשונית של נתונים לפי סדר עדיפויות
      await this.loadInitialDataWithPriority();
      
      // הרשמה לעדכונים בזמן אמת
      this.subscribeToRealtimeUpdates();
      
      this.isInitialized = true;
      lastSyncTimestamp = Date.now();
      console.log('SyncService: שירות הסנכרון אותחל בהצלחה');
    } catch (error) {
      console.error('SyncService: שגיאה באתחול שירות הסנכרון:', error);
      // לא מסמנים כמאותחל במקרה של שגיאה - ננסה שוב בפעם הבאה
    }
  }
  
  /**
   * טעינת נתונים ראשונית לפי סדר עדיפויות
   */
  private async loadInitialDataWithPriority(): Promise<void> {
    console.log('SyncService: טוען נתונים ראשוניים לפי סדר עדיפויות');
    
    try {
      // שלב 1: טעינת נתונים בעדיפות גבוהה (נדרשים תמיד)
      await Promise.all([
        this.loadUsers({ priority: LoadPriority.HIGH, includeInactive: false }),
        this.loadGroups({ priority: LoadPriority.HIGH, includeInactive: false }),
        this.loadPaymentUnits({ priority: LoadPriority.HIGH, includeInactive: false })
      ]);
      
      // שלב 2: טעינת משחקים שהושלמו (היסטוריה - עדיפות בינונית)
      await this.loadGames({ 
        priority: LoadPriority.MEDIUM,
        completedOnly: true
      });
      
      // שלב 3: המשך טעינת נתונים נוספים (עדיפות נמוכה)
      await Promise.all([
        this.loadUsers({ priority: LoadPriority.LOW, includeInactive: true }),
        this.loadGroups({ priority: LoadPriority.LOW, includeInactive: true }),
        this.loadPaymentUnits({ priority: LoadPriority.LOW, includeInactive: true }),
        this.loadGames({ priority: LoadPriority.LOW, completedOnly: false })
      ]);
      
    } catch (error) {
      console.error('SyncService: שגיאה בטעינת נתונים ראשונית:', error);
      throw error;
    }
  }
  
  /**
   * טעינת משתמשים
   */
  private async loadUsers({ 
    priority = LoadPriority.MEDIUM, 
    includeInactive = false,
    forceRefresh = false
  }: { 
    priority?: LoadPriority, 
    includeInactive?: boolean,
    forceRefresh?: boolean
  } = {}): Promise<UserProfile[]> {
    // בדיקה אם יש צורך בטעינה מחדש
    if (!forceRefresh && !store.needsRefresh('users') && includeInactive === false) {
      console.log('SyncService: משתמשים פעילים כבר במטמון ותקפים');
      return store.getUsers();
    }
    
    console.log(`SyncService: טוען משתמשים (עדיפות: ${priority}, כולל לא פעילים: ${includeInactive})`);
    
    store.setLoading('users', true);
    store.setError('users', null);
    
    try {
      // יצירת שאילתה עם אילוצים מתאימים
      const constraints: QueryConstraint[] = [];
      
      // אם רק משתמשים פעילים נדרשים
      if (!includeInactive) {
        constraints.push(where('isActive', '==', true));
      }
      
      // טעינת המשתמשים מ-Firestore
      const usersQuery = query(collection(db, 'users'), ...constraints);
      const usersSnapshot = await getDocs(usersQuery);
      const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
      
      // עדכון המאגר
      store.updateUsers(users);
      console.log(`SyncService: נטענו ${users.length} משתמשים ${includeInactive ? '(כולל לא פעילים)' : 'פעילים'}`);
      
      return users;
    } catch (error) {
      console.error('SyncService: שגיאה בטעינת משתמשים:', error);
      store.setError('users', 'שגיאה בטעינת משתמשים');
      
      // ניסיון נוסף מאוחר יותר (בעדיפות גבוהה בלבד)
      if (priority === LoadPriority.HIGH) {
        this.scheduleRetry('users', { priority, includeInactive, forceRefresh });
      }
      
      return [];
    } finally {
      store.setLoading('users', false);
    }
  }
  
  /**
   * טעינת קבוצות
   */
  private async loadGroups({ 
    priority = LoadPriority.MEDIUM, 
    includeInactive = false,
    forceRefresh = false
  }: { 
    priority?: LoadPriority, 
    includeInactive?: boolean,
    forceRefresh?: boolean
  } = {}): Promise<Group[]> {
    // בדיקה אם יש צורך בטעינה מחדש
    if (!forceRefresh && !store.needsRefresh('groups') && includeInactive === false) {
      console.log('SyncService: קבוצות פעילות כבר במטמון ותקפות');
      return store.getGroups();
    }
    
    console.log(`SyncService: טוען קבוצות (עדיפות: ${priority}, כולל לא פעילות: ${includeInactive})`);
    
    store.setLoading('groups', true);
    store.setError('groups', null);
    
    try {
      // יצירת שאילתה עם אילוצים מתאימים
      const constraints: QueryConstraint[] = [];
      
      // אם רק קבוצות פעילות נדרשות
      if (!includeInactive) {
        constraints.push(where('isActive', '==', true));
      }
      
      // טעינת הקבוצות מ-Firestore
      const groupsQuery = query(collection(db, 'groups'), ...constraints);
      const groupsSnapshot = await getDocs(groupsQuery);
      const groups = groupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
      
      // עדכון המאגר
      store.updateGroups(groups);
      console.log(`SyncService: נטענו ${groups.length} קבוצות ${includeInactive ? '(כולל לא פעילות)' : 'פעילות'}`);
      
      return groups;
    } catch (error) {
      console.error('SyncService: שגיאה בטעינת קבוצות:', error);
      store.setError('groups', 'שגיאה בטעינת קבוצות');
      
      // ניסיון נוסף מאוחר יותר (בעדיפות גבוהה בלבד)
      if (priority === LoadPriority.HIGH) {
        this.scheduleRetry('groups', { priority, includeInactive, forceRefresh });
      }
      
      return [];
    } finally {
      store.setLoading('groups', false);
    }
  }
  
  /**
   * טעינת יחידות תשלום
   */
  private async loadPaymentUnits({ 
    priority = LoadPriority.MEDIUM, 
    includeInactive = false,
    forceRefresh = false
  }: { 
    priority?: LoadPriority, 
    includeInactive?: boolean,
    forceRefresh?: boolean
  } = {}): Promise<PaymentUnit[]> {
    // בדיקה אם יש צורך בטעינה מחדש
    if (!forceRefresh && !store.needsRefresh('paymentUnits') && includeInactive === false) {
      console.log('SyncService: יחידות תשלום פעילות כבר במטמון ותקפות');
      return store.getPaymentUnits();
    }
    
    console.log(`SyncService: טוען יחידות תשלום (עדיפות: ${priority}, כולל לא פעילות: ${includeInactive})`);
    
    store.setLoading('paymentUnits', true);
    store.setError('paymentUnits', null);
    
    try {
      // יצירת שאילתה עם אילוצים מתאימים
      const constraints: QueryConstraint[] = [];
      
      // אם רק יחידות תשלום פעילות נדרשות
      if (!includeInactive) {
        constraints.push(where('isActive', '==', true));
      }
      
      // טעינת יחידות התשלום מ-Firestore
      const unitsQuery = query(collection(db, 'paymentUnits'), ...constraints);
      const unitsSnapshot = await getDocs(unitsQuery);
      const units = unitsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentUnit));
      
      // עדכון המאגר
      store.updatePaymentUnits(units);
      console.log(`SyncService: נטענו ${units.length} יחידות תשלום ${includeInactive ? '(כולל לא פעילות)' : 'פעילות'}`);
      
      return units;
    } catch (error) {
      console.error('SyncService: שגיאה בטעינת יחידות תשלום:', error);
      store.setError('paymentUnits', 'שגיאה בטעינת יחידות תשלום');
      
      // ניסיון נוסף מאוחר יותר (בעדיפות גבוהה בלבד)
      if (priority === LoadPriority.HIGH) {
        this.scheduleRetry('paymentUnits', { priority, includeInactive, forceRefresh });
      }
      
      return [];
    } finally {
      store.setLoading('paymentUnits', false);
    }
  }
  
  /**
   * טעינת משחקים
   */
  private async loadGames({ 
    priority = LoadPriority.MEDIUM,
    completedOnly = false,
    limit: maxResults = 0, // 0 משמעותו ללא הגבלה
    forceRefresh = false
  }: { 
    priority?: LoadPriority,
    completedOnly?: boolean,
    limit?: number,
    forceRefresh?: boolean
  } = {}): Promise<Game[]> {
    // בדיקה אם יש צורך בטעינה מחדש
    if (!forceRefresh && !store.needsRefresh('games')) {
      console.log('SyncService: משחקים כבר במטמון ותקפים');
      return store.getGames();
    }
    
    console.log(`SyncService: טוען משחקים (עדיפות: ${priority}, רק שהושלמו: ${completedOnly}, הגבלה: ${maxResults || 'ללא'})`);
    
    store.setLoading('games', true);
    store.setError('games', null);
    
    try {
      // יצירת שאילתה עם אילוצים מתאימים
      const constraints: QueryConstraint[] = [];
      
      // אם רק משחקים שהושלמו נדרשים
      if (completedOnly) {
        constraints.push(where('status', '==', 'completed'));
      }
      
      // מיון לפי זמן עדכון
      constraints.push(orderBy('updatedAt', 'desc'));
      
      // הגבלת מספר התוצאות אם הוגדר
      if (maxResults > 0) {
        constraints.push(limit(maxResults));
      }
      
      // טעינת המשחקים מ-Firestore
      const gamesQuery = query(collection(db, 'games'), ...constraints);
      const gamesSnapshot = await getDocs(gamesQuery);
      const games = gamesSnapshot.docs.map(doc => {
        const gameData = { id: doc.id, ...doc.data() } as Game;
        
        // וידוא קיום מערכים
        gameData.players = Array.isArray(gameData.players) ? gameData.players : [];
        gameData.payments = Array.isArray(gameData.payments) ? gameData.payments : [];
        gameData.openGames = Array.isArray(gameData.openGames) ? gameData.openGames : [];
        gameData.rebuyLogs = Array.isArray(gameData.rebuyLogs) ? gameData.rebuyLogs : [];
        
        // טיפול בעקביות תאריכים
        this.normalizeGameDate(gameData);
        
        return gameData;
      });
      
      // עדכון המאגר
      store.updateGames(games);
      console.log(`SyncService: נטענו ${games.length} משחקים ${completedOnly ? 'שהושלמו' : ''}`);
      
      return games;
    } catch (error) {
      console.error('SyncService: שגיאה בטעינת משחקים:', error);
      store.setError('games', 'שגיאה בטעינת משחקים');
      
      // ניסיון נוסף מאוחר יותר (בעדיפות גבוהה בלבד)
      if (priority === LoadPriority.HIGH) {
        this.scheduleRetry('games', { priority, completedOnly, limit: maxResults, forceRefresh });
      }
      
      return [];
    } finally {
      store.setLoading('games', false);
    }
  }
  
  /**
   * תזמון ניסיון נוסף לטעינת נתונים שנכשלו
   */
  private scheduleRetry(dataType: DataType, options: any): void {
    // ביטול ניסיון קודם אם קיים
    if (this.pendingRetries.has(dataType)) {
      clearTimeout(this.pendingRetries.get(dataType));
    }
    
    const retryTimeout = setTimeout(async () => {
      this.pendingRetries.delete(dataType);
      
      // הודעה על ניסיון נוסף
      notificationService.notify({
        type: EventType.SYNC_STARTED,
        dataType,
        payload: { retry: true }
      });
      
      console.log(`SyncService: מנסה שוב לטעון ${dataType}...`);
      
      try {
        switch (dataType) {
          case 'users':
            await this.loadUsers(options);
            break;
          case 'games':
            await this.loadGames(options);
            break;
          case 'groups':
            await this.loadGroups(options);
            break;
          case 'paymentUnits':
            await this.loadPaymentUnits(options);
            break;
        }
      } catch (error) {
        console.error(`SyncService: ניסיון חוזר נכשל עבור ${dataType}:`, error);
      }
    }, RETRY_DELAY);
    
    this.pendingRetries.set(dataType, retryTimeout);
  }
  
  /**
   * רישום להאזנה לשינויים בזמן אמת - הגדרת מאזינים לכל הקולקציות
   */
  private subscribeToRealtimeUpdates(): void {
    console.log('SyncService: נרשם לעדכונים בזמן אמת');
    
    // האזנה לשינויים בקולקציית משתמשים (כולל לא פעילים)
    const usersUnsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        try {
          const updates: UserProfile[] = [];
          
          snapshot.docChanges().forEach(change => {
            const userData = { id: change.doc.id, ...change.doc.data() } as UserProfile;
            
            if (change.type === 'added' || change.type === 'modified') {
              updates.push(userData);
            }
          });
          
          if (updates.length > 0) {
            store.updateUsers(updates);
            console.log(`SyncService: עודכנו ${updates.length} משתמשים`);
          }
        } catch (error) {
          console.error('SyncService: שגיאה בעדכון משתמשים:', error);
        }
      },
      (error) => {
        console.error('SyncService: שגיאה בהאזנה למשתמשים:', error);
        store.setError('users', 'שגיאה בהאזנה למשתמשים');
      }
    );
    
    store.setUnsubscribeFunction('usersListener', usersUnsubscribe);
    
    // האזנה לשינויים בקולקציית קבוצות (כולל לא פעילות)
    const groupsUnsubscribe = onSnapshot(
      collection(db, 'groups'),
      (snapshot) => {
        try {
          const updates: Group[] = [];
          
          snapshot.docChanges().forEach(change => {
            const groupData = { id: change.doc.id, ...change.doc.data() } as Group;
            
            if (change.type === 'added' || change.type === 'modified') {
              updates.push(groupData);
            }
          });
          
          if (updates.length > 0) {
            store.updateGroups(updates);
            console.log(`SyncService: עודכנו ${updates.length} קבוצות`);
          }
        } catch (error) {
          console.error('SyncService: שגיאה בעדכון קבוצות:', error);
        }
      },
      (error) => {
        console.error('SyncService: שגיאה בהאזנה לקבוצות:', error);
        store.setError('groups', 'שגיאה בהאזנה לקבוצות');
      }
    );
    
    store.setUnsubscribeFunction('groupsListener', groupsUnsubscribe);
    
    // האזנה לשינויים בקולקציית משחקים
    const gamesUnsubscribe = onSnapshot(
      collection(db, 'games'),
      (snapshot) => {
        try {
          const updates: Game[] = [];
          
          snapshot.docChanges().forEach(change => {
            if (change.type === 'added' || change.type === 'modified') {
              const gameData = { id: change.doc.id, ...change.doc.data() } as Game;
              
              // וידוא קיום מערכים
              gameData.players = Array.isArray(gameData.players) ? gameData.players : [];
              gameData.payments = Array.isArray(gameData.payments) ? gameData.payments : [];
              gameData.openGames = Array.isArray(gameData.openGames) ? gameData.openGames : [];
              gameData.rebuyLogs = Array.isArray(gameData.rebuyLogs) ? gameData.rebuyLogs : [];
              
              // טיפול בעקביות תאריכים
              this.normalizeGameDate(gameData);
              
              updates.push(gameData);
            }
          });
          
          if (updates.length > 0) {
            store.updateGames(updates);
            console.log(`SyncService: עודכנו ${updates.length} משחקים`);
            
            // ניקוי מטמון הסטטיסטיקות בכל פעם שמשחקים מתעדכנים
            clearStatsCache();
          }
        } catch (error) {
          console.error('SyncService: שגיאה בעדכון משחקים:', error);
        }
      },
      (error) => {
        console.error('SyncService: שגיאה בהאזנה למשחקים:', error);
        store.setError('games', 'שגיאה בהאזנה למשחקים');
      }
    );
    
    store.setUnsubscribeFunction('gamesListener', gamesUnsubscribe);
    
    // האזנה לשינויים ביחידות תשלום (כולל לא פעילות)
    const unitsUnsubscribe = onSnapshot(
      collection(db, 'paymentUnits'),
      (snapshot) => {
        try {
          const updates: PaymentUnit[] = [];
          
          snapshot.docChanges().forEach(change => {
            const unitData = { id: change.doc.id, ...change.doc.data() } as PaymentUnit;
            
            if (change.type === 'added' || change.type === 'modified') {
              updates.push(unitData);
            }
          });
          
          if (updates.length > 0) {
            store.updatePaymentUnits(updates);
            console.log(`SyncService: עודכנו ${updates.length} יחידות תשלום`);
          }
        } catch (error) {
          console.error('SyncService: שגיאה בעדכון יחידות תשלום:', error);
        }
      },
      (error) => {
        console.error('SyncService: שגיאה בהאזנה ליחידות תשלום:', error);
        store.setError('paymentUnits', 'שגיאה בהאזנה ליחידות תשלום');
      }
    );
    
    store.setUnsubscribeFunction('paymentUnitsListener', unitsUnsubscribe);
  }
  
  /**
   * נרמול מבנה תאריך במשחק - מטפל במבנים שונים של תאריכים
   */
  private normalizeGameDate(game: Game): void {
    // טיפול בעקביות של שדות התאריך
    const dateSource = game.date || (game as any).gameDate;
    
    if (!dateSource || typeof dateSource !== 'object') {
      // אם אין שדה תאריך תקין, ניצור אחד מ-createdAt
      if (typeof game.createdAt === 'number') {
        const createdDate = new Date(game.createdAt);
        game.date = {
          day: createdDate.getDate(),
          month: createdDate.getMonth() + 1,
          year: createdDate.getFullYear(),
          timestamp: game.createdAt
        };
      } else {
        // תאריך ברירת מחדל
        const now = new Date();
        game.date = {
          day: now.getDate(),
          month: now.getMonth() + 1,
          year: now.getFullYear(),
          timestamp: now.getTime()
        };
      }
    } else {
      // וידוא שיש שדה date בפורמט אחיד
      game.date = {
        day: typeof dateSource.day === 'number' ? dateSource.day : 1,
        month: typeof dateSource.month === 'number' ? dateSource.month : 1,
        year: typeof dateSource.year === 'number' ? dateSource.year : new Date().getFullYear(),
        timestamp: typeof dateSource.timestamp === 'number' ? dateSource.timestamp : (
          typeof game.createdAt === 'number' ? game.createdAt : Date.now()
        )
      };
    }
  }
  
  /**
   * בדיקת מצב הרשת הנוכחי
   */
  public isOnline(): boolean {
    return this.networkState === NetworkState.ONLINE;
  }
  
  /**
   * אילוץ רענון נתונים מסוג מסוים
   */
  public async refreshData(dataType: DataType): Promise<void> {
    if (!this.isOnline()) {
      console.log(`SyncService: לא ניתן לרענן ${dataType} - אין חיבור לרשת`);
      
      // הודעה על ניסיון רענון כשאין חיבור לרשת
      notificationService.notify({
        type: EventType.SYNC_FAILED,
        dataType,
        payload: { error: 'אין חיבור לאינטרנט' }
      });
      
      return;
    }
    
    // הודעה על התחלת רענון
    notificationService.notify({
      type: EventType.SYNC_STARTED,
      dataType,
      payload: { manual: true }
    });
    
    try {
      switch (dataType) {
        case 'users':
          await this.loadUsers({ includeInactive: true });
          break;
        case 'games':
          await this.loadGames({ includeInactive: true });
          break;
        case 'groups':
          await this.loadGroups({ includeInactive: true });
          break;
        case 'paymentUnits':
          await this.loadPaymentUnits({ includeInactive: true });
          break;
      }
      
      console.log(`SyncService: רענון ${dataType} הושלם בהצלחה`);
    } catch (error) {
      console.error(`SyncService: שגיאה ברענון ${dataType}:`, error);
    }
  }
  
  /**
   * אילוץ רענון כל הנתונים מ-Firebase
   */
  public async forceRefresh(): Promise<void> {
    if (this.networkState !== NetworkState.ONLINE) {
      console.log('SyncService: לא ניתן לבצע רענון מלא - אין חיבור לרשת');
      throw new Error('אין חיבור לאינטרנט. אנא בדוק את החיבור שלך ונסה שוב.');
    }
    
    console.log('SyncService: מבצע רענון נתונים מאולץ מ-Firebase');
    
    // מנקה את מטמון הסטטיסטיקות
    clearStatsCache();
    
    try {
      // טעינת כל סוגי הנתונים במקביל
      await Promise.all([
        this.refreshData('users'),
        this.refreshData('groups'),
        this.refreshData('paymentUnits'),
        this.refreshData('games')
      ]);
      
      // עדכון זמן הסנכרון האחרון
      lastSyncTimestamp = Date.now();
      
      console.log('SyncService: רענון נתונים מאולץ הושלם בהצלחה');
    } catch (error) {
      console.error('SyncService: שגיאה ברענון נתונים מאולץ:', error);
      throw error;
    }
  }
  
  /**
   * ניקוי משאבים - ביטול כל ההאזנות לפיירבייס
   */
  public cleanup(): void {
    // ביטול האזנה למצב הרשת
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
    }
    
    // ביטול תזמוני ניסיונות חוזרים
    this.pendingRetries.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    this.pendingRetries.clear();
    
    // ביטול המאזינים בפיירבייס
    store.reset();
    
    this.isInitialized = false;
    console.log('SyncService: נוקה');
  }
}

// סינגלטון - יצוא אינסטנס יחיד
export const syncService = SyncService.getInstance(); 