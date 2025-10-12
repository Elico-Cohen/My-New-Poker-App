import { useEffect, useState, useCallback } from 'react';
import { store, DataType } from '@/store/AppStore';
import { syncService } from '@/store/SyncService';
import { UserProfile } from '@/models/UserProfile';
import { Game } from '@/models/Game';
import { Group } from '@/models/Group';
import { PaymentUnit } from '@/models/PaymentUnit';
import { notificationService, EventType, NotificationEvent, NotificationFilter } from '@/services/NotificationService';

// פונקציית עזר שמתרגמת פרמטר סינון זמן לפונקציית פילטור
const getTimeFilterFunction = (timeFilter: 'all' | 'month' | 'quarter' | 'year') => {
  const now = new Date();
  let cutoffDate: Date;
  
  switch (timeFilter) {
    case 'month':
      cutoffDate = new Date(now);
      cutoffDate.setMonth(now.getMonth() - 1);
      break;
    case 'quarter':
      cutoffDate = new Date(now);
      cutoffDate.setMonth(now.getMonth() - 3);
      break;
    case 'year':
      cutoffDate = new Date(now);
      cutoffDate.setFullYear(now.getFullYear() - 1);
      break;
    default:
      cutoffDate = new Date(0); // מתחילת הזמן
      break;
  }
  
  return (game: Game) => {
    if (!game.date) return false;
    
    const gameDate = new Date(game.date.year, game.date.month - 1, game.date.day);
    return gameDate >= cutoffDate;
  };
};

/**
 * הוק להאזנה לאירועים והתראות במערכת
 * @param filter מסנן לסוגי אירועים להאזנה
 */
export const useNotifications = (filter: NotificationFilter = {}) => {
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  
  useEffect(() => {
    // האזנה להתראות המערכת
    const listenerId = notificationService.subscribe((event) => {
      setEvents(prev => [event, ...prev.slice(0, 19)]); // שמירה על 20 אירועים אחרונים בלבד
    }, filter);
    
    return () => {
      notificationService.unsubscribe(listenerId);
    };
  }, [filter.eventTypes, filter.dataTypes, filter.entityIds]);
  
  return events;
};

/**
 * הוק להאזנה להתראות על ישות ספציפית
 * @param entityType סוג הישות (users, games, groups, paymentUnits)
 * @param entityId מזהה הישות
 */
export const useEntityChanges = (entityType: DataType, entityId: string) => {
  const [lastChange, setLastChange] = useState<NotificationEvent | null>(null);
  
  useEffect(() => {
    // האזנה לשינויים בישות ספציפית
    const listenerId = notificationService.subscribe((event) => {
      setLastChange(event);
    }, {
      dataTypes: [entityType],
      entityIds: [entityId]
    });
    
    return () => {
      notificationService.unsubscribe(listenerId);
    };
  }, [entityType, entityId]);
  
  return lastChange;
};

/**
 * הוק לניטור מצב החיבור לרשת
 */
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState<boolean>(syncService.isOnline());
  
  useEffect(() => {
    // האזנה לשינויים במצב הרשת
    const listenerId = notificationService.subscribe((event) => {
      if (event.type === EventType.NETWORK_ONLINE) {
        setIsOnline(true);
      } else if (event.type === EventType.NETWORK_OFFLINE) {
        setIsOnline(false);
      }
    }, {
      eventTypes: [EventType.NETWORK_ONLINE, EventType.NETWORK_OFFLINE]
    });
    
    return () => {
      notificationService.unsubscribe(listenerId);
    };
  }, []);
  
  return isOnline;
};

/**
 * הוק למעקב אחר סטטוס טעינת נתונים
 * @param dataType סוג הנתונים למעקב
 */
export const useDataLoadingStatus = (dataType: DataType) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  
  useEffect(() => {
    // טעינה ראשונית
    const status = store.getDataStatus(dataType);
    setIsLoading(status.loading);
    setError(status.error);
    setLastUpdated(status.lastUpdated);
    
    // האזנה לשינויים בסטטוס
    const unsubscribeStatus = store.subscribe(`${dataType}Status`, (status) => {
      setIsLoading(status.loading);
      setError(status.error);
      setLastUpdated(status.lastUpdated);
    });
    
    // האזנה להתראות סנכרון
    const listenerId = notificationService.subscribe((event) => {
      if (event.dataType === dataType) {
        if (event.type === EventType.SYNC_STARTED) {
          setIsLoading(true);
        } else if (event.type === EventType.SYNC_COMPLETED) {
          setIsLoading(false);
          setError(null);
          if (event.payload?.lastUpdated) {
            setLastUpdated(event.payload.lastUpdated);
          }
        } else if (event.type === EventType.SYNC_FAILED) {
          setIsLoading(false);
          setError(event.payload?.error || 'שגיאה לא ידועה');
        }
      }
    }, {
      eventTypes: [EventType.SYNC_STARTED, EventType.SYNC_COMPLETED, EventType.SYNC_FAILED],
      dataTypes: [dataType]
    });
    
    return () => {
      unsubscribeStatus();
      notificationService.unsubscribe(listenerId);
    };
  }, [dataType]);
  
  // פונקציה לרענון הנתונים
  const refreshData = useCallback(() => {
    return syncService.refreshData(dataType);
  }, [dataType]);
  
  return { isLoading, error, lastUpdated, refreshData };
};

