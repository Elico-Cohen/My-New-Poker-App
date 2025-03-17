// src/components/dashboard/EditUserDialog.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  I18nManager,
  StyleSheet,
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { Dialog } from '@/components/common/Dialog';
import { Input } from '@/components/common/Input';
import { Dropdown } from '@/components/common/Dropdown';
import { Switch } from '@/components/common/Switch';
import { Icon } from '@/components/common/Icon';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { UserProfile, UserRole } from '@/models/UserProfile';
import { Group } from '@/models/Group';
import { getAllUsers, updateUser } from '@/services/users';
import { getAllActiveGroups, getGroupById, updateGroup } from '@/services/groups';
import { getPaymentUnitById, updatePaymentUnit } from '@/services/paymentUnits';

// Enable RTL
I18nManager.forceRTL(true);

// קביעת גובה הדיאלוג כ-90% מגובה המסך, וכפתורי הדיאלוג (שמירה וביטול) תופסים כ-80 פיקסלים
const dialogHeight = Dimensions.get('window').height * 0.9;
const contentHeight = dialogHeight - 80;

const CASINO_COLORS = {
  background: '#0D1B1E',
  primary: '#35654d',
  gold: '#FFD700',
  surface: '#1C2C2E',
  text: '#FFFFFF',
  error: '#ff4444',
  success: '#4CAF50'
};

interface EditUserDialogProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: UserProfile;
  userGroups: {
    groupId: string;
    groupName: string;
    isPermanent: boolean;
  }[];
}

interface EditableGroup {
  groupId: string;
  groupName: string;
  isSelected: boolean;
  isPermanent: boolean;
  wasSelected: boolean;
}

