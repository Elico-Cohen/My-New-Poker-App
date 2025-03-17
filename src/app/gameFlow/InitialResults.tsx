// src/app/gameFlow/InitialResults.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { useRouter } from 'expo-router';
import { useGameContext } from '@/contexts/GameContext';

export default function InitialResults() {
  const router = useRouter();
  const { gameData, setGameData, updateGameStatus } = useGameContext();
  
  // State to track which player cards are expanded
  const [expandedPlayers, setExpandedPlayers] = useState<string[]>([]);

  const buyInSnapshot = gameData.buyInSnapshot;
  const rebuySnapshot = gameData.rebuySnapshot;
  const useRoundingRule = gameData.useRoundingRule;
  const roundingRulePercentage = gameData.roundingRulePercentage;
  const players = gameData.players || [];

  // Your existing computation logic remains unchanged
  const computedPlayers = useMemo(() => {
    return players.map(player => {
      const buyInTotal = player.buyInCount * buyInSnapshot.amount;
      const rebuyTotal = player.rebuyCount * rebuySnapshot.amount;
      const totalInvestment = buyInTotal + rebuyTotal;
      const finalChips = Number(player.finalChips) || 0;
      let finalChipsValue = 0;
      let result = 0;
      let roundedRebuysCount = 0;

      if (useRoundingRule) {
        const completeRebuys = Math.floor(finalChips / rebuySnapshot.chips);
        const remainderChips = finalChips % rebuySnapshot.chips;
        const threshold = rebuySnapshot.chips * (roundingRulePercentage / 100);
        const entitledRebuys = remainderChips >= threshold ? completeRebuys + 1 : completeRebuys;
        finalChipsValue = entitledRebuys * rebuySnapshot.amount;
        result = finalChipsValue - totalInvestment;
        roundedRebuysCount = entitledRebuys;
      } else {
        const exactValue = finalChips / rebuySnapshot.chips;
        finalChipsValue = Number((exactValue * rebuySnapshot.amount).toFixed(2));
        result = finalChipsValue - totalInvestment;
        roundedRebuysCount = Math.floor(exactValue);
      }

      return {
        ...player,
        totalInvestment,
        buyInTotal,
        rebuyTotal,
        finalChipsValue,
        resultBeforeOpenGames: result,
        roundedRebuysCount,
      };
    });
  }, [players, buyInSnapshot, rebuySnapshot, useRoundingRule, roundingRulePercentage]);

  // Existing calculations
  const totalWins = useMemo(() => {
    return computedPlayers
      .filter(p => p.resultBeforeOpenGames > 0)
      .reduce((sum, p) => sum + p.resultBeforeOpenGames, 0);
  }, [computedPlayers]);

  const totalLosses = useMemo(() => {
    return computedPlayers
      .filter(p => p.resultBeforeOpenGames < 0)
      .reduce((sum, p) => sum + Math.abs(p.resultBeforeOpenGames), 0);
  }, [computedPlayers]);

  const difference = Math.abs(totalWins - totalLosses);
  const openGamesCount = difference > 0 ? Math.ceil(difference / rebuySnapshot.amount) : 0;

  // Update game data when computations change
  useEffect(() => {
    const currentPlayersStr = JSON.stringify(gameData.players);
    const computedPlayersStr = JSON.stringify(computedPlayers);
    if (
      currentPlayersStr !== computedPlayersStr ||
      gameData.totalWins !== totalWins ||
      gameData.totalLosses !== totalLosses ||
      gameData.difference !== difference ||
      gameData.openGamesCount !== openGamesCount
    ) {
      setGameData(prev => ({
        ...prev,
        players: computedPlayers,
        totalWins,
        totalLosses,
        difference,
        openGamesCount,
      }));
    }
  }, [computedPlayers, totalWins, totalLosses, difference, openGamesCount, gameData, setGameData]);

  const sortedPlayers = useMemo(() => {
    return [...computedPlayers].sort((a, b) => b.resultBeforeOpenGames - a.resultBeforeOpenGames);
  }, [computedPlayers]);

  // Toggle player expansion
  const togglePlayerExpansion = (playerId: string) => {
    setExpandedPlayers(prev => {
      if (prev.includes(playerId)) {
        return prev.filter(id => id !== playerId);
      } else {
        return [...prev, playerId];
      }
    });
  };

  const continueHandler = () => {
    if (!useRoundingRule || openGamesCount === 0) {
      updateGameStatus('payments');
      router.push('/gameFlow/PaymentCalculation');
    } else {
      updateGameStatus('open_games');
      router.push('/gameFlow/OpenGames');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="h4" style={styles.headerTitle}>
          סיכום תוצאות המשחק
        </Text>
        <Text style={styles.headerSubtitle}>
          {gameData.groupNameSnapshot}
        </Text>
        <Text style={styles.headerSubtitle}>
          {new Date(
            gameData.gameDate.year,
            gameData.gameDate.month - 1,
            gameData.gameDate.day
          ).toLocaleDateString('he-IL')}
        </Text>
      </View>

      {/* Summary Card */}
      <Card style={styles.summaryCard}>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>סה"כ זכיות</Text>
            <Text style={[styles.summaryValue, styles.positive]}>
              {totalWins.toFixed(2)} ₪
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>סה"כ הפסדים</Text>
            <Text style={[styles.summaryValue, styles.negative]}>
              {totalLosses.toFixed(2)} ₪
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>הפרש</Text>
            <Text style={styles.summaryValue}>
              {difference.toFixed(2)} ₪
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>משחקים פתוחים</Text>
            <Text style={[styles.summaryValue, 
              { color: openGamesCount > 0 ? '#FFD700' : '#22c55e' }]}>
              {openGamesCount}
            </Text>
          </View>
        </View>
      </Card>

      {/* Players List */}
      <ScrollView style={styles.scrollView}>
        {sortedPlayers.map((player) => (
          <TouchableOpacity
            key={player.id}
            onPress={() => togglePlayerExpansion(player.id)}
            activeOpacity={0.8}
          >
            <Card style={[
              styles.playerCard,
              expandedPlayers.includes(player.id) ? styles.expandedCard : null
            ]}>
              {/* Compact View (Always Visible) */}
              <View style={styles.compactView}>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>{player.name}</Text>
                  <Text style={[
                    styles.resultText,
                    player.resultBeforeOpenGames >= 0 ? styles.positive : styles.negative
                  ]}>
                    {player.resultBeforeOpenGames >= 0 ? '+' : ''}
                    {player.resultBeforeOpenGames.toFixed(2)} ₪
                  </Text>
                </View>
                <Icon
                  name={expandedPlayers.includes(player.id) ? "chevron-up" : "chevron-down"}
                  size="small"
                  color="#FFD700"
                />
              </View>

              {/* Expanded View */}
              {expandedPlayers.includes(player.id) && (
                <View style={styles.expandedView}>
                  {/* Investment Section */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>השקעה</Text>
                    <View style={styles.detailsGrid}>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Buy-in</Text>
                        <Text style={styles.detailValue}>
                          {player.buyInTotal} ₪ ({player.buyInCount}x)
                        </Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Rebuy</Text>
                        <Text style={styles.detailValue}>
                          {player.rebuyTotal} ₪ ({player.rebuyCount}x)
                        </Text>
                      </View>
                      <View style={[styles.detailItem, styles.totalItem]}>
                        <Text style={styles.detailLabel}>סה"כ השקעה</Text>
                        <Text style={styles.detailValue}>
                          {player.totalInvestment} ₪
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Chips Section */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>צ'יפים</Text>
                    <View style={styles.detailsGrid}>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>כמות סופית</Text>
                        <Text style={styles.detailValue}>{player.finalChips}</Text>
                      </View>
                      {useRoundingRule && (
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>
                            ריבאיים לפי {roundingRulePercentage}%
                          </Text>
                          <Text style={styles.detailValue}>
                            {player.roundedRebuysCount}
                          </Text>
                        </View>
                      )}
                      <View style={[styles.detailItem, styles.totalItem]}>
                        <Text style={styles.detailLabel}>שווי צ'יפים</Text>
                        <Text style={styles.detailValue}>
                          {player.finalChipsValue.toFixed(2)} ₪
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Result Section */}
                  <View style={[
                    styles.resultSection,
                    player.resultBeforeOpenGames >= 0 ? styles.positiveResult : styles.negativeResult
                  ]}>
                    <Text style={styles.resultLabel}>
                      {player.resultBeforeOpenGames >= 0 ? 'רווח' : 'הפסד'}
                    </Text>
                    <Text style={styles.resultValue}>
                      {Math.abs(player.resultBeforeOpenGames).toFixed(2)} ₪
                    </Text>
                  </View>
                </View>
              )}
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          title={(!useRoundingRule || openGamesCount === 0) ?
            "המשך לחישוב תשלומים" :
            "המשך למשחקים פתוחים"}
          onPress={continueHandler}
          style={styles.continueButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1B1E',
  },
  header: {
    padding: 16,
    backgroundColor: '#35654d',
    borderBottomWidth: 2,
    borderBottomColor: '#FFD700',
  },
  headerTitle: {
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    color: '#FFD700',
    textAlign: 'center',
    fontSize: 16,
    opacity: 0.9,
  },
  summaryCard: {
    margin: 16,
    backgroundColor: '#1C2C2E',
    borderColor: '#FFD700',
    borderWidth: 1,
    padding: 0,
  },
  summaryGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    padding: 16,
    gap: 16,
  },
  summaryItem: {
    flex: 1,
    minWidth: 140,
    alignItems: 'center',
  },
  summaryLabel: {
    color: '#FFD700',
    fontSize: 14,
    marginBottom: 4,
  },
  summaryValue: {
    color: '#FFD700',
    fontSize: 20,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
    padding: 16,
    paddingTop: 0,
  },
  playerCard: {
    backgroundColor: '#1C2C2E',
    borderColor: '#FFD700',
    borderWidth: 1,
    marginBottom: 10,
    padding: 10,
    borderRadius: 8,
  },
  expandedCard: {
    borderWidth: 2,
  },
  compactView: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  playerInfo: {
    flexDirection: 'row-reverse',
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  playerName: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 8,
  },
  expandedView: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 215, 0, 0.3)',
    paddingTop: 10,
  },
  section: {
    marginBottom: 16,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 8,
    padding: 12,
  },
  sectionTitle: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'right',
  },
  detailsGrid: {
    gap: 8,
  },
  detailItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalItem: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 215, 0, 0.3)',
    marginTop: 4,
    paddingTop: 8,
  },
  detailLabel: {
    color: '#FFD700',
    opacity: 0.8,
  },
  detailValue: {
    color: '#FFD700',
    fontWeight: 'bold',
  },
  resultSection: {
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  positiveResult: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderColor: '#22c55e',
    borderWidth: 1,
  },
  negativeResult: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#ef4444',
    borderWidth: 1,
  },
  resultLabel: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultValue: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
  },
  positive: {
    color: '#22c55e',
  },
  negative: {
    color: '#ef4444',
  },
  footer: {
    padding: 16,
    backgroundColor: '#0D1B1E',
    borderTopWidth: 1,
    borderTopColor: '#FFD700',
  },
  continueButton: {
    backgroundColor: '#35654d',
    borderColor: '#FFD700',
    borderWidth: 2,
  }
});