/**
 * הוק לקבלת כל השחקנים הפעילים במערכת
 */
export const useUsers = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const { isLoading, error, refreshData } = useDataLoadingStatus('users');
  
  useEffect(() => {
    // טעינה ראשונית
    setUsers(store.getUsers());
    
    // הרשמה לעדכונים
    const unsubscribe = store.subscribe('users', (updatedUsers) => {
      setUsers(updatedUsers);
    });
    
    return () => {
      unsubscribe();
    };
  }, []);
  
  return { users, loading: isLoading, error, refreshUsers: refreshData };
};

/**
 * הוק לקבלת שחקן בודד לפי מזהה
 */
export const useUser = (userId: string) => {
  const [user, setUser] = useState<UserProfile | undefined>(store.getUser(userId));
  const { isLoading, error } = useDataLoadingStatus('users');
  const lastChange = useEntityChanges('users', userId);
  
  useEffect(() => {
    // טעינה ראשונית
    setUser(store.getUser(userId));
    
    // הרשמה לעדכונים
    const unsubscribe = store.subscribe('users', () => {
      const updatedUser = store.getUser(userId);
      setUser(updatedUser);
    });
    
    return () => {
      unsubscribe();
    };
  }, [userId]);
  
  // כאשר יש שינוי בישות הספציפית, עדכון המצב
  useEffect(() => {
    if (lastChange && (lastChange.type === EventType.DATA_UPDATED || lastChange.type === EventType.DATA_CREATED)) {
      setUser(lastChange.payload);
    } else if (lastChange && lastChange.type === EventType.DATA_DELETED) {
      setUser(undefined);
    }
  }, [lastChange]);
  
  return { user, loading: isLoading, error };
};

/**
 * הוק לקבלת כל הקבוצות הפעילות במערכת
 */
export const useGroups = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    try {
      // טעינה ראשונית
      const initialGroups = store.getGroups();
      setGroups(initialGroups);
      setLoading(false);
      
      // הרשמה לעדכונים
      const unsubscribe = store.subscribe('groups', (updatedGroups) => {
        setGroups(updatedGroups);
      });
      
      return () => {
        unsubscribe();
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת הקבוצות');
      setLoading(false);
    }
  }, []);
  
  return { groups, loading, error };
};

/**
 * הוק לקבלת קבוצה בודדת לפי מזהה
 */
export const useGroup = (groupId: string | undefined) => {
  const [group, setGroup] = useState<Group | undefined>(
    groupId ? store.getGroup(groupId) : undefined
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!groupId) {
      setGroup(undefined);
      setLoading(false);
      return;
    }
    
    // טעינה ראשונית
    setGroup(store.getGroup(groupId));
    
    // הרשמה לעדכונים
    const unsubscribe = store.subscribe('groups', () => {
      setGroup(store.getGroup(groupId));
    });
    
    const unsubscribeStatus = store.subscribe('groupsStatus', (status) => {
      setLoading(status.loading);
      setError(status.error);
    });
    
    return () => {
      unsubscribe();
      unsubscribeStatus();
    };
  }, [groupId]);
  
  return { group, loading, error };
};

/**
 * הוק לקבלת כל המשחקים עם אפשרויות סינון
 */
