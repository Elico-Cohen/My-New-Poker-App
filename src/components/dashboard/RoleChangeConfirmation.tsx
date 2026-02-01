import React from 'react';
import { View, Modal, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { UserRole } from '@/models/UserProfile';

const CASINO_COLORS = {
  background: '#0D1B1E',
  surface: '#1C2C2E',
  primary: '#35654d',
  gold: '#FFD700',
  text: '#FFFFFF'
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'מנהל',
  super: 'משתמש על',
  regular: 'משתמש רגיל'
};

const ROLE_COLORS = {
  admin: CASINO_COLORS.gold,
  super: CASINO_COLORS.primary,
  regular: '#888'
};

interface RoleChangeConfirmationProps {
  visible: boolean;
  userName: string;
  currentRole: UserRole;
  newRole: UserRole;
  onConfirm: () => void;
  onCancel: () => void;
}

export const RoleChangeConfirmation: React.FC<RoleChangeConfirmationProps> = ({
  visible,
  userName,
  currentRole,
  newRole,
  onConfirm,
  onCancel
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onCancel}
      >
        <TouchableOpacity
          style={styles.container}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Icon name="alert-circle" size="large" color={CASINO_COLORS.gold} />
            <Text style={styles.title}>אישור שינוי תפקיד</Text>
          </View>

          <View style={styles.content}>
            <Text style={styles.message}>
              האם אתה בטוח שברצונך לשנות את התפקיד של{'\n'}
              <Text style={styles.userName}>{userName}</Text>?
            </Text>

            <View style={styles.roleChangeContainer}>
              <View style={styles.roleBox}>
                <Text style={styles.roleLabel}>תפקיד נוכחי:</Text>
                <View style={[styles.roleBadge, { borderColor: ROLE_COLORS[currentRole] }]}>
                  <Icon
                    name={currentRole === 'admin' ? 'crown' : currentRole === 'super' ? 'star' : 'account'}
                    size="small"
                    color={ROLE_COLORS[currentRole]}
                  />
                  <Text style={[styles.roleText, { color: ROLE_COLORS[currentRole] }]}>
                    {ROLE_LABELS[currentRole]}
                  </Text>
                </View>
              </View>

              <Icon name="arrow-left" size="medium" color={CASINO_COLORS.gold} />

              <View style={styles.roleBox}>
                <Text style={styles.roleLabel}>תפקיד חדש:</Text>
                <View style={[styles.roleBadge, { borderColor: ROLE_COLORS[newRole] }]}>
                  <Icon
                    name={newRole === 'admin' ? 'crown' : newRole === 'super' ? 'star' : 'account'}
                    size="small"
                    color={ROLE_COLORS[newRole]}
                  />
                  <Text style={[styles.roleText, { color: ROLE_COLORS[newRole] }]}>
                    {ROLE_LABELS[newRole]}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.warning}>
              שינוי התפקיד ישפיע על ההרשאות של המשתמש במערכת
            </Text>
          </View>

          <View style={styles.actions}>
            <Button
              title="ביטול"
              onPress={onCancel}
              variant="outline"
              style={styles.cancelButton}
              textStyle={{ color: CASINO_COLORS.text }}
            />
            <Button
              title="אשר שינוי"
              onPress={onConfirm}
              style={styles.confirmButton}
              textStyle={{ color: CASINO_COLORS.text }}
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
    maxWidth: 400
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
  message: {
    fontSize: 16,
    color: CASINO_COLORS.text,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24
  },
  userName: {
    color: CASINO_COLORS.gold,
    fontWeight: 'bold'
  },
  roleChangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginVertical: 20
  },
  roleBox: {
    alignItems: 'center',
    gap: 8
  },
  roleLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center'
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.05)'
  },
  roleText: {
    fontSize: 14,
    fontWeight: '600'
  },
  warning: {
    fontSize: 12,
    color: '#f59e0b',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 10
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
