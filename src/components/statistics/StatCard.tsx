// src/components/statistics/StatCard.tsx

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from '@/components/common/Icon';

// Define casino theme colors
const CASINO_COLORS = {
  gold: '#FFD700',
  primary: '#35654d',
  background: '#1C2C2E',
  surface: '#0D1B1E',
  text: '#FFFFFF',
  textSecondary: '#B8B8B8',
  success: '#22c55e',
  error: '#ef4444',
  info: '#3b82f6',
  warning: '#f59e0b'
};

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon?: string;
  format?: 'integer' | 'decimal' | 'percentage' | 'currency' | 'custom';
  valueColor?: string;
  iconColor?: string;
  size?: 'small' | 'medium' | 'large';
  backgroundColor?: string;
  style?: any;
  titleStyle?: any;
  valueStyle?: any;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: number | string;
  suffix?: string;
  prefix?: string;
  onClick?: () => void;
  decimalPlaces?: number;
  alignRight?: boolean;
  iconPosition?: 'left' | 'right';
  inlineSubtitle?: string;
}

/**
 * StatCard component for displaying statistics values with icons
 * 
 * @param title - The title/label of the statistic
 * @param value - The numerical or string value to display
 * @param subtitle - Optional additional descriptive text
 * @param icon - Optional icon name from the app's icon set
 * @param format - How to format the value (integer, decimal, percentage, currency)
 * @param valueColor - Custom color for the value text
 * @param iconColor - Custom color for the icon
 * @param size - Size variant of the card (small, medium, large)
 * @param backgroundColor - Background color for the card
 * @param style - Additional style object for the container
 * @param trend - Optional indicator for value trend (up, down, neutral)
 * @param trendValue - Optional value to display for the trend (e.g. +5%)
 * @param suffix - Optional text to append to the value (e.g. " games")
 * @param prefix - Optional text to prepend to the value (e.g. "₪ ")
 * @param onClick - Optional callback for when the card is clicked
 * @param decimalPlaces - Number of decimal places to show (default varies by format)
 * @param alignRight - Whether to align text to the right (for RTL languages)
 * @param iconPosition - Position of the icon (left or right), default is left
 * @param inlineSubtitle - Optional text to display inline with the value
 */
