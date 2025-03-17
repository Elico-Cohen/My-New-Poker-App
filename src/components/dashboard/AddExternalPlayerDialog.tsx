// src/components/dashboard/AddExternalPlayerDialog.tsx

import React from 'react';
import { ScrollView, TouchableOpacity, StyleSheet, View, Dimensions } from 'react-native';
import { Text } from '@/components/common/Text';
import { Icon } from '@/components/common/Icon';
import { Dialog } from '@/components/common/Dialog';
import Colors from '@/theme/colors';

const GOLD = '#FFD700';
const windowHeight = Dimensions.get('window').height;

export interface AddExternalPlayerDialogProps {
  visible: boolean;
  externalPlayers: { id: string; name: string; isFromGroup?: boolean }[];
  selectedExternalPlayerIds: string[];
  onToggleSelection: (playerId: string) => void;
  onConfirm: () => void;
  onAddNew: () => void;
  onCancel: () => void;
}

export default function AddExternalPlayerDialog({
  visible,
  externalPlayers,
  selectedExternalPlayerIds,
  onToggleSelection,
  onConfirm,
  onAddNew,
  onCancel,
}: AddExternalPlayerDialogProps) {
  // Split players into group and external players
  const groupPlayers = externalPlayers.filter(p => p.isFromGroup);
  const nonGroupPlayers = externalPlayers.filter(p => !p.isFromGroup);

  return (
    <Dialog
      visible={visible}
      title="הוספת שחקנים"
      confirmText="אישור"
      cancelText="סגור"
      onConfirm={onConfirm}
      onCancel={onCancel}
      containerStyle={styles.dialogContainer}
      style={styles.dialogStyle}
    >
      <View style={styles.wrapper}>
        {/* כפתור "הוסף שחקן חדש" בראש הדיאלוג */}
        <TouchableOpacity style={styles.addNewButton} onPress={onAddNew}>
          <Text style={styles.addNewButtonText}>הוסף שחקן חדש</Text>
        </TouchableOpacity>
        
        <ScrollView style={styles.scrollView}>
          {/* Group Players Section */}
          {groupPlayers.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>שחקני הקבוצה</Text>
              <View style={styles.grid}>
                {groupPlayers.map((player) => (
                  <TouchableOpacity
                    key={player.id}
                    style={[
                      styles.playerBox,
                      selectedExternalPlayerIds.includes(player.id) && styles.playerBoxSelected,
                    ]}
                    onPress={() => onToggleSelection(player.id)}
                  >
                    <View style={styles.playerContent}>
                      <Text style={styles.playerName}>{player.name}</Text>
                      {selectedExternalPlayerIds.includes(player.id) && (
                        <Icon name="check" size="small" color={GOLD} />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* External Players Section */}
          {nonGroupPlayers.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>שחקנים מקבוצות אחרות</Text>
              <View style={styles.grid}>
                {nonGroupPlayers.map((player) => (
                  <TouchableOpacity
                    key={player.id}
                    style={[
                      styles.playerBox,
                      selectedExternalPlayerIds.includes(player.id) && styles.playerBoxSelected,
                    ]}
                    onPress={() => onToggleSelection(player.id)}
                  >
                    <View style={styles.playerContent}>
                      <Text style={styles.playerName}>{player.name}</Text>
                      {selectedExternalPlayerIds.includes(player.id) && (
                        <Icon name="check" size="small" color={GOLD} />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  dialogContainer: {
    backgroundColor: Colors.dark.background,
    padding: 16,
    borderRadius: 8,
    width: '95%',
    alignSelf: 'center',
    maxHeight: windowHeight * 0.8,
  },
  dialogStyle: {
    width: '100%',
    alignSelf: 'stretch',
  },
  wrapper: {
    width: '100%',
    maxHeight: windowHeight * 0.7,
  },
  scrollView: {
    maxHeight: windowHeight * 0.6,
  },
  addNewButton: {
    backgroundColor: '#35654d',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  addNewButtonText: {
    color: GOLD,
    fontSize: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: GOLD,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'right',
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  playerBox: {
    backgroundColor: Colors.dark.surface,
    width: '48%',
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.5)',
    borderRadius: 8,
  },
  playerBoxSelected: {
    backgroundColor: '#35654d',
  },
  playerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playerName: {
    color: GOLD,
    fontSize: 16,
    flex: 1,
    textAlign: 'right',
  },
});