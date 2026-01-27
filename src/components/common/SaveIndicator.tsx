import React, { useEffect } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Text } from './Text';
import { Icon } from './Icon';
import { IconName } from '@/theme/icons';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface SaveIndicatorProps {
  status: SaveStatus;
  showText?: boolean;
  style?: any;
}

/**
 * רכיב להצגת מצב שמירה אוטומטית
 * מראה אינדיקציה ויזואלית למצב שמירה אוטומטית - טוען, נשמר, שגיאה
 */
export const SaveIndicator: React.FC<SaveIndicatorProps> = ({ 
  status, 
  showText = true,
  style 
}) => {
  // אנימציית סיבוב לאייקון הטעינה
  const spinValue = new Animated.Value(0);
  
  // אנימציית הופעה והיעלמות
  const fadeAnim = new Animated.Value(status === 'idle' ? 0 : 1);
  
  // הפעלת אנימציית סיבוב כאשר במצב שמירה
  useEffect(() => {
    if (status === 'saving') {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinValue.setValue(0);
    }
    
    // אנימציית הופעה/היעלמות
    Animated.timing(fadeAnim, {
      toValue: status === 'idle' ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [status]);
  
  // המרת ערך האנימציה לסיבוב בזוויות
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  
  // בחירת האייקון והטקסט בהתאם למצב
  let iconName: IconName = 'content-save-outline';
  let statusText = '';
  let iconColor = '';
  
  switch (status) {
    case 'saving':
      iconName = 'content-save-outline';
      statusText = 'שומר...';
      iconColor = '#FFD700';
      break;
    case 'saved':
      iconName = 'check-circle-outline';
      statusText = 'נשמר';
      iconColor = '#10b981';
      break;
    case 'error':
      iconName = 'alert-circle-outline';
      statusText = 'שגיאה בשמירה';
      iconColor = '#ef4444';
      break;
    default:
      return null; // לא מציג כלום במצב idle
  }
  
  return (
    <Animated.View 
      style={[
        styles.container, 
        { opacity: fadeAnim },
        style
      ]}
    >
      {status === 'saving' ? (
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <Icon name={iconName} size="small" color={iconColor} />
        </Animated.View>
      ) : (
        <Icon name={iconName} size="small" color={iconColor} />
      )}
      
      {showText && (
        <Text style={[styles.text, { color: iconColor }]}>
          {statusText}
        </Text>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  text: {
    fontSize: 12,
    marginLeft: 4,
  }
}); 