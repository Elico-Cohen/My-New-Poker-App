import React, { useState } from 'react';  // ייבוא useState מ-react
import {
  View,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  StyleProp,
  ViewStyle
} from 'react-native';
import { Text } from './Text';
import { Icon } from './Icon';
import Colors from '@/theme/colors';
import { useColorScheme } from '@/components/useColorScheme';

type DropdownItem = {
  label: string;
  value: string;
};

interface DropdownProps {
  label?: string;
  value: string;
  items: DropdownItem[];
  onSelect: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  rtl?: boolean; // תכונה חדשה לתמיכה ב-RTL
}

export function Dropdown(props: DropdownProps) {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const isRTL = props.rtl !== undefined ? props.rtl : true; // ברירת מחדל היא תמיכה ב-RTL

  const selectedItem = props.items && props.items.length > 0 
    ? props.items.find(item => item.value === props.value) 
    : undefined;

  const renderItem = ({ item }: { item: DropdownItem }) => (
    <TouchableOpacity
      style={[
        styles.item,
        isRTL ? styles.itemRTL : {}, // מוסיף סגנון RTL אם צריך
        {
          backgroundColor:
            item.value === props.value
              ? theme.surfaceVariant
              : 'transparent',
        },
      ]}
      onPress={() => {
        props.onSelect(item.value);
        setIsVisible(false);
      }}
    >
      <Text variant="bodyNormal" style={isRTL ? styles.itemTextRTL : {}}>
        {item.label}
      </Text>
      {item.value === props.value && (
        <Icon
          name="check"
          size="medium"
          color={theme.primary}
        />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={props.style}>
      {props.label && (
        <Text variant="bodySmall" style={[styles.label, isRTL ? styles.labelRTL : {}]}>
          {props.label}
        </Text>
      )}

      <TouchableOpacity
        style={[
          styles.button,
          isRTL ? styles.buttonRTL : {}, // מוסיף סגנון RTL אם צריך
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            opacity: props.disabled ? 0.5 : 1,
          },
        ]}
        onPress={() => !props.disabled && setIsVisible(true)}
        disabled={props.disabled}
      >
        <Text 
          variant="bodyNormal" 
          style={[
            styles.buttonText,
            isRTL ? styles.buttonTextRTL : {}
          ]}
        >
          {selectedItem ? selectedItem.label : props.placeholder || 'Select an option'}
        </Text>
        <Icon
          name="menu-down"
          size="medium"
          color={theme.textSecondary}
        />
      </TouchableOpacity>

      <Modal
        visible={isVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsVisible(false)}
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <FlatList
              data={props.items}
              keyExtractor={item => item.value}
              renderItem={renderItem}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: 4,
  },
  labelRTL: {
    textAlign: 'right',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  },
  buttonRTL: {
    flexDirection: 'row-reverse', // הפוך את כיוון האייקון והטקסט
  },
  buttonText: {
    flex: 1,
    marginRight: 8,
  },
  buttonTextRTL: {
    textAlign: 'right',
    marginRight: 0,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalContent: {
    maxHeight: '70%',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  },
  itemRTL: {
    flexDirection: 'row-reverse', // הפוך את כיוון האייקון והטקסט
  },
  itemTextRTL: {
    textAlign: 'right',
  },
});