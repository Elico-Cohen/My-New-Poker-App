import React from 'react';
import { View } from 'react-native';
import { Dialog } from '@/components/common/Dialog';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import Colors from '@/theme/colors';
import { useColorScheme } from '@/components/useColorScheme';
import { PaymentUnit } from '@/models/PaymentUnit';
import { deletePaymentUnit } from '@/services/paymentUnits';
import { updateUser } from '@/services/users';

interface EnrichedPlayer {
  id: string;
  name: string;
}

interface EnrichedPaymentUnit extends Omit<PaymentUnit, 'players'> {
  players: EnrichedPlayer[];
}

interface DeletePaymentUnitDialogProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  unit: EnrichedPaymentUnit;
}

export function DeletePaymentUnitDialog({
  visible,
  onClose,
  onSuccess,
  unit
}: DeletePaymentUnitDialogProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // איפוס בעת פתיחת הדיאלוג
  React.useEffect(() => {
    if (visible) {
      setError(null);
    }
  }, [visible]);

  const handleDelete = async () => {
    try {
      setLoading(true);
      setError(null);

      // עדכון השחקנים - הסרת הקישור ליחידת התשלום
      await Promise.all(
        unit.players.map(player =>
          updateUser(player.id, {
            paymentUnitId: null
          })
        )
      );

      // מחיקת יחידת התשלום
      await deletePaymentUnit(unit.id);

      onSuccess();
      onClose();

    } catch (error) {
      console.error('Failed to delete payment unit:', error);
      setError('מחיקת יחידת התשלום נכשלה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      visible={visible}
      onCancel={onClose}
      onConfirm={handleDelete}
      title="מחיקת יחידת תשלום"
      message=""
      hideDefaultButtons
    >
      <View style={{ gap: 16 }}>
        {error && (
          <Text 
            variant="bodyNormal" 
            style={{ color: theme.error }}
          >
            {error}
          </Text>
        )}

        <Text variant="bodyNormal">
          האם אתה בטוח שברצונך למחוק את יחידת התשלום "{unit.name}"?
        </Text>

        <Text variant="bodyNormal" style={{ color: theme.warning }}>
          שים לב: פעולה זו תסיר את הקישור בין השחקנים ליחידת התשלום:
        </Text>

        {/* הצגת השחקנים שיושפעו */}
        <View style={{ 
          backgroundColor: theme.surfaceVariant,
          padding: 12,
          borderRadius: 8
        }}>
          {unit.players.map((player, index) => (
            <Text 
              key={player.id} 
              variant="bodyNormal"
              style={{ marginBottom: index < unit.players.length - 1 ? 4 : 0 }}
            >
              • {player.name}
            </Text>
          ))}
        </View>

        <Text variant="bodyNormal" style={{ color: theme.error }}>
          פעולה זו אינה ניתנת לביטול.
        </Text>
      </View>

      {/* כפתורי פעולה */}
      <View style={{ 
        flexDirection: 'row', 
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 24,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: theme.border
      }}>
        <Button
          title="ביטול"
          onPress={onClose}
          variant="ghost"
        />
        <Button
          title={loading ? "מוחק..." : "מחק"}
          onPress={handleDelete}
          loading={loading}
          variant="secondary" // אדום
        />
      </View>
    </Dialog>
  );
}