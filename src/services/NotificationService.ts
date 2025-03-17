import { DataType, store } from '@/store/AppStore';

/**
 * סוגי אירועים שהמערכת יכולה להפיק
 */
export enum EventType {
  // אירועי נתונים
  DATA_CREATED = 'data_created',   // נוצר פריט נתונים חדש
  DATA_UPDATED = 'data_updated',   // עודכן פריט נתונים קיים
  DATA_DELETED = 'data_deleted',   // נמחק פריט נתונים
  DATA_LOADED = 'data_loaded',     // הושלמה טעינת נתונים
  
  // אירועי סנכרון
  SYNC_STARTED = 'sync_started',   // התחיל סנכרון
  SYNC_COMPLETED = 'sync_completed', // הסתיים סנכרון בהצלחה
  SYNC_FAILED = 'sync_failed',     // נכשל סנכרון
  
  // אירועי רשת
  NETWORK_ONLINE = 'network_online',   // המערכת התחברה לאינטרנט
  NETWORK_OFFLINE = 'network_offline', // המערכת התנתקה מהאינטרנט
  
  // אירועי חישוב סטטיסטיקה
  STATS_CALCULATED = 'stats_calculated', // הושלם חישוב סטטיסטיקה
}

/**
 * מבנה אירוע התראה
 */
export interface NotificationEvent<T = any> {
  type: EventType;              // סוג האירוע
  dataType?: DataType;          // סוג הנתונים (אם רלוונטי)
  entityId?: string;            // מזהה הישות (אם רלוונטי)
  payload?: T;                  // מטען - נתונים נוספים של האירוע
  timestamp: number;            // חותמת זמן של האירוע
}

/**
 * פונקציית מאזין להתראות
 */
export type NotificationListener = (event: NotificationEvent) => void;

/**
 * הגבלות להרשמה לפי מסנן
 */
export interface NotificationFilter {
  eventTypes?: EventType[];     // סוגי אירועים להאזנה
  dataTypes?: DataType[];       // סוגי נתונים להאזנה
  entityIds?: string[];         // מזהי ישויות להאזנה
}

/**
 * שירות התראות לניטור שינויים במערכת
 * מאפשר הרשמה להתראות על פעולות שונות עם אפשרות לסינון מתקדם
 */
class NotificationService {
  private static instance: NotificationService;
  
  // רשימת מאזינים להתראות
  private listeners: Map<string, { listener: NotificationListener; filter: NotificationFilter }> = new Map();
  
  // מזהה ייחודי למאזינים
  private nextListenerId = 1;
  
  // היסטוריית אירועים אחרונים - שימושי לדיבוג וניתוח רטרוספקטיבי
  private recentEvents: NotificationEvent[] = [];
  private readonly MAX_RECENT_EVENTS = 50;
  
