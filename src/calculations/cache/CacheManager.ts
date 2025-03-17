/**
 * מנהל המטמון לשכבת החישובים
 */

import { CACHE_TTL } from '../core/constants';

/**
 * מבנה נתוני מטמון
 */
interface CacheEntry<T> {
  value: T;            // הערך השמור
  timestamp: number;    // זמן השמירה
  expiresAt: number;    // זמן תפוגה
}

/**
 * מנהל מטמון עבור שכבת החישובים
 */
export class CacheManager {
  private static cache: Record<string, Record<string, CacheEntry<any>>> = {};

  /**
   * קבלת ערך מהמטמון
   * @param category קטגוריית המטמון
   * @param key מפתח
   * @returns ערך מהמטמון או null אם לא נמצא או פג תוקפו
   */
  static get<T>(category: string, key: string): T | null {
    const now = Date.now();
    const categoryCache = this.cache[category];
    
    if (!categoryCache || !categoryCache[key]) {
      return null;
    }
    
    const entry = categoryCache[key];
    
    // בדיקה האם המטמון פג תוקף
    if (entry.expiresAt < now) {
      // נקה ערך פג תוקף
      delete categoryCache[key];
      return null;
    }
    
    return entry.value;
  }
  
  /**
   * שמירת ערך במטמון
   * @param category קטגוריית המטמון
   * @param key מפתח
   * @param value הערך לשמירה
   * @param ttlMs זמן חיים במילישניות
   */
  static set<T>(
    category: string, 
    key: string, 
    value: T, 
    ttlMs: number = CACHE_TTL.MEDIUM
  ): void {
    if (!this.cache[category]) {
      this.cache[category] = {};
    }
    
    const now = Date.now();
    
    this.cache[category][key] = {
      value,
      timestamp: now,
      expiresAt: now + ttlMs
    };
  }
  
  /**
   * ניקוי קטגוריה מהמטמון
   * @param category קטגוריית המטמון לניקוי
   */
  static invalidateCategory(category: string): void {
    delete this.cache[category];
  }
  
  /**
   * ניקוי מפתח ספציפי מהמטמון
   * @param category קטגוריית המטמון
   * @param key מפתח לניקוי
   */
  static invalidateKey(category: string, key: string): void {
    if (this.cache[category]) {
      delete this.cache[category][key];
    }
  }
  
  /**
   * ניקוי כל המטמון
   */
  static invalidateAll(): void {
    this.cache = {};
  }
  
  /**
   * קבלת מידע על מצב המטמון
   * @returns סטטיסטיקות המטמון
   */
  static getCacheStats(): Record<string, any> {
    const stats: Record<string, any> = {
      categories: 0,
      entries: 0,
      expired: 0,
      categoriesDetails: {}
    };
    
    const now = Date.now();
    
    for (const category in this.cache) {
      stats.categories++;
      stats.categoriesDetails[category] = {
        entries: 0,
        expired: 0
      };
      
      for (const key in this.cache[category]) {
        stats.entries++;
        stats.categoriesDetails[category].entries++;
        
        if (this.cache[category][key].expiresAt < now) {
          stats.expired++;
          stats.categoriesDetails[category].expired++;
        }
      }
    }
    
    return stats;
  }
  
  /**
   * ניקוי ערכים שפג תוקפם
   */
  static cleanExpired(): void {
    const now = Date.now();
    
    for (const category in this.cache) {
      for (const key in this.cache[category]) {
        if (this.cache[category][key].expiresAt < now) {
          delete this.cache[category][key];
        }
      }
    }
  }
} 