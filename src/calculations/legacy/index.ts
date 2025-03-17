/**
 * מודול גישור למערכת הקיימת
 * 
 * מייצא את כל פונקציות הגישור למערכת הקיימת כדי לאפשר מעבר חלק
 * מהפונקציות הישנות לפונקציות החדשות
 */

// ייצוא מגשר פונקציות שחקן
export * from './playerBridge';

// ייצוא מגשר פונקציות משחק
export * from './gameBridge';

// ייצוא מגשר פונקציות פיננסיות
export * from './financialBridge';

// ייצוא מגשר פונקציות מגמות זמן
export * from './timeBridge';

// פונקציות ניקוי מטמון מרכזיות
import { CacheManager } from '../index';

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

/**
 * קבלת סטטוס המטמון
 * @returns סטטיסטיקות המטמון
 */
export function getCacheStats(): any {
  return CacheManager.getCacheStats();
} 