/**
 * קבועים לשכבת החישובים
 */

/**
 * קטגוריות מטמון
 */
export const CACHE_CATEGORIES = {
  PLAYER_STATS: 'playerStats',
  GAME_STATS: 'gameStats',
  FINANCIAL: 'financial',
  RANKINGS: 'rankings',
  DISTRIBUTIONS: 'distributions',
  TIME_TRENDS: 'timeTrends',
};

/**
 * זמני תפוגה של מטמון (במילישניות)
 */
export const CACHE_TTL = {
  SHORT: 1 * 60 * 1000,    // דקה אחת
  MEDIUM: 5 * 60 * 1000,   // 5 דקות
  LONG: 15 * 60 * 1000,    // 15 דקות
  VERY_LONG: 60 * 60 * 1000 // שעה
};

/**
 * הגדרות ברירת מחדל לחישובים
 */
export const DEFAULT_CALCULATION_OPTIONS = {
  useCache: true,
  forceRefresh: false
};

/**
 * גבולות להתפלגויות
 */
export const DISTRIBUTION_RANGES = {
  INVESTMENT: [
    { label: 'עד ₪100', min: 0, max: 100 },
    { label: '₪101-₪200', min: 101, max: 200 },
    { label: '₪201-₪300', min: 201, max: 300 },
    { label: '₪301-₪500', min: 301, max: 500 },
    { label: 'מעל ₪500', min: 501, max: Infinity }
  ],
  PROFIT: [
    { label: 'הפסד גדול (מעל ₪200-)', min: -Infinity, max: -201 },
    { label: 'הפסד בינוני (₪101-₪200)', min: -200, max: -101 },
    { label: 'הפסד קטן (עד ₪100)', min: -100, max: -1 },
    { label: 'רווח קטן (עד ₪100)', min: 0, max: 100 },
    { label: 'רווח בינוני (₪101-₪200)', min: 101, max: 200 },
    { label: 'רווח גדול (מעל ₪200)', min: 201, max: Infinity }
  ],
  REBUYS: [
    { label: 'ללא ריבאיים', count: 0 },
    { label: 'ריבאי אחד', count: 1 },
    { label: '2 ריבאיים', count: 2 },
    { label: '3+ ריבאיים', min: 3, max: Infinity }
  ]
}; 