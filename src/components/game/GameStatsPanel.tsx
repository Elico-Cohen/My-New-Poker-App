// src/components/game/GameStatsPanel.tsx
import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@/components/common/Text';
import { Icon } from '@/components/common/Icon';

const CASINO_COLORS = {
  gold: '#FFD700',
  primary: '#35654d',
  background: '#1C2C2E',
  surface: '#0D1B1E',
  text: '#FFFFFF',
  textSecondary: '#B8B8B8',
};

interface Player {
  id: string;
  name: string;
  rebuyCount: number;
  buyInCount: number;
  finalChips?: string;
}

interface GameStatsPanelProps {
  players: Player[];
  buyInAmount: number;
  rebuyAmount: number;
  gameStartTime?: number; // timestamp when game started
  style?: any;
}

/**
 * GameStatsPanel - Displays real-time game statistics during active games
 * Shows: total pot, player count, duration, average rebuys, top rebuy player
 */
export const GameStatsPanel: React.FC<GameStatsPanelProps> = ({
  players,
  buyInAmount,
  rebuyAmount,
  gameStartTime,
  style,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Calculate statistics
  const playerCount = players.length;

  // Total pot = sum of all buy-ins + all rebuys
  const totalBuyIns = players.reduce((sum, p) => sum + (p.buyInCount * buyInAmount), 0);
  const totalRebuys = players.reduce((sum, p) => sum + (p.rebuyCount * rebuyAmount), 0);
  const totalPot = totalBuyIns + totalRebuys;

  // Total rebuy count
  const totalRebuyCount = players.reduce((sum, p) => sum + p.rebuyCount, 0);

  // Average rebuys per player
  const avgRebuys = playerCount > 0 ? (totalRebuyCount / playerCount).toFixed(1) : '0';

  // Top rebuy player
  const topRebuyPlayer = players.reduce((top, p) => {
    if (!top || p.rebuyCount > top.rebuyCount) return p;
    return top;
  }, null as Player | null);

  // Game duration
  const getGameDuration = (): string => {
    if (!gameStartTime) return '--:--';

    const now = Date.now();
    const durationMs = now - gameStartTime;
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  // Update duration every minute
  const [duration, setDuration] = React.useState(getGameDuration());

  React.useEffect(() => {
    const interval = setInterval(() => {
      setDuration(getGameDuration());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [gameStartTime]);

  if (!isExpanded) {
    return (
      <TouchableOpacity
        style={[styles.collapsedContainer, style]}
        onPress={() => setIsExpanded(true)}
      >
        <Icon name="chart-bar" size="small" color={CASINO_COLORS.gold} />
        <Text style={styles.collapsedText}>סטטיסטיקות משחק</Text>
        <Text style={styles.potPreview}>{totalPot.toLocaleString()} ₪</Text>
        <Icon name="chevron-down" size="small" color={CASINO_COLORS.gold} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {/* Header with collapse button */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => setIsExpanded(false)}
      >
        <Icon name="chevron-up" size="small" color={CASINO_COLORS.gold} />
        <Text style={styles.headerText}>סטטיסטיקות משחק</Text>
        <Icon name="chart-bar" size="small" color={CASINO_COLORS.gold} />
      </TouchableOpacity>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        {/* Total Pot - Main stat */}
        <View style={styles.mainStat}>
          <Icon name="currency-ils" size="medium" color={CASINO_COLORS.gold} />
          <View style={styles.statContent}>
            <Text style={styles.mainStatValue}>{totalPot.toLocaleString()} ₪</Text>
            <Text style={styles.statLabel}>סה"כ קופה</Text>
          </View>
        </View>

        {/* Secondary stats row */}
        <View style={styles.statsRow}>
          {/* Player Count */}
          <View style={styles.stat}>
            <Icon name="account-group" size="small" color={CASINO_COLORS.textSecondary} />
            <Text style={styles.statValue}>{playerCount}</Text>
            <Text style={styles.statLabel}>שחקנים</Text>
          </View>

          {/* Duration */}
          <View style={styles.stat}>
            <Icon name="clock-outline" size="small" color={CASINO_COLORS.textSecondary} />
            <Text style={styles.statValue}>{duration}</Text>
            <Text style={styles.statLabel}>משך המשחק</Text>
          </View>

          {/* Total Rebuys */}
          <View style={styles.stat}>
            <Icon name="refresh" size="small" color={CASINO_COLORS.textSecondary} />
            <Text style={styles.statValue}>{totalRebuyCount}</Text>
            <Text style={styles.statLabel}>ריבאיים</Text>
          </View>

          {/* Total Buy-ins + Rebuys in Money */}
          <View style={styles.stat}>
            <Icon name="cash-multiple" size="small" color={CASINO_COLORS.textSecondary} />
            <Text style={styles.statValue}>{totalPot.toLocaleString()}</Text>
            <Text style={styles.statLabel}>קניות ₪</Text>
          </View>
        </View>

        {/* Top Rebuy Player */}
        {topRebuyPlayer && topRebuyPlayer.rebuyCount > 0 && (
          <View style={styles.topPlayerRow}>
            <Icon name="trophy" size="small" color={CASINO_COLORS.gold} />
            <Text style={styles.topPlayerText}>
              הכי הרבה ריבאיים: {topRebuyPlayer.name} ({topRebuyPlayer.rebuyCount})
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: CASINO_COLORS.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
    overflow: 'hidden',
  },
  collapsedContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CASINO_COLORS.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  collapsedText: {
    flex: 1,
    color: CASINO_COLORS.gold,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'right',
    marginRight: 8,
  },
  potPreview: {
    color: CASINO_COLORS.text,
    fontSize: 14,
    fontWeight: 'bold',
    marginHorizontal: 12,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  headerText: {
    flex: 1,
    color: CASINO_COLORS.gold,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  statsGrid: {
    padding: 16,
  },
  mainStat: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 215, 0, 0.1)',
  },
  statContent: {
    marginRight: 12,
    alignItems: 'flex-end',
  },
  mainStatValue: {
    color: CASINO_COLORS.gold,
    fontSize: 28,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: CASINO_COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  statLabel: {
    color: CASINO_COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  topPlayerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 215, 0, 0.1)',
  },
  topPlayerText: {
    color: CASINO_COLORS.gold,
    fontSize: 13,
    marginRight: 8,
  },
});

export default GameStatsPanel;