export function EditUserDialog({
  visible,
  onClose,
  onSuccess,
  user,
  userGroups
}: EditUserDialogProps) {
  // Form states – נתוני המשתמש
  const [formData, setFormData] = useState({
    name: user.name,
    phone: user.phone,
    role: user.role as UserRole,
    isActive: user.isActive
  });
  const [originalData, setOriginalData] = useState({ ...formData });
  // הודעות שגיאה מתחת לשדות
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  // Groups state
  const [groups, setGroups] = useState<EditableGroup[]>([]);

  // Payment unit states
  const [paymentUnitDetails, setPaymentUnitDetails] = useState<{
    unitId: string;
    unitName: string;
    otherPlayerId: string;
    otherPlayerName: string;
    isActive: boolean;
  } | null>(null);
  const [paymentUnitActive, setPaymentUnitActive] = useState<boolean>(true);
  // For tracking שינוי במצב יחידת התשלום (pending)
  const [pendingPaymentUnitToggle, setPendingPaymentUnitToggle] = useState<boolean | null>(null);

  // UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingUsers, setExistingUsers] = useState<UserProfile[]>([]);

  // Confirmation dialogs
  const [showNameConfirm, setShowNameConfirm] = useState(false);
  const [showPhoneConfirm, setShowPhoneConfirm] = useState(false);
  const [showRoleConfirm, setShowRoleConfirm] = useState(false);
  const [showInactiveConfirmation, setShowInactiveConfirmation] = useState(false);
  const [showGroupRemoveConfirmation, setShowGroupRemoveConfirmation] = useState(false);
  const [groupToRemove, setGroupToRemove] = useState<string | null>(null);
  const [showPaymentUnitToggleConfirm, setShowPaymentUnitToggleConfirm] = useState(false);

  // ניתוח אם בוצעו שינויים (כולל שינוי במצב יחידת התשלום)
  const hasChanges =
    formData.name !== originalData.name ||
    formData.phone !== originalData.phone ||
    formData.role !== originalData.role ||
    formData.isActive !== originalData.isActive ||
    groups.some(group => group.isSelected !== group.wasSelected) ||
    (paymentUnitDetails && paymentUnitActive !== paymentUnitDetails.isActive) ||
    (pendingPaymentUnitToggle !== null);

  useEffect(() => {
    if (visible) {
      loadInitialData();
    }
  }, [visible]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const users = await getAllUsers();
      setExistingUsers(users.filter(u => u.id !== user.id));

      const activeGroups = await getAllActiveGroups();
      const userGroupIds = userGroups.map(g => g.groupId);
      const initialGroups = activeGroups.map(group => ({
        groupId: group.id,
        groupName: group.name,
        isSelected: userGroupIds.includes(group.id),
        isPermanent: userGroups.find(g => g.groupId === group.id)?.isPermanent ?? true,
        wasSelected: userGroupIds.includes(group.id)
      }));
      setGroups(initialGroups);
      setOriginalData({
        name: user.name,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive
      });
      if (user.paymentUnitId) {
        const paymentUnit = await getPaymentUnitById(user.paymentUnitId);
        if (paymentUnit) {
          setPaymentUnitActive(paymentUnit.isActive);
          const otherPlayerId = paymentUnit.players.find(id => id !== user.id);
          if (otherPlayerId) {
            const otherPlayer = users.find(u => u.id === otherPlayerId);
            if (otherPlayer) {
              setPaymentUnitDetails({
                unitId: paymentUnit.id,
                unitName: paymentUnit.name,
                otherPlayerId,
                otherPlayerName: otherPlayer.name,
                isActive: paymentUnit.isActive
              });
            }
          }
        }
      } else {
        setPaymentUnitDetails(null);
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
      setError('טעינת הנתונים נכשלה');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof typeof formData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'name') {
      if (value && value !== user.name && !validateName(value)) {
        setNameError('שם המשתמש כבר קיים במערכת');
      } else {
        setNameError('');
      }
    }
    if (field === 'phone') {
      if (value && value !== user.phone && existingUsers.some(u => u.phone === value)) {
        setPhoneError('מספר הטלפון כבר קיים במערכת');
      } else {
        setPhoneError('');
      }
    }
  };

  const validateName = (name: string): boolean => {
    return !existingUsers.some(u => u.name.toLowerCase() === name.toLowerCase());
  };

  const handleGroupToggle = (groupId: string) => {
    if (!formData.isActive) return;
    setGroups(prev =>
      prev.map(group =>
        group.groupId === groupId
          ? { ...group, isSelected: !group.isSelected }
          : group
      )
    );
  };

  const handleGroupStatusToggle = (groupId: string) => {
    if (!formData.isActive) return;
    setGroups(prev =>
      prev.map(group =>
        group.groupId === groupId
          ? { ...group, isPermanent: !group.isPermanent }
          : group
      )
    );
  };

  const handleGroupRemove = (groupId: string) => {
    const remainingGroups = groups.filter(g => g.isSelected && g.groupId !== groupId);
    if (remainingGroups.length === 0) {
      setGroupToRemove(groupId);
      setShowGroupRemoveConfirmation(true);
    } else {
      handleGroupToggle(groupId);
    }
  };

  const handleInactiveStatusChange = (newStatus: boolean) => {
    handleChange('isActive', newStatus);
    if (!newStatus) {
      setShowInactiveConfirmation(true);
    }
  };

  // Payment Unit toggle – Switch change handler
  const handlePaymentUnitToggle = (newValue: boolean) => {
    setPendingPaymentUnitToggle(newValue);
    setShowPaymentUnitToggleConfirm(true);
  };

  const confirmPaymentUnitToggle = async () => {
    if (!paymentUnitDetails || pendingPaymentUnitToggle === null) return;
    try {
      setLoading(true);
      if (pendingPaymentUnitToggle) {
        // Activate payment unit
        await updatePaymentUnit(paymentUnitDetails.unitId, { isActive: true });
        setPaymentUnitActive(true);
        await updateUser(user.id, { paymentUnitId: paymentUnitDetails.unitId });
      } else {
        // Deactivate payment unit
        await updatePaymentUnit(paymentUnitDetails.unitId, { isActive: false });
        setPaymentUnitActive(false);
      }
      setPaymentUnitDetails(prev =>
        prev ? { ...prev, isActive: pendingPaymentUnitToggle } : null
      );
    } catch (err) {
      console.error('Failed to toggle payment unit:', err);
      setError('עדכון יחידת התשלום נכשל');
    } finally {
      setLoading(false);
      setShowPaymentUnitToggleConfirm(false);
      setPendingPaymentUnitToggle(null);
    }
  };

  const cancelPaymentUnitToggle = () => {
    setShowPaymentUnitToggleConfirm(false);
    setPendingPaymentUnitToggle(null);
  };

  const handleSave = async () => {
    // אם יש pending שינוי במצב יחידת התשלום, נעדכן אותה תחילה
    if (pendingPaymentUnitToggle !== null) {
      await confirmPaymentUnitToggle();
    }
    if (!hasChanges || nameError || phoneError) {
      return;
    }
    if (!formData.name.trim()) {
      setError('נדרש להזין שם משתמש');
      return;
    }
    if (formData.name !== user.name && !validateName(formData.name)) {
      setError('שם המשתמש כבר קיים במערכת');
      return;
    }
    if (formData.phone !== user.phone && phoneError) {
      setError('מספר הטלפון כבר קיים במערכת');
      return;
    }
    if (formData.isActive && groups.filter(g => g.isSelected).length === 0) {
      setError('כדי שהמשתמש יהיה פעיל, יש לרשמו לפחות בקבוצה אחת');
      return;
    }
    if (formData.name !== originalData.name && !showNameConfirm) {
      setShowNameConfirm(true);
      return;
    }
    if (formData.phone !== originalData.phone && !showPhoneConfirm) {
      setShowPhoneConfirm(true);
      return;
    }
    if (formData.role !== originalData.role && !showRoleConfirm) {
      setShowRoleConfirm(true);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await updateUser(user.id, {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        role: formData.role,
        isActive: formData.isActive
      });
      for (const group of groups) {
        if (
          group.isSelected !== group.wasSelected ||
          (group.isSelected && group.wasSelected &&
            group.isPermanent !== userGroups.find(g => g.groupId === group.groupId)?.isPermanent)
        ) {
          const currentGroup = await getGroupById(group.groupId);
          if (!currentGroup) continue;
          const updatedGroup = { ...currentGroup };
          if (group.wasSelected) {
            updatedGroup.permanentPlayers = updatedGroup.permanentPlayers.filter(id => id !== user.id);
            updatedGroup.guestPlayers = updatedGroup.guestPlayers.filter(id => id !== user.id);
          }
          if (group.isSelected) {
            if (group.isPermanent) {
              updatedGroup.permanentPlayers = [...updatedGroup.permanentPlayers, user.id];
            } else {
              updatedGroup.guestPlayers = [...updatedGroup.guestPlayers, user.id];
            }
          }
          await updateGroup(group.groupId, updatedGroup);
        }
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to update user:', err);
      setError('שמירת השינויים נכשלה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {showNameConfirm && (
        <Dialog
          visible={showNameConfirm}
          title="אישור שינוי שם"
          message={`האם אתה בטוח שברצונך לשנות את שם המשתמש ל"${formData.name}"?`}
          confirmText="כן, אשר"
          cancelText="ביטול"
          onConfirm={() => {
            setShowNameConfirm(false);
            handleSave();
          }}
          onCancel={() => {
            setShowNameConfirm(false);
          }}
          type="default"
        />
      )}
      {showPhoneConfirm && (
        <Dialog
          visible={showPhoneConfirm}
          title="אישור שינוי טלפון"
          message={`שינוי מספר הטלפון ישפיע על אפשרויות החיבור. האם להמשיך?`}
          confirmText="כן, אשר"
          cancelText="ביטול"
          onConfirm={() => {
            setShowPhoneConfirm(false);
            handleSave();
          }}
          onCancel={() => {
            setShowPhoneConfirm(false);
          }}
          type="default"
        />
      )}
      {showRoleConfirm && (
        <Dialog
          visible={showRoleConfirm}
          title="אישור שינוי תפקיד"
          message={`האם אתה בטוח שברצונך לשנות את סוג המשתמש ל"${formData.role}"?`}
          confirmText="כן, אשר"
          cancelText="ביטול"
          onConfirm={() => {
            setShowRoleConfirm(false);
            handleSave();
          }}
          onCancel={() => {
            setShowRoleConfirm(false);
          }}
          type="default"
        />
      )}
      {showInactiveConfirmation && (
        <Dialog
          visible={showInactiveConfirmation}
          title="אישור הפיכת משתמש ללא פעיל"
          message={`האם אתה בטוח שברצונך להפוך את המשתמש ${user.name} ללא פעיל? פעולה זו תסיר את המשתמש מכל הקבוצות ומיחידת התשלום.`}
          confirmText="אישור"
          cancelText="ביטול"
          onConfirm={confirmInactiveStatus}
          onCancel={() => {
            setShowInactiveConfirmation(false);
            handleChange('isActive', true);
          }}
          type="default"
        />
      )}
      {showPaymentUnitToggleConfirm && (
        <Dialog
          visible={showPaymentUnitToggleConfirm}
          title={pendingPaymentUnitToggle ? "אישור הפעלת יחידת תשלום" : "אישור כיבוי יחידת תשלום"}
          message={
            pendingPaymentUnitToggle
              ? "האם אתה בטוח שברצונך להפעיל מחדש את יחידת התשלום? פעולה זו תוסיף את המשתמש הנוכחי ואת המשתמש השני ליחידה ותסמן אותה כפעילה."
              : "האם אתה בטוח שברצונך לכבות את יחידת התשלום? פעולה זו תסיר את המשתמש הנוכחי ואת המשתמש השני מהיחידה ותסמן אותה כלא פעילה."
          }
          confirmText="כן, אשר"
          cancelText="ביטול"
          onConfirm={confirmPaymentUnitToggle}
          onCancel={cancelPaymentUnitToggle}
          type="default"
        />
      )}
      {showGroupRemoveConfirmation && (
        <Dialog
          visible={showGroupRemoveConfirmation}
          title="אישור הסרה מקבוצה"
          onClose={() => {
            setShowGroupRemoveConfirmation(false);
            setGroupToRemove(null);
          }}
          confirmText=""
          cancelText=""
        >
          <View style={{ padding: 16 }}>
            <Text style={styles.inlineErrorText}>
              הסרת המשתמש מקבוצה זו תהפוך אותו ללא פעיל כיוון שזו הקבוצה האחרונה שלו. האם להמשיך?
            </Text>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'flex-start', gap: 8, marginTop: 16 }}>
              <Button
                title="אישור"
                style={{ backgroundColor: CASINO_COLORS.primary, borderWidth: 1, borderColor: CASINO_COLORS.gold }}
                textStyle={{ color: CASINO_COLORS.gold }}
                onPress={() => {
                  if (groupToRemove) {
                    handleGroupToggle(groupToRemove);
                    handleInactiveStatusChange(false);
                  }
                  setShowGroupRemoveConfirmation(false);
                  setGroupToRemove(null);
                }}
              />
              <Button
                title="ביטול"
                variant="ghost"
                style={{ backgroundColor: 'rgba(255, 215, 0, 0.1)' }}
                textStyle={{ color: CASINO_COLORS.gold }}
                onPress={() => {
                  setShowGroupRemoveConfirmation(false);
                  setGroupToRemove(null);
                }}
              />
            </View>
          </View>
        </Dialog>
      )}

      <Dialog
        visible={visible}
        onClose={onClose}
        title={`עריכת משתמש - ${user.name}`}
        confirmText="שמירה"
        cancelText="ביטול"
        onConfirm={handleSave}
        onCancel={onClose}
      >
        {/* מיכל תוכן הדיאלוג – מוגדר בגובה קבוע (contentHeight) */}
        <View style={[styles.contentContainer, { height: contentHeight }]}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
          >
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>פרטי משתמש</Text>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>שם משתמש</Text>
                <Input
                  value={formData.name}
                  onChangeText={(value) => handleChange('name', value)}
                  placeholder="הכנס שם משתמש"
                  style={styles.inputField}
                />
                {nameError ? (
                  <Text style={styles.inlineErrorText}>{nameError}</Text>
                ) : null}
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>מספר טלפון</Text>
                <Input
                  value={formData.phone}
                  onChangeText={(value) => handleChange('phone', value)}
                  placeholder="05X-XXXXXXX"
                  keyboardType="phone-pad"
                  style={styles.inputField}
                />
                {phoneError ? (
                  <Text style={styles.inlineErrorText}>{phoneError}</Text>
                ) : null}
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>סוג משתמש</Text>
                <Dropdown
                  value={formData.role}
                  onSelect={(value) => handleChange('role', value)}
                  items={[
                    { label: 'רגיל', value: 'regular' },
                    { label: 'סופר', value: 'super' },
                    { label: 'מנהל', value: 'admin' }
                  ]}
                />
              </View>
              <View style={styles.fieldSwitch}>
                <Switch
                  value={formData.isActive}
                  onValueChange={handleInactiveStatusChange}
                  label="משתמש פעיל"
                />
              </View>
            </View>

            {paymentUnitDetails && (
              <View style={styles.paymentUnitContainer}>
                <Text style={styles.paymentUnitTitle}>יחידת תשלום</Text>
                <View style={styles.paymentUnitRow}>
                  <Icon name="cash" size="small" color={CASINO_COLORS.gold} />
                  <Text style={styles.paymentUnitText}>
                    {paymentUnitDetails.unitName} - עם {paymentUnitDetails.otherPlayerName}
                  </Text>
                </View>
                <View style={styles.paymentUnitSwitchContainer}>
                  <Text style={styles.paymentUnitSwitchLabel}>פעילות יחידת תשלום</Text>
                  <Switch
                    value={paymentUnitActive}
                    onValueChange={handlePaymentUnitToggle}
                    label=""
                  />
                </View>
              </View>
            )}

            {groups.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>קבוצות</Text>
                <View style={styles.groupsContainer}>
                  {groups.map(group => (
                    <View key={group.groupId} style={[
                      styles.groupRow,
                      { borderColor: group.isSelected ? CASINO_COLORS.gold : 'transparent' }
                    ]}>
                      <View style={styles.groupInfo}>
                        <Switch
                          value={group.isSelected}
                          onValueChange={() => handleGroupToggle(group.groupId)}
                          disabled={!formData.isActive}
                        />
                        <Text style={styles.groupName}>
                          {group.groupName}
                        </Text>
                      </View>
                      {group.isSelected && (
                        <View style={styles.groupActions}>
                          <Button
                            title={group.isPermanent ? "קבוע" : "אורח"}
                            size="small"
                            variant="outline"
                            onPress={() => handleGroupStatusToggle(group.groupId)}
                            disabled={!formData.isActive}
                            style={styles.groupActionButton}
                            textStyle={styles.groupActionText}
                          />
                        </View>
                      )}
                    </View>
                  ))}
                </View>
                {formData.isActive && groups.filter(g => g.isSelected).length === 0 && (
                  <Text style={styles.inlineErrorText}>
                    כדי שהמשתמש יהיה פעיל, יש לרשמו לפחות בקבוצה אחת
                  </Text>
                )}
              </View>
            )}
            <View style={{ flex: 1 }} />
          </ScrollView>
        </View>
      </Dialog>
    </>
  );
}

