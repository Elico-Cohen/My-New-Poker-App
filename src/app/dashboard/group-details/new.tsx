// src/app/dashboard/group-details/new.tsx
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/common/Text';
import { GroupDetailsForm } from '@/components/dashboard/GroupDetailsForm';
import { Button } from '@/components/common/Button';
import { Dialog } from '@/components/common/Dialog';
import { Icon } from '@/components/common/Icon';
import { createGroup } from '@/services/groups';
import { Group } from '@/models/Group';

const CASINO_COLORS = {
  background: '#0D1B1E',
  primary: '#35654d',
  gold: '#FFD700',
  surface: '#1C2C2E',
  text: '#B8B8B8',
};

export default function NewGroupScreen() {
  const router = useRouter();

  // הגדרות ברירת מחדל לקבוצה חדשה
  const [group, setGroup] = React.useState<Omit<Group, 'id' | 'createdAt' | 'updatedAt'>>({
    name: '',
    buyIn: { chips: 0, amount: 0 },
    rebuy: { chips: 0, amount: 0 },
    useRoundingRule: true,
    roundingRulePercentage: 80,
    permanentPlayers: [],
    guestPlayers: [],
    isActive: true,
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showDiscardDialog, setShowDiscardDialog] = React.useState(false);

  // עדכון הטופס כאשר המשתמש משנה נתונים
  const handleFormChange = (data: Partial<Group>) => {
    setGroup(prev => ({ ...prev, ...data }));
    setHasUnsavedChanges(true);
  };

  // טיפול בלחיצה על כפתור השמירה
  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);
      // קריאה ליצירת הקבוצה החדשה במסד הנתונים
      await createGroup(group);
      // לאחר הצלחה, העבר את המשתמש למסך ניהול הקבוצות
      router.push('/dashboard/groups');
    } catch (err) {
      console.error('Failed to create group:', err);
      setError('שמירת הקבוצה נכשלה. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  // טיפול בלחיצה על כפתור הביטול
  const handleCancel = () => {
    if (hasUnsavedChanges) {
      setShowDiscardDialog(true);
    } else {
      router.push('/dashboard/groups');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleCancel}>
          <Icon name="arrow-right" size="medium" color={CASINO_COLORS.gold} />
        </TouchableOpacity>
        <Text variant="h4" style={styles.headerTitle}>
          הוספת קבוצה חדשה
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Form Area */}
      <View style={styles.formContainer}>
        <GroupDetailsForm initialData={group} onChange={handleFormChange} error={error || undefined} />
      </View>

      {/* Bottom Action Buttons */}
      <View style={styles.buttonContainer}>
        <Button title="ביטול" variant="ghost" onPress={handleCancel} />
        <Button title="שמירה" onPress={handleSave} loading={loading} disabled={!hasUnsavedChanges} />
      </View>

      {/* Discard Changes Dialog */}
      <Dialog
        visible={showDiscardDialog}
        title="ביטול שינויים"
        message="האם אתה בטוח שברצונך לבטל את השינויים?"
        confirmText="בטל שינויים"
        cancelText="המשך עריכה"
        onConfirm={() => {
          setShowDiscardDialog(false);
          router.push('/dashboard/groups');
        }}
        onCancel={() => setShowDiscardDialog(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CASINO_COLORS.background,
  },
  header: {
    padding: 16,
    backgroundColor: CASINO_COLORS.primary,
    borderBottomWidth: 2,
    borderBottomColor: CASINO_COLORS.gold,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 60,
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
  formContainer: {
    flex: 1,
    padding: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: CASINO_COLORS.gold,
  },
});
