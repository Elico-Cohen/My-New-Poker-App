// src/components/statistics/StatisticsList.tsx

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
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

export interface StatisticsListItem {
  id: string;
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  valueColor?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string | number;
  prefix?: string;
}

interface StatisticsListProps {
  items: StatisticsListItem[];
  showRank?: boolean;
  maxItems?: number;
  onItemPress?: (item: StatisticsListItem, index: number) => void;
  style?: any;
  scrollable?: boolean;
  maxHeight?: number;
  showDividers?: boolean;
  startRankFrom?: number;
  emptyMessage?: string;
  rankPrefix?: string;
  valuePrefix?: string;
  valueSuffix?: string;
  alignRight?: boolean;
  highlightTop?: number;
  title?: string;
}

/**
 * StatisticsList component displays a list of statistics items,
 * optionally with ranking, icons, and interactive capabilities.
 * 
 * @param items - Array of statistics items to display
 * @param showRank - Whether to show rank numbers
 * @param maxItems - Maximum number of items to display
 * @param onItemPress - Callback when an item is pressed
 * @param style - Additional styles for the container
 * @param scrollable - Whether the list should be scrollable
 * @param maxHeight - Maximum height for the scrollable container
 * @param showDividers - Whether to show dividers between items
 * @param startRankFrom - Starting number for ranks (default: 1)
 * @param emptyMessage - Message to display when the list is empty
 * @param rankPrefix - Prefix for rank numbers (e.g., "#")
 * @param valuePrefix - Prefix for values (e.g., "₪")
 * @param valueSuffix - Suffix for values (e.g., " pts")
 * @param alignRight - Whether to align text to the right (for RTL languages)
 * @param highlightTop - Number of top items to highlight
 */
