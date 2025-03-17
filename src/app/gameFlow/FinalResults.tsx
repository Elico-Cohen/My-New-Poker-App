// src/app/gameFlow/FinalResults.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { useRouter } from 'expo-router';
import { useGameContext } from '@/contexts/GameContext';
import { getAllUsers } from '@/services/users';

export default function FinalResults() {
  const router = useRouter();
  const { gameData, setGameData, updateGameStatus } = useGameContext();
  const [loading, setLoading] = React.useState(false);
  // Track expanded player cards
  const [expandedPlayers, setExpandedPlayers] = useState<string[]>([]);

  // Helper function to calculate player investment
  const calculatePlayerInvestment = (player) => {
    const buyInTotal = (player.buyInCount || 0) * (gameData.buyInSnapshot.amount || 0);
    const rebuyTotal = (player.rebuyCount || 0) * (gameData.rebuySnapshot.amount || 0);
    return buyInTotal + rebuyTotal;
  };

  // Get winners from open games
  const openGameWinners = gameData.openGames?.map(game => game.winner) || [];

  // Calculate final results for each player
  const finalResults = useMemo(() => {
    return gameData.players.map(player => {
      // Count wins in open games for this player
      const openGameWinsCount = gameData.openGamesCount > 0 ? 
        (gameData.openGames?.filter(game => game.winner === player.id).length || 0) : 0;
      const openGameBonus = openGameWinsCount * gameData.rebuySnapshot.amount;

      // Calculate final result
      const finalResultMoney = (player.resultBeforeOpenGames || 0) + openGameBonus;

      return {
        ...player,
        openGameWins: openGameWinsCount,
        openGamesBonus: {
          winsCount: openGameWinsCount,
          bonusAmount: openGameBonus
        },
        finalResultMoney
      };
    });
  }, [gameData.players, openGameWinners, gameData.rebuySnapshot.amount]);

  // Sort players by final results (winners first)
  const sortedPlayers = useMemo(() => {
    return [...finalResults].sort((a, b) => (b.finalResultMoney || 0) - (a.finalResultMoney || 0));
  }, [finalResults]);

  // Toggle player card expansion
  const togglePlayerExpansion = (playerId) => {
    setExpandedPlayers(prev => {
      if (prev.includes(playerId)) {
        return prev.filter(id => id !== playerId);
      } else {
        return [...prev, playerId];
      }
    });
  };

  const handleContinue = async () => {
    try {
      setLoading(true);

      // Create sets for efficient lookup
      const gamePlayerIds = new Set(gameData.players.map(p => p.id));
      const gamePlayerUnits = new Set(
        gameData.players
          .map(p => p.paymentUnitId)
          .filter((id): id is string => id !== undefined)
      );

      // Separate solo players and payment unit players
      const soloPlayers = gameData.players.filter(p => !p.paymentUnitId);
      const paymentUnitPlayers = gameData.players.filter(p => p.paymentUnitId);

      // Log information about players and units
      console.log('\n=== Game Players and Payment Units Analysis ===\n');
      
      console.log('Total Players in Game:', gameData.players.length);
      console.log('Solo Players:', soloPlayers.length);
      console.log('Players in Payment Units:', paymentUnitPlayers.length);
      console.log('Unique Payment Units:', gamePlayerUnits.size);
      
      console.log('\n--- Solo Players ---');
      soloPlayers.forEach(player => {
        console.log(`${player.name} (${player.id})`);
        console.log(`  Final Result: ${player.finalResultMoney} ₪`);
      });

      console.log('\n--- Payment Unit Analysis ---');
      // Group players by payment unit
      const unitGroups = new Map<string, { 
        unitId: string; 
        players: { id: string; name: string; result: number; }[];
      }>();

      paymentUnitPlayers.forEach(player => {
        if (player.paymentUnitId) {
          if (!unitGroups.has(player.paymentUnitId)) {
            unitGroups.set(player.paymentUnitId, {
              unitId: player.paymentUnitId,
              players: []
            });
          }
          unitGroups.get(player.paymentUnitId)!.players.push({
            id: player.id,
            name: player.name,
            result: player.finalResultMoney || 0
          });
        }
      });

      // Log each payment unit
      for (const [unitId, group] of unitGroups) {
        console.log(`\nPayment Unit: ${unitId}`);
        console.log('Players:');
        group.players.forEach(player => {
          console.log(`  - ${player.name} (${player.id})`);
          console.log(`    Result: ${player.result} ₪`);
        });
        
        const totalResult = group.players.reduce((sum, p) => sum + p.result, 0);
        console.log(`Unit Total Result: ${totalResult} ₪`);
        
        const allPlayersPresent = group.players.length === 2;
        console.log(`Complete Unit (both players present): ${allPlayersPresent ? 'Yes' : 'No'}`);
      }

      console.log('\n=== End Analysis ===\n');

      // Update game data with final results
      setGameData(prev => ({
        ...prev,
        players: finalResults.map(player => ({
          ...player,
          finalResultMoney: player.finalResultMoney || 0
        }))
      }));
      
      // Navigate to payment calculations
      updateGameStatus('payments');
      router.push('/gameFlow/PaymentCalculations');
    } catch (error) {
      console.error('Error updating game data:', error);
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="h4" style={styles.headerTitle}>
          תוצאות סופיות
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

      {/* Players List with Expandable Cards */}
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
                    (player.finalResultMoney || 0) >= 0 ? styles.positive : styles.negative
                  ]}>
                    {(player.finalResultMoney || 0) >= 0 ? '+' : ''}
                    {(player.finalResultMoney || 0).toFixed(2)} ₪
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
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>תוצאות ראשוניות</Text>
                    <View style={styles.detailsGrid}>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>השקעה כוללת</Text>
                        <Text style={styles.detailValue}>
                          {calculatePlayerInvestment(player).toFixed(2)} ₪
                        </Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>שווי צ'יפים</Text>
                        <Text style={styles.detailValue}>
                          {(player.finalChipsValue || 0).toFixed(2)} ₪
                        </Text>
                      </View>
                      <View style={[styles.detailItem, styles.totalItem]}>
                        <Text style={styles.detailLabel}>תוצאה ראשונית</Text>
                        <Text style={[
                          styles.detailValue,
                          (player.resultBeforeOpenGames || 0) >= 0 ? styles.positive : styles.negative
                        ]}>
                          {(player.resultBeforeOpenGames || 0).toFixed(2)} ₪
                        </Text>
                      </View>
                    </View>
                  </View>

                  {gameData.openGamesCount > 0 && (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>משחקים פתוחים</Text>
                      <View style={styles.detailsGrid}>
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>מספר זכיות</Text>
                          <Text style={styles.detailValue}>
                            {player.openGameWins || 0} משחקים
                          </Text>
                        </View>
                        <View style={[styles.detailItem, styles.totalItem]}>
                          <Text style={styles.detailLabel}>בונוס ממשחקים פתוחים</Text>
                          <Text style={[styles.detailValue, (player.openGamesBonus?.bonusAmount || 0) > 0 && styles.positive]}>
                            {(player.openGamesBonus?.bonusAmount || 0).toFixed(2)} ₪
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  <View style={[
                    styles.resultSection,
                    (player.finalResultMoney || 0) >= 0 ? styles.positiveResult : styles.negativeResult
                  ]}>
                    <Text style={styles.resultLabel}>תוצאה סופית</Text>
                    <Text style={styles.resultValue}>
                      {(player.finalResultMoney || 0).toFixed(2)} ₪
                    </Text>
                  </View>
                </View>
              )}
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="המשך לחישוב תשלומים"
          onPress={handleContinue}
          disabled={loading}
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
  scrollView: {
    flex: 1,
    padding: 16,
    paddingBottom: 24,
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
    marginTop: 8,
  },
  continueButton: {
    backgroundColor: '#35654d',
    borderColor: '#FFD700',
    borderWidth: 2,
  },
});