import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from '@/components/common/Text';
import { Icon } from '@/components/common/Icon';
import { HandoffEvent } from '@/models/Game';

const CASINO_COLORS = {
  background: '#0D1B1E',
  surface: '#1C2C2E',
  primary: '#35654d',
  gold: '#FFD700',
  text: '#FFFFFF'
};

interface HandoffHistoryProps {
  handoffLog: HandoffEvent[];
  originalCreator?: string;
}

export const HandoffHistory: React.FC<HandoffHistoryProps> = ({
  handoffLog,
  originalCreator
}) => {
  if (!handoffLog || handoffLog.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Icon name="clipboard-list" size="small" color={CASINO_COLORS.gold} />
          <Text style={styles.headerText}>העברות שליטה</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            לא בוצעו העברות שליטה במשחק זה
          </Text>
        </View>
      </View>
    );
  }

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  const getInitiatorLabel = (event: HandoffEvent): string => {
    if (event.initiatedBy === event.fromAuthUid) {
      return 'יזם: בעלים';
    }
    return 'יזם: מנהל';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Icon name="clipboard-list" size="small" color={CASINO_COLORS.gold} />
        <Text style={styles.headerText}>העברות שליטה</Text>
      </View>

      <ScrollView style={styles.logContainer}>
        {handoffLog.map((event, index) => (
          <View
            key={event.id}
            style={[
              styles.logItem,
              index === handoffLog.length - 1 && styles.logItemLast
            ]}
          >
            {/* Event Number & Date */}
            <View style={styles.logItemHeader}>
              <Text style={styles.logNumber}>{index + 1}.</Text>
              <Text style={styles.logDate}>{formatDate(event.timestamp)}</Text>
            </View>

            {/* Transfer Arrow */}
            <View style={styles.transferRow}>
              <Text style={styles.userName}>{event.fromUserName}</Text>
              <Icon name="arrow-left" size="small" color={CASINO_COLORS.gold} />
              <Text style={styles.userName}>{event.toUserName}</Text>
            </View>

            {/* Reason */}
            {event.reason && (
              <View style={styles.reasonContainer}>
                <Text style={styles.reasonLabel}>סיבה:</Text>
                <Text style={styles.reasonText}>"{event.reason}"</Text>
              </View>
            )}

            {/* Initiator */}
            <Text style={styles.initiatorText}>
              ({getInitiatorLabel(event)})
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Original Creator Note */}
      {originalCreator && (
        <View style={styles.originalCreatorNote}>
          <Icon name="information-outline" size="tiny" color="rgba(255, 255, 255, 0.5)" />
          <Text style={styles.originalCreatorText}>
            יוצר המשחק המקורי: {originalCreator}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: CASINO_COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
    padding: 12,
    marginVertical: 10
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 215, 0, 0.3)'
  },
  headerText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CASINO_COLORS.gold
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    fontStyle: 'italic'
  },
  logContainer: {
    maxHeight: 300
  },
  logItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 215, 0, 0.2)'
  },
  logItemLast: {
    borderBottomWidth: 0
  },
  logItemHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  logNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: CASINO_COLORS.gold
  },
  logDate: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)'
  },
  transferRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 8
  },
  userName: {
    fontSize: 14,
    color: CASINO_COLORS.text,
    fontWeight: '600'
  },
  reasonContainer: {
    flexDirection: 'row-reverse',
    gap: 6,
    marginBottom: 4,
    paddingHorizontal: 8
  },
  reasonLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)'
  },
  reasonText: {
    flex: 1,
    fontSize: 12,
    color: CASINO_COLORS.text,
    fontStyle: 'italic',
    textAlign: 'right'
  },
  initiatorText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'right',
    paddingHorizontal: 8
  },
  originalCreatorNote: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 215, 0, 0.2)'
  },
  originalCreatorText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    fontStyle: 'italic'
  }
});
