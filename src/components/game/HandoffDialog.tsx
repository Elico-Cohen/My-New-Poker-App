import React, { useState } from 'react';
import { View, Modal, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { UserProfile } from '@/models/UserProfile';
import { GameData } from '@/contexts/GameContext';

const CASINO_COLORS = {
  background: '#0D1B1E',
  surface: '#1C2C2E',
  primary: '#35654d',
  gold: '#FFD700',
  text: '#FFFFFF'
};

interface HandoffDialogProps {
  visible: boolean;
  currentGame: GameData;
  currentUser: UserProfile;
  eligibleUsers: UserProfile[];
  onHandoff: (newOwnerAuthUid: string, reason?: string) => Promise<void>;
  onCancel: () => void;
}

export const HandoffDialog: React.FC<HandoffDialogProps> = ({
  visible,
  currentGame,
  currentUser,
  eligibleUsers,
  onHandoff,
  onCancel
}) => {
  const [selectedUserAuthUid, setSelectedUserAuthUid] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Get current owner name from game
  const currentOwnerName = currentUser.name;

  // Get player IDs from the current game
  const gamePlayerIds = new Set(currentGame.players?.map(p => p.id) || []);

  // Filter eligible users:
  // 1. Must be participating in the current game
  // 2. Must be admin or super user
  // 3. Must be active
  // 4. Must not be the current game owner
  const filteredUsers = eligibleUsers.filter(u =>
    gamePlayerIds.has(u.id) &&
    (u.role === 'admin' || u.role === 'super') &&
    u.isActive &&
    u.authUid !== currentGame.createdBy
  );

  const selectedUser = filteredUsers.find(u => u.authUid === selectedUserAuthUid);

  const handleConfirm = () => {
    if (!selectedUserAuthUid) {
      Alert.alert('שגיאה', 'יש לבחור משתמש');
      return;
    }

    const selectedUserName = selectedUser?.name || 'לא ידוע';

    Alert.alert(
      'אישור העברת שליטה',
      `האם אתה בטוח שברצונך להעביר את השליטה במשחק ל-${selectedUserName}?\n\nלאחר ההעברה, לא תוכל לערוך את המשחק.`,
      [
        {
          text: 'ביטול',
          style: 'cancel'
        },
        {
          text: 'כן, העבר',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await onHandoff(selectedUserAuthUid, reason || undefined);
              setSelectedUserAuthUid('');
              setReason('');
            } catch (error: any) {
              Alert.alert('שגיאה', error.message || 'שגיאה בהעברת השליטה');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleCancel = () => {
    setSelectedUserAuthUid('');
    setReason('');
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleCancel}
      >
        <TouchableOpacity
          style={styles.container}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.header}>
            <Icon name="swap-horizontal" size="large" color={CASINO_COLORS.gold} />
            <Text style={styles.title}>העבר שליטה במשחק</Text>
          </View>

          <ScrollView style={styles.content}>
            {/* Current Owner */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>בעלים נוכחי:</Text>
              <Text style={styles.infoValue}>{currentOwnerName}</Text>
            </View>

            {/* User Picker */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>העבר ל:</Text>

              {filteredUsers.length === 0 ? (
                <View style={styles.noUsersContainer}>
                  <Text style={styles.noUsersText}>
                    אין משתמשים זמינים להעברה.{'\n'}
                    רק שחקנים המשתתפים במשחק עם הרשאות מנהל/על יכולים לקבל שליטה.
                  </Text>
                </View>
              ) : (
                <View style={styles.userList}>
                  {filteredUsers.map((user) => (
                    <TouchableOpacity
                      key={user.id}
                      style={[
                        styles.userOption,
                        selectedUserAuthUid === user.authUid && styles.userOptionSelected
                      ]}
                      onPress={() => setSelectedUserAuthUid(user.authUid!)}
                    >
                      <View style={styles.userOptionContent}>
                        <View style={styles.userInfo}>
                          <Text style={[
                            styles.userName,
                            selectedUserAuthUid === user.authUid && styles.userNameSelected
                          ]}>
                            {user.name}
                          </Text>
                          <View style={[
                            styles.roleBadge,
                            { borderColor: user.role === 'admin' ? CASINO_COLORS.gold : CASINO_COLORS.primary }
                          ]}>
                            <Icon
                              name={user.role === 'admin' ? 'crown' : 'star'}
                              size="tiny"
                              color={user.role === 'admin' ? CASINO_COLORS.gold : CASINO_COLORS.primary}
                            />
                            <Text style={[
                              styles.roleText,
                              { color: user.role === 'admin' ? CASINO_COLORS.gold : CASINO_COLORS.primary }
                            ]}>
                              {user.role === 'admin' ? 'מנהל' : 'על'}
                            </Text>
                          </View>
                        </View>
                        {selectedUserAuthUid === user.authUid && (
                          <Icon name="check-circle" size="medium" color={CASINO_COLORS.gold} />
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Reason Input */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>סיבה (אופציונלי):</Text>
              <TextInput
                style={styles.reasonInput}
                value={reason}
                onChangeText={setReason}
                placeholder="למה אתה מעביר את השליטה?"
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                multiline
                maxLength={200}
              />
              <Text style={styles.characterCount}>{reason.length}/200</Text>
            </View>

            {/* Warning */}
            <View style={styles.warningContainer}>
              <Icon name="alert-circle" size="small" color="#f59e0b" />
              <Text style={styles.warningText}>
                לאחר ההעברה, לא תוכל לערוך את המשחק
              </Text>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              title="ביטול"
              onPress={handleCancel}
              variant="outline"
              style={styles.cancelButton}
              textStyle={{ color: CASINO_COLORS.text }}
              disabled={isLoading}
            />
            <Button
              title={isLoading ? "מעביר..." : "אשר העברה"}
              onPress={handleConfirm}
              style={styles.confirmButton}
              textStyle={{ color: CASINO_COLORS.text }}
              disabled={!selectedUserAuthUid || isLoading || filteredUsers.length === 0}
            />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  container: {
    backgroundColor: CASINO_COLORS.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: CASINO_COLORS.gold,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%'
  },
  header: {
    alignItems: 'center',
    marginBottom: 20
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: CASINO_COLORS.gold,
    marginTop: 10,
    textAlign: 'center'
  },
  content: {
    marginBottom: 20
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 10
  },
  infoLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)'
  },
  infoValue: {
    fontSize: 16,
    color: CASINO_COLORS.gold,
    fontWeight: '600'
  },
  section: {
    marginBottom: 20
  },
  sectionLabel: {
    fontSize: 14,
    color: CASINO_COLORS.text,
    marginBottom: 10,
    textAlign: 'right',
    fontWeight: '600'
  },
  noUsersContainer: {
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)'
  },
  noUsersText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center'
  },
  userList: {
    gap: 10
  },
  userOption: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12
  },
  userOptionSelected: {
    borderColor: CASINO_COLORS.gold,
    backgroundColor: 'rgba(255, 215, 0, 0.1)'
  },
  userOptionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  userName: {
    fontSize: 16,
    color: CASINO_COLORS.text,
    fontWeight: '500'
  },
  userNameSelected: {
    color: CASINO_COLORS.gold
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)'
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600'
  },
  reasonInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    padding: 12,
    color: CASINO_COLORS.text,
    fontSize: 14,
    textAlign: 'right',
    minHeight: 80,
    maxHeight: 120
  },
  characterCount: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'left',
    marginTop: 4
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)'
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#f59e0b',
    textAlign: 'right',
    fontStyle: 'italic'
  },
  actions: {
    flexDirection: 'row',
    gap: 12
  },
  cancelButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 1
  },
  confirmButton: {
    flex: 1,
    backgroundColor: CASINO_COLORS.primary,
    borderColor: CASINO_COLORS.gold,
    borderWidth: 2
  }
});
