// src/app/dashboard/groups.tsx
import React from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/common/Text';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { Dialog } from '@/components/common/Dialog';
import { Group } from '@/models/Group';
import { getAllActiveGroups, deleteGroup } from '@/services/groups';
import { useAuth } from '@/contexts/AuthContext';

const CASINO_COLORS = {
  background: '#0D1B1E',
  primary: '#35654d',
  gold: '#FFD700',
  surface: '#1C2C2E',
  text: '#B8B8B8',
  success: '#22c55e'
};

export default function GroupsScreen() {
  const router = useRouter();
  const { canDeleteEntity } = useAuth();
  
  const [groups, setGroups] = React.useState<Group[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteDialogVisible, setDeleteDialogVisible] = React.useState(false);
  const [groupToDelete, setGroupToDelete] = React.useState<Group | null>(null);

  React.useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedGroups = await getAllActiveGroups();
      setGroups(fetchedGroups);
    } catch (error) {
      console.error('Failed to load groups:', error);
      setError('טעינת הקבוצות נכשלה. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  // ניווט למסך יצירת קבוצה חדשה
  const handleAddGroup = () => {
    router.push('/dashboard/group-details/new');
  };

  const handleEditGroup = (groupId: string) => {
    router.push(`/dashboard/group-details/${groupId}`);
  };

  const handleDeleteGroup = async (group: Group) => {
    // Check if user has delete permissions
    if (!canDeleteEntity('group')) {
      setError('אין לך הרשאות למחיקת קבוצה');
      return;
    }
    
    setGroupToDelete(group);
    setDeleteDialogVisible(true);
  };

  const confirmDelete = async () => {
    if (!groupToDelete) return;
    
    try {
      setLoading(true);
      await deleteGroup(groupToDelete.id);
      await loadGroups();
      setDeleteDialogVisible(false);
      setGroupToDelete(null);
    } catch (error) {
      console.error('Failed to delete group:', error);
      setError('מחיקת הקבוצה נכשלה. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.fullScreen}>
        <LoadingIndicator text="טוען קבוצות..." fullscreen />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.fullScreenCentered}>
        <Card style={styles.errorCard}>
          <Text style={{ color: CASINO_COLORS.gold }}>{error}</Text>
        </Card>
        <Button 
          title="נסה שוב" 
          onPress={loadGroups}
          icon="refresh"
          style={styles.retryButton}
        />
      </View>
    );
  }

  if (groups.length === 0) {
    return (
      <View style={styles.fullScreenCentered}>
        <Icon 
          name="account-group" 
          size="xlarge" 
          color={CASINO_COLORS.gold}
          style={{ marginBottom: 16 }}
        />
        <Text 
          variant="bodyLarge" 
          style={styles.noGroupsText}
        >
          {"אין קבוצות זמינות.\nצור קבוצה חדשה כדי להתחיל!"}
        </Text>
        <Button 
          title="הוספת קבוצה חדשה" 
          onPress={handleAddGroup}
          icon="account-group"
          style={styles.addButton}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.replace('/dashboard')}
          style={styles.backButton}
        >
          <Icon name="arrow-right" size="medium" color={CASINO_COLORS.gold} />
        </TouchableOpacity>
        <Text variant="h4" style={styles.headerTitle}>
          ניהול קבוצות
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Add Group Button */}
      <View style={styles.addButtonContainer}>
        <Button
          title="הוספת קבוצה חדשה"
          icon="account-group"
          onPress={handleAddGroup}
          style={styles.addButton}
          textStyle={styles.addButtonText}
        />
      </View>

      {/* Groups List */}
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {groups.map((group) => (
          <Card 
            key={group.id}
            style={styles.card}
          >
            {/* Group Header */}
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.statusIndicator} />
                <Text variant="h4" style={styles.groupName}>
                  {group.name}
                </Text>
              </View>
              <View style={styles.cardHeaderRight}>
                <Button
                  variant="ghost"
                  icon="pencil"
                  iconColor={CASINO_COLORS.gold}
                  iconSize={24}
                  onPress={() => handleEditGroup(group.id)}
                  style={styles.editButton}
                />
                {/* Only show delete button if user has permission */}
                {canDeleteEntity('group') && (
                  <Button
                    variant="ghost"
                    icon="trash-can"
                    iconColor="#ef4444"
                    iconSize={24}
                    onPress={() => handleDeleteGroup(group)}
                    style={styles.deleteButton}
                  />
                )}
              </View>
            </View>

            {/* Buy-in & Rebuy Info */}
            <View style={styles.infoContainer}>
              {/* Buy-in */}
              <View style={styles.infoBlock}>
                <View style={styles.infoRow}>
                  <Icon name="poker-chip" size="small" color={CASINO_COLORS.gold} />
                  <Text variant="bodyNormal" style={styles.infoLabel}>
                    Buy-in
                  </Text>
                </View>
                <View style={styles.infoBox}>
                  <Text variant="bodyNormal" style={styles.infoTextBold}>
                    {group.buyIn.chips.toLocaleString()} צ'יפים
                  </Text>
                  <Text variant="bodySmall" style={styles.infoTextSmall}>
                    ₪{group.buyIn.amount} לקנייה
                  </Text>
                </View>
              </View>

              {/* Rebuy */}
              <View style={styles.infoBlock}>
                <View style={styles.infoRow}>
                  <Icon name="refresh" size="small" color={CASINO_COLORS.gold} />
                  <Text variant="bodyNormal" style={styles.infoLabel}>
                    Rebuy
                  </Text>
                </View>
                <View style={styles.infoBox}>
                  <Text variant="bodyNormal" style={styles.infoTextBold}>
                    {group.rebuy.chips.toLocaleString()} צ'יפים
                  </Text>
                  <Text variant="bodySmall" style={styles.infoTextSmall}>
                    ₪{group.rebuy.amount} לקנייה
                  </Text>
                </View>
              </View>
            </View>

            {/* Players Info */}
            <View style={styles.playersContainer}>
              <View style={styles.playersBlock}>
                <Icon name="account-multiple" size="small" color={CASINO_COLORS.gold} />
                <Text variant="bodyNormal" style={styles.playersText}>
                  {group.permanentPlayers.length} שחקנים קבועים
                </Text>
              </View>
              <View style={styles.playersBlock}>
                <Icon name="account-multiple-outline" size="small" color={CASINO_COLORS.gold} />
                <Text variant="bodyNormal" style={styles.playersText}>
                  {group.guestPlayers.length} אורחים
                </Text>
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>

      {/* Delete Confirmation Dialog */}
      <Dialog
        visible={deleteDialogVisible}
        title="אישור מחיקת קבוצה"
        message={`האם אתה בטוח שברצונך למחוק את הקבוצה "${groupToDelete?.name}"? פעולה זו לא ניתנת לביטול.`}
        confirmText="מחק"
        cancelText="ביטול"
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleteDialogVisible(false);
          setGroupToDelete(null);
        }}
        type="danger"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: CASINO_COLORS.background,
  },
  fullScreenCentered: {
    flex: 1,
    backgroundColor: CASINO_COLORS.background,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: CASINO_COLORS.background,
  },
  header: {
    padding: 16,
    backgroundColor: CASINO_COLORS.primary,
    borderBottomWidth: 2,
    borderBottomColor: CASINO_COLORS.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,215,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: CASINO_COLORS.gold,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 40,
  },
  addButtonContainer: {
    padding: 16,
  },
  addButton: {
    backgroundColor: CASINO_COLORS.primary,
    borderColor: CASINO_COLORS.gold,
    borderWidth: 2,
    paddingVertical: 12,
  },
  addButtonText: {
    fontSize: 18,
    color: CASINO_COLORS.gold,
  },
  scrollContainer: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
    backgroundColor: CASINO_COLORS.surface,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: `${CASINO_COLORS.gold}30`,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: CASINO_COLORS.success,
    marginEnd: 8,
  },
  groupName: {
    color: CASINO_COLORS.gold,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    gap: 20,
  },
  infoContainer: {
    padding: 16,
    flexDirection: 'row',
    gap: 16,
  },
  infoBlock: {
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    marginStart: 8,
    color: CASINO_COLORS.gold,
  },
  infoBox: {
    backgroundColor: `${CASINO_COLORS.primary}30`,
    padding: 8,
    borderRadius: 8,
  },
  infoTextBold: {
    color: CASINO_COLORS.gold,
    fontWeight: 'bold',
  },
  infoTextSmall: {
    color: `${CASINO_COLORS.gold}70`,
  },
  playersContainer: {
    backgroundColor: `${CASINO_COLORS.primary}20`,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: `${CASINO_COLORS.gold}30`,
  },
  playersBlock: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playersText: {
    marginStart: 8,
    color: CASINO_COLORS.gold,
  },
  errorCard: {
    backgroundColor: CASINO_COLORS.surface,
    padding: 16,
    borderColor: CASINO_COLORS.gold,
    borderWidth: 1,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: CASINO_COLORS.primary,
    borderColor: CASINO_COLORS.gold,
    borderWidth: 2,
  },
  noGroupsText: {
    color: CASINO_COLORS.gold,
    textAlign: 'center',
    marginBottom: 20,
  },
  editButton: {
    padding: 8,
    marginEnd: 4,
  },
  deleteButton: {
    padding: 8,
    marginStart: 4,
  },
});