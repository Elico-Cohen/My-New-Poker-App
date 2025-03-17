// src/app/(tabs)/history.tsx
import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Text } from '@/components/common/Text';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { Dropdown } from '@/components/common/Dropdown';
import { Input } from '@/components/common/Input';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { Game } from '@/models/Game';
import { getAllActiveGroups } from '@/services/groups';
import { getGamesByGroup, deleteGame } from '@/services/games';
import { getDocs, collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Dialog } from '@/components/common/Dialog';
import gameDataManager from '@/services/gameDataManager';

// Define fallback date object to use when date is invalid
const DEFAULT_GAME_DATE = {
  day: 1,
  month: 1,
  year: 2023,
  timestamp: Date.now()
};

const CASINO_COLORS = {
  background: '#0D1B1E',
  primary: '#35654d',
  gold: '#FFD700',
  surface: '#1C2C2E',
  text: '#FFFFFF',
  textSecondary: '#B8B8B8',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444'
};

export default function HistoryScreen() {
  const router = useRouter();
  const { refresh } = useLocalSearchParams<{ refresh: string }>();
  
  // State
  const [allGames, setAllGames] = useState<Game[]>([]);  // Store all fetched games
  const [filteredGames, setFilteredGames] = useState<Game[]>([]);
  const [groups, setGroups] = useState<{label: string, value: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Delete dialog state
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [gameToDelete, setGameToDelete] = useState<Game | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  
  // Filters state
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Format date for display with safety checks
  const formatDate = (gameDate: any): string => {
    try {
      // More defensive check for all required properties
      if (!gameDate || typeof gameDate.year !== 'number' || typeof gameDate.month !== 'number' || typeof gameDate.day !== 'number') {
        // Log what we received to help debugging
        console.log('Invalid date properties:', gameDate);
        
        // Fallback to timestamp
        if (gameDate && typeof gameDate.timestamp === 'number') {
          const date = new Date(gameDate.timestamp);
          return date.toLocaleDateString('he-IL');
        }
        
        return 'תאריך לא זמין';
      }
      
      const date = new Date(gameDate.year, gameDate.month - 1, gameDate.day);
      return date.toLocaleDateString('he-IL');
    } catch (e) {
      console.error('Error formatting date:', e, gameDate);
      return 'תאריך לא זמין';
    }
  };

  // Process a game to ensure it has valid data
  const processGame = (game: any): Game | null => {
    if (!game || !game.id) {
      console.warn('Invalid game object, skipping:', game);
      return null;
    }
    
    try {
      // יצירת עותק בטוח
      const safeGame = { ...game };
      
      // וידוא שיש מערכים
      safeGame.players = Array.isArray(safeGame.players) ? safeGame.players : [];
      safeGame.payments = Array.isArray(safeGame.payments) ? safeGame.payments : [];
      
      // הדפסת האובייקט המלא לאיתור הבעיה
      console.log(`Game ${game.id} fields:`, Object.keys(safeGame));
      
      // טיפול בעקביות של שדות התאריך
      const dateSource = safeGame.gameDate || safeGame.date;
      console.log(`Game ID ${game.id}, date source:`, dateSource);
      
      if (!dateSource || typeof dateSource !== 'object') {
        console.warn(`Game ${game.id} missing date fields, using createdAt or default`);
        
        // שימוש ב-createdAt כמקור חלופי לתאריך
        if (typeof safeGame.createdAt === 'number') {
          const createdDate = new Date(safeGame.createdAt);
          safeGame.date = {
            day: createdDate.getDate(),
            month: createdDate.getMonth() + 1,
            year: createdDate.getFullYear(),
            timestamp: safeGame.createdAt
          };
        } else {
          safeGame.date = { ...DEFAULT_GAME_DATE };
        }
      } else {
        // יצירת שדה תאריך בפורמט אחיד
        safeGame.date = {
          day: typeof dateSource.day === 'number' ? dateSource.day : DEFAULT_GAME_DATE.day,
          month: typeof dateSource.month === 'number' ? dateSource.month : DEFAULT_GAME_DATE.month,
          year: typeof dateSource.year === 'number' ? dateSource.year : DEFAULT_GAME_DATE.year,
          timestamp: typeof dateSource.timestamp === 'number' ? 
            dateSource.timestamp : 
            (typeof safeGame.createdAt === 'number' ? safeGame.createdAt : DEFAULT_GAME_DATE.timestamp)
        };
      }
      
      return safeGame;
    } catch (err) {
      console.error(`Error processing game ${game?.id}:`, err);
      return null;
    }
  };

  // Fetch all games once, then filter client-side
  const fetchAllGames = async () => {
    try {
      console.log('History: טוען משחקים ממנהל הנתונים המרכזי');
      
      // השימוש במנהל הנתונים המרכזי במקום ב-Firebase ישירות
      // מציג רק משחקים שהושלמו - לפי הדרישה של מסך ההיסטוריה
      const allGames = await gameDataManager.fetchAllGames({ 
        skipCache: false,
        onlyCompleted: true  // הצגת משחקים שהושלמו בלבד
      });
      
      // הפעלת הפונקציה processGame על התוצאות כדי לוודא עקביות בפורמט הנתונים
      // עבור קוד קיים שעדיין מצפה למבנה נתונים מסוים
      const processedGames: Game[] = [];
      allGames.forEach(gameData => {
        const processedGame = processGame(gameData);
        if (processedGame) {
          processedGames.push(processedGame);
        }
      });
      
      // Sort games by date in descending order (newest first)
      const sortedGames = processedGames.sort((a, b) => {
        const timestampA = a.date?.timestamp || 0;
        const timestampB = b.date?.timestamp || 0;
        return timestampB - timestampA;
      });
      
      console.log(`History: עיבד בהצלחה ${sortedGames.length} משחקים שהושלמו`);
      return sortedGames;
    } catch (error) {
      console.error('History: שגיאה בהבאת כל המשחקים:', error);
      throw error;
    }
  };

  // Handle game deletion
  const handleDeleteGame = async () => {
    if (!gameToDelete) return;
    
    try {
      setDeleteLoading(true);
      setDeleteError(null);
      
      // Call the delete service
      await deleteGame(gameToDelete.id);
      
      // Update local state after successful deletion
      const updatedGames = allGames.filter(game => game.id !== gameToDelete.id);
      setAllGames(updatedGames);
      setFilteredGames(filteredGames.filter(game => game.id !== gameToDelete.id));
      
      // Close dialog
      setDeleteDialogVisible(false);
      setGameToDelete(null);
      
    } catch (error) {
      console.error('Error deleting game:', error);
      setDeleteError('מחיקת המשחק נכשלה. אנא נסה שוב מאוחר יותר.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Load data
  useEffect(() => {
    const loadData = async () => {
      console.log('Starting loadData function');
      try {
        setLoading(true);
        setError(null);
        
        // Load groups for filtering
        console.log('Fetching active groups');
        const groupsData = await getAllActiveGroups();
        console.log(`Fetched ${groupsData.length} groups`);
        
        setGroups([
          { label: 'כל הקבוצות', value: 'all' },
          ...groupsData.map(group => ({ 
            label: group.name, 
            value: group.id 
          }))
        ]);
        
        // Load all games at once
        const allGamesData = await fetchAllGames();
        setAllGames(allGamesData);
        setFilteredGames(allGamesData);
        
      } catch (err) {
        console.error('Failed to load history data:', err);
        setError('טעינת הנתונים נכשלה. אנא נסה שוב.');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [refresh]);
  
  // Apply filters when they change
  useEffect(() => {
    console.log('Applying filters');
    
    if (allGames.length === 0) {
      console.log('No games to filter');
      return;
    }
    
    try {
      // Start with all games
      let result = [...allGames];
      console.log(`Starting with ${result.length} games`);
      
      // Filter by group
      if (selectedGroup !== 'all') {
        console.log(`Filtering by group: ${selectedGroup}`);
        result = result.filter(game => game.groupId === selectedGroup);
        console.log(`After group filter: ${result.length} games`);
      }
      
      // Filter by time period
      if (selectedPeriod !== 'all') {
        console.log(`Filtering by period: ${selectedPeriod}`);
        const now = new Date();
        const cutoffDate = new Date();
        
        if (selectedPeriod === 'month') {
          cutoffDate.setMonth(now.getMonth() - 1);
        } else if (selectedPeriod === 'year') {
          cutoffDate.setFullYear(now.getFullYear() - 1);
        }
        
        const cutoffTimestamp = cutoffDate.getTime();
        console.log(`Cutoff timestamp: ${cutoffTimestamp}`);
        
        result = result.filter(game => {
          try {
            // Safely access timestamp with fallback
            const gameTimestamp = game.date?.timestamp || 0;
            return gameTimestamp >= cutoffTimestamp;
          } catch (err) {
            console.warn('Error filtering game by date:', err);
            return false;
          }
        });
        console.log(`After time filter: ${result.length} games`);
      }
      
      // Filter by search query (player name)
      if (searchQuery.trim() !== '') {
        console.log(`Filtering by player name: "${searchQuery}"`);
        const query = searchQuery.toLowerCase();
        result = result.filter(game => {
          try {
            if (!game.players || !Array.isArray(game.players)) return false;
            
            return game.players.some(player => 
              player.name && typeof player.name === 'string' && 
              player.name.toLowerCase().includes(query)
            );
          } catch (err) {
            console.warn('Error filtering game by player name:', err);
            return false;
          }
        });
        console.log(`After player name filter: ${result.length} games`);
      }
      
      // Sort by date (newest first)
      result.sort((a, b) => {
        const timestampA = a.date?.timestamp || 0;
        const timestampB = b.date?.timestamp || 0;
        return timestampB - timestampA;
      });
      
      setFilteredGames(result);
    } catch (err) {
      console.error('Error applying filters:', err);
    }
  }, [selectedGroup, selectedPeriod, searchQuery, allGames, refresh]);
  
  // Calculate game result data
  const calculateGameStats = (game: Game) => {
    try {
      // Find the largest winner
      let topWinner = { name: '', amount: 0 };
      let totalAmount = 0;
      
      if (game.players && Array.isArray(game.players)) {
        game.players.forEach(player => {
          // Make sure finalResultMoney exists and is a number
          const result = typeof player.finalResultMoney === 'number' ? player.finalResultMoney : 0;
          totalAmount += Math.abs(result);
          
          if (result > topWinner.amount) {
            topWinner = { 
              name: player.name || 'לא ידוע', 
              amount: result 
            };
          }
        });
      }
      
      return {
        playerCount: game.players?.length || 0,
        topWinner,
        totalAmount: Math.round(totalAmount / 2) // Divide by 2 since winners = losers
      };
    } catch (error) {
      console.error('Error calculating game stats:', error);
      return {
        playerCount: 0,
        topWinner: { name: '', amount: 0 },
        totalAmount: 0
      };
    }
  };

  if (loading && filteredGames.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={{ width: 40 }} />
          <Text variant="h4" style={styles.headerTitle}>
            היסטוריית משחקים
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <LoadingIndicator text="טוען היסטוריה..." />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ width: 40 }} />
        <Text variant="h4" style={styles.headerTitle}>
          היסטוריית משחקים
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>קבוצה:</Text>
          <View style={styles.filterControl}>
            <Dropdown
              value={selectedGroup}
              onSelect={setSelectedGroup}
              items={groups}
            />
          </View>
        </View>
        
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>תקופה:</Text>
          <View style={styles.filterControl}>
            <Dropdown
              value={selectedPeriod}
              onSelect={setSelectedPeriod}
              items={[
                { label: 'כל הזמנים', value: 'all' },
                { label: 'חודש אחרון', value: 'month' },
                { label: 'שנה אחרונה', value: 'year' }
              ]}
            />
          </View>
        </View>
        
        <View style={styles.searchContainer}>
          <Input
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="חיפוש לפי שם שחקן..."
            style={styles.searchInput}
          />
        </View>
      </View>

      {/* Games List */}
      <ScrollView style={styles.scrollView}>
        {loading && filteredGames.length > 0 && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={CASINO_COLORS.gold} />
          </View>
        )}
        
        {error && (
          <Card style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        )}
        
        {filteredGames.length > 0 ? (
          filteredGames.map((game) => {
            try {
              const { playerCount, topWinner, totalAmount } = calculateGameStats(game);
              
              return (
                <TouchableOpacity
                  key={game.id}
                  onPress={() => router.push(`/history/${game.id}`)}
                  onLongPress={() => {
                    setGameToDelete(game);
                    setDeleteDialogVisible(true);
                  }}
                  delayLongPress={500} // 500ms threshold for long press
                >
                  <Card style={styles.gameCard}>
                    <View style={styles.gameCardHeader}>
                      <Text style={styles.gameDate}>
                        {formatDate(game.date)}
                      </Text>
                      <Text style={styles.gameGroup}>{game.groupNameSnapshot || 'קבוצה'}</Text>
                    </View>
                    
                    <View style={styles.gameCardContent}>
                      <View style={styles.gameDetail}>
                        <Icon name="account-group" size="small" color={CASINO_COLORS.gold} />
                        <Text style={styles.gameDetailText}>{playerCount} שחקנים</Text>
                      </View>
                      
                      {topWinner.name && (
                        <View style={styles.gameDetail}>
                          <Icon name="trophy" size="small" color={CASINO_COLORS.gold} />
                          <Text style={styles.gameDetailText}>
                            המנצח הגדול: {topWinner.name} ({topWinner.amount.toFixed(0)} ₪)
                          </Text>
                        </View>
                      )}
                      
                      <View style={styles.gameDetail}>
                        <Icon name="cash" size="small" color={CASINO_COLORS.gold} />
                        <Text style={styles.gameDetailText}>
                          סכום כולל: {totalAmount.toFixed(0)} ₪
                        </Text>
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            } catch (err) {
              console.error(`Error rendering game ${game?.id}:`, err);
              return null;
            }
          }).filter(Boolean) // Filter out any null elements from failed renders
        ) : (
          <View style={styles.emptyContainer}>
            <Icon name="book-open-variant" size="xlarge" color={CASINO_COLORS.gold} />
            <Text style={styles.emptyText}>
              לא נמצאו משחקים העונים לקריטריונים
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Delete Confirmation Dialog */}
      <Dialog
        visible={deleteDialogVisible}
        title="מחיקת משחק"
        message=""
        confirmText={deleteLoading ? "מוחק..." : "מחק"}
        cancelText="ביטול"
        onConfirm={handleDeleteGame}
        onCancel={() => {
          setDeleteDialogVisible(false);
          setGameToDelete(null);
          setDeleteError(null);
        }}
        type="danger"
        confirmButtonProps={{ disabled: deleteLoading }}
      >
        {gameToDelete && (
          <Text
            style={{
              color: '#FFFFFF', // White text for visibility
              textAlign: 'center',
              marginBottom: 16,
              fontSize: 16,
              lineHeight: 24
            }}
          >
            האם אתה בטוח שברצונך למחוק את המשחק מתאריך {formatDate(gameToDelete.date)}?
            {'\n'}
            פעולה זו אינה ניתנת לביטול.
          </Text>
        )}
        {deleteError && (
          <View style={styles.deleteErrorContainer}>
            <Text style={styles.deleteErrorText}>{deleteError}</Text>
          </View>
        )}
      </Dialog>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CASINO_COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: CASINO_COLORS.primary,
    padding: 16,
    borderBottomWidth: 2,
    borderBottomColor: CASINO_COLORS.gold,
  },
  headerTitle: {
    color: CASINO_COLORS.gold,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
  },
  filtersContainer: {
    backgroundColor: CASINO_COLORS.surface,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: CASINO_COLORS.gold,
  },
  filterRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterLabel: {
    color: CASINO_COLORS.gold,
    width: 80,
    textAlign: 'right',
    marginLeft: 12,
  },
  filterControl: {
    flex: 1,
  },
  searchContainer: {
    marginTop: 8,
  },
  searchInput: {
    backgroundColor: CASINO_COLORS.background,
    borderColor: CASINO_COLORS.gold,
    color: CASINO_COLORS.text,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  gameCard: {
    backgroundColor: CASINO_COLORS.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
  },
  gameCardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 215, 0, 0.3)',
    paddingBottom: 8,
  },
  gameDate: {
    color: CASINO_COLORS.gold,
    fontSize: 16,
    fontWeight: 'bold',
  },
  gameGroup: {
    color: CASINO_COLORS.gold,
    fontSize: 16,
  },
  gameCardContent: {
    gap: 8,
  },
  gameDetail: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  gameDetailText: {
    color: CASINO_COLORS.text,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: CASINO_COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  errorCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: CASINO_COLORS.error,
    padding: 16,
    marginBottom: 16,
  },
  errorText: {
    color: CASINO_COLORS.error,
    textAlign: 'center',
  },
  deleteErrorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  deleteErrorText: {
    color: CASINO_COLORS.error,
    textAlign: 'center',
  }
});