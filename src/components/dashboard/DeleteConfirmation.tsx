import React from 'react';
import { Dialog } from '@/components/common/Dialog';
import { View } from 'react-native';
import { Text } from '@/components/common/Text';

const CASINO_COLORS = {
  background: '#0D1B1E',
  primary: '#35654d',
  gold: '#FFD700',
  surface: '#1C2C2E',
  text: '#FFFFFF',
  warning: '#ef4444'  // אדום לאזהרה
};

interface DeleteConfirmationProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title?: string;
  message?: string;
  itemName: string;
  itemType: 'קבוצה' | 'שחקן' | 'יחידת תשלום';
}

export function DeleteConfirmation({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  itemName,
  itemType
}: DeleteConfirmationProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleConfirm = async () => {
    try {
      setIsDeleting(true);
      await onConfirm();
    } finally {
      setIsDeleting(false);
      onClose();
    }
  };

  const mainMessage = `האם אתה בטוח שברצונך למחוק את ה${itemType} "${itemName}"?`;
  const warningMessage = `פעולה זו תסיר את המשתמש מכל הקבוצות ומיחידת התשלום שלו`;

  return (
    <Dialog
      visible={visible}
      title={title || `אישור מחיקת ${itemType}`}
      message=""
      confirmText={isDeleting ? "מוחק..." : "מחק"}
      cancelText="ביטול"
      onConfirm={handleConfirm}
      onCancel={onClose}
      type="danger"
    >
      <View style={{ marginBottom: 24, gap: 12 }}>
        {/* Main Message - centered, white */}
        <Text 
          variant="bodyLarge" 
          style={{ 
            color: CASINO_COLORS.text,
            textAlign: 'center',
            fontWeight: 'bold'
          }}
        >
          {mainMessage}
        </Text>

        {/* Warning Message - right-aligned, red */}
        <Text 
          variant="bodyNormal" 
          style={{ 
            color: CASINO_COLORS.warning,
            textAlign: 'right'
          }}
        >
          {warningMessage}
        </Text>
      </View>
    </Dialog>
  );
}