  private constructor() {
    // הרשמה לשינויי נתונים מ-AppStore
    this.registerStoreListeners();
  }
  
  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }
  
  /**
   * רישום להאזנה לאירועים עם אפשרות לסינון
   * @param listener פונקציית המאזין שתקרא כאשר ישנה התראה
   * @param filter הגבלות להרשמה
   * @returns מזהה הרשמה המשמש לביטול ההרשמה
   */
  public subscribe(listener: NotificationListener, filter: NotificationFilter = {}): string {
    const id = `listener_${this.nextListenerId++}`;
    this.listeners.set(id, { listener, filter });
    return id;
  }
  
  /**
   * ביטול הרשמה להאזנה
   * @param id מזהה ההרשמה שהתקבל מפונקציית subscribe
   */
  public unsubscribe(id: string): void {
    this.listeners.delete(id);
  }
  
  /**
   * שליחת התראה לכל המאזינים המתאימים
   * @param event אירוע ההתראה
   */
  public notify(event: Omit<NotificationEvent, 'timestamp'>): void {
    const fullEvent: NotificationEvent = {
      ...event,
      timestamp: Date.now()
    };
    
    // שמירת האירוע בהיסטוריה
    this.addToRecentEvents(fullEvent);
    
    // שליחה לכל המאזינים המתאימים
    this.listeners.forEach(({ listener, filter }) => {
      if (this.matchesFilter(fullEvent, filter)) {
        try {
          listener(fullEvent);
        } catch (error) {
          console.error('שגיאה בעת קריאה למאזין התראות:', error);
        }
      }
    });
  }
  
  /**
   * קבלת אירועים אחרונים ממערכת ההתראות
   * @param limit מספר אירועים מקסימלי להחזרה
   */
  public getRecentEvents(limit: number = this.MAX_RECENT_EVENTS): NotificationEvent[] {
    return this.recentEvents.slice(0, limit);
  }
  
  /**
   * בדיקה אם אירוע תואם למסנן
   * @param event אירוע לבדיקה
   * @param filter מסנן להתאמה
   * @returns האם האירוע תואם למסנן
   */
  private matchesFilter(event: NotificationEvent, filter: NotificationFilter): boolean {
    // בדיקת התאמה לסוג אירוע
    if (filter.eventTypes && filter.eventTypes.length > 0) {
      if (!filter.eventTypes.includes(event.type)) {
        return false;
      }
    }
    
    // בדיקת התאמה לסוג נתונים
    if (filter.dataTypes && filter.dataTypes.length > 0) {
      if (!event.dataType || !filter.dataTypes.includes(event.dataType)) {
        return false;
      }
    }
    
    // בדיקת התאמה למזהה ישות
    if (filter.entityIds && filter.entityIds.length > 0) {
      if (!event.entityId || !filter.entityIds.includes(event.entityId)) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * הוספת אירוע לרשימת האירועים האחרונים
   */
  private addToRecentEvents(event: NotificationEvent): void {
    this.recentEvents.unshift(event);
    
    // שמירה על גודל מקסימלי של רשימת האירועים
    if (this.recentEvents.length > this.MAX_RECENT_EVENTS) {
      this.recentEvents = this.recentEvents.slice(0, this.MAX_RECENT_EVENTS);
    }
  }
  
  /**
   * רישום להאזנה לשינויים ב-AppStore
   */
  private registerStoreListeners(): void {
    // מאזין לשינויים במשתמשים
    store.subscribe('users', (users) => {
      this.notify({
        type: EventType.DATA_UPDATED,
        dataType: 'users',
        payload: users
      });
    });
    
    // מאזין לשינויים במשחקים
    store.subscribe('games', (games) => {
      this.notify({
        type: EventType.DATA_UPDATED,
        dataType: 'games',
        payload: games
      });
    });
    
    // מאזין לשינויים בקבוצות
    store.subscribe('groups', (groups) => {
      this.notify({
        type: EventType.DATA_UPDATED,
        dataType: 'groups',
        payload: groups
      });
    });
    
    // מאזין לשינויים ביחידות תשלום
    store.subscribe('paymentUnits', (paymentUnits) => {
      this.notify({
        type: EventType.DATA_UPDATED,
        dataType: 'paymentUnits',
        payload: paymentUnits
      });
    });
    
    // מאזינים לסטטוס טעינת נתונים
    const dataTypes: DataType[] = ['users', 'games', 'groups', 'paymentUnits'];
    dataTypes.forEach(dataType => {
      store.subscribe(`${dataType}Status`, (status) => {
        if (status.loading) {
          this.notify({
            type: EventType.SYNC_STARTED,
            dataType
          });
        } else if (status.error) {
          this.notify({
            type: EventType.SYNC_FAILED,
            dataType,
            payload: { error: status.error }
          });
        } else if (!status.loading) {
          this.notify({
            type: EventType.SYNC_COMPLETED,
            dataType,
            payload: { lastUpdated: status.lastUpdated }
          });
        }
      });
    });
  }
}

// יצוא הסינגלטון
export const notificationService = NotificationService.getInstance(); 