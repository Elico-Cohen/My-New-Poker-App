// src/components/dashboard/PlayersInGroupManagement.tsx

import React from 'react';
import { View, ScrollView, TouchableOpacity, I18nManager, StyleSheet } from 'react-native';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Dialog } from '@/components/common/Dialog';
import { DeleteConfirmation } from './DeleteConfirmation';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { Input } from '@/components/common/Input';
import { UserProfile } from '@/models/UserProfile';
import { getAllUsers, createUser } from '@/services/users';
import { Icon } from '@/components/common/Icon';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/theme/colors';
import { createNewPlayerAndAddToGroup, NewPlayerData } from '@/services/playerManagement/playerManagement';

// Enable RTL
I18nManager.forceRTL(true);

const CASINO_COLORS = {
  background: '#0D1B1E',
  primary: '#35654d',
  gold: '#FFD700',
  surface: '#1C2C2E',
  text: '#FFFFFF',
  inactive: '#666666',
  error: '#ff4444'
};

interface PlayerItem {
  id: string;
  name: string;
  isPermanent: boolean;
}

interface PlayersInGroupManagementProps {
  groupId: string; // מזהה הקבוצה
  permanentPlayers: string[];
  guestPlayers: string[];
  onUpdatePlayers: (permanent: string[], guests: string[]) => void;
  onClose: () => void;
}

interface NewPlayerFormData {
  name: string;
  phone: string;
  email?: string;
}

