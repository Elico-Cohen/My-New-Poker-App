// src/app/gameFlow/OpenGames.tsx
import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, BackHandler } from 'react-native';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Dropdown } from '@/components/common/Dropdown';
import { Icon } from '@/components/common/Icon';
import { Dialog } from '@/components/common/Dialog';
import { ReadOnlyIndicator } from '@/components/auth/ReadOnlyIndicator';
import { useRouter } from 'expo-router';
import { useGameContext } from '@/contexts/GameContext';

interface OpenGameState {
  id: number;
  winner?: string;
}

export default function OpenGames() {
  const router = useRouter();
  const { gameData, setGameData, updateGameStatus, shouldUpdateStatus, canUserContinueThisGame } = useGameContext();
  
  // State for tracking open games
  const [openGames, setOpenGames] = useState<OpenGameState[]>([]);
  const [showExitDialog, setShowExitDialog] = useState(false);
  
  // בדיקת הרשאות להמשך המשחק
  const canContinue = canUserContinueThisGame(gameData);
  
  // Initialize open games array based on required count
  useEffect(() => {
    const games = Array.from({ length: gameData.openGamesCount }, (_, index) => ({
      id: index + 1,
    }));
    setOpenGames(games);
  }, [gameData.openGamesCount]);

  // Select winner for a specific game
  const selectWinner = (gameId: number, winnerId: string) => {
    setOpenGames(prev => prev.map(game => 
      game.id === gameId ? { ...game, winner: winnerId } : game
    ));
  };

  // Prepare dropdown items for player selection
  const playerItems = gameData.players.map(player => ({
    label: player.name,
    value: player.id
  }));

  // Check if all games have winners selected
  const allGamesCompleted = openGames.every(game => game.winner);

  // Calculate wins per player (for summary card)
  const playerWinCounts = gameData.players.map(player => {
    const wins = openGames.filter(game => game.winner === player.id).length;
    return {
      id: player.id,
      name: player.name,
      wins,
      totalAmount: wins * gameData.rebuySnapshot.amount
    };
  }).filter(player => player.wins > 0);

  // Handle completion of open games
  const handleComplete = () => {
    // Update game state with open games results
    setGameData(prev => ({
      ...prev,
      openGames: openGames.map(game => ({
        ...game,
        createdAt: Date.now()
      }))
    }));
    
    // Navigate to final results (not payment calculations yet)
    updateGameStatus('final_results');
    router.push('/gameFlow/FinalResults');
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

  // Calculate remaining games
  const completedGamesCount = openGames.filter(game => game.winner).length;
  const remainingGamesCount = gameData.openGamesCount - completedGamesCount;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {/* Back Button */}
        <TouchableOpacity onPress={() => setShowExitDialog(true)} style={styles.backButton}>
           <Icon name="arrow-right" size={24} color="#FFD700" />
        </TouchableOpacity>
        
        {/* Header Content */} 
        <View style={styles.headerContent}> 
        <Text variant="h4" style={styles.headerTitle}>
          משחקים פתוחים
        </Text>
        <Text style={styles.headerSubtitle}>
          {gameData.groupNameSnapshot}
        </Text>
        <Text style={styles.headerInfo}>
          נדרשים {gameData.openGamesCount} משחקים פתוחים
        </Text>
        <Text style={styles.headerInfo}>
          כל משחק שווה {gameData.rebuySnapshot.amount} ₪
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

      {/* Summary Section - Always shown, dynamically updated */}
      <Card style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>סיכום זכיות</Text>
        
        {/* Progress information */}
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            {completedGamesCount} מתוך {gameData.openGamesCount} משחקים הושלמו
          </Text>
          {remainingGamesCount > 0 && (
            <Text style={styles.remainingText}>
              נותרו {remainingGamesCount} משחקים
            </Text>
          )}
        </View>
        
        {/* Player wins */}
        {playerWinCounts.length > 0 ? (
          playerWinCounts.map(player => (
            <View key={player.id} style={styles.summaryRow}>
              <Text style={styles.playerName}>{player.name}</Text>
              <Text style={styles.winsCount}>
                {player.wins} × {gameData.rebuySnapshot.amount} ₪ = {player.totalAmount} ₪
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.noWinnersText}>
            טרם נבחרו זוכים במשחקים
          </Text>
        )}
      </Card>

      {/* List of Open Games */}
      <ScrollView style={styles.scrollView}>
        {openGames.map((game) => (
          <Card key={game.id} style={styles.gameCard}>
            <View style={styles.gameHeader}>
              <Text style={styles.gameTitle}>
                משחק פתוח {game.id}
              </Text>
              {game.winner && (
                <View style={styles.winnerTag}>
                  <Text style={styles.winnerTagText}>
                    {gameData.rebuySnapshot.amount} ₪
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.dropdownContainer}>
              <Dropdown
                value={game.winner || ''}
                items={[
                  { label: 'בחר זוכה', value: '' },
                  ...playerItems
                ]}
                onSelect={canContinue ? (value) => selectWinner(game.id, value) : () => {}}
                disabled={!canContinue}
              />
            </View>

            {game.winner && (
              <View style={styles.winnerInfo}>
                <Text style={styles.winnerLabel}>הזוכה:</Text>
                <Text style={styles.winnerName}>
                  {gameData.players.find(p => p.id === game.winner)?.name}
                </Text>
              </View>
            )}
          </Card>
        ))}
      </ScrollView>

      {/* Footer */}
      {canContinue && (
        <View style={styles.footer}>
          <Button
            title="המשך לתוצאות הסופיות"
            onPress={handleComplete}
            disabled={!allGamesCompleted}
            style={[
              styles.continueButton,
              !allGamesCompleted && styles.disabledButton
            ]}
          />
        </View>
      )}

      {/* Exit Confirmation Dialog */}
      <Dialog
        visible={showExitDialog}
        title="חזרה למסך הקודם"
        message="האם אתה בטוח שברצונך לחזור למסך הקודם? הנתונים שהוזנו עבור המשחקים הפתוחים לא יישמרו."
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
    marginBottom: 4,
  },
  headerInfo: {
    color: '#FFD700',
    textAlign: 'center',
    fontSize: 14,
    opacity: 0.8,
  },
  summaryCard: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: '#1C2C2E',
    borderColor: '#FFD700',
    borderWidth: 1,
    padding: 16,
  },
  summaryTitle: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  progressContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 215, 0, 0.3)',
    paddingBottom: 8,
  },
  progressText: {
    color: '#FFD700',
    fontSize: 14,
    marginBottom: 4,
  },
  remainingText: {
    color: '#ef4444',
    fontSize: 14,
  },
  noWinnersText: {
    color: '#B8B8B8',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  scrollView: {
    flex: 1,
    padding: 16,
    paddingBottom: 24,
  },
  gameCard: {
    marginBottom: 16,
    backgroundColor: '#1C2C2E',
    borderColor: '#FFD700',
    borderWidth: 1,
    padding: 16,
  },
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  gameTitle: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
  },
  winnerTag: {
    backgroundColor: '#35654d',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  winnerTagText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
  },
  dropdownContainer: {
    marginBottom: 12,
  },
  winnerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(53, 101, 77, 0.3)',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  winnerLabel: {
    color: '#FFD700',
    marginStart: 8,
    fontSize: 16,
  },
  winnerName: {
    color: '#22c55e',
    fontSize: 16,
    fontWeight: 'bold',
  },
  playerName: {
    color: '#FFD700',
    fontSize: 16,
  },
  winsCount: {
    color: '#22c55e',
    fontSize: 16,
    fontWeight: 'bold',
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
  disabledButton: {
    opacity: 0.5,
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