export default EditUserDialog;

const styles = StyleSheet.create({
  // מיכל תוכן הדיאלוג – גובה קבוע לפי contentHeight
  contentContainer: {
    height: contentHeight,
    width: '100%',
    flexDirection: 'column',
  },
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    paddingBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CASINO_COLORS.error,
    marginBottom: 16,
  },
  errorText: {
    color: CASINO_COLORS.error,
    textAlign: 'right',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: CASINO_COLORS.gold,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  field: {
    marginBottom: 12,
  },
  fieldLabel: {
    color: CASINO_COLORS.text,
    marginBottom: 4,
    textAlign: 'right',
  },
  inputField: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderColor: CASINO_COLORS.gold,
    color: CASINO_COLORS.text,
    textAlign: 'right',
  },
  inlineErrorText: {
    color: CASINO_COLORS.error,
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  fieldSwitch: {
    alignItems: 'flex-end',
  },
  paymentUnitContainer: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
    marginBottom: 24,
  },
  paymentUnitTitle: {
    color: CASINO_COLORS.gold,
    marginBottom: 8,
    textAlign: 'right',
  },
  paymentUnitRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  paymentUnitText: {
    color: CASINO_COLORS.text,
    marginRight: 8,
    textAlign: 'right',
  },
  paymentUnitSwitchContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginTop: 12,
  },
  paymentUnitSwitchLabel: {
    color: CASINO_COLORS.text,
    fontSize: 16,
    marginRight: 8,
    textAlign: 'right',
  },
  groupsContainer: {
    // אין שינוי כאן
  },
  groupRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  groupInfo: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  groupName: {
    color: CASINO_COLORS.text,
    marginRight: 8,
    textAlign: 'right',
  },
  groupActions: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  groupActionButton: {
    borderColor: CASINO_COLORS.gold,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  groupActionText: {
    color: CASINO_COLORS.gold,
  },
});
