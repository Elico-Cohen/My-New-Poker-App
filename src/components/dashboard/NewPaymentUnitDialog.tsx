// src/components/dashboard/NewPaymentUnitDialog.tsx

import React from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { Dialog } from '@/components/common/Dialog';
import { Input } from '@/components/common/Input';
import { Text } from '@/components/common/Text';
import Colors from '@/theme/colors';
import { useColorScheme } from '@/components/useColorScheme';
import { UserProfile } from '@/models/UserProfile';
import { PaymentUnit } from '@/models/PaymentUnit';
import { getAllActivePaymentUnits, createPaymentUnit } from '@/services/paymentUnits';
import { getAllUsers } from '@/services/users';

interface NewPaymentUnitDialogProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface SelectableUser extends UserProfile {
  isSelected: boolean;
}

export function NewPaymentUnitDialog({
  visible,
  onClose,
  onSuccess,
}: NewPaymentUnitDialogProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  // מצבי טופס
  const [name, setName] = React.useState('');
  const [availableUsers, setAvailableUsers] = React.useState<SelectableUser[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [existingUnits, setExistingUnits] = React.useState<PaymentUnit[]>([]);

  React.useEffect(() => {
    if (visible) {
      resetForm();
      loadInitialData();
    }
  }, [visible]);

  const resetForm = () => {
    setName('');
    setAvailableUsers([]);
    setError(null);
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);
      // טעינת כל יחידות התשלום הפעילות (לבדיקת כפילויות בשם)
      const units = await getAllActivePaymentUnits();
      setExistingUnits(units);
      // טעינת כל המשתמשים וסינון של משתמשים פעילים שאין להם יחידת תשלום
      const users = await getAllUsers();
      const available = users.filter(user =>
        user.isActive &&
        (user.paymentUnitId === null ||
         user.paymentUnitId === undefined ||
         user.paymentUnitId === '')
      ).map(user => ({
        ...user,
        isSelected: false,
      }));
      // מיון המשתמשים לפי שם עם בדיקה שהשם קיים
      available.sort((a, b) => {
        // בדיקה שהשמות קיימים ואז ביצוע ההשוואה
        if (!a.name && !b.name) return 0;
        if (!a.name) return 1;
        if (!b.name) return -1;
        return a.name.localeCompare(b.name, 'he');
      });
      setAvailableUsers(available);
    } catch (error) {
      console.error('Failed to load initial data:', error);
      setError('טעינת הנתונים נכשלה');
    } finally {
      setLoading(false);
    }
  };

  // בדיקת תקינות השם – אם כבר קיימת יחידת תשלום עם שם זה
  const validateName = (name: string): boolean => {
    return !existingUnits.some(
      unit => unit.name.toLowerCase() === name.toLowerCase()
    );
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (value && !validateName(value)) {
      setError('שם יחידת התשלום כבר קיים במערכת');
    } else {
      setError(null);
    }
  };

  // טיפול בבחירת שחקנים – המשתמש יכול לבחור בדיוק שני שחקנים
  const handleUserToggle = (userId: string) => {
    const selectedCount = availableUsers.filter(u => u.isSelected).length;
    const user = availableUsers.find(u => u.id === userId);
    if (!user) return;
    if (user.isSelected) {
      // הסרת הבחירה
      setAvailableUsers(prev =>
        prev.map(u =>
          u.id === userId ? { ...u, isSelected: false } : u
        )
      );
    } else {
      // אם כבר נבחרו שני שחקנים, לא ניתן לבחור עוד
      if (selectedCount >= 2) {
        setError('לא ניתן לבחור יותר משני שחקנים');
        return;
      }
      setAvailableUsers(prev =>
        prev.map(u =>
          u.id === userId ? { ...u, isSelected: true } : u
        )
      );
      setError(null);
    }
  };

  // אימות הטופס – שם לא ריק, שם ייחודי ובחירת בדיוק שני שחקנים
  const validateForm = (): string | null => {
    if (!name.trim()) {
      return 'נדרש להזין שם יחידת תשלום';
    }
    if (!validateName(name)) {
      return 'שם יחידת התשלום כבר קיים במערכת';
    }
    const selectedUsers = availableUsers.filter(u => u.isSelected);
    if (selectedUsers.length !== 2) {
      return 'יש לבחור בדיוק שני שחקנים';
    }
    return null;
  };

  // שמירת יחידת התשלום החדשה
  const handleSave = async () => {
    try {
      const validationError = validateForm();
      if (validationError) {
        setError(validationError);
        return;
      }
      setLoading(true);
      setError(null);
      const selectedUsers = availableUsers.filter(u => u.isSelected);
      const newUnit: Omit<PaymentUnit, 'id' | 'createdAt' | 'updatedAt'> = {
        name: name.trim(),
        players: selectedUsers.map(u => u.id),
        isActive: true,
      };
      await createPaymentUnit(newUnit, newUnit.players);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to create payment unit:', error);
      setError('שמירת יחידת התשלום נכשלה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title="יצירת יחידת תשלום חדשה"
      message=""
      onConfirm={handleSave}
      onCancel={onClose}
      confirmText="צור"
      cancelText="ביטול"
    >
      <View style={styles.dialogContainer}>
        <View style={styles.inputContainer}>
          <Text variant="bodySmall" style={styles.inputLabel}>
            שם יחידת תשלום
          </Text>
          <Input
            value={name}
            onChangeText={handleNameChange}
            placeholder="הכנס שם יחידת תשלום"
            style={styles.inputField}
          />
          {/* הודעת שגיאה תופיע מתחת לשדה */}
          {error && (
            <Text variant="bodyNormal" style={styles.errorText}>
              {error}
            </Text>
          )}
        </View>

        <Text variant="h4" style={styles.sectionTitle}>
          בחירת שחקנים
        </Text>
        <View style={styles.playersContainer}>
          <FlatList
            data={availableUsers}
            keyExtractor={(item) => item.id}
            nestedScrollEnabled={true}
            style={styles.playersList}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleUserToggle(item.id)}
                activeOpacity={0.8}
                style={[
                  styles.playerItem,
                  item.isSelected && styles.playerItemSelected,
                ]}
              >
                <Text
                  variant="bodyNormal"
                  style={[
                    styles.playerItemText,
                    item.isSelected && styles.playerItemTextSelected,
                  ]}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <Text variant="bodyNormal" style={styles.emptyListText}>
                אין שחקנים זמינים ליצירת יחידת תשלום
              </Text>
            )}
          />
        </View>
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  dialogContainer: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 16,
  },
  inputLabel: {
    marginBottom: 4,
    color: '#FFFFFF',
    textAlign: 'right',
  },
  inputField: {
    width: '100%',
    backgroundColor: '#1C2C2E',
    color: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'right',
    marginTop: 4,
  },
  sectionTitle: {
    color: '#FFD700',
    textAlign: 'right',
    marginBottom: 12,
  },
  playersContainer: {
    height: 300,
  },
  playersList: {
    flex: 1,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1C2C2E',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  playerItemSelected: {
    backgroundColor: '#35654d',
    borderWidth: 1,
    borderColor: '#FFD700', // מסגרת זהב
  },
  playerItemText: {
    flex: 1,
    color: '#FFD700',
    textAlign: 'right',
    marginRight: 12,
  },
  playerItemTextSelected: {
    color: '#FFFFFF',
  },
  emptyListText: {
    color: '#B8B8B8',
    textAlign: 'center',
  },
});

export default NewPaymentUnitDialog;
