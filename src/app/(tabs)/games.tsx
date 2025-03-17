// src/app/(tabs)/games.tsx
import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Text } from '@/components/common/Text';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { Button } from '@/components/common/Button';
import { useRouter } from 'expo-router';
import { Dialog } from '@/components/common/Dialog';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { Game } from '@/models/Game';
import { getAllActiveGroups } from '@/services/groups';
import { useAuth } from '@/contexts/AuthContext';
import { getDocs, query, collection, where, orderBy, limit, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/config/firebase';

// Constants for colors
const CASINO_COLORS = {
  background: '#0D1B1E',
  primary: '#35654d',
  gold: '#FFD700',
  surface: '#1C2C2E',
  text: '#FFFFFF',
  error: '#ef4444'
};

// Date formatting helper
const formatDate = (gameDate: any): string => {
  try {
    if (!gameDate) return 'תאריך לא זמין';
    
    // Using game date components or timestamp
    if (gameDate.year && gameDate.month && gameDate.day) {
      const date = new Date(gameDate.year, gameDate.month - 1, gameDate.day);
      return date.toLocaleDateString('he-IL');
    }
    
    // Fallback to timestamp
    if (gameDate.timestamp) {
      return new Date(gameDate.timestamp).toLocaleDateString('he-IL');
    }
    
    return 'תאריך לא זמין';
  } catch (e) {
    console.error('Error formatting date:', e);
    return 'תאריך לא זמין';
  }
};

// Game status label component
const GameStatusLabel = ({ status }: { status: string }) => {
  let statusText = '';
  let bgColor = '';
  
  switch(status) {
    case 'active':
      statusText = 'משחק פעיל';
      bgColor = '#22c55e';
      break;
    case 'ending':
      statusText = 'בסיום';
      bgColor = '#3b82f6';
      break;
    case 'open_games':
      statusText = 'משחקים פתוחים';
      bgColor = '#f59e0b';
      break;
    default:
      statusText = status === 'completed' ? 'הושלם' : 'לא ידוע';
      bgColor = status === 'completed' ? '#6b7280' : '#ef4444';
  }
  
  return (
    <View style={[styles.statusBadge, { backgroundColor: bgColor }]}>
      <Text style={styles.statusText}>{statusText}</Text>
    </View>
  );
};

export default function GamesScreen() {
  const router = useRouter();
  const { user, canDeleteEntity } = useAuth();
  
  // State variables
  const [activeGames, setActiveGames] = useState<Game[]>([]);
  const [recentGames, setRecentGames] = useState<Game[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [gameToDelete, setGameToDelete] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<{id: string, name: string}[]>([]);

  // Load games when component mounts
  useEffect(() => {
    loadGames();
  }, []);

  // Function to load games from Firestore
  const loadGames = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load groups for reference
      const groupsData = await getAllActiveGroups();
      setGroups(groupsData);
      
      // Query active games (not completed)
      const activeGamesQuery = query(
        collection(db, 'games'),
        where('status', 'in', ['active', 'ending', 'open_games']),
        orderBy('updatedAt', 'desc')
      );
      
      // Query recent completed games
      const recentGamesQuery = query(
        collection(db, 'games'),
        where('status', '==', 'completed'),
        orderBy('updatedAt', 'desc'),
        limit(5)
      );
      
      // Execute queries
      const [activeGamesSnapshot, recentGamesSnapshot] = await Promise.all([
        getDocs(activeGamesQuery),
        getDocs(recentGamesQuery)
      ]);
      
      // Process active games
      const activeGamesData: Game[] = [];
      activeGamesSnapshot.forEach(doc => {
        activeGamesData.push({ id: doc.id, ...doc.data() } as Game);
      });
      
      // Process recent games
      const recentGamesData: Game[] = [];
      recentGamesSnapshot.forEach(doc => {
        recentGamesData.push({ id: doc.id, ...doc.data() } as Game);
      });
      
      // Update state
      setActiveGames(activeGamesData);
      setRecentGames(recentGamesData);
      
    } catch (error) {
      console.error('Error loading games:', error);
      setError('טעינת המשחקים נכשלה');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle starting a new game
  const handleNewGame = () => {
    router.push('/gameFlow/NewGameSetup');
  };
  
  // Handle continuing a game
  const handleContinueGame = (game: Game) => {
    // Update GameContext with the game data
    router.push(`/gameFlow/GameManagement?gameId=${game.id}`);
  };
  
  // Handle deleting a game
  const handleDeleteGame = (game: Game) => {
    // Check if user has permission to delete
    if (!canDeleteEntity('game')) {
      Alert.alert(
        "אין הרשאה",
        "אין לך הרשאה למחוק משחקים. רק מנהל מערכת יכול לבצע פעולה זו.",
        [{ text: "הבנתי" }]
      );
      return;
    }
    
    setGameToDelete(game);
    setShowDeleteDialog(true);
  };
  
  // Confirm deleting a game
  const confirmDelete = async () => {
    if (!gameToDelete) return;
    
    try {
      setLoading(true);
      // Delete the game document
      await deleteDoc(doc(db, 'games', gameToDelete.id));
      
      // Reload games
      await loadGames();
      
      // Close dialog
      setShowDeleteDialog(false);
      setGameToDelete(null);
    } catch (error) {
      console.error('Error deleting game:', error);
      setError('מחיקת המשחק נכשלה');
    } finally {
      setLoading(false);
    }
  };
  
  // Get group name by ID
  const getGroupName = (groupId?: string): string => {
    if (!groupId) return 'קבוצה לא ידועה';
    
    const group = groups.find(g => g.id === groupId);
    return group?.name || groupId;
  };
  
  // Render a game card
  const renderGameCard = (game: Game, active: boolean = false) => {
    // Count players
    const playersCount = game.players?.length || 0;
    
    return (
      <Card key={game.id} style={styles.gameCard}>
        <View style={styles.gameCardHeader}>
          <Text style={styles.gameGroupName}>{game.groupNameSnapshot || getGroupName(game.groupId)}</Text>
          <GameStatusLabel status={game.status} />
        </View>
        
        <View style={styles.gameCardDetails}>
          <View style={styles.gameCardDetail}>
            <Text style={styles.gameCardDetailLabel}>תאריך:</Text>
            <Text style={styles.gameCardDetailValue}>{formatDate(game.date)}</Text>
          </View>
          
          <View style={styles.gameCardDetail}>
            <Text style={styles.gameCardDetailLabel}>מספר שחקנים:</Text>
            <Text style={styles.gameCardDetailValue}>{playersCount}</Text>
          </View>
          
          {/* Show additional details for active games */}
          {active && game.players && game.buyInSnapshot && game.rebuySnapshot && (
            <View style={styles.gameCardDetail}>
              <Text style={styles.gameCardDetailLabel}>סכום כולל:</Text>
              <Text style={styles.gameCardDetailValue}>
                {game.players.reduce((sum, player) => {
                  const buyInTotal = (player.buyInCount || 0) * game.buyInSnapshot.amount;
                  const rebuyTotal = (player.rebuyCount || 0) * game.rebuySnapshot.amount;
                  return sum + buyInTotal + rebuyTotal;
                }, 0)} ₪
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.gameCardActions}>
          {active ? (
            <Button
              title="המשך משחק"
              onPress={() => handleContinueGame(game)}
              style={styles.continueButton}
              textStyle={styles.buttonText}
            />
          ) : (
            <Button
              title="צפה בפרטים"
              onPress={() => router.push(`/history/${game.id}`)}
              style={styles.viewButton}
              textStyle={styles.buttonText}
            />
          )}
          
          {/* Only admins can delete games */}
          {canDeleteEntity('game') && (
            <Button
              title="מחק"
              onPress={() => handleDeleteGame(game)}
              style={styles.deleteButton}
              textStyle={styles.buttonText}
            />
          )}
        </View>
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text variant="h4" style={styles.headerTitle}>משחקים</Text>
        </View>
        <View style={styles.loadingContainer}>
          <LoadingIndicator text="טוען משחקים..." />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="h4" style={styles.headerTitle}>משחקים</Text>
      </View>
      
      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* New Game Button */}
        <TouchableOpacity 
          style={styles.newGameButton}
          onPress={handleNewGame}
        >
          <Icon name="cards-playing-outline" size="xlarge" color="#FFD700" />
          <Text variant="h3" style={styles.newGameButtonText}>התחל משחק חדש</Text>
        </TouchableOpacity>
        
        {/* Active Games Section */}
        {activeGames.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>משחקים פעילים</Text>
            {activeGames.map(game => renderGameCard(game, true))}
          </>
        )}
        
        {/* Recent Games Section */}
        {recentGames.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>משחקים אחרונים</Text>
            {recentGames.map(game => renderGameCard(game, false))}
            
            {/* View All History Button */}
            <Button
              title="צפה בכל ההיסטוריה"
              onPress={() => router.push('/(tabs)/history')}
              style={styles.viewAllButton}
              textStyle={styles.viewAllButtonText}
            />
          </>
        )}
        
        {/* Show message when no games */}
        {activeGames.length === 0 && recentGames.length === 0 && (
          <Card style={styles.noGamesCard}>
            <Text style={styles.noGamesText}>אין משחקים זמינים. התחל משחק חדש!</Text>
          </Card>
        )}
      </ScrollView>
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        visible={showDeleteDialog}
        title="מחיקת משחק"
        message="האם אתה בטוח שברצונך למחוק את המשחק? פעולה זו אינה ניתנת לביטול."
        confirmText="מחק"
        cancelText="ביטול"
        onConfirm={confirmDelete}
        onCancel={() => {
          setShowDeleteDialog(false);
          setGameToDelete(null);
        }}
        type="danger"
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
    padding: 16,
    backgroundColor: '#35654d',
    borderBottomWidth: 2,
    borderBottomColor: '#FFD700',
  },
  headerTitle: {
    color: '#FFD700',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newGameButton: {
    backgroundColor: '#35654d',
    padding: 24,
    borderRadius: 12,
    marginBottom: 24,
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  newGameButtonText: {
    color: '#FFD700',
    marginRight: 16,
    fontSize: 24,
  },
  sectionTitle: {
    color: '#FFD700',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'right',
  },
  gameCard: {
    backgroundColor: '#1C2C2E',
    borderWidth: 1,
    borderColor: '#FFD700',
    marginBottom: 16,
    padding: 16,
  },
  gameCardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  gameGroupName: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  gameCardDetails: {
    marginBottom: 16,
  },
  gameCardDetail: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  gameCardDetailLabel: {
    color: '#B8B8B8',
  },
  gameCardDetailValue: {
    color: '#FFD700',
    fontWeight: 'bold',
  },
  gameCardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  continueButton: {
    flex: 1,
    marginRight: 8,
    backgroundColor: '#35654d',
    borderColor: '#FFD700',
    borderWidth: 1,
  },
  viewButton: {
    flex: 1,
    marginRight: 8,
    backgroundColor: '#1f3a2b',
    borderColor: '#FFD700',
    borderWidth: 1,
  },
  deleteButton: {
    flex: 1,
    marginLeft: 8,
    backgroundColor: '#c41e3a',
    borderColor: '#FFD700',
    borderWidth: 1,
  },
  buttonText: {
    color: '#FFD700',
  },
  noGamesCard: {
    backgroundColor: '#1C2C2E',
    padding: 24,
    alignItems: 'center',
  },
  noGamesText: {
    color: '#B8B8B8',
    fontSize: 16,
  },
  viewAllButton: {
    backgroundColor: '#1f3a2b',
    borderColor: '#FFD700',
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 16,
  },
  viewAllButtonText: {
    color: '#FFD700',
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    padding: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyStateIcon: {
    marginBottom: 16,
  },
  emptyStateText: {
    color: '#B8B8B8',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#35654d',
    borderColor: '#FFD700',
    borderWidth: 2,
    paddingHorizontal: 24,
  }
});