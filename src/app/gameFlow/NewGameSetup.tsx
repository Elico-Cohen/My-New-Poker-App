// src/app/gameFlow/NewGameSetup.tsx

export const unstable_settings = {
  headerShown: false,
};

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  StyleSheet,
  Dimensions,
  BackHandler,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { Text } from '@/components/common/Text';
import { Icon } from '@/components/common/Icon';
import { Dropdown } from '@/components/common/Dropdown';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Dialog } from '@/components/common/Dialog';
import { getAllActiveGroups, getGroupPlayers, getGroupById } from '@/services/groups';
import { getAllUsers } from '@/services/users';
import { createNewPlayerAndAddToGroup, NewPlayerData } from '@/services/playerManagement/playerManagement';
import { UserProfile } from '@/models/UserProfile';
import AddExternalPlayerDialog from '@/components/dashboard/AddExternalPlayerDialog';
import { useGameContext } from '@/contexts/GameContext';
import { Group, ChipsConfig } from '@/models/Group';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
// Note: DatePickerDialog doesn't exist, using DateTimePicker directly instead
import { GameDate } from '@/models/Game';
import { saveOrUpdateActiveGame } from '@/services/gameSnapshot';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Player = {
  id: string;
  name: string;
  type: 'permanent' | 'guest';
  external?: boolean;
};

const windowHeight = Dimensions.get('window').height;

