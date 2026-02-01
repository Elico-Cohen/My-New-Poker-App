// src/app/gameFlow/FinalResults.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, BackHandler } from 'react-native';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { Dialog } from '@/components/common/Dialog';
import { ReadOnlyIndicator } from '@/components/auth/ReadOnlyIndicator';
import { useRouter, useFocusEffect } from 'expo-router';
import { useGameContext, Player } from '@/contexts/GameContext';
import { getAllUsers } from '@/services/users';

export default function FinalResults() {
  const router = useRouter();
  const { gameData, setGameData, updateGameStatus, shouldUpdateStatus, canUserContinueThisGame } = useGameContext();
  const [loading, setLoading] = React.useState(false);
  // Track expanded player cards
  const [expandedPlayers, setExpandedPlayers] = useState<string[]>([]);
  const [showExitDialog, setShowExitDialog] = useState(false);

  // בדיקת הרשאות להמשך המשחק
  const canContinue = canUserContinueThisGame(gameData);

  // Reset loading state when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setLoading(false);
    }, [])
  );

  // Helper function to calculate player investment
  const calculatePlayerInvestment = (player: Player) => {
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

  // Auto-update gameData with final results when calculations change
  useEffect(() => {
    const currentPlayersStr = JSON.stringify(gameData.players.map(p => ({ id: p.id, finalResultMoney: p.finalResultMoney })));
    const calculatedPlayersStr = JSON.stringify(finalResults.map(p => ({ id: p.id, finalResultMoney: p.finalResultMoney })));
    
    if (currentPlayersStr !== calculatedPlayersStr) {
      console.log('FinalResults: Auto-updating gameData with calculated finalResultMoney');
      setGameData(prev => ({
        ...prev,
        players: prev.players.map(player => {
          const calculated = finalResults.find(fr => fr.id === player.id);
          return {
            ...player,
            finalResultMoney: calculated?.finalResultMoney || 0,
            openGameWins: calculated?.openGameWins || 0
          };
        })
      }));
    }
  }, [finalResults, setGameData]);

  // Toggle player card expansion
  const togglePlayerExpansion = (playerId: string) => {
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
      
      // For now, treat all players as solo players since paymentUnitId is not in Player interface
      const soloPlayers = gameData.players;
      const paymentUnitPlayers: never[] = []; // Empty array since we don't have payment units in Player interface

      // Log information about players
      console.log('\n=== Game Players Analysis ===\n');
      
      console.log('Total Players in Game:', gameData.players.length);
      console.log('Solo Players:', soloPlayers.length);
      
      console.log('\n--- Solo Players ---');
      soloPlayers.forEach(player => {
        console.log(`${player.name} (${player.id})`);
        console.log(`  Final Result: ${player.finalResultMoney} ₪`);
      });

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

  // הסרת עדכון אוטומטי של סטטוס - נעשה באופן ידני במקומות המתאימים

  // Handle hardware back press
  useEffect(() => {
    const backAction = () => {
      setShowExitDialog(true);
      return true; // Prevent default behavior (exiting the app)
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );
    return () => backHandler.remove();
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setShowExitDialog(true)} style={styles.backButton}>
           <Icon name="arrow-right" size={24} color="#FFD700" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
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
        
        <TouchableOpacity 
          onPress={() => {
            router.push('/(tabs)/home2');
          }} 
          style={styles.homeButton}
        >
          <Icon name="home" size={24} color="#FFD700" />
        </TouchableOpacity>
      </View>

      <ReadOnlyIndicator />

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
                  name={expandedPlayers.includes(player.id) ? "minus" : "plus"}
                  size="medium"
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
                          {(player.exactChipsValue !== undefined ? player.exactChipsValue :
                           (player.roundedRebuysCount !== undefined ? player.roundedRebuysCount * gameData.rebuySnapshot.amount : 0)
                          ).toFixed(2)} ₪
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

      {canContinue && (
        <View style={styles.footer}>
          <Button
            title="המשך לחישוב תשלומים"
            onPress={handleContinue}
            disabled={loading}
            style={styles.continueButton}
          />
        </View>
      )}

      {/* Exit Confirmation Dialog */}
      <Dialog
        visible={showExitDialog}
        title="חזרה למסך הקודם"
        message="האם אתה בטוח שברצונך לחזור למסך הקודם?"
        onCancel={() => setShowExitDialog(false)}
        onConfirm={() => {
          setShowExitDialog(false);
          router.back(); // פשוט חזרה למסך הקודם במחסנית הניווט
        }}
        confirmText="כן, חזור"
        cancelText="לא, המשך כאן"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1B1E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#35654d',
    borderBottomWidth: 2,
    borderBottomColor: '#FFD700',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginEnd: 8,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  playerInfo: {
    flexDirection: 'row',
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
    flexDirection: 'row',
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
    flexDirection: 'row',
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
  homeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginStart: 8,
  },
});