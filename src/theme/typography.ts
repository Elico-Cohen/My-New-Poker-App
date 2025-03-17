import { Platform } from 'react-native';

/**
 * הגדרות טיפוגרפיה לאפליקציה
 */

// משפחות פונטים
export const fontFamilies = {
  // פונט ראשי - Inter
  primary: 'Inter_400Regular',
  primaryMedium: 'Inter_500Medium',
  primarySemiBold: 'Inter_600SemiBold',
  primaryBold: 'Inter_700Bold',
  
  // פונט למספרים (סכומים, צ'יפים וכו')
  numeric: 'SpaceMono'
} as const;

// גדלי פונטים
export const fontSizes = {
  // כותרות
  h1: 32,
  h2: 28,
  h3: 24,
  h4: 20,
  
  // טקסט
  bodyLarge: 18,
  bodyNormal: 16,
  bodySmall: 14,
  
  // מספרים
  numberLarge: 24,
  numberNormal: 20,
  numberSmall: 16,
} as const;

// משקלי פונט מותאמים למשפחת Inter
export const textStyles = {
  // כותרות
  h1: {
    fontFamily: fontFamilies.primaryBold,
    fontSize: fontSizes.h1,
    letterSpacing: -0.5
  },
  h2: {
    fontFamily: fontFamilies.primaryBold,
    fontSize: fontSizes.h2,
    letterSpacing: -0.3
  },
  h3: {
    fontFamily: fontFamilies.primarySemiBold,
    fontSize: fontSizes.h3,
    letterSpacing: -0.2
  },
  h4: {
    fontFamily: fontFamilies.primarySemiBold,
    fontSize: fontSizes.h4,
    letterSpacing: -0.1
  },
  
  // טקסט רגיל
  bodyLarge: {
    fontFamily: fontFamilies.primary,
    fontSize: fontSizes.bodyLarge,
    letterSpacing: 0
  },
  bodyNormal: {
    fontFamily: fontFamilies.primary,
    fontSize: fontSizes.bodyNormal,
    letterSpacing: 0
  },
  bodySmall: {
    fontFamily: fontFamilies.primary,
    fontSize: fontSizes.bodySmall,
    letterSpacing: 0
  },
  
  // מספרים
  numberLarge: {
    fontFamily: fontFamilies.numeric,
    fontSize: fontSizes.numberLarge,
    letterSpacing: -0.3
  },
  numberNormal: {
    fontFamily: fontFamilies.numeric,
    fontSize: fontSizes.numberNormal,
    letterSpacing: -0.2
  },
  numberSmall: {
    fontFamily: fontFamilies.numeric,
    fontSize: fontSizes.numberSmall,
    letterSpacing: -0.1
  }
} as const;

export default {
  families: fontFamilies,
  sizes: fontSizes,
  styles: textStyles
};