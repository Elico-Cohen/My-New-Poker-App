/**
 * ערכת צבעים לאפליקציית פוקר
 */

// צבעי בסיס - מוגדרים פעם אחת ומשמשים בכל המקומות
const baseColors = {
    // צבעי פוקר קלאסיים
    pokerGreen: '#35654d',     // ירוק שולחן פוקר קלאסי
    pokerRed: '#c41e3a',       // אדום קלפים קלאסי
    feltBlue: '#256d8d',       // כחול-ירקרק של שולחן
    
    // צבעי מותג
    primary: '#35654d',        // ירוק כצבע ראשי
    secondary: '#c41e3a',      // אדום כצבע משני
    
    // אפורים
    gray100: '#f7f7f7',
    gray200: '#e6e6e6',
    gray300: '#d4d4d4',
    gray400: '#a3a3a3',
    gray500: '#737373',
    gray600: '#525252',
    gray700: '#404040',
    gray800: '#262626',
    gray900: '#171717',
    
    // צבעי סטטוס
    success: '#22c55e',        // ירוק - להצלחה/רווח
    error: '#ef4444',          // אדום - לשגיאה/הפסד
    warning: '#f59e0b',        // כתום - לאזהרה
    info: '#3b82f6',          // כחול - למידע
    
    // צבעים נוספים
    white: '#ffffff',
    black: '#000000'
  } as const;
  
  // ערכת צבעים למצב בהיר
  export const lightTheme = {
    // רקעים
    background: baseColors.white,
    surface: baseColors.gray100,
    surfaceVariant: baseColors.gray200,
    
    // טקסט
    textPrimary: baseColors.gray900,
    textSecondary: baseColors.gray700,
    textDisabled: baseColors.gray500,
    
    // צבעי מותג
    primary: baseColors.primary,
    onPrimary: baseColors.white,
    secondary: baseColors.secondary,
    onSecondary: baseColors.white,
    
    // גבולות והפרדה
    border: baseColors.gray300,
    divider: baseColors.gray200,
    
    // צבעי סטטוס
    success: baseColors.success,
    error: baseColors.error,
    warning: baseColors.warning,
    info: baseColors.info,
    
    // צבעי פוקר ספציפיים
    pokerTable: baseColors.pokerGreen,
    cardRed: baseColors.pokerRed,
    feltOverlay: baseColors.feltBlue
  } as const;
  
  // ערכת צבעים למצב כהה
  export const darkTheme = {
    // רקעים
    background: baseColors.gray900,
    surface: baseColors.gray800,
    surfaceVariant: baseColors.gray700,
    
    // טקסט
    textPrimary: baseColors.gray100,
    textSecondary: baseColors.gray300,
    textDisabled: baseColors.gray500,
    
    // צבעי מותג - מוחלשים מעט במצב כהה
    primary: baseColors.pokerGreen,
    onPrimary: baseColors.white,
    secondary: baseColors.pokerRed,
    onSecondary: baseColors.white,
    
    // גבולות והפרדה
    border: baseColors.gray600,
    divider: baseColors.gray700,
    
    // צבעי סטטוס - מוחלשים מעט במצב כהה
    success: baseColors.success,
    error: baseColors.error,
    warning: baseColors.warning,
    info: baseColors.info,
    
    // צבעי פוקר ספציפיים - זהים למצב בהיר
    pokerTable: baseColors.pokerGreen,
    cardRed: baseColors.pokerRed,
    feltOverlay: baseColors.feltBlue
  } as const;
  
  // ערכת צבעי משחק - קבועה בין המצבים
  export const gameColors = {
    chips: {
      white: '#ffffff',
      red: '#ff0000',
      blue: '#0000ff',
      green: '#008000',
      black: '#000000'
    },
    
    suits: {
      hearts: baseColors.pokerRed,
      diamonds: baseColors.pokerRed,
      clubs: baseColors.black,
      spades: baseColors.black
    }
  } as const;
  
  // טיפוס לערכת הצבעים
  export type ThemeColors = typeof lightTheme;
  
  // ייצוא ברירת המחדל
  export default {
    light: lightTheme,
    dark: darkTheme,
    game: gameColors
  };