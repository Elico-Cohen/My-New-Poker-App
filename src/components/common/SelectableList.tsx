import React from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import { Text } from './Text';
import { Icon } from './Icon';
import Colors from '@/theme/colors';
import { useColorScheme } from '@/components/useColorScheme';

interface SelectableListItemProps {
  id: string;
  title: string;
  subtitle?: string;
  selected?: boolean;
  disabled?: boolean;
}

interface SelectableListProps {
  data: SelectableListItemProps[];
  onSelect: (id: string) => void;
  multiSelect?: boolean;
  style?: StyleProp<ViewStyle>;
}

function SelectableListItem({
  title,
  subtitle,
  selected = false,
  disabled = false,
  onSelect,
}: SelectableListItemProps & { onSelect: () => void }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <TouchableOpacity
      style={[
        styles.item,
        {
          backgroundColor: selected ? theme.surfaceVariant : theme.surface,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
      onPress={!disabled ? onSelect : undefined}
      disabled={disabled}
    >
      <View style={styles.itemContent}>
        <Text variant="bodyNormal">{title}</Text>
        {subtitle && (
          <Text
            variant="bodySmall"
            style={{ color: theme.textSecondary }}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {selected && (
        <Icon
          name="check"
          size="medium"
          color={theme.primary}
        />
      )}
    </TouchableOpacity>
  );
}

export function SelectableList({
  data,
  onSelect,
  multiSelect = false,
  style,
}: SelectableListProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const renderItem = ({ item }: { item: SelectableListItemProps }) => (
    <SelectableListItem
      {...item}
      onSelect={() => onSelect(item.id)}
    />
  );

  return (
    <View style={[styles.container, { borderColor: theme.border }, style]}>
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        ItemSeparatorComponent={() => (
          <View 
            style={[
              styles.separator,
              { backgroundColor: theme.border }
            ]} 
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  itemContent: {
    flex: 1,
    marginEnd: 16,
  },
  separator: {
    height: 1,
  },
});