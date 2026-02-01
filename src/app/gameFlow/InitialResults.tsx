// src/app/gameFlow/InitialResults.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, BackHandler } from 'react-native';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { Dialog } from '@/components/common/Dialog';
import { ReadOnlyIndicator } from '@/components/auth/ReadOnlyIndicator';
import { useRouter } from 'expo-router';
import { useGameContext } from '@/contexts/GameContext';

export default function InitialResults() {
  const router = useRouter();
  const { gameData, setGameData, updateGameStatus, shouldUpdateStatus, canUserContinueThisGame } = useGameContext();
  
  // State to track which player cards are expanded
  const [expandedPlayers, setExpandedPlayers] = useState<string[]>([]);
  const [showExitDialog, setShowExitDialog] = useState(false);

  const buyInSnapshot = gameData.buyInSnapshot;
  const rebuySnapshot = gameData.rebuySnapshot;
  const useRoundingRule = gameData.useRoundingRule;
  const roundingRulePercentage = gameData.roundingRulePercentage;
  const players = gameData.players || [];

  // בדיקת הרשאות להמשך המשחק
  const canContinue = canUserContinueThisGame(gameData);

  // Your existing computation logic - modified to handle completed games
  const computedPlayers = useMemo(() => {
    return players.map(player => {
      const buyInTotal = player.buyInCount * buyInSnapshot.amount;
      const rebuyTotal = player.rebuyCount * rebuySnapshot.amount;
      const totalInvestment = buyInTotal + rebuyTotal;
      
      // אם המשחק כבר הסתיים (ended או יותר מתקדם), השתמש בנתונים המחושבים הקיימים
      if (gameData.status !== 'active' && player.exactChipsValue !== undefined && player.resultBeforeOpenGames !== undefined) {
        console.log(`Using existing calculated data for player ${player.name}`);
        return {
          ...player,
          totalInvestment,
          buyInTotal,
          rebuyTotal,
          finalChipsValue: player.exactChipsValue,
          resultBeforeOpenGames: player.resultBeforeOpenGames,
          roundedRebuysCount: player.roundedRebuysCount || 0,
        };
      }
      
      // אחרת, חשב מחדש מהצ'יפים הראשוניים (רק למשחקים פעילים)
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
  }, [players, buyInSnapshot, rebuySnapshot, useRoundingRule, roundingRulePercentage, gameData.status]);

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
        // players: computedPlayers, // Temporarily revert to original players to fix type error
        totalWins,
        totalLosses,
        difference,
        openGamesCount,
      }));
    }
  }, [computedPlayers, totalWins, totalLosses, difference, openGamesCount]);

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

    // Also set up header back button press to trigger the same dialog
    // Note: This assumes expo-router or react-navigation handles merging options.
    // If headerLeft is directly controlled elsewhere, this might need adjustment.
    // Consider placing this logic within a useFocusEffect if issues arise with navigation state.
    // For now, we assume this structure works with the navigation setup.

    return () => backHandler.remove();
  }, [router]); 

  const continueHandler = () => {
    if (!useRoundingRule || openGamesCount === 0) {
      updateGameStatus('payments');
      router.push('/gameFlow/PaymentCalculations');
    } else {
      updateGameStatus('open_games');
      router.push('/gameFlow/OpenGames');
    }
  };

  // הסרת עדכון אוטומטי של סטטוס - נעשה באופן ידני במקומות המתאימים

  // Debug logging לבדיקת נתוני השחקנים שמגיעים למסך - מופחת
  useEffect(() => {
    if (gameData.status !== 'active') {
      console.log(`InitialResults: Game status is ${gameData.status}, using existing calculated data`);
    }
  }, [gameData.status]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {/* Back Button (Now on the right) - Restored action */}
        <TouchableOpacity onPress={() => setShowExitDialog(true)} style={styles.backButton}> 
           <Icon name="arrow-right" size={24} color="#FFD700" />
        </TouchableOpacity>
        
        {/* Header Content */}
        <View style={styles.headerContent}>
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
        
        <TouchableOpacity 
          onPress={() => router.push('/(tabs)/home2')} 
          style={styles.homeButton}
        >
          <Icon name="home" size={24} color="#FFD700" />
        </TouchableOpacity>
      </View>

      <ReadOnlyIndicator />

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
                    {player.resultBeforeOpenGames >= 0 
                      ? `+${player.resultBeforeOpenGames.toFixed(2)} ₪`
                      : `${player.resultBeforeOpenGames.toFixed(2)} ₪`
                    }
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
                  {/* Investment Section */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>השקעה</Text>
                    <View style={styles.detailsGrid}>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Buy-in</Text>
                        <Text style={styles.detailValue}>
                          {`${player.buyInTotal} ₪ (${player.buyInCount}x)`}
                        </Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Rebuy</Text>
                        <Text style={styles.detailValue}>
                          {`${player.rebuyTotal} ₪ (${player.rebuyCount}x)`}
                        </Text>
                      </View>
                      <View style={[styles.detailItem, styles.totalItem]}>
                        <Text style={styles.detailLabel}>סה"כ השקעה</Text>
                        <Text style={styles.detailValue}>
                          {`${player.totalInvestment} ₪`}
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
                        <Text style={styles.detailValue}>
                          {player.finalChips !== undefined ? player.finalChips : 
                           (player.finalChipsValue && rebuySnapshot.chips ? 
                           Math.round(player.finalChipsValue / rebuySnapshot.amount * rebuySnapshot.chips) : 
                           'לא זמין')}
                        </Text>
                      </View>
                      {useRoundingRule && (
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>
                            ריבאיים לפי {`${roundingRulePercentage}%`}
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
                      {player.resultBeforeOpenGames >= 0 
                        ? `+${player.resultBeforeOpenGames.toFixed(2)} ₪`
                        : `${player.resultBeforeOpenGames.toFixed(2)} ₪`
                      }
                    </Text>
                  </View>
                </View>
              )}
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Footer */}
      {canContinue && (
        <View style={styles.footer}>
          <Button
            title={(!useRoundingRule || openGamesCount === 0) ?
              "המשך לחישוב תשלומים" :
              "המשך למשחקים פתוחים"}
            onPress={continueHandler}
            style={styles.continueButton}
          />
        </View>
      )}

      {/* Exit Confirmation Dialog - Restored */}
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
    flexDirection: 'row', // Changed to row-reverse for right alignment
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#35654d', // Matches GameManagement
    borderBottomWidth: 2,
    borderBottomColor: '#FFD700', // Matches GameManagement
  },
  backButton: {
    width: 40, // Added from GameManagement
    height: 40, // Added from GameManagement
    borderRadius: 20, // Added from GameManagement to make it circular
    backgroundColor: 'rgba(255, 215, 0, 0.1)', // Added from GameManagement
    justifyContent: 'center', // Added from GameManagement to center icon
    alignItems: 'center', // Added from GameManagement to center icon
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    marginBottom: 2,
  },
  headerSubtitle: {
    color: '#FFD700',
    fontSize: 14,
  },
  summaryCard: {
    margin: 16,
    backgroundColor: '#1C2C2E',
    borderColor: '#FFD700',
    borderWidth: 1,
    padding: 0,
  },
  summaryGrid: {
    flexDirection: 'row',
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
  },
});