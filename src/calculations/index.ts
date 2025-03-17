/**
 * מודול חישובים מרכזי
 * 
 * מייצא את כל פונקציות החישוב והטיפוסים הנדרשים
 */

// ייצוא טיפוסים בסיסיים
export * from './core/types';
export * from './core/constants';
export * from './core/utils';

// ייצוא מנהל מטמון
import { CacheManager } from './cache/CacheManager';
export { CacheManager };

// ייצוא פונקציות חישוב שחקן
export { calculatePlayerStats } from './player/stats';
export { calculatePlayerRanking } from './player/ranking';

// ייצוא פונקציות חישוב משחק
// לחלופין ניתן להשתמש ב: export * from './game/results';
// כרגע הפונקציות לא קיימות לכן יש להסיר אותן מהייצוא הספציפי עד שיממשו
export * from './game/results';
export * from './game/payments';

// ייצוא פונקציות חישוב פיננסי
// לחלופין ניתן להשתמש ב: export * from './financial/profit';
// כרגע הפונקציות לא קיימות לכן יש להסיר אותן מהייצוא הספציפי עד שיממשו
export * from './financial/profit';

// ייצוא פונקציות חישוב התפלגויות
export * from './distributions/profit';

// ייצוא פונקציות חישוב מגמות זמן
export * from './time/trends';

/**
 * ניקוי כל המטמון של מערכת החישובים
 */
export function clearAllCalculationsCache(): void {
  CacheManager.invalidateAll();
}

/**
 * ניקוי מטמון לקטגוריה ספציפית
 * @param category שם הקטגוריה
 */
export function clearCategoryCache(category: string): void {
  CacheManager.invalidateCategory(category);
} 