const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  format = 'integer',
  valueColor,
  iconColor,
  size = 'medium',
  backgroundColor,
  style,
  titleStyle,
  valueStyle,
  trend,
  trendValue,
  suffix = '',
  prefix = '',
  onClick,
  decimalPlaces,
  alignRight = true,
  iconPosition = 'left',
  inlineSubtitle
}) => {
  // Format the value based on the specified format
  const formatValue = (): string => {
    // אם אין כותרת ויש prefix, זה כרטיס של זוכה - נציג רק את השם ללא תוספות
    if (!title && prefix) {
      return typeof value === 'string' ? value : value.toString();
    }
    
    // לכרטיסים רגילים, תצוגה רגילה עם כל התוספות
    if (typeof value === 'string') {
      return `${prefix}${value}${suffix}`;
    }
    
    switch (format) {
      case 'integer':
        return `${prefix}${Math.round(value).toLocaleString()}${suffix}`;
        
      case 'decimal':
        const places = decimalPlaces !== undefined ? decimalPlaces : 1;
        return `${prefix}${value.toFixed(places).replace(/\.0+$/, '')}${suffix}`;
        
      case 'percentage':
        const percentPlaces = decimalPlaces !== undefined ? decimalPlaces : 1;
        return `${prefix}${value.toFixed(percentPlaces)}%${suffix}`;
        
      case 'currency':
        return `${prefix}${value.toLocaleString()} ₪${suffix}`;
        
      case 'custom':
      default:
        return `${prefix}${value}${suffix}`;
    }
  };
  
  // Get size variant styles
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          container: styles.containerSmall,
          title: styles.titleSmall,
          value: styles.valueSmall,
          subtitle: styles.subtitleSmall,
          icon: 'small'
        };
      case 'large':
        return {
          container: styles.containerLarge,
          title: styles.titleLarge,
          value: styles.valueLarge,
          subtitle: styles.subtitleLarge,
          icon: 'large'
        };
      case 'medium':
      default:
        return {
          container: styles.containerMedium,
          title: styles.titleMedium,
          value: styles.valueMedium,
          subtitle: styles.subtitleMedium,
          icon: 'medium'
        };
    }
  };
  
  // Get trend icon and color
  const getTrendIndicator = () => {
    if (!trend) return null;
    
    let trendIcon;
    let trendColor;
    
    switch (trend) {
      case 'up':
        trendIcon = 'trending-up';
        trendColor = CASINO_COLORS.success;
        break;
      case 'down':
        trendIcon = 'trending-down';
        trendColor = CASINO_COLORS.error;
        break;
      case 'neutral':
      default:
        trendIcon = 'trending-neutral';
        trendColor = CASINO_COLORS.info;
        break;
    }
    
    return (
      <View style={styles.trendContainer}>
        <Icon name={trendIcon as any} size="small" color={trendColor} />
        {trendValue && (
          <Text style={[styles.trendValue, { color: trendColor }]}>
            {typeof trendValue === 'number' ? trendValue.toFixed(1) + '%' : trendValue}
          </Text>
        )}
      </View>
    );
  };
  
  const sizeStyles = getSizeStyles();
  
  // Determine the value color
  const actualValueColor = valueColor || 
    (format === 'currency' ? CASINO_COLORS.gold : CASINO_COLORS.gold);
  
  // הגדרה ברורה יותר של מיקום האייקון לפי RTL
  const shouldShowIconFirst = (iconPosition === 'right' && alignRight) || (iconPosition === 'left' && !alignRight);
  const shouldShowIconLast = (iconPosition === 'left' && alignRight) || (iconPosition === 'right' && !alignRight);
  
  // Define the component content
  const cardContent = (
    <>
      {/* Title Row (with icon if provided) */}
      <View style={[
        styles.headerRow, 
        alignRight ? styles.headerRowRtl : {}
      ]}>
        {/* אם יש prefix והכותרת ריקה, נציג את ה-prefix כטקסט מוגדל מצד שמאל */}
        {prefix && !title && (
          <Text style={[
            styles.prefixAsTitle,
            alignRight ? styles.textRtl : {}
          ]}>
            {prefix}
          </Text>
        )}
        
        {/* האייקון תמיד בצד ימין בתצוגת RTL, או בצד שמאל בתצוגה רגילה */}
        {icon && iconPosition === 'right' && alignRight && (
          <Icon 
            name={icon as any} 
            size={sizeStyles.icon as any} 
            color={iconColor || CASINO_COLORS.gold} 
            style={styles.topIcon}
          />
        )}
        
        {/* הכותרת תוצג רק אם יש כותרת */}
        {title && (
          <Text style={[
            sizeStyles.title, 
            alignRight ? styles.textRtl : {},
            titleStyle
          ]}>
            {title}
          </Text>
        )}
        
        {/* מצבים אחרים של הצגת האייקון */}
        {icon && !(iconPosition === 'right' && alignRight) && (
          <Icon 
            name={icon as any} 
            size={sizeStyles.icon as any} 
            color={iconColor || CASINO_COLORS.gold} 
            style={styles.icon}
          />
        )}
      </View>
      
      {/* Value Row (with trend indicator if provided) */}
      <View style={[
        styles.valueRow,
        alignRight ? styles.valueRowRtl : {}
      ]}>
        <Text style={[
          sizeStyles.value, 
          { color: actualValueColor },
          alignRight ? styles.textRtl : {},
          valueStyle
        ]}>
          {formatValue()}
        </Text>
        {inlineSubtitle && (
          <Text style={[
            styles.inlineSubtitle,
            alignRight ? styles.textRtl : {}
          ]}>
            {inlineSubtitle}
          </Text>
        )}
        {getTrendIndicator()}
      </View>
      
      {/* Subtitle if provided */}
      {subtitle && (
        <Text style={[
          sizeStyles.subtitle,
          alignRight ? styles.textRtl : {}
        ]}>
          {subtitle}
        </Text>
      )}
    </>
  );
  
  // Render as a button if onClick is provided, otherwise as a plain view
  return onClick ? (
    <TouchableOpacity
      style={[
        styles.container,
        sizeStyles.container,
        backgroundColor ? { backgroundColor } : {},
        style
      ]}
      onPress={onClick}
      activeOpacity={0.7}
    >
      {cardContent}
    </TouchableOpacity>
  ) : (
    <View
      style={[
        styles.container,
        sizeStyles.container,
        backgroundColor ? { backgroundColor } : {},
        style
      ]}
    >
      {cardContent}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: CASINO_COLORS.background,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: `rgba(255, 215, 0, 0.3)`,
    padding: 12,
  },
  containerSmall: {
    padding: 8,
    minHeight: 75,
  },
  containerMedium: {
    padding: 12,
    minHeight: 110,
  },
  containerLarge: {
    padding: 16,
    minHeight: 140,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  headerRowRtl: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  valueRowRtl: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
  },
  titleSmall: {
    fontSize: 12,
    color: CASINO_COLORS.textSecondary,
    fontWeight: '500',
    flexShrink: 1,
  },
  titleMedium: {
    fontSize: 14,
    color: CASINO_COLORS.textSecondary,
    fontWeight: '500',
    flexShrink: 1,
  },
  titleLarge: {
    fontSize: 14,
    color: CASINO_COLORS.textSecondary,
    fontWeight: '500',
    flexShrink: 1,
  },
  valueSmall: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CASINO_COLORS.gold,
    flexShrink: 1,
  },
  valueMedium: {
    fontSize: 20,
    fontWeight: 'bold',
    color: CASINO_COLORS.gold,
    flexShrink: 1,
  },
  valueLarge: {
    fontSize: 20,
    fontWeight: 'bold',
    color: CASINO_COLORS.gold,
    flexShrink: 1,
  },
  subtitleSmall: {
    fontSize: 10,
    color: CASINO_COLORS.textSecondary,
  },
  subtitleMedium: {
    fontSize: 12,
    color: CASINO_COLORS.textSecondary,
  },
  subtitleLarge: {
    fontSize: 14,
    color: CASINO_COLORS.textSecondary,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  trendValue: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: 'bold',
  },
  icon: {
    marginRight: 6,
  },
  textRtl: {
    textAlign: 'right',
  },
  inlineSubtitle: {
    fontSize: 14,
    color: CASINO_COLORS.textSecondary,
    marginRight: 4,
    marginLeft: 4,
  },
  prefixAsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: CASINO_COLORS.text,
    marginLeft: 'auto',
  },
  topIcon: {
    marginLeft: 10,
    marginRight: 10,
  },
});

export default StatCard;