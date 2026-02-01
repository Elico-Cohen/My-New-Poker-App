// src/components/statistics/PlayersRanking.tsx

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Icon } from '@/components/common/Icon';
import { IconName } from '@/theme/icons';

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

/**
 * Props interface for player ranking
 */
interface Player {
  playerId: string;
  playerName: string;
  value: number;
  isNegative?: boolean;
  subtitle?: string;
  additionalValue?: string | number;
  games?: number;
  winRate?: number;
  highlight?: boolean;
}

interface PlayersRankingProps {
  players: Player[];
  title?: string;
  style?: any;
  valueLabel?: string;
  showRank?: boolean;
  maxHeight?: number;
  onPlayerPress?: (playerId: string) => void;
  emptyMessage?: string;
  showValues?: boolean;
  medalRanks?: boolean;
  showDividers?: boolean;
  limit?: number;
  highlightNegative?: boolean;
  rankStartFrom?: number;
  alignRight?: boolean;
}

/**
 * PlayersRanking component for displaying player rankings with statistics
 * 
 * @param players - Array of player objects with stats
 * @param title - Optional title for the ranking
 * @param style - Additional style for the container
 * @param valueLabel - Label for the value column (e.g., "₪", "points")
 * @param showRank - Whether to show rank numbers
 * @param maxHeight - Maximum height for the scrollable container
 * @param onPlayerPress - Callback when a player row is pressed
 * @param emptyMessage - Message to display when there are no players
 * @param showValues - Whether to show numerical values
 * @param medalRanks - Whether to show medal icons for top ranks
 * @param showDividers - Whether to show dividers between players
 * @param limit - Maximum number of players to display
 * @param highlightNegative - Whether to use red for negative values
 * @param rankStartFrom - Starting rank number (default: 1)
 * @param alignRight - Whether to align text to the right (for RTL languages)
 */
