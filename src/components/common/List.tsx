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
import Colors from '@/theme/colors';
import { useColorScheme } from '@/components/useColorScheme';

interface ListItemProps {
  title: string;
  subtitle?: string;
  rightText?: string;
  onPress?: () => void;
  disabled?: boolean;
}

interface ListProps {
  data: ListItemProps[];
  style?: StyleProp<ViewStyle>;
}

function ListItem({
  title,
  subtitle,
  rightText,
  onPress,
  disabled = false,
}: ListItemProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      style={[
        styles.item,
        {
          backgroundColor: theme.surface,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
      onPress={!disabled ? onPress : undefined}
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
      {rightText && (
        <Text
          variant="bodyNormal"
          style={{ color: theme.textSecondary }}
        >
          {rightText}
        </Text>
      )}
    </Container>
  );
}

export function List({ data, style }: ListProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const renderItem = ({ item }: { item: ListItemProps }) => (
    <ListItem {...item} />
  );

  return (
    <View style={[styles.container, { borderColor: theme.border }, style]}>
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(_, index) => index.toString()}
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