import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@/components/common/Text';
import { UserRole } from '@/models/UserProfile';

interface UserRoleSelectorProps {
  currentRole: UserRole;
  onRoleChange: (newRole: UserRole) => void;
  disabled?: boolean;
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'מנהל',
  super: 'משתמש על',
  regular: 'משתמש רגיל'
};

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'גישה מלאה לכל המערכת',
  super: 'יכול ליצור ולנהל משחקים וקבוצות',
  regular: 'צפייה והשתתפות במשחקים'
};

const ROLE_COLORS = {
  primary: '#35654d',
  gold: '#FFD700',
  surface: '#1C2C2E',
  text: '#FFFFFF',
  border: 'rgba(255, 215, 0, 0.3)'
};

export const UserRoleSelector: React.FC<UserRoleSelectorProps> = ({
  currentRole,
  onRoleChange,
  disabled = false
}) => {
  const roles: UserRole[] = ['admin', 'super', 'regular'];

  return (
    <View style={styles.container}>
      <Text style={styles.label}>תפקיד</Text>
      <View style={styles.rolesContainer}>
        {roles.map((role) => {
          const isSelected = currentRole === role;

          return (
            <TouchableOpacity
              key={role}
              style={[
                styles.roleButton,
                isSelected && styles.roleButtonActive,
                disabled && styles.roleButtonDisabled
              ]}
              onPress={() => !disabled && onRoleChange(role)}
              disabled={disabled}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.roleLabel,
                isSelected && styles.roleLabelActive
              ]}>
                {ROLE_LABELS[role]}
              </Text>
              <Text style={styles.roleDescription}>
                {ROLE_DESCRIPTIONS[role]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: ROLE_COLORS.gold,
    textAlign: 'right',
  },
  rolesContainer: {
    gap: 10,
  },
  roleButton: {
    backgroundColor: ROLE_COLORS.surface,
    borderWidth: 2,
    borderColor: ROLE_COLORS.border,
    borderRadius: 8,
    padding: 15,
  },
  roleButtonActive: {
    borderColor: ROLE_COLORS.gold,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
  },
  roleButtonDisabled: {
    opacity: 0.5,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
    color: ROLE_COLORS.text,
    textAlign: 'right',
  },
  roleLabelActive: {
    color: ROLE_COLORS.gold,
  },
  roleDescription: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
});
