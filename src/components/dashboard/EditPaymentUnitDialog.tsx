// src/components/dashboard/EditPaymentUnitDialog.tsx

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Dialog } from '@/components/common/Dialog';
import { Input } from '@/components/common/Input';
import { Text } from '@/components/common/Text';
import Colors from '@/theme/colors';
import { useColorScheme } from '@/components/useColorScheme';
import { PaymentUnit } from '@/models/PaymentUnit';
import { getAllActivePaymentUnits, updatePaymentUnit } from '@/services/paymentUnits';

interface EnrichedPlayer {
  id: string;
  name: string;
}

interface EnrichedPaymentUnit extends Omit<PaymentUnit, 'players'> {
  players: EnrichedPlayer[];
}

interface EditPaymentUnitDialogProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  unit: EnrichedPaymentUnit;
}

export function EditPaymentUnitDialog({
  visible,
  onClose,
  onSuccess,
  unit
}: EditPaymentUnitDialogProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  // אתחול שם היחידה מהנתונים הקיימים
  const [name, setName] = React.useState(unit.name);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [existingUnits, setExistingUnits] = React.useState<PaymentUnit[]>([]);

  React.useEffect(() => {
    if (visible) {
      setName(unit.name);
      setError(null);
      loadInitialData();
    }
  }, [visible, unit]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      // טוענים את כל יחידות התשלום כדי לבדוק כפילות בשם (לא כולל היחידה הנוכחית)
      const units = await getAllActivePaymentUnits();
      setExistingUnits(units.filter(u => u.id !== unit.id));
    } catch (error) {
      console.error('Failed to load payment units:', error);
      setError('טעינת נתוני יחידות התשלום נכשלה');
    } finally {
      setLoading(false);
    }
  };

  const validateName = (name: string): boolean => {
    // אם השם לא השתנה – אין צורך לבדוק
    if (name === unit.name) return true;
    return !existingUnits.some(u => u.name.toLowerCase() === name.toLowerCase());
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (value && !validateName(value)) {
      setError('שם יחידת התשלום כבר קיים במערכת');
    } else {
      setError(null);
    }
  };

  const validateForm = (): string | null => {
    if (!name.trim()) {
      return 'נדרש להזין שם יחידת תשלום';
    }
    if (!validateName(name)) {
      return 'שם יחידת התשלום כבר קיים במערכת';
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
      // עדכון שם היחידה במסד הנתונים
      await updatePaymentUnit(unit.id, { name: name.trim() });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to update payment unit:', error);
      setError('עדכון יחידת התשלום נכשל');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      visible={visible}
      title={`עריכת יחידת תשלום - ${unit.name}`}
      message=""
      onConfirm={handleSave}
      onCancel={onClose}
      confirmText="שמירה"
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
          {/* הודעת שגיאה מוצגת מתחת לשדה */}
          {error && (
            <Text variant="bodyNormal" style={styles.errorText}>
              {error}
            </Text>
          )}
        </View>

        <Text variant="bodySmall" style={styles.playersLabel}>
          שחקנים ביחידה:
        </Text>
        <View style={styles.playersContainer}>
          {unit.players.map(player => (
            <View key={player.id} style={styles.playerCard}>
              <Text variant="bodyNormal" style={styles.playerText}>
                {player.name}
              </Text>
            </View>
          ))}
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
  playersLabel: {
    color: '#FFD700',
    textAlign: 'right',
    marginBottom: 8,
  },
  playersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
  },
  playerCard: {
    backgroundColor: '#1C2C2E',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
    marginStart: 8,
    marginBottom: 8,
  },
  playerText: {
    color: '#FFD700',
    textAlign: 'right',
  },
});

export default EditPaymentUnitDialog;