export const useGames = (options?: {
  groupId?: string;
  status?: string | string[];
  timeFilter?: 'all' | 'month' | 'quarter' | 'year';
}) => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // טעינה ראשונית עם פילטרים
    const allGames = store.getGames();
    
    // הפעלת פילטרים
    const filteredGames = allGames.filter(game => {
      // פילטור לפי קבוצה
      if (options?.groupId && game.groupId !== options.groupId) {
        return false;
      }
      
      // פילטור לפי סטטוס
      if (options?.status) {
        const statusArray = Array.isArray(options.status) ? options.status : [options.status];
        if (!statusArray.includes(game.status)) {
          return false;
        }
      }
      
      // פילטור לפי זמן
      if (options?.timeFilter && options.timeFilter !== 'all') {
        const timeFilterFunc = getTimeFilterFunction(options.timeFilter);
        if (!timeFilterFunc(game)) {
          return false;
        }
      }
      
      return true;
    });
    
    // מיון לפי תאריך (מהחדש לישן)
    const sortedGames = [...filteredGames].sort((a, b) => {
      const aTime = a.date?.timestamp || a.createdAt || 0;
      const bTime = b.date?.timestamp || b.createdAt || 0;
      return bTime - aTime;
    });
    
    setGames(sortedGames);
    
    // הרשמה לעדכונים
    const unsubscribe = store.subscribe('games', () => {
      const updatedGames = store.getGames();
      
      // החלת אותם פילטרים על הנתונים המעודכנים
      const updatedFilteredGames = updatedGames.filter(game => {
        // פילטור לפי קבוצה
        if (options?.groupId && game.groupId !== options.groupId) {
          return false;
        }
        
        // פילטור לפי סטטוס
        if (options?.status) {
          const statusArray = Array.isArray(options.status) ? options.status : [options.status];
          if (!statusArray.includes(game.status)) {
            return false;
          }
        }
        
        // פילטור לפי זמן
        if (options?.timeFilter && options.timeFilter !== 'all') {
          const timeFilterFunc = getTimeFilterFunction(options.timeFilter);
          if (!timeFilterFunc(game)) {
            return false;
          }
        }
        
        return true;
      });
      
      // מיון לפי תאריך (מהחדש לישן)
      const updatedSortedGames = [...updatedFilteredGames].sort((a, b) => {
        const aTime = a.date?.timestamp || a.createdAt || 0;
        const bTime = b.date?.timestamp || b.createdAt || 0;
        return bTime - aTime;
      });
      
      setGames(updatedSortedGames);
    });
    
    const unsubscribeStatus = store.subscribe('gamesStatus', (status) => {
      setLoading(status.loading);
      setError(status.error);
    });
    
    return () => {
      unsubscribe();
      unsubscribeStatus();
    };
  }, [options?.groupId, options?.status, options?.timeFilter]);
  
  return { games, loading, error };
};

/**
 * הוק לקבלת משחק בודד לפי מזהה
 */
export const useGame = (gameId: string | undefined) => {
  const [game, setGame] = useState<Game | undefined>(
    gameId ? store.getGame(gameId) : undefined
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!gameId) {
      setGame(undefined);
      setLoading(false);
      return;
    }
    
    // טעינה ראשונית
    setGame(store.getGame(gameId));
    
    // הרשמה לעדכונים
    const unsubscribe = store.subscribe('games', () => {
      setGame(store.getGame(gameId));
    });
    
    const unsubscribeStatus = store.subscribe('gamesStatus', (status) => {
      setLoading(status.loading);
      setError(status.error);
    });
    
    return () => {
      unsubscribe();
      unsubscribeStatus();
    };
  }, [gameId]);
  
  return { game, loading, error };
};

/**
 * הוק לקבלת כל יחידות התשלום הפעילות
 */
export const usePaymentUnits = () => {
  const [units, setUnits] = useState<PaymentUnit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // טעינה ראשונית
    setUnits(store.getPaymentUnits());
    
    // הרשמה לעדכונים
    const unsubscribe = store.subscribe('paymentUnits', (updatedUnits) => {
      setUnits(updatedUnits);
    });
    
    const unsubscribeStatus = store.subscribe('paymentUnitsStatus', (status) => {
      setLoading(status.loading);
      setError(status.error);
    });
    
    return () => {
      unsubscribe();
      unsubscribeStatus();
    };
  }, []);
  
  return { units, loading, error };
};

/**
 * הוק לקבלת יחידת תשלום בודדת לפי מזהה
 */
export const usePaymentUnit = (unitId: string | undefined) => {
  const [unit, setUnit] = useState<PaymentUnit | undefined>(
    unitId ? store.getPaymentUnit(unitId) : undefined
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!unitId) {
      setUnit(undefined);
      setLoading(false);
      return;
    }
    
    // טעינה ראשונית
    setUnit(store.getPaymentUnit(unitId));
    
    // הרשמה לעדכונים
    const unsubscribe = store.subscribe('paymentUnits', () => {
      setUnit(store.getPaymentUnit(unitId));
    });
    
    const unsubscribeStatus = store.subscribe('paymentUnitsStatus', (status) => {
      setLoading(status.loading);
      setError(status.error);
    });
    
    return () => {
      unsubscribe();
      unsubscribeStatus();
    };
  }, [unitId]);
  
  return { unit, loading, error };
}; 