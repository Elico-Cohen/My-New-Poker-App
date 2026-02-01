import React from 'react';
import { 
  View, 
  StyleSheet, 
  Switch as RNSwitch,
  StyleProp,
  ViewStyle
} from 'react-native';
import { Text } from './Text';
import Colors from '@/theme/colors';
import { useColorScheme } from '@/components/useColorScheme';

const CASINO_COLORS = {
  background: '#0D1B1E',
  primary: '#35654d',
  gold: '#FFD700',
  surface: '#1C2C2E',
  text: '#B8B8B8'
};

interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Switch({
  value,
  onValueChange,
  label,
  disabled = false,
  style,
}: SwitchProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text 
          variant="bodyNormal" 
          style={[
            styles.label,
            { color: CASINO_COLORS.gold }
          ]}
        >
          {label}
        </Text>
      )}
      <View style={[
        styles.switchContainer,
        { borderColor: CASINO_COLORS.gold }
      ]}>
        <RNSwitch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{
            false: CASINO_COLORS.background,
            true: CASINO_COLORS.background
          }}
          thumbColor={value ? CASINO_COLORS.gold : CASINO_COLORS.text}
          ios_backgroundColor={CASINO_COLORS.background}
          style={{ margin: 0 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  label: {
    marginStart: 12,
  },
  switchContainer: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 0,
    width: 48,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center'
  }
});