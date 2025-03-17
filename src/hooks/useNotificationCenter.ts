import { useState, useEffect, useCallback, useRef } from 'react';
import { notificationService, EventType, NotificationEvent, NotificationFilter } from '@/services/NotificationService';
import { Alert } from 'react-native';
import { DataType } from '@/store/AppStore';

/**
 * סוגי התראות למשתמש
 */
export enum NotificationType {
  SUCCESS = 'success',
  ERROR = 'error',
  INFO = 'info',
  WARNING = 'warning',
}

/**
 * מבנה התראה למשתמש
 */
export interface UserNotification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  source: EventType;
  entityId?: string;
  dataType?: DataType;
}

/**
 * הוק מרכזי להתראות
 * שולט בלוגיקה של קבלת וניהול התראות למשתמש
 */
export const useNotificationCenter = () => {
  // מערך ההתראות למשתמש
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  
  // מזהה ייחודי להתראות
  const nextNotificationId = useRef(1);
  
  // פונקציה להוספת התראה חדשה
  const addNotification = useCallback((notification: Omit<UserNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: UserNotification = {
      ...notification,
      id: nextNotificationId.current++,
      timestamp: Date.now(),
      read: false,
    };
    
    setNotifications(prev => [newNotification, ...prev].slice(0, 50)); // שומר רק 50 התראות אחרונות
    
    return newNotification.id;
  }, []);
  
  // פונקציה לסימון התראה כנקראה
  const markAsRead = useCallback((notificationId: number) => {
    setNotifications(prev => 
      prev.map(note => 
        note.id === notificationId ? { ...note, read: true } : note
      )
    );
  }, []);
  
  // פונקציה לסימון כל ההתראות כנקראות
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => 
      prev.map(note => ({ ...note, read: true }))
    );
  }, []);
  
  // פונקציה למחיקת התראה
  const removeNotification = useCallback((notificationId: number) => {
    setNotifications(prev => 
      prev.filter(note => note.id !== notificationId)
    );
  }, []);
  
  // פונקציה לניקוי כל ההתראות
  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);
  
  // הצגת התראה כ-Alert
  const showAlert = useCallback((notification: Omit<UserNotification, 'id' | 'timestamp' | 'read'>) => {
    const id = addNotification(notification);
    
    Alert.alert(
      notification.title,
      notification.message,
      [{ text: 'אישור', onPress: () => markAsRead(id) }]
    );
    
    return id;
  }, [addNotification, markAsRead]);
  
  // האזנה לאירועי שינוי מהמערכת והמרתם להתראות למשתמש
  useEffect(() => {
    const listenerId = notificationService.subscribe((event) => {
      // המרת אירועי מערכת להתראות למשתמש לפי הצורך
      switch (event.type) {
        case EventType.NETWORK_OFFLINE:
          addNotification({
            type: NotificationType.WARNING,
            title: 'אין חיבור לאינטרנט',
            message: 'המערכת עברה למצב לא מקוון. חלק מהתכונות לא יהיו זמינות.',
            source: event.type,
          });
          break;
          
        case EventType.NETWORK_ONLINE:
          addNotification({
            type: NotificationType.SUCCESS,
            title: 'החיבור לאינטרנט חזר',
            message: 'המערכת מסנכרנת נתונים...',
            source: event.type,
          });
          break;
          
        case EventType.SYNC_FAILED:
          if (event.dataType) {
            const dataTypeName = getHebrewDataTypeName(event.dataType);
            addNotification({
              type: NotificationType.ERROR,
              title: `שגיאת סנכרון`,
              message: `נכשל סנכרון ${dataTypeName}. המערכת תנסה שוב בקרוב.`,
              source: event.type,
              dataType: event.dataType,
            });
          }
          break;
          
        case EventType.DATA_CREATED:
          if (event.dataType === 'games' && event.entityId) {
            addNotification({
              type: NotificationType.INFO,
              title: 'משחק חדש נוסף',
              message: 'נוסף משחק חדש למערכת.',
              source: event.type,
              dataType: event.dataType,
              entityId: event.entityId,
            });
          }
          break;
      }
    });
    
    return () => {
      notificationService.unsubscribe(listenerId);
    };
  }, [addNotification]);
  
  // ספירת התראות שלא נקראו
  const unreadCount = notifications.filter(note => !note.read).length;
  
  return {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAllNotifications,
    showAlert,
  };
};

/**
 * המרת סוג נתונים לשם בעברית
 */
function getHebrewDataTypeName(dataType: DataType): string {
  switch (dataType) {
    case 'users':
      return 'משתמשים';
    case 'games':
      return 'משחקים';
    case 'groups':
      return 'קבוצות';
    case 'paymentUnits':
      return 'יחידות תשלום';
    default:
      return 'נתונים';
  }
}

/**
 * הוק פשוט להצגת התראות בצד הקליינט
 */
export const useUserNotifications = () => {
  const { 
    notifications, 
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAllNotifications,
  } = useNotificationCenter();

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAllNotifications,
  };
}; 