export default function NewGameSetup() {
  const router = useRouter();
  const { setGameData, saveActiveGame, clearActiveGame } = useGameContext();
  const { user } = useAuth();

  const now = new Date();
  const [selectedDate, setSelectedDate] = useState({
    day: now.getDate(),
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    timestamp: now.getTime()
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);

  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [groupPlayers, setGroupPlayers] = useState<Player[]>([]);
  const [selectedGroupPlayerIds, setSelectedGroupPlayerIds] = useState<string[]>([]);
  const [externalPlayers, setExternalPlayers] = useState<UserProfile[]>([]);
  const [selectedExternalPlayerIds, setSelectedExternalPlayerIds] = useState<string[]>([]);
  const [showExternalDialog, setShowExternalDialog] = useState(false);
  const [showNewPlayerDialog, setShowNewPlayerDialog] = useState(false);
  const [newPlayerData, setNewPlayerData] = useState<NewPlayerData>({ name: '', phone: '', email: '' });
  const [newPlayerNameError, setNewPlayerNameError] = useState<string | null>(null);
  const [newPlayerEmailError, setNewPlayerEmailError] = useState<string | null>(null);
  const [newPlayerGeneralError, setNewPlayerGeneralError] = useState<string | null>(null);
  const [logDialogVisible, setLogDialogVisible] = useState(false);
  const [rebuyLogs, setRebuyLogs] = useState<any[]>([]);

  // Add back handler logic
  const handleBackPress = () => {
    const hasUnsavedChanges = selectedGroupId !== '' || 
      selectedGroupPlayerIds.length > 0 || 
      selectedExternalPlayerIds.length > 0;

    if (hasUnsavedChanges) {
      setShowExitDialog(true);
      return true;
    }
    router.push('/(tabs)/home');
    return true;
  };

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackPress
    );
    return () => backHandler.remove();
  }, [selectedGroupId, selectedGroupPlayerIds, selectedExternalPlayerIds]);

  useEffect(() => {
    setSelectedGroupPlayerIds([]);
    setSelectedExternalPlayerIds([]);
  }, [selectedGroupId]);

  useEffect(() => {
    async function fetchGroups() {
      try {
        const groupsData = await getAllActiveGroups();
        setGroups(groupsData);
      } catch (error) {
        console.error('Error fetching groups:', error);
      }
    }
    fetchGroups();
  }, []);

  const refreshGroupPlayers = async () => {
    if (selectedGroupId) {
      try {
        const { permanent, guests } = await getGroupPlayers(selectedGroupId);
        const users = await getAllUsers();
        const permanentPlayers: Player[] = users
          .filter((user) => permanent.includes(user.id))
          .map((user) => ({
            id: user.id,
            name: user.name,
            type: 'permanent' as const,
          }))
          .sort((a, b) => {
            if (!a.name && !b.name) return 0;
            if (!a.name) return 1;
            if (!b.name) return -1;
            return a.name.localeCompare(b.name);
          });

        const guestPlayers: Player[] = users
          .filter((user) => guests.includes(user.id))
          .map((user) => ({
            id: user.id,
            name: user.name,
            type: 'guest' as const,
          }))
          .sort((a, b) => {
            if (!a.name && !b.name) return 0;
            if (!a.name) return 1;
            if (!b.name) return -1;
            return a.name.localeCompare(b.name);
          });

        setGroupPlayers([...permanentPlayers, ...guestPlayers]);
      } catch (error) {
        console.error('Error refreshing group players:', error);
      }
    } else {
      setGroupPlayers([]);
    }
  };

  useEffect(() => {
    if (selectedGroupId) {
      async function fetchPlayers() {
        await refreshGroupPlayers();
        await loadExternalPlayers();
      }
      fetchPlayers();
    }
  }, [selectedGroupId]);

  async function loadExternalPlayers() {
    try {
      const users = await getAllUsers();
      const { permanent, guests } = await getGroupPlayers(selectedGroupId);
      const groupIds = [...permanent, ...guests];
      const external = users.filter((user) => !groupIds.includes(user.id));
      setExternalPlayers(external);
    } catch (error) {
      console.error('Error loading external players:', error);
    }
  }

  const onDateChange = (event: any, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date && date <= new Date()) {
      setSelectedDate({
        day: date.getDate(),
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        timestamp: date.getTime()
      });
    }
  };

  const permanentGroupPlayers = groupPlayers.filter((player) => player.type === 'permanent');
  const guestGroupPlayers = groupPlayers.filter((player) => player.type === 'guest');

  const externalGuestPlayers: Player[] = externalPlayers
    .filter((player) => selectedExternalPlayerIds.includes(player.id))
    .map((player) => ({
      id: player.id,
      name: player.name,
      type: 'guest' as const,
      external: true,
    }));

  const combinedGuestPlayers: Player[] = [...guestGroupPlayers, ...externalGuestPlayers];

  const toggleGroupPlayerSelection = (playerId: string) => {
    setSelectedGroupPlayerIds((prev) => {
      if (prev.includes(playerId)) {
        return prev.filter((id) => id !== playerId);
      } else {
        if (prev.length + selectedExternalPlayerIds.length < 13) {
          return [...prev, playerId];
        }
        return prev;
      }
    });
  };

  const toggleExternalPlayerSelection = (playerId: string) => {
    setSelectedExternalPlayerIds((prev) => {
      if (prev.includes(playerId)) {
        return prev.filter((id) => id !== playerId);
      } else {
        if (prev.length + selectedGroupPlayerIds.length < 13) {
          return [...prev, playerId];
        }
        return prev;
      }
    });
  };

  const toggleGuestSelection = (player: Player) => {
    if (player.external) {
      toggleExternalPlayerSelection(player.id);
    } else {
      toggleGroupPlayerSelection(player.id);
    }
  };

  const totalSelected = selectedGroupPlayerIds.length + selectedExternalPlayerIds.length;
  const canStartGame = totalSelected >= 5 && totalSelected <= 13;

  const handleNewPlayerSubmit = async () => {
    if (!newPlayerData.name.trim()) {
      setNewPlayerNameError('נדרש להזין שם שחקן');
      return;
    }
    
    if (newPlayerData.email && newPlayerData.email.trim() && !/\S+@\S+\.\S+/.test(newPlayerData.email.trim())) {
      setNewPlayerEmailError('כתובת אימייל אינה תקינה');
      return;
    }
    
    if (newPlayerNameError || newPlayerEmailError) return;
    
    try {
      const newUserId = await createNewPlayerAndAddToGroup(newPlayerData, selectedGroupId); 
      
      // Check if email was provided to show appropriate message
      if (newPlayerData.email && newPlayerData.email.trim()) {
        setNewPlayerGeneralError('✅ השחקן נוצר בהצלחה עם אימייל! המערכת תתנתק אוטומטית כדי לשמור על אבטחת המערכת. תוכל להתחבר מחדש כאדמין תוך כמה שניות.');
        
        // Close dialog after showing success message
        setTimeout(() => {
          setShowNewPlayerDialog(false);
          setNewPlayerData({ name: '', phone: '', email: '' });
          setNewPlayerNameError(null);
          setNewPlayerEmailError(null);
          setNewPlayerGeneralError(null);
        }, 3000);
      } else {
        // Regular success for player without email
        setShowNewPlayerDialog(false);
        setNewPlayerData({ name: '', phone: '', email: '' });
        setNewPlayerNameError(null);
        setNewPlayerEmailError(null);
        setNewPlayerGeneralError(null);
      }
      
      await refreshGroupPlayers(); 
      await loadExternalPlayers(); 
      
    } catch (error: any) {
      console.error('Error creating new player in NewGameSetup:', error);
      if (error.message && error.message.toLowerCase().includes('שם')) {
        setNewPlayerNameError(error.message);
      } else {
        setNewPlayerGeneralError(error.message || 'יצירת שחקן חדש נכשלה. נסה שנית.');
      }
    }
  };

  const startGame = async () => {
    if (canStartGame && selectedGroupId) {
      try {
        console.log('🎮 === STARTING NEW GAME === 🎮');
        console.log('Selected group ID:', selectedGroupId);
        console.log('Selected date:', selectedDate);
        console.log('Total players selected:', [...selectedGroupPlayerIds, ...selectedExternalPlayerIds].length);
        
        // Fetch the complete group data to access buyIn and rebuy
        const selectedGroup = await getGroupById(selectedGroupId);
        
        if (!selectedGroup) {
          console.error("Selected group not found");
          return;
        }
        
        const groupNameSnapshot = selectedGroup.name;
        
        // Use the actual group values instead of hardcoded ones
        const buyInSnapshot = { ...selectedGroup.buyIn };
        const rebuySnapshot = { ...selectedGroup.rebuy };

        const initialPlayers = [...selectedGroupPlayerIds, ...selectedExternalPlayerIds].map((id) => {
          const playerObj = groupPlayers.find((p) => p.id === id) || externalPlayers.find((p) => p.id === id);
          return {
            id,
            name: playerObj ? playerObj.name : 'Unknown',
            buyInCount: 1,
            rebuyCount: 0,
            finalChips: '',
          };
        });

        const gameData = {
          gameDate: selectedDate,
          groupId: selectedGroupId,
          groupNameSnapshot,
          buyInSnapshot,
          rebuySnapshot,
          players: initialPlayers,
          rebuyLogs: [],
          openGames: [],
          payments: [],
          useRoundingRule: selectedGroup.useRoundingRule,
          roundingRulePercentage: selectedGroup.roundingRulePercentage || 0,
          totalWins: 0,
          totalLosses: 0,
          difference: 0,
          openGamesCount: 0,
          status: 'active' as const,
        };

        console.log('📝 Setting game data in GameContext...');
        console.log("Game Data to be saved:", JSON.stringify(gameData, null, 2));
        
        // עדכון הקונטקסט - השמירה האוטומטית תטפל בשמירה ב-Firestore
        setGameData(gameData);
        
        console.log('✅ Game data set in context - auto-save will handle Firestore sync');
        console.log('🎯 Navigating to GameManagement...');
        router.push('/gameFlow/GameManagement');
        console.log('🎮 === NEW GAME SETUP COMPLETE === 🎮');
      } catch (error) {
        console.error("❌ Error starting game:", error);
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Main Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBackPress}
        >
          <Icon name="arrow-right" size="medium" color="#FFD700" />
        </TouchableOpacity>
        <Text variant="h4" style={styles.headerTitle}>
          התחל משחק חדש
        </Text>
        <TouchableOpacity 
          style={styles.homeButton}
          onPress={() => router.push('/(tabs)/home2')}
        >
          <Icon name="home" size="medium" color="#FFD700" />
        </TouchableOpacity>
      </View>

      {/* Settings Area */}
      <View style={styles.settingsArea}>
        {/* Date Selection Row */}
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>תאריך משחק:</Text>
          <TouchableOpacity 
            style={styles.settingControl}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.settingText}>
              {new Date(selectedDate.timestamp).toLocaleDateString('he-IL')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Group Selection Row */}
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>בחר קבוצה:</Text>
          <View style={styles.settingControl}>
            <Dropdown
              value={selectedGroupId}
              onSelect={(value) => setSelectedGroupId(value)}
              items={[
                { label: 'בחר קבוצה', value: '' },
                ...groups.map((group) => ({ 
                  label: group.name, 
                  value: group.id 
                })),
              ]}
              placeholder="בחר קבוצה"
            />
          </View>
        </View>
      </View>

      <ScrollView style={styles.playersScroll} contentContainerStyle={styles.playersContainer}>
        {selectedGroupId !== '' && (
          <>
            <Text variant="h4" style={styles.sectionTitle}>
              שחקנים קבועים
            </Text>
            <View style={styles.playersGrid}>
              {permanentGroupPlayers.map((player) => (
                <TouchableOpacity
                  key={player.id}
                  onPress={() => toggleGroupPlayerSelection(player.id)}
                  style={[
                    styles.playerButton,
                    selectedGroupPlayerIds.includes(player.id) && styles.playerButtonSelected,
                  ]}
                >
                  <View style={styles.playerContent}>
                    <Text variant="bodyNormal" style={styles.playerText}>
                      {player.name}
                    </Text>
                    {selectedGroupPlayerIds.includes(player.id) && (
                      <Icon name="check" size="medium" color="#FFD700" style={styles.checkIcon} />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <Text variant="h4" style={styles.sectionTitle}>
              שחקנים אורחים
            </Text>
            <View style={styles.playersGrid}>
              {combinedGuestPlayers.map((player) => {
                const isSelected = player.external
                  ? selectedExternalPlayerIds.includes(player.id)
                  : selectedGroupPlayerIds.includes(player.id);
                return (
                  <TouchableOpacity
                    key={player.id}
                    onPress={() => toggleGuestSelection(player)}
                    style={[
                      styles.playerButton,
                      isSelected && styles.playerButtonSelected,
                    ]}
                  >
                    <View style={styles.playerContent}>
                      <Text variant="bodyNormal" style={styles.playerText}>
                        {player.name}
                      </Text>
                      {isSelected && (
                        <Icon name="check" size="medium" color="#FFD700" style={styles.checkIcon} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.externalButtonsContainer}>
              <Button
                title="הוסף שחקן"
                onPress={async () => {
                  await loadExternalPlayers();
                  setShowExternalDialog(true);
                }}
                style={styles.externalButton}
                textStyle={styles.externalButtonText}
              />
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.fixedButtonContainer}>
        <TouchableOpacity
          onPress={startGame}
          disabled={!canStartGame}
          style={[
            styles.startButton,
            { backgroundColor: canStartGame ? '#35654d' : '#555' },
          ]}
        >
          <Text variant="bodyLarge" style={styles.startButtonText}>
            התחל משחק ({totalSelected} שחקנים)
          </Text>
        </TouchableOpacity>
      </View>

      {/* All the dialogs */}
      <Dialog
        visible={showExitDialog}
        title="יציאה מהמשחק"
        message="האם אתה בטוח שברצונך לצאת? כל הבחירות שלך יאבדו."
        confirmText="צא"
        cancelText="המשך משחק"
        onConfirm={async () => {          setShowExitDialog(false);          await clearActiveGame();          router.push('/(tabs)/home2');        }}
        onCancel={() => setShowExitDialog(false)}
        type="danger"
      />

      <Dialog
        visible={logDialogVisible}
        title="לוג ריבאיים"
        message=""
        confirmText="סגור"
        cancelText=""
        onConfirm={() => setLogDialogVisible(false)}
        onCancel={() => {}}
      >
        <View style={styles.logWrapper}>
          <ScrollView
            style={styles.logContainer}
            contentContainerStyle={styles.logContentContainer}
            nestedScrollEnabled={true}
            onStartShouldSetResponderCapture={() => true}
            onMoveShouldSetResponderCapture={() => true}
          >
            {rebuyLogs.map((log) => (
              <Text key={log.id} style={styles.logEntry}>
                {log.time} - {log.playerName}: {log.action === 'add' ? "הוסיף" : "הפחית"} ריבאיי
              </Text>
            ))}
          </ScrollView>
        </View>
      </Dialog>

      {showNewPlayerDialog && (
        <Dialog
          visible={showNewPlayerDialog}
          title="הוסף שחקן חדש"
          message=""
          confirmText="הוסף"
          cancelText="ביטול"
          onConfirm={handleNewPlayerSubmit}
          onCancel={() => {
            setShowNewPlayerDialog(false);
            setNewPlayerData({ name: '', phone: '', email: '' });
            setNewPlayerNameError(null);
            setNewPlayerEmailError(null);
            setNewPlayerGeneralError(null);
          }}
        >
          <View style={{ padding: 16, gap: 12 }}>
            <Input
              label="שם מלא"
              value={newPlayerData.name}
              onChangeText={(text) => {
                setNewPlayerData((prev) => ({ ...prev, name: text }));
                if (!text.trim()) {
                  setNewPlayerNameError('שם הוא שדה חובה');
                } else {
                  setNewPlayerNameError(null);
                }
              }}
              placeholder="הזן שם מלא"
              error={newPlayerNameError}
            />
            <Input
              label="טלפון (אופציונלי)"
              value={newPlayerData.phone}
              onChangeText={(text) => setNewPlayerData((prev) => ({ ...prev, phone: text }))}
              placeholder="הזן מספר טלפון"
              keyboardType="phone-pad"
            />
            <Input
              label="אימייל (אופציונלי)"
              value={newPlayerData.email || ''}
              onChangeText={(text) => setNewPlayerData((prev) => ({ ...prev, email: text }))}
              placeholder="הזן כתובת אימייל"
              keyboardType="email-address"
              autoCapitalize="none"
              error={newPlayerEmailError}
            />
            {newPlayerGeneralError && (
              <Text style={{ color: 'red', textAlign: 'right', marginBottom: 8 }}>{newPlayerGeneralError}</Text>
            )}
          </View>
        </Dialog>
      )}

      {showExternalDialog && (
        <AddExternalPlayerDialog
          visible={showExternalDialog}
          externalPlayers={externalPlayers}
          selectedExternalPlayerIds={selectedExternalPlayerIds}
          onToggleSelection={(playerId: string) => toggleExternalPlayerSelection(playerId)}
          onConfirm={() => setShowExternalDialog(false)}
          onAddNew={() => {
            setShowExternalDialog(false);
            setShowNewPlayerDialog(true);
          }}
          onCancel={() => setShowExternalDialog(false)}
        />
      )}

      {showDatePicker && (
        <DateTimePicker
          value={new Date(selectedDate.timestamp)}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={onDateChange}
        />
      )}
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
  },
  headerTitle: {
    flex: 1,
    color: '#FFD700',
    textAlign: 'center',
    fontSize: 24,
  },
  homeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsArea: {
    backgroundColor: '#1C2C2E',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 215, 0, 0.3)',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 215, 0, 0.1)',
  },
  settingLabel: {
    width: 100,
    color: '#FFD700',
    fontSize: 16,
    textAlign: 'right',
    marginStart: 12,
  },
  settingControl: {
    flex: 1,
    minHeight: 40,
    backgroundColor: '#35654d',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
    justifyContent: 'center',
  },
  settingText: {
    color: '#FFD700',
    fontSize: 16,
    textAlign: 'right',
    paddingHorizontal: 12,
  },
  playersScroll: {
    flex: 1,
  },
  playersContainer: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  sectionTitle: {
    color: '#FFD700',
    marginBottom: 8,
    textAlign: 'right',
  },
  playersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    alignItems: 'flex-start',
  },
  playerButton: {
    width: '48%',
    backgroundColor: '#1C2C2E',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    marginStart: '1%',
    marginEnd: '1%',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  playerButtonSelected: {
    backgroundColor: '#35654d',
  },
  playerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checkIcon: {
    marginStart: 8,
  },
  playerText: {
    flex: 1,
    color: '#FFFFFF',
    textAlign: 'right',
  },
  fixedButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#0D1B1E',
  },
  startButton: {
    paddingVertical: 16,
    borderRadius: 8,
    flexDirection: 'row',
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
  logWrapper: {
    height: 400,
  },
  logContainer: {},
  logContentContainer: {
    flexGrow: 1,
    padding: 16,
  },
  logEntry: {
    color: '#FFD700',
    marginBottom: 8,
    textAlign: 'right',
  },
  externalButtonsContainer: {
    marginTop: 16,
    width: '100%',
  },
  externalButton: {
    width: '100%',
    padding: 12,
    backgroundColor: '#35654d',
    borderRadius: 8,
    alignItems: 'center',
  },
  externalButtonText: {
    color: '#FFD700',
    fontSize: 16,
  },
});

// Note: Default export is at function definition (line 49)