// src/app/(tabs)/history.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect, Stack } from 'expo-router';
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
import ActiveGameBanner from '@/components/common/ActiveGameBanner';
import { useAuth } from '@/contexts/AuthContext';

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
  const { canDeleteEntity } = useAuth();
  
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

  // Autocomplete state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [playerSuggestions, setPlayerSuggestions] = useState<string[]>([]);

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
      console.warn('processGame: Invalid game object, skipping:', game);
      return null;
    }
    
    console.log(`processGame: מעבד משחק ${game.id}, status: ${game.status}`);
    
    try {
      // יצירת עותק בטוח
      const safeGame = { ...game };
      
      // וידוא שיש מערכים
      safeGame.players = Array.isArray(safeGame.players) ? safeGame.players : [];
      safeGame.payments = Array.isArray(safeGame.payments) ? safeGame.payments : [];
      
      // הדפסת האובייקט המלא לאיתור הבעיה
      console.log(`processGame: Game ${game.id} fields:`, Object.keys(safeGame));
      console.log(`processGame: Game ${game.id} players count: ${safeGame.players.length}`);
      
      // טיפול בעקביות של שדות התאריך
      const dateSource = safeGame.gameDate || safeGame.date;
      console.log(`processGame: Game ID ${game.id}, date source:`, dateSource);
      
      if (!dateSource || typeof dateSource !== 'object') {
        console.warn(`processGame: Game ${game.id} missing date fields, using createdAt or default`);
        
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
      
      console.log(`processGame: Game ${game.id} processed successfully with date:`, safeGame.date);
      return safeGame;
    } catch (err) {
      console.error(`processGame: Error processing game ${game?.id}:`, err);
      return null;
    }
  };

  // Fetch all games once, then filter client-side
  const fetchAllGames = async () => {
    try {
      console.log('History: טוען משחקים ממנהל הנתונים המרכזי');
      
      // נקה מטמון כדי לוודא נתונים רעננים
      gameDataManager.clearGamesCache();
      
      // בדיקה נוספת: נראה כמה משחקים יש בכלל (כולל לא מושלמים)
      console.log('History: בודק כמה משחקים יש בכלל ב-Firestore...');
      const allGamesIncludingIncomplete = await gameDataManager.fetchAllGames({ 
        skipCache: true,
        onlyCompleted: false  // כל המשחקים
      });
      console.log(`History: סה"כ משחקים בכלל ב-Firestore (כולל לא מושלמים): ${allGamesIncludingIncomplete.length}`);
      
      const allGames = await gameDataManager.fetchAllGames({ 
        skipCache: true,  // אילץ רענון חד פעמי
        onlyCompleted: true  // הצגת משחקים שהושלמו בלבד
      });
      
      console.log(`History: gameDataManager החזיר ${allGames.length} משחקים מושלמים`);
      console.log(`History: הפרש: ${allGamesIncludingIncomplete.length - allGames.length} משחקים לא מושלמים`);
      
      // הצגת המשחקים הלא מושלמים
      const incompleteGames = allGamesIncludingIncomplete.filter(game => game.status !== 'completed');
      if (incompleteGames.length > 0) {
        console.log('History: משחקים לא מושלמים:');
        incompleteGames.forEach(game => {
          console.log(`- ${game.id}: status=${game.status}, players=${game.players?.length || 0}`);
        });
      }
      
      // gameDataManager כבר מעבד את המשחקים ומטפל בפורמט התאריך
      // אז אנחנו פשוט נחזיר את התוצאות ישירות
      
      console.log(`History: החזיר ${allGames.length} משחקים מעובדים מ-gameDataManager`);
      return allGames;
    } catch (error) {
      console.error('History: שגיאה בהבאת כל המשחקים:', error);
      throw error;
    }
  };

  // Function to apply current filters to a list of games and update state
  const applyFiltersAndSetState = (gamesToFilter: Game[]) => {
    console.log('Applying filters');
    if (gamesToFilter.length === 0) {
      console.log('No games to filter');
      setFilteredGames([]); // Ensure filtered list is empty if source is empty
      return;
    }
    
    try {
      // Start with the provided games
      let result = [...gamesToFilter];
      console.log(`Filtering ${result.length} games`);
      
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
              player.name.toLowerCase().includes(query)
            );
          } catch (err) {
            console.warn('Error filtering game by player name:', err);
            return false;
          }
        });
        console.log(`After search filter: ${result.length} games`);
      }
      
      setFilteredGames(result);
      console.log(`Filtered games count: ${result.length}`);
    } catch (err) {
      console.error('Error applying filters:', err);
      // Optionally set an error state here
      setFilteredGames([]); // Reset filtered games on error
    }
  };

  // Handle game deletion
  const handleDeleteGame = async () => {
    if (!gameToDelete) return;
    
    try {
      setDeleteLoading(true);
      setDeleteError(null);
      
      // Call the delete service
      console.log(`History: Deleting game ${gameToDelete.id}`);
      await deleteGame(gameToDelete.id);
      console.log(`History: Game ${gameToDelete.id} deleted successfully`);
      
      // נקה את המטמון לפני רענון הנתונים
      console.log('History: Clearing cache before refresh...');
      gameDataManager.clearGamesCache();
      
      // Refetch the games list to update the UI
      console.log('History: Refetching games after deletion...');
      const updatedGames = await gameDataManager.fetchAllGames({ 
        skipCache: true,  // אילץ רענון מ-Firestore
        onlyCompleted: true
      });
      
      console.log(`History: After deletion, fetched ${updatedGames.length} games`);
      
      // עדכן את רשימת המשחקים הראשית
      setAllGames(updatedGames);
      
      // החל פילטרים על הרשימה המעודכנת
      applyFiltersAndSetState(updatedGames);
      
      console.log(`History: Updated UI with ${updatedGames.length} games after deletion`);

      // Clear deletion state and close dialog
      setGameToDelete(null);
      setDeleteDialogVisible(false);
      
    } catch (error) {
      console.error('History: Error deleting game:', error);
      setDeleteError('מחיקת המשחק נכשלה. אנא נסה שוב מאוחר יותר.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Add useFocusEffect to refresh data when screen is focused after a potential change
  useFocusEffect(
    React.useCallback(() => {
      console.log('History screen focused, checking for refresh param...');
      if (refresh === 'true') {
        console.log('Refresh param found, reloading data...');
        loadData();
        // Optionally, navigate back or remove the param to prevent multiple refreshes
        // router.setParams({ refresh: undefined }); 
      }
    }, [refresh])
  );

  // Renamed loadData to be callable explicitly
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
      
      // Load all games at once using gameDataManager directly
      console.log('Loading games using gameDataManager...');
      const allGamesData = await gameDataManager.fetchAllGames({
        skipCache: false,  // שימוש במטמון אם זמין
        onlyCompleted: true
      });
      console.log(`Loaded ${allGamesData.length} completed games`);
      
      setAllGames(allGamesData);
      // Apply initial filters
      applyFiltersAndSetState(allGamesData);
      
    } catch (err) {
      console.error('Failed to load history data:', err);
      setError('טעינת הנתונים נכשלה. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  // Original useEffect that called loadData - now just calls it once or on refresh
  useEffect(() => {
    loadData();
  }, [refresh]);

  // רענון נתונים כשחוזרים למסך ההיסטוריה (אחרי סיום משחק)
  useFocusEffect(
    useCallback(() => {
      console.log('History screen focused - refreshing data');
      loadData();
    }, [])
  );
  
  // Apply filters when they change
  useEffect(() => {
    // Call the filtering function whenever filters or the base list change
    applyFiltersAndSetState(allGames);
  }, [allGames, selectedGroup, selectedPeriod, searchQuery]); // Dependencies include allGames and filters

  // Get unique player names based on selected group filter
  const getFilteredPlayerNames = useCallback((): string[] => {
    let gamesToSearch = allGames;

    // Filter by group if a specific group is selected
    if (selectedGroup !== 'all') {
      gamesToSearch = allGames.filter(game => game.groupId === selectedGroup);
    }

    // Extract unique player names
    const playerNamesSet = new Set<string>();
    gamesToSearch.forEach(game => {
      if (game.players && Array.isArray(game.players)) {
        game.players.forEach(player => {
          if (player.name) {
            playerNamesSet.add(player.name);
          }
        });
      }
    });

    return Array.from(playerNamesSet).sort((a, b) => a.localeCompare(b, 'he'));
  }, [allGames, selectedGroup]);

  // Update suggestions when search query changes
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      const allPlayerNames = getFilteredPlayerNames();
      const query = searchQuery.toLowerCase();

      // Check if the query is an exact match to a player name (user selected from suggestions)
      const isExactMatch = allPlayerNames.some(name =>
        name.toLowerCase() === query
      );

      if (isExactMatch) {
        // Don't show suggestions if user already selected a player
        setPlayerSuggestions([]);
        setShowSuggestions(false);
      } else {
        // Show matching suggestions
        const matches = allPlayerNames.filter(name =>
          name.toLowerCase().includes(query)
        );
        setPlayerSuggestions(matches);
        setShowSuggestions(matches.length > 0);
      }
    } else {
      setPlayerSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchQuery, getFilteredPlayerNames]);

  // Handle suggestion selection
  const handleSelectSuggestion = (playerName: string) => {
    setSearchQuery(playerName);
    setShowSuggestions(false);
  };
  
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
        <View style={styles.headerContainer}>
          <TouchableOpacity onPress={loadData} style={styles.refreshButton}>
            <Icon name="refresh" size={28} color={CASINO_COLORS.gold} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>היסטוריית משחקים</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.loadingContainer}>
          <LoadingIndicator text="טוען היסטוריה..." />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false, header: () => null }} />
      
      {/* Header with Refresh Button */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={loadData} style={styles.refreshButton}>
          <Icon name="refresh" size={28} color={CASINO_COLORS.gold} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>היסטוריית משחקים</Text>
        {/* Placeholder to balance the title */}
        <View style={{ width: 44 }} /> 
      </View>

      {/* Active Game Banner - shows when there's an active game */}
      <ActiveGameBanner style={{ margin: 16, marginBottom: 8 }} />

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
            onChangeText={(text) => {
              setSearchQuery(text);
              if (text.trim().length === 0) {
                setShowSuggestions(false);
              }
            }}
            onFocus={() => {
              if (searchQuery.trim().length > 0 && playerSuggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            placeholder="חיפוש לפי שם שחקן..."
            style={styles.searchInputWrapper}
            inputStyle={styles.searchInputText}
            clearable={true}
            onClear={() => {
              setSearchQuery('');
              setShowSuggestions(false);
            }}
          />
        </View>
      </View>

      {/* Autocomplete suggestions dropdown - positioned outside filters for better z-index on mobile */}
      {showSuggestions && playerSuggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <ScrollView
            style={styles.suggestionsList}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
          >
            {playerSuggestions.map((playerName, index) => (
              <TouchableOpacity
                key={`${playerName}-${index}`}
                style={styles.suggestionItem}
                onPress={() => handleSelectSuggestion(playerName)}
              >
                <Icon name="account" size="small" color={CASINO_COLORS.gold} />
                <Text style={styles.suggestionText}>{playerName}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Display Filtered Games Count */}
      <View style={styles.countContainer}>
        <Text style={styles.countText}>
          {`נמצאו ${filteredGames.length} משחקים`}
        </Text>
      </View>

      {/* Games List */}
      <ScrollView
        style={styles.scrollView}
        onScrollBeginDrag={() => setShowSuggestions(false)}
      >
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
                    // Only allow deletion if user has permission
                    if (canDeleteEntity('game')) {
                      setGameToDelete(game);
                      setDeleteDialogVisible(true);
                    } else {
                      Alert.alert(
                        "אין הרשאה", 
                        "רק מנהל מערכת יכול למחוק משחקים.", 
                        [{ text: "הבנתי" }]
                      );
                    }
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
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: CASINO_COLORS.primary,
    borderBottomWidth: 2,
    borderBottomColor: CASINO_COLORS.gold,
  },
  headerTitle: {
    color: CASINO_COLORS.gold,
    fontSize: 20,
    fontWeight: 'bold',
  },
  refreshButton: {
    padding: 8,
  },
  filtersContainer: {
    backgroundColor: CASINO_COLORS.surface,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: CASINO_COLORS.gold,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterLabel: {
    color: CASINO_COLORS.gold,
    width: 80,
    textAlign: 'right',
    marginStart: 12,
  },
  filterControl: {
    flex: 1,
  },
  searchContainer: {
    marginTop: 8,
  },
  searchInputWrapper: {
    // No border here - handled by inputStyle
  },
  searchInputText: {
    backgroundColor: CASINO_COLORS.background,
    color: '#FFFFFF',
    minHeight: 48,
    fontSize: 16,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
    borderRadius: 8,
  },
  suggestionsContainer: {
    marginHorizontal: 16,
    backgroundColor: CASINO_COLORS.surface,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
    borderRadius: 8,
    maxHeight: 200,
    zIndex: 100,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 215, 0, 0.2)',
    gap: 12,
  },
  suggestionText: {
    color: CASINO_COLORS.text,
    fontSize: 16,
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
    flexDirection: 'row',
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
    flexDirection: 'row',
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
  },
  countContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    alignItems: 'flex-end',
  },
  countText: {
    color: CASINO_COLORS.gold,
    fontSize: 16,
  },
});