export function PlayersInGroupManagement({
  groupId,
  permanentPlayers: initialPermanentPlayers,
  guestPlayers: initialGuestPlayers,
  onUpdatePlayers,
  onClose
}: PlayersInGroupManagementProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  // מצבי שחקנים
  const [permanentPlayers, setPermanentPlayers] = React.useState<PlayerItem[]>([]);
  const [guestPlayers, setGuestPlayers] = React.useState<PlayerItem[]>([]);
  const [availablePlayers, setAvailablePlayers] = React.useState<UserProfile[]>([]);
  
  // מצבי בחירה
  const [selectedPlayers, setSelectedPlayers] = React.useState<PlayerItem[]>([]);
  const [showInactivePlayers, setShowInactivePlayers] = React.useState(false);
  const [playerToDelete, setPlayerToDelete] = React.useState<PlayerItem | null>(null);

  // מצבי דיאלוגים
  const [showAddPlayersDialog, setShowAddPlayersDialog] = React.useState(false);
  const [showNewPlayerDialog, setShowNewPlayerDialog] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

  // מצב שחקן חדש
  const [newPlayerData, setNewPlayerData] = React.useState<NewPlayerFormData>({
    name: '',
    phone: '',
    email: ''
  });

  // מצבי UI
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [nameError, setNameError] = React.useState<string | null>(null);

  // טעינת נתונים ראשונית
  React.useEffect(() => {
    loadPlayers();
  }, [initialPermanentPlayers, initialGuestPlayers]);

  const loadPlayers = async () => {
    try {
      setLoading(true);
      setError(null);
      const users = await getAllUsers();
      setAvailablePlayers(users);

      const permanent = users
        .filter(user => initialPermanentPlayers.includes(user.id))
        .map(user => ({
          id: user.id,
          name: user.name,
          isPermanent: true
        }));

      const guests = users
        .filter(user => initialGuestPlayers.includes(user.id))
        .map(user => ({
          id: user.id,
          name: user.name,
          isPermanent: false
        }));

      setPermanentPlayers(permanent);
      setGuestPlayers(guests);
      setSelectedPlayers([]);
    } catch (error) {
      console.error('Failed to load players:', error);
      setError('טעינת השחקנים נכשלה. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  // ניהול שחקנים
  const updatePlayersState = (newPermanent: PlayerItem[], newGuests: PlayerItem[]) => {
    setPermanentPlayers(newPermanent);
    setGuestPlayers(newGuests);
    onUpdatePlayers(
      newPermanent.map(p => p.id),
      newGuests.map(p => p.id)
    );
  };

  const handlePlayerToggle = (userId: string) => {
    const player = availablePlayers.find(p => p.id === userId);
    if (!player) return;

    setSelectedPlayers(prev => {
      const isSelected = prev.some(p => p.id === userId);
      if (isSelected) {
        return prev.filter(p => p.id !== userId);
      } else {
        return [...prev, { id: userId, name: player.name, isPermanent: true }];
      }
    });
  };

  const togglePlayerType = (playerId: string) => {
    setSelectedPlayers(prev => prev.map(player => 
      player.id === playerId 
        ? { ...player, isPermanent: !player.isPermanent }
        : player
    ));
  };

  const handleConfirmAddPlayers = () => {
    const newPermanent = [
      ...permanentPlayers,
      ...selectedPlayers.filter(p => p.isPermanent)
    ];
    const newGuests = [
      ...guestPlayers,
      ...selectedPlayers.filter(p => !p.isPermanent)
    ];
    updatePlayersState(newPermanent, newGuests);
    setShowAddPlayersDialog(false);
    setSelectedPlayers([]);
  };

  const toggleExistingPlayerStatus = (player: PlayerItem) => {
    let newPermanent = [...permanentPlayers];
    let newGuests = [...guestPlayers];

    if (player.isPermanent) {
      newPermanent = newPermanent.filter(p => p.id !== player.id);
      newGuests = [...newGuests, { ...player, isPermanent: false }];
    } else {
      newGuests = newGuests.filter(p => p.id !== player.id);
      newPermanent = [...newPermanent, { ...player, isPermanent: true }];
    }

    updatePlayersState(newPermanent, newGuests);
  };

  // ניהול שחקן חדש - שימוש במודול playerManagement
  const handleNewPlayerSubmit = async () => {
    try {
      if (!newPlayerData.name.trim()) {
        setNameError('נדרש להזין שם שחקן');
        return;
      }
      if (newPlayerData.email && !/\S+@\S+\.\S+/.test(newPlayerData.email)) {
        setError('כתובת אימייל אינה תקינה');
        return;
      }
      if (nameError) return;

      setLoading(true);
      setError(null);

      const newUserId = await createNewPlayerAndAddToGroup(newPlayerData, groupId);

      const users = await getAllUsers();
      setAvailablePlayers(users);

      const newGuest: PlayerItem = { id: newUserId, name: newPlayerData.name.trim(), isPermanent: false };
      setGuestPlayers(prev => [...prev, newGuest]);

      onUpdatePlayers(
        permanentPlayers.map(p => p.id),
        [...guestPlayers, newGuest].map(p => p.id)
      );

      setSelectedPlayers(prev => [...prev, newGuest]);
      
      // Check if email was provided to show appropriate message
      if (newPlayerData.email && newPlayerData.email.trim()) {
        setError('✅ השחקן נוצר בהצלחה עם אימייל! המערכת תתנתק אוטומטית כדי לשמור על אבטחת המערכת. תוכל להתחבר מחדש כאדמין תוך כמה שניות.');
        
        // Close dialog after showing success message
        setTimeout(() => {
          setShowNewPlayerDialog(false);
          setNewPlayerData({ name: '', phone: '', email: '' });
          setNameError(null);
        }, 3000);
      } else {
        // Regular success for player without email
        setShowNewPlayerDialog(false);
        setNewPlayerData({ name: '', phone: '', email: '' });
        setNameError(null);
      }
    } catch (error: any) {
      console.error('Failed to create new player:', error);
      if (error.message && error.message.toLowerCase().includes('שם')) {
          setNameError(error.message);
      } else {
          setError(error.message || 'יצירת השחקן נכשלה. אנא נסה שוב.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlayer = (player: PlayerItem) => {
    setPlayerToDelete(player);
    setShowDeleteDialog(true);
  };

  const confirmDeletePlayer = () => {
    if (!playerToDelete) return;

    const newPermanent = permanentPlayers.filter(p => p.id !== playerToDelete.id);
    const newGuests = guestPlayers.filter(p => p.id !== playerToDelete.id);

    updatePlayersState(newPermanent, newGuests);
    setShowDeleteDialog(false);
    setPlayerToDelete(null);
  };

  const getAvailablePlayers = () => {
    const currentPlayerIds = [
      ...permanentPlayers.map(p => p.id),
      ...guestPlayers.map(p => p.id)
    ];

    return availablePlayers.filter(player => 
      !currentPlayerIds.includes(player.id) &&
      player.isActive === !showInactivePlayers
    );
  };

  const renderPlayersList = (players: PlayerItem[], title: string) => (
    <View>
      <View style={{
        flexDirection: 'row-reverse',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8
      }}>
        <Text variant="titleLarge" style={{ color: CASINO_COLORS.gold }}>{title}</Text>
      </View>
      {players.map(player => (
        <Card key={player.id} style={{
          marginBottom: 8,
          paddingVertical: 4,
          paddingHorizontal: 4,
          backgroundColor: CASINO_COLORS.surface,
          borderColor: CASINO_COLORS.gold,
          borderWidth: 1,
        }}>
          <View style={{
            flexDirection: 'row-reverse',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: 4,
            paddingHorizontal: 4,
          }}>
            <Text variant="labelLarge" style={{ color: CASINO_COLORS.text, fontWeight: '600' }}>
              {player.name}
            </Text>
            <View style={{ flexDirection: 'row', gap: 24 }}>
              <Button
                variant="ghost"
                icon="account-outline"
                iconSize={24}
                iconColor={CASINO_COLORS.text}
                size="small"
                onPress={() => toggleExistingPlayerStatus(player)}
                style={{ backgroundColor: 'rgba(255, 215, 0, 0.1)' }}
                textStyle={{ color: CASINO_COLORS.text }}
              />
              <Button
                variant="ghost"
                icon="delete"
                iconSize={24}
                iconColor={CASINO_COLORS.text}
                size="small"
                onPress={() => handleDeletePlayer(player)}
                style={{ backgroundColor: 'rgba(255, 215, 0, 0.1)' }}
                textStyle={{ color: CASINO_COLORS.text }}
              />
            </View>
          </View>
        </Card>
      ))}
    </View>
  );

  if (loading) {
    return <LoadingIndicator text="טוען שחקנים..." />;
  }

  if (error) {
    return (
      <Card style={{ backgroundColor: CASINO_COLORS.surface, borderColor: CASINO_COLORS.gold, borderWidth: 1, padding: 16 }}>
        <Text style={{ color: CASINO_COLORS.gold, textAlign: 'right' }}>{error}</Text>
        <Button
          title="נסה שוב"
          onPress={loadPlayers}
          style={{ marginTop: 8 }}
        />
      </Card>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ gap: 24, padding: 16 }}>
        {renderPlayersList(permanentPlayers, 'שחקנים קבועים')}
        {renderPlayersList(guestPlayers, 'שחקנים אורחים')}
        <Button
          title="הוסף שחקנים"
          icon="account-plus"
          onPress={() => setShowAddPlayersDialog(true)}
          style={{
            backgroundColor: 'rgba(255, 215, 0, 0.1)',
            borderColor: CASINO_COLORS.gold,
            borderWidth: 1,
          }}
          textStyle={{ color: CASINO_COLORS.gold }}
        />
      </View>
  
      <Dialog
        visible={showAddPlayersDialog}
        title="הוספת שחקנים"
        onDismiss={() => {
          setShowAddPlayersDialog(false);
          setSelectedPlayers([]);
          setShowInactivePlayers(false);
        }}
        containerStyle={{
          backgroundColor: CASINO_COLORS.background,
        }}
        style={{
          backgroundColor: CASINO_COLORS.background,
          borderColor: CASINO_COLORS.gold,
          borderWidth: 1,
          width: '100%'
        }}
      >
        <View style={{ gap: 16, backgroundColor: CASINO_COLORS.background, width: '100%', padding: 16 }}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 8,
            gap: 8
          }}>
            <Button
              title={showInactivePlayers ? "הצג שחקנים פעילים" : "הצג שחקנים לא פעילים"}
              variant="outline"
              size="small"
              onPress={() => setShowInactivePlayers(!showInactivePlayers)}
              style={{
                borderColor: CASINO_COLORS.gold,
                backgroundColor: 'rgba(255, 215, 0, 0.1)',
                paddingHorizontal: 8,
              }}
              textStyle={{ color: CASINO_COLORS.gold, fontSize: 14 }}
            />
            <Button
              title="הוסף שחקן חדש"
              variant="outline"
              size="small"
              onPress={() => {
                setShowAddPlayersDialog(false);
                setShowNewPlayerDialog(true);
              }}
              style={{
                borderColor: CASINO_COLORS.gold,
                backgroundColor: 'rgba(255, 215, 0, 0.1)',
                paddingHorizontal: 8,
              }}
              textStyle={{ color: CASINO_COLORS.gold, fontSize: 14 }}
            />
          </View>
  
          <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ flexGrow: 1 }}>
            {getAvailablePlayers().map(player => (
              <TouchableOpacity
                key={player.id}
                onPress={() => handlePlayerToggle(player.id)}
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  padding: 12,
                  backgroundColor: CASINO_COLORS.surface,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(255, 215, 0, 0.1)',
                  width: '100%'
                }}
              >
                <Text style={{
                  color: CASINO_COLORS.text,
                  fontSize: 16,
                  flex: 1,
                  textAlign: 'right'
                }}>
                  {player.name}
                </Text>
  
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <Icon
                    name={selectedPlayers.some(p => p.id === player.id) ?
                      'checkbox-marked-outline' : 'checkbox-blank-outline'}
                    size={24}
                    color={CASINO_COLORS.text}
                  />
                  {selectedPlayers.some(p => p.id === player.id) && (
                    <Button
                      title={selectedPlayers.find(p => p.id === player.id)?.isPermanent ? "קבוע" : "אורח"}
                      variant="outline"
                      size="small"
                      icon="account-outline"
                      iconColor={CASINO_COLORS.text}
                      onPress={(e: React.SyntheticEvent) => {
                        e.stopPropagation();
                        togglePlayerType(player.id);
                      }}
                      style={{
                        borderColor: CASINO_COLORS.gold,
                        backgroundColor: 'rgba(255, 215, 0, 0.1)',
                      }}
                      textStyle={{ color: CASINO_COLORS.gold }}
                    />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 10 }}>
            <Button
              title="הוסף"
              onPress={handleConfirmAddPlayers}
              style={styles.dialogButton}
              textStyle={styles.dialogButtonText}
              disabled={selectedPlayers.length === 0}
            />
            <Button
              title="ביטול"
              onPress={() => setShowAddPlayersDialog(false)}
              style={styles.dialogButton}
              textStyle={styles.dialogButtonText}
            />
          </View>
        </View>
      </Dialog>
  
      <Dialog
        visible={showNewPlayerDialog}
        title="הוסף שחקן חדש"
        onDismiss={() => {
          setShowNewPlayerDialog(false);
          setNewPlayerData({ name: '', phone: '', email: '' });
          setNameError(null);
          setError(null);
        }}
        containerStyle={{
          backgroundColor: CASINO_COLORS.background,
        }}
        style={{
          backgroundColor: CASINO_COLORS.background,
          borderColor: CASINO_COLORS.gold,
          borderWidth: 1,
          width: '100%'
        }}
        actions={[
          {
            text: "ביטול",
            onPress: () => {
              setShowNewPlayerDialog(false);
              setNewPlayerData({ name: '', phone: '', email: '' });
              setNameError(null);
              setError(null);
            },
            style: "cancel",
          },
          {
            text: "אישור",
            onPress: handleNewPlayerSubmit,
            style: "confirm",
          },
        ]}
      >
        <View style={styles.newPlayerContainer}>
          <Text variant="bodyLarge" style={styles.inputLabel}>
            שם השחקן
          </Text>
          <Input
            value={newPlayerData.name}
            onChangeText={(text) => {
              setNewPlayerData(prev => ({ ...prev, name: text }));
              getAllUsers().then(users => {
                const exists = users.some(user =>
                  user.name.toLowerCase() === text.trim().toLowerCase()
                );
                setNameError(exists ? 'שם זה כבר קיים' : null);
              });
            }}
            placeholder="הזן שם שחקן"
            style={styles.fixedInput}
          />
          {nameError && (
            <Text variant="bodySmall" style={styles.errorText}>
              {nameError}
            </Text>
          )}
          <Text variant="bodyLarge" style={styles.inputLabel}>
            טלפון (אופציונלי)
          </Text>
          <Input
            value={newPlayerData.phone}
            onChangeText={(text) => setNewPlayerData(prev => ({ ...prev, phone: text }))}
            placeholder="הזן טלפון"
            keyboardType="phone-pad"
            style={styles.fixedInput}
          />
          <Text variant="bodyLarge" style={styles.inputLabel}>
            אימייל (אופציונלי)
          </Text>
          <Input
            value={newPlayerData.email || ''}
            onChangeText={(text) => setNewPlayerData(prev => ({ ...prev, email: text }))}
            placeholder="הזן אימייל"
            keyboardType="default"
            autoCapitalize="none"
            style={styles.fixedInput}
          />
          {error && !nameError && (
            <Text variant="bodySmall" style={styles.errorText}>
              {error}
            </Text>
          )}
        </View>
      </Dialog>
  
      <DeleteConfirmation
        visible={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setPlayerToDelete(null);
        }}
        onConfirm={async () => confirmDeletePlayer()}
        itemName={playerToDelete?.name || ''}
        itemType="שחקן"
      />
    </View>
  );
}
  
const styles = StyleSheet.create({
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  container: { flex: 1, backgroundColor: '#0D1B1E', position: 'relative' },
  contentContainer: { padding: 16, paddingBottom: 140 },
  sectionTitle: { color: '#FFD700', marginBottom: 8, textAlign: 'right' },
  dateButton: { padding: 16, backgroundColor: '#35654d', borderRadius: 8, marginBottom: 16 },
  dateText: { color: '#FFD700', textAlign: 'right' },
  dropdown: { marginBottom: 16 },
  playerButton: { padding: 12, borderRadius: 8, marginBottom: 8, backgroundColor: '#35654d' },
  playerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' },
  checkIcon: { marginRight: 8 },
  playerText: { flex: 1, textAlign: 'right', color: '#FFD700' },
  fixedButtonContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#0D1B1E' },
  startButton: {
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  startButtonText: { color: '#FFD700', marginRight: 8, fontSize: 16 },
  externalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 16,
  },
  externalButton: {
    backgroundColor: '#35654d',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  externalButtonText: {
    color: '#FFD700',
    fontSize: 14,
  },
  externalPlayerButton: {
    padding: 12,
    backgroundColor: '#35654d',
    borderRadius: 8,
    marginBottom: 8,
  },
  dialogButton: {
    backgroundColor: '#35654d',
    padding: 8,
    borderRadius: 8,
    marginTop: 16,
  },
  dialogButtonText: {
    color: '#FFD700',
    fontSize: 14,
  },
  newPlayerContainer: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  inputLabel: {
    color: '#FFD700',
    marginBottom: 4,
    textAlign: 'right',
  },
  fixedInput: {
    width: '100%',
    marginBottom: 12,
  },
  errorText: {
    color: '#ff4444',
    textAlign: 'right',
    marginBottom: 8,
  },
});
  
export default PlayersInGroupManagement;
