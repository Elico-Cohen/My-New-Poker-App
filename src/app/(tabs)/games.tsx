// src/app/(tabs)/games.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Text } from '@/components/common/Text';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { Button } from '@/components/common/Button';
import { useRouter, useFocusEffect } from 'expo-router';
import { Dialog } from '@/components/common/Dialog';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { Game } from '@/models/Game';
import { getAllActiveGroups } from '@/services/groups';
import { useAuth } from '@/contexts/AuthContext';
import { useGameContext, GameStatus } from '@/contexts/GameContext';
import { getDocs, query, collection, where, orderBy, limit, deleteDoc, doc, addDoc, getDoc, connectFirestoreEmulator } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { 
  getActiveGames, 
  getLocalActiveGame, 
  clearLocalActiveGame,
  saveOrUpdateActiveGame
} from '@/services/gameSnapshot';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ActiveGameBanner from '@/components/common/ActiveGameBanner';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { useCan } from '@/hooks/useCan';

// קבוע לזיהוי המשחק הפעיל ב-AsyncStorage (העתק מהקבוע המוגדר ב-GameContext)
const ACTIVE_GAME_ID_KEY = 'active_game_id';

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
    case 'ended':
      statusText = 'בסיום';
      bgColor = '#3b82f6';
      break;
    case 'open_games':
      statusText = 'משחקים פתוחים';
      bgColor = '#f59e0b';
      break;
    case 'final_results':
      statusText = 'תוצאות סופיות';
      bgColor = '#8b5cf6';
      break;
    case 'payments':
      statusText = 'חישוב תשלומים';
      bgColor = '#ec4899';
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
  const { user, canDeleteEntity, canStartNewGame, canContinueGame, canDeleteActiveGame, canViewGameAsReadOnly } = useAuth();
  const { loadActiveGame, isLoadingGame, isNetworkConnected, determineCorrectGameScreen, clearActiveGame } = useGameContext();
  const can = useCan();
  
  // State variables
  const [activeGames, setActiveGames] = useState<Game[]>([]);
  const [recentGames, setRecentGames] = useState<Game[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [gameToDelete, setGameToDelete] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<{id: string, name: string}[]>([]);
  const [continuingGameId, setContinuingGameId] = useState<string | null>(null);
  const [permissionsRefreshKey, setPermissionsRefreshKey] = useState(0);

  // פונקציה לבדיקת חיבור Firebase
  const testFirebaseConnection = async () => {
    try {
      console.log('🔥 Testing Firebase connection...');
      
      // בדיקת חיבור לאינטרנט
      const netInfo = await NetInfo.fetch();
      console.log(`Network status: connected=${netInfo.isConnected}, type=${netInfo.type}`);
      
      // בדיקת אותנטיקציה
      console.log('Auth user:', auth.currentUser ? {
        uid: auth.currentUser.uid,
        email: auth.currentUser.email,
        emailVerified: auth.currentUser.emailVerified
      } : 'Not authenticated');
      
      // ניסיון קריאה פשוטה ל-Firestore
      const testQuery = query(collection(db, 'games'), limit(1));
      const testSnapshot = await getDocs(testQuery);
      console.log(`✅ Firebase connection test successful - found ${testSnapshot.size} documents`);
      
      return true;
    } catch (error) {
      console.error('❌ Firebase connection test failed:', error);
      return false;
    }
  };

  // פונקציה לניקוי זיכרון ישן של משחקים שטופלו
  const cleanupOldHandledGames = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const handledGameKeys = keys.filter(key => key.startsWith('handled_deleted_game_'));
      
      // בדיקה אם יש יותר מדי מפתחות של משחקים שטופלו (מעל 10)
      if (handledGameKeys.length > 10) {
        console.log(`Found ${handledGameKeys.length} handled game keys, cleaning up old ones`);
        
        // קביעה שאנחנו שומרים רק את ה-5 האחרונים
        const keysToRemove = handledGameKeys.slice(0, -5);
        await AsyncStorage.multiRemove(keysToRemove);
        
        console.log(`Cleaned up ${keysToRemove.length} old handled game keys`);
      }
    } catch (error) {
      console.error('Error cleaning up old handled games:', error);
    }
  };

  // Load games when component mounts or network status changes
  useEffect(() => {
    loadGames();
  }, [isNetworkConnected]);

  // רענון נתונים כשחוזרים למסך המשחקים (אחרי סיום משחק)
  useFocusEffect(
    useCallback(() => {
      console.log('Games screen focused - refreshing data and permissions');
      loadGames();
      
      // Force permissions re-evaluation by updating the refresh key
      // This ensures permission buttons are recalculated after returning from a game
      setPermissionsRefreshKey(prev => prev + 1);
    }, [])
  );

  // Function to load games from Firestore
  const loadGames = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('=== GAMES SCREEN: Starting loadGames ===');
      console.log('Current user:', user ? `${user.id} (${user.email})` : 'No user');
      console.log('Auth current user:', auth.currentUser ? `${auth.currentUser.uid} (${auth.currentUser.email})` : 'No auth user');
      console.log('Network connected:', isNetworkConnected);
      
      // בדיקת חיבור Firebase
      await testFirebaseConnection();
      
      // ניקוי זיכרון ישן של משחקים שטופלו (מעל 30 יום)
      await cleanupOldHandledGames();
      
      // Load groups for reference
      console.log('Loading groups...');
      const groupsData = await getAllActiveGroups();
      console.log(`Loaded ${groupsData.length} groups`);
      setGroups(groupsData);
      
      // שלב 1: טען משחקים פעילים מ-Firestore (לא completed ולא deleted)
      console.log('📥 Step 1: Loading active games from Firestore...');
      const firestoreGames = await getActiveGames();
      console.log(`📊 Found ${firestoreGames.length} active games in Firestore`);
      firestoreGames.forEach((g, index) => {
        console.log(`  [${index + 1}] ID: ${g.id}, Status: ${g.status}, CreatedBy: ${g.createdBy}`);
      });
      
      // שלב 2: בדוק אם יש משחק פעיל מקומי
      console.log('📱 Step 2: Checking for local active game...');
      const localActiveGameId = await AsyncStorage.getItem(ACTIVE_GAME_ID_KEY);
      console.log(`Local active game ID: ${localActiveGameId || 'None'}`);
      
      // שלב 3: צור מפה של משחקים סופית עם עדיפות לגרסה המקומית
      console.log('🔧 Step 3: Creating final games map with local priority...');
      const finalGamesMap = new Map<string, Game>();
      
      // הוסף את כל המשחקים מ-Firestore למפה
      firestoreGames.forEach(game => {
        console.log(`📤 Adding Firestore game: ${game.id} (status: ${game.status})`);
        finalGamesMap.set(game.id, game);
      });
      
      // שלב 4: טפל במשחק מקומי - אם קיים, העדף אותו על פני Firestore
      if (localActiveGameId) {
        console.log(`🔍 Step 4: Processing local game ${localActiveGameId}...`);
        
        try {
          // טען את המשחק המקומי
          const localGameJson = await AsyncStorage.getItem('active_game_storage');
          if (localGameJson) {
            const localGame = JSON.parse(localGameJson) as Game;
            console.log(`📱 Found local game data with status: ${localGame.status}`);
            
            // אם המשחק הזה כבר קיים ב-Firestore
            if (finalGamesMap.has(localActiveGameId)) {
              console.log('🔄 Game exists in both locations - using LOCAL version (more up-to-date)');
              // השתמש בגרסה המקומית כי היא תמיד מעודכנת יותר
              finalGamesMap.set(localActiveGameId, localGame);
            } else {
              console.log('📱 Local game not in Firestore results - adding LOCAL version');
              // הוסף את המשחק המקומי גם אם הוא לא ב-Firestore
              finalGamesMap.set(localActiveGameId, localGame);
            }
          } else {
            console.log('⚠️ Local game ID exists but no game data found - cleaning up');
            // נקה את המזהה המקומי כי אין נתונים
            await AsyncStorage.removeItem(ACTIVE_GAME_ID_KEY);
          }
        } catch (error) {
          console.error('❌ Error processing local game:', error);
        }
      }
      
      // שלב 5: המר למערך, סנן משחקים לא מושלמים ולא מחוקים
      console.log('🔧 Step 5: Converting to array and filtering...');
      const allGames = Array.from(finalGamesMap.values());
      const activeGamesData = allGames.filter(game => 
        game.status !== 'completed' && game.status !== 'deleted'
      );
      
      console.log(`📊 Final active games count: ${activeGamesData.length}`);
      activeGamesData.forEach((game, index) => {
        console.log(`  Game ${index + 1}: ${game.id} (status: ${game.status}, players: ${game.players?.length || 0})`);
      });

      setActiveGames(activeGamesData);
      
      // הלוגיקה החדשה כבר מטפלת בסנכרון בין Firestore ו-AsyncStorage
      // אז לא צריך את הקוד המורכב הישן של בדיקת משחקים חסרים
      
      // Query recent games (all games ordered by updatedAt)
      const recentGamesQuery = query(
        collection(db, 'games'),
        orderBy('updatedAt', 'desc'),
        limit(20) // Get more games so we can filter them
      );
      
      // Execute query
      const recentGamesSnapshot = await getDocs(recentGamesQuery);
      
      // Process and filter recent non-completed games
      const allRecentGames: Game[] = [];
      recentGamesSnapshot.forEach(doc => {
        allRecentGames.push({ id: doc.id, ...doc.data() } as Game);
      });
      
      // Create a set of active game IDs for quick lookup
      const activeGameIds = new Set(activeGamesData.map(game => game.id));
      
      // Filter out completed games AND active games, then take only 5
      const nonCompletedGames = allRecentGames
        .filter(game => game.status !== 'completed' && !activeGameIds.has(game.id))
        .slice(0, 5);
      
      // Update state
      setRecentGames(nonCompletedGames);
      
      console.log('=== GAMES SCREEN: Load complete ===');
      console.log(`Final active games count: ${activeGamesData.length}`);
      console.log(`Final recent games count: ${nonCompletedGames.length}`);
      
      // בדיקת כפילויות במשחקים פעילים
      if (activeGamesData.length > 1) {
        console.log('🚨 POTENTIAL DUPLICATE DETECTION 🚨');
        const gamesByDate = activeGamesData.reduce((acc, game) => {
          const dateKey = `${game.date?.day}/${game.date?.month}/${game.date?.year}`;
          if (!acc[dateKey]) acc[dateKey] = [];
          acc[dateKey].push(game);
          return acc;
        }, {} as Record<string, typeof activeGamesData>);
        
        Object.entries(gamesByDate).forEach(([dateKey, games]) => {
          if (games.length > 1) {
            console.log(`🔍 Found ${games.length} games for date ${dateKey}:`);
            games.forEach((game, i) => {
              console.log(`  Game ${i + 1}: ID=${game.id}, Status=${game.status}, CreatedAt=${game.createdAt ? new Date(game.createdAt).toLocaleString('he-IL') : 'N/A'}`);
            });
          }
        });
      }
      
      console.log('=== END GAMES SCREEN LOAD ===');
      
    } catch (error) {
      console.error('Error loading games:', error);
      console.error('Error details:', error);
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
  const handleGamePress = async (game: Game) => {
    try {
      console.log(`🎯 === GAME PRESS STARTED ===`);
      console.log(`Game ID: ${game.id}`);
      console.log(`Game Status: ${game.status}`);
      console.log(`Game CreatedBy: ${game.createdBy}`);
      console.log(`Current User ID: ${user?.id}`);
      console.log(`Current User Role: ${user?.role}`);
      
      // Show loading state
      setContinuingGameId(game.id);
      
      // בדיקת הרשאות המשתמש בהתבסס על הנתונים העדכניים
      const canContinue = canContinueGame(game);
      const canViewOnly = canViewGameAsReadOnly();
      
      console.log(`🔐 Permissions Check:`);
      console.log(`  Can Continue: ${canContinue}`);
      console.log(`  Can View Only: ${canViewOnly}`);
      
      // אם אין הרשאה לצפות, הצג שגיאה
      if (!canContinue && !canViewOnly) {
        console.log(`❌ No permissions to access this game`);
        Alert.alert(
          "אין הרשאה",
          "אין לך הרשאה לגשת למשחק זה.",
          [{ text: "הבנתי" }]
        );
        return;
      }
      
      // Load the game into GameContext
      console.log(`📥 Loading game into GameContext...`);
      const success = await loadActiveGame(game.id);
      
      if (success) {
        console.log(`✅ Game loaded successfully into GameContext`);
        
        // שימוש בפונקציה החדשה לקביעת המסך הנכון
        const targetScreen = determineCorrectGameScreen(
          game.status as GameStatus, 
          { canContinue, canViewOnly },
          game.id
        );
        
        console.log(`🎯 Target Screen: ${targetScreen}`);
        console.log(`🔄 Navigating to: ${targetScreen}`);
        
        // ניווט למסך המתאים
        router.push(targetScreen as any);
        console.log(`🎮 === GAME PRESS COMPLETED ===`);
      } else {
        console.log(`❌ Failed to load game into GameContext`);
        Alert.alert(
          "שגיאה בטעינת המשחק",
          "לא הצלחנו לטעון את המשחק. נסה שוב מאוחר יותר.",
          [{ text: "הבנתי" }]
        );
      }
    } catch (error) {
      console.error('❌ Error in handleGamePress:', error);
      Alert.alert(
        "שגיאה",
        "אירעה שגיאה בעת טעינת המשחק. נסה שוב מאוחר יותר.",
        [{ text: "הבנתי" }]
      );
    } finally {
      setContinuingGameId(null);
    }
  };
  
  // Handle deleting a game
  const handleDeleteGame = (game: Game) => {
    // Check if user has permission to delete based on game type
    const hasDeletePermission = game.status === 'completed' 
      ? canDeleteEntity('game') // Only admin can delete completed games
      : canDeleteActiveGame(game); // Admin or super user who created active games
    
    if (!hasDeletePermission) {
      Alert.alert(
        "אין הרשאה",
        game.status === 'completed' 
          ? "רק מנהל מערכת יכול למחוק משחקים שהסתיימו"
          : "אין לך הרשאה למחוק משחק זה. רק מנהל מערכת או יוצר המשחק יכולים למחוק משחקים פעילים.",
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
      console.log(`🗑️ Attempting to delete game: ${gameToDelete.id}`);
      console.log(`Game details: Status=${gameToDelete.status}, CreatedBy=${gameToDelete.createdBy}, Date=${gameToDelete.date?.day}/${gameToDelete.date?.month}/${gameToDelete.date?.year}`);
      
      // Delete the game document
      await deleteDoc(doc(db, 'games', gameToDelete.id));
      console.log(`✅ Successfully deleted game ${gameToDelete.id} from Firestore`);
      
      // אם זה משחק פעיל, נמחק גם מהאחסון המקומי ומה-GameContext
      const activeGameId = await AsyncStorage.getItem(ACTIVE_GAME_ID_KEY);
      if (activeGameId === gameToDelete.id) {
        console.log(`🧹 Clearing active game from local storage and GameContext: ${activeGameId}`);
        await AsyncStorage.removeItem(ACTIVE_GAME_ID_KEY);
        await clearLocalActiveGame();
        
        // ניקוי גם מה-GameContext כדי למנוע סנכרון חזרה
        await clearActiveGame();
        
        // סמן שהמשחק נמחק כדי למנוע סנכרון אוטומטי
        const handledGameKey = `handled_deleted_game_${gameToDelete.id}`;
        await AsyncStorage.setItem(handledGameKey, 'true');
      }
      
      // Reload games
      await loadGames();
      
      // Close dialog
      setShowDeleteDialog(false);
      setGameToDelete(null);
      
      console.log(`🎯 Game deletion completed successfully`);
    } catch (error) {
      console.error('❌ Error deleting game:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
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
    const isLoading = continuingGameId === game.id;
    
    // Re-evaluate permissions on each render (triggered by permissionsRefreshKey)
    console.log(`Evaluating permissions for game ${game.id}, refresh key: ${permissionsRefreshKey}`);
    const userCanContinue = canContinueGame(game);
    const userCanViewOnly = canViewGameAsReadOnly();
    const userCanDeleteActive = canDeleteActiveGame(game);
    const userCanDeleteEntity = canDeleteEntity('game');
    
    console.log(`Game ${game.id} permissions: continue=${userCanContinue}, viewOnly=${userCanViewOnly}, deleteActive=${userCanDeleteActive}, deleteEntity=${userCanDeleteEntity}`);
    
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
            // Show continue button only if user has permission to continue the game
            userCanContinue ? (
              <Button
                title={isLoading ? "טוען..." : "המשך משחק"}
                onPress={() => handleGamePress(game)}
                style={[styles.continueButton, isLoading && styles.loadingButton]}
                textStyle={styles.buttonText}
                disabled={isLoading}
                loading={isLoading}
              />
            ) : userCanViewOnly ? (
              <Button
                title="צפה במשחק"
                onPress={() => handleGamePress(game)}
                style={[styles.viewButton, isLoading && styles.loadingButton]}
                textStyle={styles.buttonText}
                disabled={isLoading}
                loading={isLoading}
              />
            ) : null
          ) : (
            <Button
              title="צפה בפרטים"
              onPress={() => router.push(`/history/${game.id}`)}
              style={styles.viewButton}
              textStyle={styles.buttonText}
            />
          )}
          
          {/* Show delete button with appropriate permissions */}
          {(active ? userCanDeleteActive : userCanDeleteEntity) && (
            <Button
              title="מחק"
              onPress={() => handleDeleteGame(game)}
              style={styles.deleteButton}
              textStyle={styles.buttonText}
              disabled={isLoading}
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
      
      {/* Network Status Warning */}
      {!isNetworkConnected && (
        <View style={styles.networkWarning}>
          <Icon name="wifi-off" size="medium" color="#FFD700" />
          <Text style={styles.networkWarningText}>אין חיבור לאינטרנט. חלק מהנתונים עשויים להיות לא מעודכנים.</Text>
        </View>
      )}
      
      {/* Active Game Banner - shows when there's an active game */}
      <ActiveGameBanner style={{ margin: 16, marginBottom: 8 }} />
      
      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* New Game Button */}
        <PermissionGuard
          checkPermission={() => can.startNewGame()}
          fallback={
            <TouchableOpacity 
              style={[styles.newGameButton, styles.disabledNewGameButton]}
              onPress={() => Alert.alert(
                "אין הרשאה", 
                "רק מנהל מערכת וסופר יוזר יכולים להתחיל משחק חדש.",
                [{ text: "הבנתי" }]
              )}
            >
              <Icon name="lock" size="xlarge" color="#666" />
              <Text variant="h3" style={[styles.newGameButtonText, styles.disabledNewGameButtonText]}>
                התחל משחק חדש (נדרשת הרשאה)
              </Text>
            </TouchableOpacity>
          }
        >
          <TouchableOpacity 
            style={styles.newGameButton}
            onPress={handleNewGame}
          >
            <Icon name="cards-playing-outline" size="xlarge" color="#FFD700" />
            <Text variant="h3" style={styles.newGameButtonText}>התחל משחק חדש</Text>
          </TouchableOpacity>
        </PermissionGuard>
        
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
            <Text style={styles.sectionTitle}>משחקים בתהליך</Text>
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
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  newGameButtonText: {
    color: '#FFD700',
    marginEnd: 16,
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
    flexDirection: 'row',
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
    flexDirection: 'row',
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
    marginEnd: 8,
    backgroundColor: '#35654d',
    borderColor: '#FFD700',
    borderWidth: 1,
  },
  loadingButton: {
    opacity: 0.7,
  },
  viewButton: {
    flex: 1,
    marginEnd: 8,
    backgroundColor: '#1f3a2b',
    borderColor: '#FFD700',
    borderWidth: 1,
  },
  deleteButton: {
    flex: 1,
    marginStart: 8,
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
  networkWarning: {
    backgroundColor: '#904E55',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  networkWarningText: {
    color: '#FFFFFF',
    marginEnd: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  disabledNewGameButton: {
    backgroundColor: '#444',
    borderColor: '#666',
    borderWidth: 2,
    opacity: 0.7,
  },
  disabledNewGameButtonText: {
    color: '#999',
    marginEnd: 16,
    fontSize: 24,
  },
});