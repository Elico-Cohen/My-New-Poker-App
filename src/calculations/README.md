# שכבת חישובים - Poker Analytics

שכבת חישובים סטטיסטיים ואנליטיים לאפליקציית פוקר.

## מטרת השכבה

שכבה זו נועדה לספק תשתית אחידה וחזקה לכל חישובי הסטטיסטיקה והאנליטיקה במערכת, כולל:

1. סטטיסטיקות שחקן
2. דירוגי שחקנים
3. תוצאות והתפלגויות משחק
4. חישובי תשלומים
5. ניתוחים פיננסיים
6. מגמות לאורך זמן

## יתרונות השכבה החדשה

- **אחידות** - פורמט אחיד לכל פונקציות החישוב, כולל מטה-נתונים ומידע על מקור הנתונים
- **מטמון** - מנגנון מטמון מובנה וחכם המותאם לסוגי חישוב שונים
- **מודולריות** - חלוקה למודולים לוגיים שקל להרחיב ולתחזק
- **ביצועים** - תכנון מבנה עם דגש על ביצועים ואופטימיזציה
- **תיעוד** - תיעוד מקיף של כל פונקציה וטיפוס

## מבנה השכבה

```
src/calculations/
│
├── core/              # רכיבי ליבה
│   ├── types.ts       # טיפוסים בסיסיים
│   ├── constants.ts   # קבועים משותפים
│   └── utils.ts       # פונקציות עזר
│
├── cache/             # מנגנון מטמון
│   └── CacheManager.ts # מנהל מטמון מרכזי
│
├── player/            # חישובי שחקן
│   ├── stats.ts       # סטטיסטיקות שחקן
│   └── ranking.ts     # דירוג שחקנים
│
├── game/              # חישובי משחק
│   ├── results.ts     # תוצאות משחק
│   └── payments.ts    # תשלומים אופטימליים
│
├── financial/         # חישובים פיננסיים
│   └── profit.ts      # חישובי רווח מצטבר
│
├── distributions/     # חישובי התפלגויות
│   └── profit.ts      # התפלגות רווחים והשקעות
│
├── time/              # חישובי מגמות זמן
│   └── trends.ts      # מגמות לאורך זמן
│
├── legacy/            # מודולי גישור לקוד ישן
│   ├── index.ts           # ייצוא מרכזי
│   ├── playerBridge.ts    # גישור פונקציות שחקן
│   ├── gameBridge.ts      # גישור פונקציות משחק
│   ├── financialBridge.ts # גישור פונקציות פיננסיות
│   └── timeBridge.ts      # גישור פונקציות זמן
│
├── index.ts           # ייצוא מרכזי של השכבה
│
├── README.md          # תיעוד ראשי
├── FUNCTION_MAPPING.md # מיפוי פונקציות ישנות-חדשות
├── USAGE_EXAMPLE.md    # דוגמאות שימוש
└── ROADMAP.md          # מפת דרכים להמשך פיתוח
```

## התחלה מהירה

### שימוש בפונקציות חדשות

```typescript
import { calculatePlayerStats, PlayerStatsParams } from './calculations';

// הגדרת פרמטרים
const params: PlayerStatsParams = {
  userId: 'user123',
  games: gamesList,
  timeFilter: 'month'
};

// קריאה לפונקציה
const result = calculatePlayerStats(params);

// שימוש בתוצאה
console.log(`Total profit: ${result.data.totalProfit}`);
console.log(`Execution time: ${result.metadata.executionTimeMs}ms`);
console.log(`Cached: ${result.metadata.cached}`);
```

### שימוש במודולי גישור (עבור קוד קיים)

```typescript
import { calculateTotalProfit } from './calculations/legacy';

// שימוש באותה צורה כמו הפונקציות הישנות
const profit = calculateTotalProfit('user123', gamesList);
```

## ניהול המטמון

```typescript
import { CacheManager, clearCategoryCache, clearAllCalculationsCache } from './calculations';

// ניקוי מטמון ספציפי
clearCategoryCache('playerStats');

// ניקוי כל המטמון
clearAllCalculationsCache();

// שימוש ישיר במנהל המטמון
const cacheStats = CacheManager.getCacheStats();
console.log(`Cache hits: ${cacheStats.hits}, misses: ${cacheStats.misses}`);
```

## תיעוד נוסף

- ראה [FUNCTION_MAPPING.md](./FUNCTION_MAPPING.md) למיפוי פונקציות ישנות-חדשות
- ראה [USAGE_EXAMPLE.md](./USAGE_EXAMPLE.md) לדוגמאות שימוש מפורטות
- ראה [ROADMAP.md](./ROADMAP.md) למפת הדרכים לפיתוח עתידי

## תלויות

השכבה תלויה במודלים הבאים:

- `src/models/Game.ts`
- `src/models/Player.ts`
- `src/models/UserProfile.ts`

## סטטוס מימוש

✅ כל המודולים מיושמים במלואם ומוכנים לשימוש!

## צעדים הבאים

1. כיסוי בדיקות לכל המודולים
2. עדכון API ושירותים לשימוש בשכבה החדשה
3. עדכון ממשקי UI להצגת המידע הנוסף
4. הוספת פונקציות ויכולות ניתוח מתקדמות 