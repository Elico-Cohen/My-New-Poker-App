// src/app/gameFlow/GameManagement.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  BackHandler,
  Keyboard,
  KeyboardEvent,
  StyleSheet,
  FlatList,
  Alert
} from 'react-native';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { Dialog } from '@/components/common/Dialog';
import { useRouter } from 'expo-router';
import { useGameContext, GameData, Player } from '@/contexts/GameContext';
import { calculateInitialGameSummary } from '@/calculations/legacy';
import AddExternalPlayerDialog from '@/components/dashboard/AddExternalPlayerDialog';
import { getActiveUsers, getAllUsers } from '@/services/users';
import { getGroupPlayers } from '@/services/groups';
import { createNewPlayerAndAddToGroup } from '@/services/playerManagement/playerManagement';
import { Modal as RNModal } from 'react-native';
import { SaveIndicator } from '@/components/common/SaveIndicator';
import { PlayerInGame } from '@/models/Game';
import { useAuth } from '@/contexts/AuthContext';
import { ReadOnlyIndicator } from '@/components/auth/ReadOnlyIndicator';
import { useReadOnlyMode } from '@/components/auth/ProtectedRoute';
import { useCan } from '@/hooks/useCan';

// Types
interface RebuyLog {
  id: string;
  playerId: string;
  playerName: string;
  action: 'add' | 'remove';
  time: string;
}

interface AvailablePlayer {
  id: string;
  name: string;
  type: 'group' | 'external';
}

// PlayerCard Component
const PlayerCard: React.FC<{
  player: Player;
  onIncrement: () => void;
  onDecrement: () => void;
  onFinalChipsChange: (value: string) => void;
  buyInAmount: number;
  rebuyAmount: number;
  canEdit: boolean;
}> = ({ player, onIncrement, onDecrement, onFinalChipsChange, buyInAmount, rebuyAmount, canEdit }) => {
  const totalInvestment = (player.buyInCount * buyInAmount) + (player.rebuyCount * rebuyAmount);
  
  return (
    <View style={styles.playerCard}>
      <View style={styles.topRow}>
        <View style={styles.financialColumn}>
          <Text style={styles.financialText}>Buy-In: {player.buyInCount * buyInAmount} ₪</Text>
          <Text style={styles.financialText}>Rebuy: {player.rebuyCount * rebuyAmount} ₪</Text>
          <Text style={styles.financialText}>Total: {totalInvestment} ₪</Text>
        </View>
        <View style={styles.nameColumn}>
          <Text variant="h4" style={styles.playerName}>{player.name}</Text>
        </View>
      </View>

      <View style={styles.rebuyRow}>
        <TouchableOpacity
          onPress={onDecrement}
          disabled={!canEdit || player.rebuyCount === 0}
          style={[styles.actionBtn, (!canEdit || player.rebuyCount === 0) && styles.disabledButton]}
        >
          <Icon name="minus" size="medium" color={canEdit ? "#FFD700" : "#666"} />
        </TouchableOpacity>
        <Text style={styles.rebuyCount}>{player.rebuyCount}</Text>
        <TouchableOpacity 
          onPress={onIncrement} 
          disabled={!canEdit}
          style={[styles.actionBtn, !canEdit && styles.disabledButton]}
        >
          <Icon name="plus" size="medium" color={canEdit ? "#FFD700" : "#666"} />
        </TouchableOpacity>
      </View>

      <View style={styles.finalChipsFull}>
        <Text style={styles.finalLabel}>Final Chips:</Text>
        <TextInput
          style={[styles.finalChipsInputFull, !canEdit && styles.disabledInput]}
          placeholder="0"
          keyboardType="numeric"
          value={player.finalChips}
          onChangeText={onFinalChipsChange}
          maxLength={8}
          editable={canEdit}
        />
      </View>
    </View>
  );
};

