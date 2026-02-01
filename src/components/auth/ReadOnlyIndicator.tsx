import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/common/Text';
import { Icon } from '@/components/common/Icon';
import { lightTheme } from '@/theme/colors';
import { useReadOnlyMode } from './ProtectedRoute';

interface ReadOnlyIndicatorProps {
  /** הודעה מותאמת */
  message?: string;
  /** האם להציג אייקון */
  showIcon?: boolean;
  /** סגנון נוסף */
  style?: any;
}

/**
 * רכיב להצגת מצב קריאה בלבד
 */
export const ReadOnlyIndicator: React.FC<ReadOnlyIndicatorProps> = ({
  message = "מצב צפייה בלבד - אין הרשאה לעריכה",
  showIcon = true,
  style
}) => {
  const { isReadOnlyMode } = useReadOnlyMode();

  if (!isReadOnlyMode) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      {showIcon && (
        <Icon name="information-outline" size="small" color={lightTheme.warning} />
      )}
      <Text style={styles.text}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginVertical: 4,
  },
  text: {
    color: '#d97706', // צבע כתום כהה
    fontSize: 12,
    fontWeight: '500',
    marginStart: 6,
    textAlign: 'center',
  },
}); 