const StatisticsList: React.FC<StatisticsListProps> = ({
  items,
  showRank = false,
  maxItems,
  onItemPress,
  style,
  scrollable = false,
  maxHeight = 300,
  showDividers = false,
  startRankFrom = 1,
  emptyMessage = 'אין נתונים זמינים',
  rankPrefix = '',
  valuePrefix = '',
  valueSuffix = '',
  alignRight = true,
  highlightTop = 0,
  title
}) => {
  // Limit items if maxItems specified
  const displayItems = maxItems ? items.slice(0, maxItems) : items;
  
  // Function to format the item value
  const formatValue = (value: string | number): string => {
    if (typeof value === 'number') {
      return `${valuePrefix}${value.toLocaleString()}${valueSuffix}`;
    }
    return `${valuePrefix}${value}${valueSuffix}`;
  };
  
  // Function to render trend icon
  const renderTrend = (trend?: 'up' | 'down' | 'neutral', trendValue?: string | number) => {
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
        {trendValue !== undefined && (
          <Text style={[styles.trendValue, { color: trendColor }]}>
            {typeof trendValue === 'number' ? trendValue.toFixed(1) + '%' : trendValue}
          </Text>
        )}
      </View>
    );
  };
  
  // Function to render a single list item
  const renderItem = (item: StatisticsListItem, index: number) => {
    const actualRank = index + startRankFrom;
    const isHighlighted = highlightTop > 0 && actualRank <= highlightTop;
    
    // Medal colors for top 3 ranks if highlightTop >= 3
    const getMedalColor = () => {
      if (highlightTop < 3) return CASINO_COLORS.gold;
      
      switch (actualRank) {
        case 1: return CASINO_COLORS.gold;
        case 2: return '#C0C0C0'; // Silver
        case 3: return '#CD7F32'; // Bronze
        default: return CASINO_COLORS.textSecondary;
      }
    };
    
    const itemStyle = [
      styles.item,
      showDividers && index < displayItems.length - 1 && styles.itemWithDivider,
      isHighlighted && styles.highlightedItem,
      alignRight ? styles.itemRTL : {}
    ];
    
    return (
      <TouchableOpacity
        style={itemStyle}
        onPress={() => onItemPress && onItemPress(item, index)}
        disabled={!onItemPress}
        activeOpacity={onItemPress ? 0.7 : 1}
      >
        {/* במצב RTL הסדר הוא מימין לשמאל: דירוג, תוכן, ערך */}
        {alignRight ? (
          <>
            {/* Rank (if showRank is true) - RTL Mode */}
            {showRank && (
              <View style={styles.rankContainerRTL}>
                <Text style={[
                  styles.rank, 
                  { color: getMedalColor() }
                ]}>
                  {rankPrefix}{actualRank}
                </Text>
              </View>
            )}
            
            {/* Content (icon, title, subtitle) - RTL Mode */}
            <View style={styles.contentContainerRtl}>
              {item.icon && (
                <Icon 
                  name={item.icon as any} 
                  size="small" 
                  color={isHighlighted ? CASINO_COLORS.gold : CASINO_COLORS.textSecondary} 
                  style={styles.iconRtl}
                />
              )}
              
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[
                  styles.title,
                  isHighlighted && styles.highlightedTitle,
                  styles.textRtl
                ]}>
                  {item.title}
                </Text>
                
                {item.subtitle && (
                  <Text style={[
                    styles.subtitle,
                    styles.textRtl
                  ]}>
                    {item.subtitle}
                  </Text>
                )}
              </View>
            </View>
            
            {/* Value and trend - RTL Mode */}
            <View style={styles.valueContainerRTL}>
              <Text style={[
                styles.value,
                { color: item.valueColor || CASINO_COLORS.gold }
              ]}>
                {item.prefix && <Text style={styles.prefix}>{item.prefix}</Text>}
                {formatValue(item.value)}
              </Text>
              
              {renderTrend(item.trend, item.trendValue)}
            </View>
          </>
        ) : (
          <>
            {/* LTR Mode (Original) */}
            {showRank && (
              <View style={styles.rankContainer}>
                <Text style={[
                  styles.rank, 
                  { color: getMedalColor() }
                ]}>
                  {rankPrefix}{actualRank}
                </Text>
              </View>
            )}
            
            <View style={styles.contentContainer}>
              {item.icon && (
                <Icon 
                  name={item.icon as any} 
                  size="small" 
                  color={isHighlighted ? CASINO_COLORS.gold : CASINO_COLORS.textSecondary} 
                  style={styles.icon}
                />
              )}
              
              <View>
                <Text style={[
                  styles.title,
                  isHighlighted && styles.highlightedTitle
                ]}>
                  {item.title}
                </Text>
                
                {item.subtitle && (
                  <Text style={styles.subtitle}>
                    {item.subtitle}
                  </Text>
                )}
              </View>
            </View>
            
            <View style={styles.valueContainer}>
              <Text style={[
                styles.value,
                { color: item.valueColor || CASINO_COLORS.gold }
              ]}>
                {item.prefix && <Text style={styles.prefix}>{item.prefix}</Text>}
                {formatValue(item.value)}
              </Text>
              
              {renderTrend(item.trend, item.trendValue)}
            </View>
          </>
        )}
      </TouchableOpacity>
    );
  };
  
  // Render list content
  return (
    <View style={[styles.container, style]}>
      {/* כותרת אם קיימת */}
      {title && (
        <Text style={styles.listTitle}>{title}</Text>
      )}
      
      {/* Handle empty list */}
      {displayItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyMessage}>{emptyMessage}</Text>
        </View>
      ) : (
        <View style={{ width: '100%' }}>
          {scrollable ? (
            <ScrollView 
              style={{ maxHeight }}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {displayItems.map((item, index) => (
                <React.Fragment key={`${item.id || 'item'}-${index}`}>
                  {renderItem(item, index)}
                </React.Fragment>
              ))}
            </ScrollView>
          ) : (
            displayItems.map((item, index) => (
              <React.Fragment key={`${item.id || 'item'}-${index}`}>
                {renderItem(item, index)}
              </React.Fragment>
            ))
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    borderRadius: 8,
    overflow: 'hidden',
  },
  scrollContent: {
    flexGrow: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  itemRTL: {
    flexDirection: 'row',
  },
  itemWithDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 215, 0, 0.1)',
  },
  highlightedItem: {
    backgroundColor: 'rgba(255, 215, 0, 0.05)',
  },
  rankContainer: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankContainerRTL: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginStart: 4,
  },
  rank: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CASINO_COLORS.textSecondary,
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginStart: 8,
  },
  contentContainerRtl: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginEnd: 8,
  },
  icon: {
    marginEnd: 8,
  },
  iconRtl: {
    marginStart: 8,
  },
  title: {
    fontSize: 16,
    color: CASINO_COLORS.text,
  },
  highlightedTitle: {
    fontWeight: 'bold',
    color: CASINO_COLORS.gold,
  },
  subtitle: {
    fontSize: 12,
    color: CASINO_COLORS.textSecondary,
    marginTop: 2,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 80,
  },
  valueContainerRTL: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minWidth: 90,
    marginEnd: 'auto',
  },
  value: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CASINO_COLORS.gold,
    textAlign: 'right',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginStart: 8,
  },
  trendValue: {
    marginStart: 4,
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMessage: {
    color: CASINO_COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  textRtl: {
    textAlign: 'right',
  },
  listTitle: {
    color: CASINO_COLORS.gold,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  prefix: {
    fontSize: 12,
    color: CASINO_COLORS.textSecondary,
    marginEnd: 6,
    marginBottom: 2,
    textAlign: 'right',
    fontFamily: 'Inter_400Regular',
  },
});

export default StatisticsList;