// Main Component
export default function GameManagement() {
  const router = useRouter();
  const { user, canAddPlayerToGame } = useAuth();
  const { isReadOnlyMode } = useReadOnlyMode();
  const { manageGame } = useCan();
  const { 
    gameData, 
    setGameData, 
    saveActiveGame, 
    updateGameStatus, 
    saveStatus, 
    isNetworkConnected,
    clearActiveGame,
    canUserContinueThisGame
  } = useGameContext();

  const players = gameData.players || [];
  const rebuyLogs = gameData.rebuyLogs || [];
  const gameDate = gameData.gameDate;
  const groupName = gameData.groupNameSnapshot || '';
  const buyInAmount = gameData.buyInSnapshot?.amount || 0;
  const rebuyAmount = gameData.rebuySnapshot?.amount || 0;
  
  // בדיקת הרשאות עריכה
  const canEdit = canUserContinueThisGame(gameData) && manageGame(gameData);

  // Dialog States
  const [dialogVisible, setDialogVisible] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showAddPlayerDialog, setShowAddPlayerDialog] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Player Management States
  const [availablePlayers, setAvailablePlayers] = useState<AvailablePlayer[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [showNewPlayerDialog, setShowNewPlayerDialog] = useState(false);
  const [newPlayerData, setNewPlayerData] = useState({ name: '', phone: '', email: '' });
  const [newPlayerError, setNewPlayerError] = useState<string | null>(null);
  const [newPlayerEmailError, setNewPlayerEmailError] = useState<string | null>(null);
  const [addPlayerError, setAddPlayerError] = useState<string | null>(null);

  // Ref to track pending timeouts for cleanup
  const playerDialogTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (playerDialogTimeoutRef.current) {
        clearTimeout(playerDialogTimeoutRef.current);
        console.log('GameManagement: Cleaned up player dialog timeout on unmount');
      }
    };
  }, []);

  // Keyboard Event Handlers
  useEffect(() => {
    const keyboardWillShow = (e: KeyboardEvent) => {
      setKeyboardHeight(e.endCoordinates.height);
      setKeyboardVisible(true);
    };

    const keyboardWillHide = () => {
      setKeyboardHeight(0);
      setKeyboardVisible(false);
    };

    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      keyboardWillShow
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      keyboardWillHide
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // Back Handler
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        setShowExitDialog(true);
        return true;
      }
    );
    return () => backHandler.remove();
  }, []);

  // Player Management Functions
  const loadAvailablePlayers = async () => {
    try {
      setAddPlayerError(null);
      const allUsers = await getAllUsers();
      const { permanent, guests } = await getGroupPlayers(gameData.groupId);
      const groupIds = new Set([...permanent, ...guests]);
      
      // Get current game player IDs
      const currentGamePlayerIds = new Set(players.map(p => p.id));
      
      // Filter out players already in the game
      const availableUsers = allUsers
        .filter(user => !currentGamePlayerIds.has(user.id) && user.isActive)
        .map(user => ({
          id: user.id,
          name: user.name,
          isFromGroup: groupIds.has(user.id)
        }));
  
      // Set the available players
      setAvailablePlayers(availableUsers as any);
      setSelectedPlayerIds([]);
    } catch (error) {
      console.error('Error loading available players:', error);
      setAddPlayerError('טעינת רשימת השחקנים נכשלה');
    }
  };

  const handleAddPlayers = () => {
    try {
      if (players.length + selectedPlayerIds.length > 13) {
        setAddPlayerError('לא ניתן להוסיף שחקנים נוספים - הגעת למקסימום המותר');
        return;
      }

      const newPlayers = selectedPlayerIds.map(id => {
        const player = availablePlayers.find(p => p.id === id);
        if (!player) throw new Error(`Player with id ${id} not found`);
        
        return {
          id: player.id,
          name: player.name,
          buyInCount: 1,
          rebuyCount: 0,
          finalChips: '',
        };
      });

      setGameData(prev => ({
        ...prev,
        players: [...prev.players, ...newPlayers]
      }));

      setShowAddPlayerDialog(false);
      setSelectedPlayerIds([]);
      setAddPlayerError(null);
    } catch (error) {
      console.error('Error adding players:', error);
      setAddPlayerError('הוספת השחקנים נכשלה');
    }
  };

  const handleNewPlayer = async () => {
    try {
      setNewPlayerError(null);
      setNewPlayerEmailError(null);

      if (!newPlayerData.name.trim()) {
        setNewPlayerError('יש להזין שם שחקן');
        return;
      }

      if (newPlayerData.email.trim() && !/\\S+@\\S+\\.\\S+/.test(newPlayerData.email.trim())) {
        setNewPlayerEmailError('כתובת אימייל אינה תקינה');
        return;
      }

      if (players.length >= 13) {
        setNewPlayerError('לא ניתן להוסיף שחקנים נוספים - הגעת למקסימום המותר');
        return;
      }

      const newUserId = await createNewPlayerAndAddToGroup(
        {
          name: newPlayerData.name.trim(),
          phone: newPlayerData.phone.trim(),
          email: newPlayerData.email.trim() ? newPlayerData.email.trim() : undefined
        }, 
        gameData.groupId
      );
      
      const newPlayer = {
        id: newUserId,
        name: newPlayerData.name.trim(),
        buyInCount: 1,
        rebuyCount: 0,
        finalChips: '',
      };

      setGameData(prev => ({
        ...prev,
        players: [...prev.players, newPlayer]
      }));

      // Check if email was provided to show appropriate message
      if (newPlayerData.email.trim()) {
        setNewPlayerError('✅ השחקן נוצר בהצלחה עם אימייל! המערכת תתנתק אוטומטית כדי לשמור על אבטחת המערכת. תוכל להתחבר מחדש כאדמין תוך כמה שניות.');

        // Clear any existing timeout
        if (playerDialogTimeoutRef.current) {
          clearTimeout(playerDialogTimeoutRef.current);
        }

        // Close dialog after showing success message
        playerDialogTimeoutRef.current = setTimeout(() => {
          setNewPlayerData({ name: '', phone: '', email: '' });
          setNewPlayerError(null);
          setNewPlayerEmailError(null);
          setShowNewPlayerDialog(false);
          setShowAddPlayerDialog(false);
          playerDialogTimeoutRef.current = null;
        }, 3000);
      } else {
        // Regular success for player without email
        setNewPlayerData({ name: '', phone: '', email: '' });
        setNewPlayerError(null);
        setNewPlayerEmailError(null);
        setShowNewPlayerDialog(false);
        setShowAddPlayerDialog(false);
      }
    } catch (error: any) {
      if (error.message && error.message.toLowerCase().includes('אימייל')) {
        setNewPlayerEmailError(error.message);
      } else if (error.message && error.message.toLowerCase().includes('שם')) {
        setNewPlayerError(error.message);
      }
      else {
      setNewPlayerError(error.message || 'שגיאה ביצירת שחקן חדש');
      }
    }
  };

  // Game Management Functions
  const formatGameDate = (date: any): string => {
    if (!date) return '';
    
    if (date instanceof Date) {
      return date.toLocaleDateString('he-IL');
    }
    
    if (date.year && date.month && date.day) {
      const formattedDate = new Date(date.year, date.month - 1, date.day);
      return formattedDate.toLocaleDateString('he-IL');
    }
    
    return '';
  };

  const updateRebuy = (playerId: string, delta: number) => {
    if (!canEdit) {
      Alert.alert(
        "אין הרשאה",
        "אין לך הרשאה לערוך את המשחק הזה.",
        [{ text: "הבנתי" }]
      );
      return;
    }
    
    setGameData((prev: GameData): GameData => ({
      ...prev,
      players: prev.players.map((p) => {
        if (p.id === playerId) {
          return {
            ...p,
            rebuyCount: Math.max(0, p.rebuyCount + delta),
            isHighlighted: true
          };
        }
        return { ...p, isHighlighted: false };
      }),
      rebuyLogs: [
        {
          id: Date.now().toString(),
          playerId,
          playerName: players.find(p => p.id === playerId)?.name || '',
          action: delta > 0 ? 'add' : 'remove',
          time: new Date().toLocaleTimeString('he-IL', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })
        },
        ...prev.rebuyLogs,
      ]
    }));
  };

  const updateFinalChips = (playerId: string, value: string) => {
    if (!canEdit) {
      Alert.alert(
        "אין הרשאה",
        "אין לך הרשאה לערוך את המשחק הזה.",
        [{ text: "הבנתי" }]
      );
      return;
    }
    
    // Clean the input: remove all non-digit characters and trim whitespace
    const cleanValue = value.trim().replace(/\D/g, '');
    
    // If original value had non-digits and we cleaned it, use the cleaned version
    const finalValue = cleanValue;
    
    console.log(`updateFinalChips: playerId=${playerId}, originalValue="${value}", cleanValue="${cleanValue}"`);
    
    setGameData((prev: GameData): GameData => ({
      ...prev,
      players: prev.players.map(p => 
        p.id === playerId ? { ...p, finalChips: finalValue } : p
      )
    }));
  };

  const allFinalChipsEntered = players.every(
    (p) => p.finalChips && p.finalChips.trim() !== ''
  );

  const finishGame = async () => {
    if (!canEdit) {
      Alert.alert(
        "אין הרשאה",
        "אין לך הרשאה לסיים את המשחק הזה.",
        [{ text: "הבנתי" }]
      );
      return;
    }
    
    if (!allFinalChipsEntered) return;

    try {
      console.log('GameManagement: Starting finish game process');
      
      const summary = calculateInitialGameSummary(
        players,
        gameData.buyInSnapshot,
        gameData.rebuySnapshot,
        gameData.useRoundingRule,
        gameData.roundingRulePercentage
      );

      const needsOpenGames = gameData.useRoundingRule && 
                           summary.openGamesCount > 0;

      const newStatus = needsOpenGames ? 'ended' : 'final_results';

      // עדכון הנתונים בצורה אטומית - ללא קריאות נפרדות
      const updatedGameData: GameData = {
        ...gameData,
        players: summary.playersResults,
        totalWins: summary.totalWins,
        totalLosses: summary.totalLosses,
        difference: summary.difference,
        openGamesCount: summary.openGamesCount,
        status: newStatus
      };

      setGameData(updatedGameData);

      console.log(`GameManagement: Game status updated to ${newStatus}, navigating to next screen`);

      // ניווט ללא עדכון סטטוס נפרד - כי כבר עדכנו ב-setGameData
      if (needsOpenGames) {
        router.push('/gameFlow/InitialResults');
      } else {
        router.push('/gameFlow/FinalResults');
      }
    } catch (error) {
      console.error('GameManagement: Error finishing game:', error);
      Alert.alert(
        "שגיאה",
        "אירעה שגיאה בסיום המשחק. נסה שוב.",
        [{ text: "הבנתי" }]
      );
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setShowExitDialog(true)}
        >
          <Icon name="arrow-right" size="medium" color="#FFD700" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerSubText}>ניהול משחק</Text>
          <Text style={styles.groupName}>{groupName}</Text>
          <Text style={styles.headerSubText}>{formatGameDate(gameDate)}</Text>
        </View>
        <View style={styles.homeButtonContainer}>
          <TouchableOpacity
            style={styles.homeButton}
            onPress={() => router.push('/(tabs)/home2')}
          >
            <Icon name="home" size="medium" color="#FFD700" />
          </TouchableOpacity>
          <View style={styles.saveIndicatorContainer}>
            <SaveIndicator status={saveStatus} />
            {!isNetworkConnected && (
              <Icon name="wifi-off" size="small" color="#FFD700" />
            )}
          </View>
        </View>
      </View>

      <ReadOnlyIndicator />

      {/* Action Buttons Bar */}
      <View style={styles.actionButtonsBar}>
        {canAddPlayerToGame(gameData) ? (
          <Button
            title="הוסף שחקן"
            icon="account-plus"
            onPress={() => {
              loadAvailablePlayers();
              setShowAddPlayerDialog(true);
            }}
            style={styles.actionButton}
            textStyle={styles.actionButtonText}
            disabled={players.length >= 13}
          />
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, styles.disabledButton]}
            onPress={() => {
              Alert.alert(
                "אין הרשאה",
                "רק מנהל מערכת או יוצר המשחק יכולים להוסיף שחקנים.",
                [{ text: "הבנתי" }]
              );
            }}
          >
            <Icon name="account-plus" size="medium" color="#666" />
            <Text style={[styles.actionButtonText, { color: '#666' }]}>הוסף שחקן</Text>
          </TouchableOpacity>
        )}
        <Button
          title="לוג ריבאיים"
          icon="clipboard-list"
          onPress={() => setDialogVisible(true)}
          style={styles.actionButton}
          textStyle={styles.actionButtonText}
        />
      </View>

      {/* Main Scrollable Content */}
      <View style={{ flex: 1 }}>
        <ScrollView 
          style={styles.mainContent}
          contentContainerStyle={[
            styles.scrollContainer,
            { paddingBottom: 100 }
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {players.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              onIncrement={() => updateRebuy(player.id, 1)}
              onDecrement={() => updateRebuy(player.id, -1)}
              onFinalChipsChange={(value) => updateFinalChips(player.id, value)}
              buyInAmount={buyInAmount}
              rebuyAmount={rebuyAmount}
              canEdit={canEdit}
            />
          ))}
        </ScrollView>

        {/* Fixed Bottom Button */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "position" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          <View style={styles.fixedButtonContainer}>
            {canEdit ? (
              <TouchableOpacity
                onPress={finishGame}
                disabled={!allFinalChipsEntered}
                style={[
                  styles.startButton,
                  { backgroundColor: allFinalChipsEntered ? '#00008B' : '#555' }
                ]}
              >
                <Text variant="bodyLarge" style={styles.startButtonText}>
                  {allFinalChipsEntered
                    ? "סיים משחק"
                    : "לסיום המשחק הזן כמות צ'יפים סופית לכל השחקנים"}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.startButton, { backgroundColor: '#666' }]}
                onPress={() => {
                  Alert.alert(
                    "אין הרשאה",
                    "אין לך הרשאה לסיים את המשחק הזה.",
                    [{ text: "הבנתי" }]
                  );
                }}
              >
                <Text variant="bodyLarge" style={[styles.startButtonText, { color: '#AAA' }]}>
                  אין הרשאה לסיים משחק
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>

      {/* Custom Modal Implementation for Rebuy Log */}
      <RNModal
        visible={dialogVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDialogVisible(false)}
      >
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        }}>
          <View style={{
            width: '90%',
            maxHeight: '80%',
            backgroundColor: '#0D1B1E',
            borderRadius: 10,
            borderWidth: 2,
            borderColor: '#FFD700',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <View style={{
              backgroundColor: '#35654d',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: '#FFD700',
              alignItems: 'center',
            }}>
              <Text style={{
                color: '#FFD700',
                fontSize: 20,
                fontWeight: 'bold',
              }}>לוג ריבאיים</Text>
            </View>
            
            {/* Content */}
            <View style={{
              maxHeight: 400,
              padding: 10,
            }}>
              <ScrollView style={{
                backgroundColor: '#1C2C2E',
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#FFD700',
                maxHeight: 300,
              }}>
                {rebuyLogs.length > 0 ? (
                  rebuyLogs.map((log) => (
                    <View key={log.id} style={{
                      padding: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: 'rgba(255, 215, 0, 0.2)',
                      marginBottom: 5,
                    }}>
                      <Text style={{
                        color: '#FFD700',
                        textAlign: 'right',
                      }}>
                        {log.time} - {log.playerName}: {log.action === 'add' ? "הוסיף" : "הפחית"} ריבאיי
                      </Text>
                    </View>
                  ))
                ) : (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={{ color: '#B8B8B8' }}>
                      אין רישומי ריבאיים עדיין
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
            
            {/* Footer */}
            <View style={{
              padding: 10,
              borderTopWidth: 1,
              borderTopColor: '#FFD700',
              alignItems: 'center',
            }}>
              <TouchableOpacity 
                style={{
                  backgroundColor: '#35654d',
                  paddingVertical: 10,
                  paddingHorizontal: 20,
                  borderRadius: 5,
                  borderWidth: 1,
                  borderColor: '#FFD700',
                }}
                onPress={() => setDialogVisible(false)}
              >
                <Text style={{ color: '#FFD700' }}>סגור</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </RNModal>

      {/* Exit Dialog */}
      <Dialog
        visible={showExitDialog}
        title="יציאה מהמשחק"
        confirmText="צא"
        cancelText="המשך משחק"
        onConfirm={async () => {
          setShowExitDialog(false);
          await clearActiveGame();
          router.push('/(tabs)/games');
        }}
        onCancel={() => setShowExitDialog(false)}
        message="האם אתה בטוח שברצונך לצאת? כל השינויים שלך יאבדו."
      >
        <Text style={styles.exitDialogText}>
          האם אתה בטוח שברצונך לצאת? כל השינויים שלך יאבדו.
        </Text>
      </Dialog>

      {/* Add Player Dialog */}
      <AddExternalPlayerDialog
        visible={showAddPlayerDialog}
        externalPlayers={availablePlayers}
        selectedExternalPlayerIds={selectedPlayerIds}
        onToggleSelection={(playerId) => {
          if (selectedPlayerIds.includes(playerId)) {
            setSelectedPlayerIds(prev => prev.filter(id => id !== playerId));
          } else if (players.length + selectedPlayerIds.length < 13) {
            setSelectedPlayerIds(prev => [...prev, playerId]);
          }
        }}
        onConfirm={handleAddPlayers}
        onAddNew={() => {
          setShowNewPlayerDialog(true);
          setNewPlayerData({ name: '', phone: '', email: '' });
          setNewPlayerError(null);
          setNewPlayerEmailError(null);
        }}
        onCancel={() => {
          setShowAddPlayerDialog(false);
          setSelectedPlayerIds([]);
          setAddPlayerError(null);
        }}
      />

      {/* New Player Dialog */}
      <Dialog
        visible={showNewPlayerDialog}
        title="הוסף שחקן חדש"
        onConfirm={() => {
          if (newPlayerData.name.trim() && !newPlayerError && !newPlayerEmailError) {
            handleNewPlayer();
          }
        }}
        confirmText="הוסף"
        cancelText="ביטול"
        onCancel={() => {
          setShowNewPlayerDialog(false);
          setNewPlayerData({ name: '', phone: '', email: '' });
          setNewPlayerError(null);
          setNewPlayerEmailError(null);
        }}
        confirmButtonProps={{
          disabled: Boolean(!newPlayerData.name.trim() || newPlayerError !== null || newPlayerEmailError !== null)
        }}
        message="הזן את פרטי השחקן החדש"
      >
        <View style={styles.newPlayerContainer}>
          <Text style={styles.inputLabel}>שם השחקן</Text>
          <TextInput
            style={styles.newPlayerInput}
            value={newPlayerData.name}
            onChangeText={(text) => {
              setNewPlayerData(prev => ({ ...prev, name: text }));
              if (!text.trim()) {
                setNewPlayerError('יש להזין שם שחקן');
              } else {
                setNewPlayerError(null);
              }
            }}
            placeholder="הכנס שם שחקן"
            placeholderTextColor="#666"
          />
          {newPlayerError && !newPlayerError.toLowerCase().includes('אימייל') && (
            <Text style={styles.errorText}>{newPlayerError}</Text>
          )}
          <Text style={styles.inputLabel}>טלפון (אופציונלי)</Text>
          <TextInput
            style={styles.newPlayerInput}
            value={newPlayerData.phone}
            onChangeText={(text) => setNewPlayerData(prev => ({ ...prev, phone: text }))}
            placeholder="הכנס מספר טלפון"
            placeholderTextColor="#666"
            keyboardType="phone-pad"
          />
          <Text style={styles.inputLabel}>אימייל (אופציונלי)</Text>
          <TextInput
            style={styles.newPlayerInput}
            value={newPlayerData.email}
            onChangeText={(text) => {
              setNewPlayerData(prev => ({ ...prev, email: text }));
              if (text.trim() && !/\\S+@\\S+\\.\\S+/.test(text.trim())) {
                setNewPlayerEmailError('כתובת אימייל אינה תקינה');
              } else {
                setNewPlayerEmailError(null);
              }
            }}
            placeholder="הכנס אימייל"
            placeholderTextColor="#666"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {newPlayerEmailError && (
            <Text style={styles.errorText}>{newPlayerEmailError}</Text>
          )}
          {newPlayerError && !newPlayerError.toLowerCase().includes('שם') && !newPlayerError.toLowerCase().includes('אימייל') && (
            <Text style={styles.errorText}>{newPlayerError}</Text>
          )}
        </View>
      </Dialog>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1B1E',
  },
  header: {
    flexDirection: 'row-reverse',
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
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerSubText: {
    color: '#FFD700',
    fontSize: 16,
  },
  groupName: {
    color: '#FFD700',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  actionButtonsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#1C2C2E',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 215, 0, 0.3)',
  },
  actionButton: {
    backgroundColor: '#35654d',
    borderColor: '#FFD700',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    minWidth: 140,
  },
  actionButtonText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginLeft: 8,
  },
  mainContent: {
    flex: 1,
  },
  scrollContainer: {
    padding: 16,
  },
  playerCard: {
    backgroundColor: '#1C2C2E',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  highlightCard: {
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  financialColumn: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  nameColumn: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  financialText: {
    color: '#FFD700',
    fontSize: 16,
  },
  playerName: {
    fontSize: 18,
    color: '#FFD700',
    textAlign: 'right',
  },
  rebuyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionBtn: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#FFD700',
    borderRadius: 4,
    marginHorizontal: 16,
  },
  disabledButton: {
    opacity: 0.5,
    backgroundColor: '#444',
    borderColor: '#666',
  },
  rebuyCount: {
    fontSize: 22,
    color: '#FFD700',
  },
  finalChipsFull: {
    flexDirection: 'column',
    marginTop: 8,
  },
  finalLabel: {
    color: '#B8B8B8',
    fontSize: 16,
    marginBottom: 4,
    textAlign: 'right',
  },
  finalChipsInputFull: {
    borderWidth: 1,
    borderColor: '#FFD700',
    borderRadius: 4,
    padding: 8,
    color: '#FFD700',
    width: '100%',
    textAlign: 'right',
    backgroundColor: '#1C2C2E',
  },
  disabledInput: {
    backgroundColor: '#333',
    borderColor: '#666',
    color: '#666',
  },
  fixedButtonContainer: {
    backgroundColor: '#0D1B1E',
    borderTopWidth: 1,
    borderTopColor: '#FFD700',
    padding: 16,
    width: '100%',
  },
  startButton: {
    paddingVertical: 16,
    borderRadius: 8,
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  startButtonText: {
    color: '#FFD700',
    fontSize: 16,
    textAlign: 'center',
  },
  logScrollView: {
    backgroundColor: '#1C2C2E',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
    flex: 0,
    flexGrow: 0,
  },
  logContentContainer: {
    padding: 16,
  },
  emptyLogText: {
    color: '#B8B8B8',
    textAlign: 'center',
    padding: 16,
    fontSize: 16,
  },
  logEntryContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 215, 0, 0.2)',
    marginBottom: 8,
  },
  logEntry: {
    color: '#FFD700',
    textAlign: 'right',
    fontSize: 16,
  },
  exitDialogText: {
    color: '#c41e3a',
    textAlign: 'center',
    marginBottom: 16,
  },
  newPlayerContainer: {
    padding: 16,
    width: '100%',
  },
  inputLabel: {
    color: '#FFD700',
    fontSize: 16,
    marginBottom: 8,
    textAlign: 'right',
  },
  newPlayerInput: {
    backgroundColor: '#1C2C2E',
    borderWidth: 1,
    borderColor: '#FFD700',
    borderRadius: 8,
    padding: 12,
    color: '#FFD700',
    marginBottom: 16,
    textAlign: 'right',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 14,
    textAlign: 'right',
    marginTop: 8,
  },
  sectionTitle: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'right',
    marginBottom: 12,
  },
  playerType: {
    color: '#FFD700',
    fontSize: 14,
    opacity: 0.7,
  },
  saveIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    justifyContent: 'center',
    width: 40,
  },
  homeButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
});