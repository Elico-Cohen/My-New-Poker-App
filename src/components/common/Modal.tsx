// Modified Modal.tsx
import React from 'react';
import {
  Modal as RNModal,
  View,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Text } from './Text';
import Colors from '@/theme/colors';
import { useColorScheme } from '@/components/useColorScheme';

const CASINO_COLORS = {
  background: '#0D1B1E',
  primary: '#35654d',
  gold: '#FFD700',
  surface: '#1C2C2E',
  text: '#FFFFFF'
};

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Modal({ 
  visible, 
  onClose, 
  title,
  children,
  style 
}: ModalProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View 
          style={[
            styles.container,
            {
              backgroundColor: CASINO_COLORS.background,
              borderColor: CASINO_COLORS.gold,
            },
            style
          ]}
          // Add this onPress handler to stop event propagation
          onStartShouldSetResponder={() => true}
          onTouchEnd={(e) => {
            e.stopPropagation();
          }}
        >
          {title && (
            <View style={[
              styles.header,
              { borderBottomColor: CASINO_COLORS.gold }
            ]}>
              <Text 
                variant="h4" 
                style={[styles.title, { color: CASINO_COLORS.gold }]}
              >
                {title}
              </Text>
            </View>
          )}
          <View style={[
            styles.content,
            { backgroundColor: CASINO_COLORS.background }
          ]}>
            {children}
          </View>
        </View>
      </TouchableOpacity>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    backgroundColor: '#0D1B1E',
  },
  title: {
    textAlign: 'center',
  },
  content: {
    padding: 16,
  },
});