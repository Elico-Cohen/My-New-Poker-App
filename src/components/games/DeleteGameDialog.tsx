import React from 'react';
import { View } from 'react-native';
import { Dialog } from '@/components/common/Dialog';
import { Text } from '@/components/common/Text';
import Colors from '@/theme/colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Game } from '@/models/Game';
import { deleteGame } from '@/services/games';

interface DeleteGameDialogProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  game: Game;
}

export function DeleteGameDialog({
  visible,
  onClose,
  onSuccess,
  game
}: DeleteGameDialogProps) {
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

      // מחיקת המשחק
      await deleteGame(game.id as string);
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to delete game:', error);
      setError('מחיקת המשחק נכשלה');
    } finally {
      setLoading(false);
    }
  };

  // עזרה בפורמוט תאריך
  const formatDate = (date: any) => {
    if (!date) return '';
    
    // אם זה תאריך מהמבנה החדש, ננסה לחלץ ממנו
    if (typeof date === 'object' && date.day && date.month && date.year) {
      return `${date.day}/${date.month}/${date.year}`;
    }
    
    // אחרת, ננסה לפרסר כתאריך
    const dateObj = new Date(date);
    return isNaN(dateObj.getTime()) 
      ? '' 
      : `${dateObj.getDate()}/${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`;
  };

  const textStyle = { textAlign: 'right' as const };

  return (
    <Dialog
      visible={visible}
      title="מחיקת משחק"
      message=""
      confirmText={loading ? "מוחק..." : "אישור"}
      cancelText="ביטול"
      onConfirm={handleDelete}
      onCancel={onClose}
      type="danger"
      confirmButtonProps={{
        loading: loading
      }}
    >
      <View style={{ gap: 16, width: '100%' }}>
        {error && (
          <Text 
            variant="bodyNormal" 
            style={[textStyle, { color: theme.error }]}
          >
            {error}
          </Text>
        )}

        <Text 
          variant="bodyNormal" 
          style={[textStyle, { color: "#FFFFFF" }]}
        >
          האם אתה בטוח שברצונך למחוק את המשחק מתאריך {formatDate(game.gameDate || game.date)}?
        </Text>

        <Text 
          variant="bodyNormal" 
          style={[textStyle, { color: theme.error }]}
        >
          פעולה זו תמחק את כל נתוני המשחק, כולל תוצאות השחקנים ותשלומים במשחק זה.
        </Text>

        <Text 
          variant="bodyNormal" 
          style={[textStyle, { color: theme.error }]}
        >
          פעולה זו אינה ניתנת לביטול.
        </Text>
      </View>
    </Dialog>
  );
}
