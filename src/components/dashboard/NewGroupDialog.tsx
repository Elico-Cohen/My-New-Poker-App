// src/app/dashboard/NewGroupDialog.tsx
import React from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Dialog } from '@/components/common/Dialog';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { Text } from '@/components/common/Text';
import { Switch } from '@/components/common/Switch';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import Colors from '@/theme/colors';
import { useColorScheme } from '@/components/useColorScheme';
import { getAllActiveGroups } from '@/services/groups';
import { getAllUsers } from '@/services/users';
import { Group } from '@/models/Group';
import { UserProfile } from '@/models/UserProfile';
import { Icon } from '@/components/common/Icon';

interface NewGroupDialogProps {
  visible: boolean;
  onClose: () => void;
  onSave: (group: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

interface SelectedPlayer {
  id: string;
  name: string;
  isPermanent: boolean;
}

export function NewGroupDialog({
  visible,
  onClose,
  onSave,
}: NewGroupDialogProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  // State for form fields
  const [name, setName] = React.useState('');
  const [buyInChips, setBuyInChips] = React.useState('');
  const [buyInAmount, setBuyInAmount] = React.useState('');
  const [rebuyChips, setRebuyChips] = React.useState('');
  const [rebuyAmount, setRebuyAmount] = React.useState('');
  const [useRoundingRule, setUseRoundingRule] = React.useState(true);
  const [roundingRulePercentage, setRoundingRulePercentage] = React.useState('80');

  // State for players
  const [availablePlayers, setAvailablePlayers] = React.useState<UserProfile[]>([]);
  const [selectedPlayers, setSelectedPlayers] = React.useState<SelectedPlayer[]>([]);

  // UI states
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showPlayerSelection, setShowPlayerSelection] = React.useState(false);
  const [existingGroups, setExistingGroups] = React.useState<Group[]>([]);

  React.useEffect(() => {
    if (visible) {
      loadInitialData();
    }
  }, [visible]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use getAllActiveGroups for validation of group names
      const groups = await getAllActiveGroups();
      setExistingGroups(groups);

      // Load all users
      const users = await getAllUsers();
      setAvailablePlayers(users);

      resetForm();
    } catch (error) {
      console.error('Failed to load initial data:', error);
      setError('טעינת הנתונים נכשלה. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setBuyInChips('');
    setBuyInAmount('');
    setRebuyChips('');
    setRebuyAmount('');
    setUseRoundingRule(true);
    setRoundingRulePercentage('80');
    setSelectedPlayers([]);
    setShowPlayerSelection(false);
    setError(null);
  };

  const validateGroupName = (name: string): boolean => {
    return !existingGroups.some(
      (group) => group.name.toLowerCase() === name.toLowerCase()
    );
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (value && !validateGroupName(value)) {
      setError('קיימת כבר קבוצה בשם זה');
    } else {
      setError(null);
    }
  };

  // Handler for selecting/unselecting a player using checkbox
  const handlePlayerToggle = (userId: string) => {
    const player = availablePlayers.find((p) => p.id === userId);
    if (!player) return;

    const isSelected = selectedPlayers.some((p) => p.id === userId);
    if (isSelected) {
      setSelectedPlayers((prev) => prev.filter((p) => p.id !== userId));
    } else {
      setSelectedPlayers((prev) => [
        ...prev,
        { id: userId, name: player.name, isPermanent: true }, // default: permanent
      ]);
    }
  };

  const togglePlayerStatus = (playerId: string) => {
    setSelectedPlayers((prev) =>
      prev.map((player) =>
        player.id === playerId
          ? { ...player, isPermanent: !player.isPermanent }
          : player
      )
    );
  };

  const validateForm = (): string | null => {
    if (!name.trim()) {
      return 'נדרש להזין שם קבוצה';
    }
    if (!validateGroupName(name)) {
      return 'קיימת כבר קבוצה בשם זה';
    }

    const buyInChipsNum = parseInt(buyInChips);
    const buyInAmountNum = parseInt(buyInAmount);
    const rebuyChipsNum = parseInt(rebuyChips);
    const rebuyAmountNum = parseInt(rebuyAmount);

    if (isNaN(buyInChipsNum) || buyInChipsNum <= 0) {
      return 'נדרש להזין כמות צ\'יפים תקינה ל-Buy In';
    }
    if (isNaN(buyInAmountNum) || buyInAmountNum <= 0) {
      return 'נדרש להזין סכום תקין ל-Buy In';
    }
    if (isNaN(rebuyChipsNum) || rebuyChipsNum <= 0) {
      return 'נדרש להזין כמות צ\'יפים תקינה ל-Rebuy';
    }
    if (isNaN(rebuyAmountNum) || rebuyAmountNum <= 0) {
      return 'נדרש להזין סכום תקין ל-Rebuy';
    }
    if (useRoundingRule) {
      const percentage = parseInt(roundingRulePercentage);
      if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
        return 'אחוז העיגול חייב להיות בין 1 ל-100';
      }
    }
    if (selectedPlayers.length === 0) {
      return 'יש לבחור לפחות שחקן אחד';
    }
    return null;
  };

  const handleSave = async () => {
    try {
      const validationError = validateForm();
      if (validationError) {
        setError(validationError);
        return;
      }
      setLoading(true);
      setError(null);
      const newGroup: Omit<Group, 'id' | 'createdAt' | 'updatedAt'> = {
        name: name.trim(),
        buyIn: {
          chips: parseInt(buyInChips),
          amount: parseInt(buyInAmount),
        },
        rebuy: {
          chips: parseInt(rebuyChips),
          amount: parseInt(rebuyAmount),
        },
        useRoundingRule,
        roundingRulePercentage: parseInt(roundingRulePercentage),
        permanentPlayers: selectedPlayers.filter((p) => p.isPermanent).map((p) => p.id),
        guestPlayers: selectedPlayers.filter((p) => !p.isPermanent).map((p) => p.id),
        isActive: true,
      };
      await onSave(newGroup);
      onClose();
    } catch (error) {
      console.error('Failed to save group:', error);
      setError('שמירת הקבוצה נכשלה. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog visible={visible} onClose={onClose} title="הוספת קבוצה חדשה">
      <ScrollView style={{ maxHeight: 600 }}>
        <View style={{ gap: 24, padding: 16 }}>
          {error && (
            <Text variant="bodyNormal" style={{ color: theme.error }}>
              {error}
            </Text>
          )}
          {/* שלב 1: פרטי קבוצה */}
          <View>
            <Text variant="h4" style={{ marginBottom: 16 }}>פרטי הקבוצה</Text>
            {/* שם קבוצה */}
            <View style={{ marginBottom: 16 }}>
              <Text variant="bodySmall" style={{ marginBottom: 4 }}>שם קבוצה</Text>
              <Input
                value={name}
                onChangeText={handleNameChange}
                placeholder="הכנס שם קבוצה"
              />
            </View>
            {/* הגדרות Buy-in */}
            <View style={{ marginBottom: 16 }}>
              <Text variant="bodyNormal" style={{ marginBottom: 8 }}>Buy-in</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1, maxWidth: 120 }}>
                  <Input
                    value={buyInChips}
                    onChangeText={setBuyInChips}
                    placeholder="כמות צ'יפים"
                    keyboardType="numeric"
                    inputStyle={{ textAlign: 'left' }}
                  />
                </View>
                <View style={{ flex: 1, maxWidth: 120 }}>
                  <Input
                    value={buyInAmount}
                    onChangeText={setBuyInAmount}
                    placeholder="סכום בש״ח"
                    keyboardType="numeric"
                    inputStyle={{ textAlign: 'left' }}
                  />
                </View>
              </View>
            </View>
            {/* הגדרות Rebuy */}
            <View style={{ marginBottom: 16 }}>
              <Text variant="bodyNormal" style={{ marginBottom: 8 }}>Rebuy</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1, maxWidth: 120 }}>
                  <Input
                    value={rebuyChips}
                    onChangeText={setRebuyChips}
                    placeholder="כמות צ'יפים"
                    keyboardType="numeric"
                    inputStyle={{ textAlign: 'left' }}
                  />
                </View>
                <View style={{ flex: 1, maxWidth: 120 }}>
                  <Input
                    value={rebuyAmount}
                    onChangeText={setRebuyAmount}
                    placeholder="סכום בש״ח"
                    keyboardType="numeric"
                    inputStyle={{ textAlign: 'left' }}
                  />
                </View>
              </View>
            </View>
            {/* חוק האחוזים */}
            <View>
              <Switch
                value={useRoundingRule}
                onValueChange={setUseRoundingRule}
                label="השתמש בחוק האחוזים"
              />
              {useRoundingRule && (
                <View style={{ marginTop: 8 }}>
                  <Input
                    value={roundingRulePercentage}
                    onChangeText={setRoundingRulePercentage}
                    placeholder="הכנס אחוז (למשל: 80)"
                    keyboardType="numeric"
                  />
                </View>
              )}
            </View>
          </View>
          {/* שלב 2: בחירת שחקנים */}
          <View>
            <Text variant="h4" style={{ marginBottom: 16 }}>שחקנים בקבוצה</Text>
            {selectedPlayers.length > 0 ? (
              <View style={{ gap: 8 }}>
                {selectedPlayers.map((player) => (
                  <View
                    key={player.id}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: 12,
                      backgroundColor: theme.surface,
                      borderRadius: 8,
                    }}
                  >
                    <Text variant="bodyNormal">{player.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Button
                        title={player.isPermanent ? 'קבוע' : 'אורח'}
                        onPress={() => togglePlayerStatus(player.id)}
                        variant="outline"
                        size="small"
                      />
                      <Button
                        icon="close"
                        variant="ghost"
                        size="small"
                        onPress={() => handlePlayerToggle(player.id)}
                      />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text variant="bodyNormal" style={{ color: theme.textSecondary }}>
                טרם נבחרו שחקנים
              </Text>
            )}
            {/* דיאלוג לבחירת שחקנים עם תיבות סימון */}
            <Dialog
              visible={showPlayerSelection}
              onClose={() => setShowPlayerSelection(false)}
              title="בחירת שחקנים"
            >
              <ScrollView style={{ maxHeight: 400 }}>
                <View style={{ gap: 8, padding: 8 }}>
                  {availablePlayers.map((player) => {
                    const isSelected = selectedPlayers.some((p) => p.id === player.id);
                    return (
                      <TouchableOpacity
                        key={player.id}
                        onPress={() => handlePlayerToggle(player.id)}
                        style={styles.playerRow}
                      >
                        <Text variant="bodyNormal" style={{ color: theme.text }}>
                          {player.name}
                        </Text>
                        <Icon
                          name={isSelected ? 'checkbox-marked-outline' : 'checkbox-blank-outline'}
                          size="medium"
                          color={theme.gold}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
                <Button title="סיום" onPress={() => setShowPlayerSelection(false)} />
              </View>
            </Dialog>
            <Button
              title="הוסף שחקנים"
              icon="account-plus"
              onPress={() => setShowPlayerSelection(true)}
              style={{ marginTop: 16 }}
            />
          </View>
        </View>
      </ScrollView>
      {/* כפתורי פעולה */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.border }}>
        <Button title="ביטול" onPress={onClose} variant="ghost" />
        <Button title="שמירה" onPress={handleSave} loading={loading} />
      </View>
    </Dialog>
  );
}

export default NewGroupDialog;

const styles = StyleSheet.create({
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.gold,
  },
});
