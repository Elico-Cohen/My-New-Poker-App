// src/app/dashboard/group-details/[id].tsx
import React from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from '@/components/common/Text';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { DeleteConfirmation } from '@/components/dashboard/DeleteConfirmation';
import { GroupDetailsForm } from '@/components/dashboard/GroupDetailsForm';
import { Dialog } from '@/components/common/Dialog';
import { Icon } from '@/components/common/Icon';
import { Group } from '@/models/Group';
import { getGroupById, updateGroup, deleteGroup } from '@/services/groups';
import { getUserById, updateUser } from '@/services/users';
import { getAllActiveGroups } from '@/services/groups';

const CASINO_COLORS = {
  background: '#0D1B1E',
  primary: '#35654d',
  gold: '#FFD700',
  surface: '#1C2C2E',
  text: '#B8B8B8'
};

export default function GroupDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();

  // מצבי נתונים
  const [group, setGroup] = React.useState<Group | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [originalData, setOriginalData] = React.useState<Group | null>(null);

  // מצבי UI
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = React.useState(false);

  // טעינת נתוני הקבוצה
  React.useEffect(() => {
    loadGroup();
  }, [id]);

  const loadGroup = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!id || typeof id !== 'string') {
        throw new Error('מזהה קבוצה לא תקין');
      }

      const groupData = await getGroupById(id);
      if (!groupData) {
        throw new Error('הקבוצה לא נמצאה');
      }

      setGroup(groupData);
      setOriginalData(groupData);
    } catch (error) {
      console.error('Failed to load group:', error);
      setError('טעינת נתוני הקבוצה נכשלה');
    } finally {
      setLoading(false);
    }
  };

  // עדכון שינויים בטופס
  const handleFormChange = (data: Partial<Group>) => {
    if (!group) return;

    const updatedGroup = {
      ...group,
      ...data
    };

    setGroup(updatedGroup);
    setHasUnsavedChanges(true);
  };

  // בדיקה אם שחקן רשום בקבוצות אחרות
  const checkPlayerInOtherGroups = async (playerId: string): Promise<boolean> => {
    const allGroups = await getAllActiveGroups();
    return allGroups.some(g =>
      g.id !== id &&
      (g.permanentPlayers.includes(playerId) ||
       g.guestPlayers.includes(playerId))
    );
  };

  // טיפול בשחקן שהוסר מהקבוצה
  const handlePlayerRemoval = async (playerId: string) => {
    const isInOtherGroups = await checkPlayerInOtherGroups(playerId);
    
    if (!isInOtherGroups) {
      const player = await getUserById(playerId);
      if (player && player.isActive) {
        await updateUser(playerId, { isActive: false });
        
        if (player.paymentUnitId) {
          // TODO: טיפול ביחידת תשלום
        }
      }
    }
  };

  // שמירת השינויים - כאשר לוחצים על כפתור "שמירה"
  const handleSave = async () => {
    if (!group) return;

    try {
      setSaving(true);
      setError(null);

      await updateGroup(group.id, {
        name: group.name,
        buyIn: group.buyIn,
        rebuy: group.rebuy,
        useRoundingRule: group.useRoundingRule,
        roundingRulePercentage: group.roundingRulePercentage,
        permanentPlayers: group.permanentPlayers,
        guestPlayers: group.guestPlayers
      });

      setOriginalData(group);
      setHasUnsavedChanges(false);

      // עדכון הנתונים במסך הראשי והמעבר חזרה לניהול הקבוצות
      router.push('/dashboard/groups');

    } catch (error) {
      console.error('Failed to save group:', error);
      setError('שמירת השינויים נכשלה');
    } finally {
      setSaving(false);
    }
  };

  // מחיקת הקבוצה
  const handleDelete = async () => {
    if (!group) return;

    try {
      setLoading(true);
      
      const allPlayers = [...group.permanentPlayers, ...group.guestPlayers];
      for (const playerId of allPlayers) {
        await handlePlayerRemoval(playerId);
      }

      await deleteGroup(group.id);
      router.back();

    } catch (error) {
      console.error('Failed to delete group:', error);
      setError('מחיקת הקבוצה נכשלה');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: CASINO_COLORS.background }}>
        <LoadingIndicator text="טוען נתוני קבוצה..." fullscreen />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ 
        flex: 1, 
        backgroundColor: CASINO_COLORS.background,
        padding: 16,
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <Card style={{
          backgroundColor: CASINO_COLORS.surface,
          padding: 16,
          marginBottom: 16,
          borderColor: CASINO_COLORS.gold,
          borderWidth: 1,
        }}>
          <Text style={{ color: CASINO_COLORS.gold }}>{error}</Text>
        </Card>
        <Button 
          title="נסה שוב" 
          onPress={loadGroup}
          icon="refresh"
          style={{
            backgroundColor: CASINO_COLORS.primary,
            borderColor: CASINO_COLORS.gold,
            borderWidth: 2,
          }}
          textStyle={{ color: CASINO_COLORS.gold }}
        />
      </View>
    );
  }

  if (!group) {
    return (
      <View style={{ 
        flex: 1, 
        backgroundColor: CASINO_COLORS.background,
        padding: 16,
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <Text variant="h4" style={{ color: CASINO_COLORS.gold }}>הקבוצה לא נמצאה</Text>
        <Button 
          title="חזור לרשימת הקבוצות" 
          onPress={() => router.back()}
          style={{
            marginTop: 16,
            backgroundColor: CASINO_COLORS.primary,
            borderColor: CASINO_COLORS.gold,
            borderWidth: 2,
          }}
          textStyle={{ color: CASINO_COLORS.gold }}
        />
      </View>
    );
  }

  return (
    <View style={{ 
      flex: 1, 
      backgroundColor: CASINO_COLORS.background,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <View style={{ 
        padding: 16,
        backgroundColor: CASINO_COLORS.primary,
        borderBottomWidth: 2,
        borderBottomColor: CASINO_COLORS.gold,
        flexDirection: 'row', // תמיכה ב-RTL
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 60,
      }}>
        {/* Back Button - עכשיו בצד ימין */}
        <TouchableOpacity 
          onPress={() => {
            if (hasUnsavedChanges) {
              setShowDiscardDialog(true);
            } else {
              router.push('/dashboard/groups');
            }
          }}
          disabled={loading}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(255, 215, 0, 0.1)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Icon 
            name="arrow-right"
            size="medium"
            color={CASINO_COLORS.gold}
            style={{ opacity: loading ? 0.5 : 1 }}
          />
        </TouchableOpacity>

        {/* Title */}
        <Text 
          variant="h4" 
          style={{ 
            color: CASINO_COLORS.gold, 
            flex: 1,
            textAlign: 'center',
            marginHorizontal: 40,
          }}
        >
          {group.name}
        </Text>

        {/* Invisible placeholder for symmetry - עכשיו בצד שמאל */}
        <View style={{ width: 40 }} />
      </View>

      {/* Content Area with Fixed Form */}
      <View style={{ flex: 1, position: 'relative' }}>
        <GroupDetailsForm
          initialData={group}
          onChange={handleFormChange}
          error={error || undefined}
        />
      </View>

      {/* Bottom Action Buttons */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'flex-end',
        padding: 16,
        backgroundColor: CASINO_COLORS.background,
        gap: 8,
      }}>
        <Button
          title="ביטול"
          variant="ghost"
          onPress={() => {
            if (hasUnsavedChanges) {
              setShowDiscardDialog(true);
            } else {
              router.push('/dashboard/groups');
            }
          }}
          style={{ 
            backgroundColor: 'rgba(255, 215, 0, 0.1)'
          }}
          textStyle={{ color: CASINO_COLORS.gold }}
        />
        <Button
          title="שמירה"
          onPress={() => {
            if (hasUnsavedChanges) {
              handleSave();
            } else {
              router.push('/dashboard/groups');
            }
          }}
          loading={saving}
          style={{
            backgroundColor: CASINO_COLORS.primary,
            borderColor: CASINO_COLORS.gold,
            borderWidth: 2,
          }}
          textStyle={{ color: CASINO_COLORS.gold }}
        />
      </View>

      {/* Dialogs */}
      <DeleteConfirmation
        visible={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        itemName={group.name}
        itemType="קבוצה"
      />

      <Dialog
        visible={showDiscardDialog}
        title="ביטול שינויים"
        message="האם אתה בטוח שברצונך לבטל את השינויים?"
        confirmText="בטל שינויים"
        cancelText="המשך עריכה"
        onConfirm={() => {
          setShowDiscardDialog(false);
          if (originalData) {
            setGroup(originalData);
            setHasUnsavedChanges(false);
          }
          router.push('/dashboard/groups');
        }}
        onCancel={() => setShowDiscardDialog(false)}
      />
    </View>
  );
}