export function PlayersRanking({
  players,
  title,
  style,
  valueLabel = '',
  showRank = true,
  maxHeight,
  onPlayerPress,
  emptyMessage = 'אין נתונים זמינים',
  showValues = true,
  medalRanks = true,
  showDividers = true,
  limit,
  highlightNegative = true,
  rankStartFrom = 1,
  alignRight = true
}: PlayersRankingProps) {
  // Limit the number of players if specified
  const displayPlayers = limit ? players.slice(0, limit) : players;
  
  // Format currency or number
  const formatValue = (value: number, isNegative?: boolean): string => {
    // If value is currency
    if (valueLabel === '₪' || valueLabel.includes('₪')) {
      return `${Math.abs(value).toLocaleString()} ₪`;
    }
    
    // If value is percentage
    if (valueLabel === '%' || valueLabel.includes('%')) {
      return `${value.toFixed(1)}%`;
    }
    
    // If special format is specified
    if (valueLabel) {
      return `${value.toLocaleString()} ${valueLabel}`;
    }
    
    // Default number formatting
    return value.toLocaleString();
  };
  
  // Helper to get appropriate medal icon for top ranks
  const getMedalIcon = (rank: number): IconName | null => {
    if (!medalRanks) return null;

    switch (rank) {
      case 1: return 'medal';
      case 2: return 'medal-outline';
      case 3: return 'podium';
      default: return null;
    }
  };
  
  // Helper to get appropriate medal color for top ranks
  const getMedalColor = (rank: number): string => {
    if (!medalRanks) return CASINO_COLORS.textSecondary;
    
    switch (rank) {
      case 1: return '#FFD700'; // Gold
      case 2: return '#C0C0C0'; // Silver
      case 3: return '#CD7F32'; // Bronze
      default: return CASINO_COLORS.textSecondary;
    }
  };
  
  // Render the list of players
  const renderPlayers = () => {
    if (displayPlayers.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </View>
      );
    }
    
    return displayPlayers.map((player, index) => {
      const rank = index + rankStartFrom;
      const medalIcon = getMedalIcon(rank);
      const rankColor = getMedalColor(rank);
      
      // Determine value color based on whether it's positive/negative
      const valueColor = player.isNegative && highlightNegative ? 
        CASINO_COLORS.error : 
        (player.value > 0 ? CASINO_COLORS.success : CASINO_COLORS.text);
      
      return (
        <TouchableOpacity
          key={player.playerId}
          style={[
            styles.playerRow,
            showDividers && index < displayPlayers.length - 1 && styles.rowWithDivider,
            player.highlight && styles.highlightedRow
          ]}
          onPress={() => onPlayerPress && onPlayerPress(player.playerId)}
          disabled={!onPlayerPress}
          activeOpacity={onPlayerPress ? 0.7 : 1}
        >
          {/* Rank column */}
          {showRank && (
            <View style={styles.rankColumn}>
              {medalIcon ? (
                <Icon name={medalIcon} size="small" color={rankColor} />
              ) : (
                <Text style={[styles.rankText, { color: rankColor }]}>{rank}</Text>
              )}
            </View>
          )}
          
          {/* Player info column */}
          <View style={[
            styles.playerColumn,
            alignRight ? styles.playerColumnRtl : {}
          ]}>
            <Text style={[
              styles.playerName,
              alignRight ? styles.textRtl : {}
            ]}>
              {player.playerName}
            </Text>
            
            {player.subtitle && (
              <Text style={[
                styles.playerSubtitle,
                alignRight ? styles.textRtl : {}
              ]}>
                {player.subtitle}
              </Text>
            )}
            
            {player.games !== undefined && (
              <Text style={[
                styles.statsText,
                alignRight ? styles.textRtl : {}
              ]}>
                {player.games} משחקים
                {player.winRate !== undefined && ` | ${player.winRate.toFixed(1)}% זכיות`}
              </Text>
            )}
          </View>
          
          {/* Value column */}
          {showValues && (
            <View style={styles.valueColumn}>
              <Text style={[styles.valueText, { color: valueColor }]}>
                {player.isNegative ? '-' : (player.value > 0 ? '+' : '')}
                {formatValue(player.value, player.isNegative)}
              </Text>
              
              {player.additionalValue !== undefined && (
                <Text style={styles.additionalValueText}>
                  {typeof player.additionalValue === 'number' 
                    ? player.additionalValue.toLocaleString() 
                    : player.additionalValue}
                </Text>
              )}
            </View>
          )}
        </TouchableOpacity>
      );
    });
  };
  
  // Main component render
  return (
    <View style={[styles.container, style]}>
      {title && <Text style={styles.title}>{title}</Text>}
      
      {/* Players list with optional scrolling */}
      {maxHeight ? (
        <ScrollView 
          style={[styles.scrollContainer, { maxHeight }]}
          contentContainerStyle={styles.rankingList}
          showsVerticalScrollIndicator={true}
        >
          {renderPlayers()}
        </ScrollView>
      ) : (
        <View style={styles.rankingList}>
          {renderPlayers()}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  title: {
    color: CASINO_COLORS.gold,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  rankingList: {
    width: '100%',
  },
  scrollContainer: {
    width: '100%',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: 'transparent',
  },
  rowWithDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 215, 0, 0.1)',
  },
  highlightedRow: {
    backgroundColor: 'rgba(255, 215, 0, 0.05)',
  },
  rankColumn: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CASINO_COLORS.textSecondary,
  },
  playerColumn: {
    flex: 1,
    marginStart: 8,
  },
  playerColumnRtl: {
    alignItems: 'flex-end',
  },
  playerName: {
    fontSize: 16,
    color: CASINO_COLORS.text,
    marginBottom: 2,
  },
  playerSubtitle: {
    fontSize: 14,
    color: CASINO_COLORS.textSecondary,
    marginBottom: 2,
  },
  statsText: {
    fontSize: 12,
    color: CASINO_COLORS.textSecondary,
  },
  valueColumn: {
    minWidth: 90,
    alignItems: 'flex-end',
  },
  valueText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  additionalValueText: {
    fontSize: 12,
    color: CASINO_COLORS.textSecondary,
    marginTop: 2,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: CASINO_COLORS.textSecondary,
    textAlign: 'center',
  },
  textRtl: {
    textAlign: 'right',
  }
});

export default PlayersRanking;