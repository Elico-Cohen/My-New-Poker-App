// src/components/dashboard/EditUserDialog.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  I18nManager,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  TouchableWithoutFeedback,
  Pressable,
  GestureResponderEvent,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { deleteField } from 'firebase/firestore';
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
import { createNewPlayerAndAddToGroup, createAuthUserAndUpdateFirestore, deleteAuthUserByEmail } from '@/services/playerManagement/playerManagement';

// Enable RTL
I18nManager.forceRTL(true);

// קביעת גובה הדיאלוג כ-80% מגובה המסך
const dialogHeight = Dimensions.get('window').height * 0.8;
const contentHeight = dialogHeight - 120; // משאיר יותר מקום לכפתורים

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

// פונקציה שמאפשרת שימוש ב-TouchableOpacity אבל מעבירה אירועי גלילה
const TouchableThatPassesScroll = ({ 
  children, 
  onPress, 
  ...props 
}: { 
  children: React.ReactNode; 
  onPress?: () => void; 
  [key: string]: any; 
}) => {
  return (
    <Pressable
      onPress={onPress}
      delayLongPress={300}
      {...props}
    >
      {children}
    </Pressable>
  );
};

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
    email: user.email || '',
    role: user.role as UserRole,
    isActive: user.isActive
  });
  const [originalData, setOriginalData] = useState({
    name: user.name,
    phone: user.phone,
    email: user.email || '',
    role: user.role,
    isActive: user.isActive
  });
  // הודעות שגיאה מתחת לשדות
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [emailError, setEmailError] = useState('');

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
    formData.email !== originalData.email ||
    formData.role !== originalData.role ||
    formData.isActive !== originalData.isActive ||
    groups.some(group => group.isSelected !== group.wasSelected) ||
    (paymentUnitDetails && paymentUnitActive !== paymentUnitDetails.isActive) ||
    (pendingPaymentUnitToggle !== null);

  // רפרנס לפקד ScrollView שמאפשר לנו לגלול תכנית כשצריך
  const scrollViewRef = React.useRef<ScrollView>(null);
  
  // טיפול בגלילה ידנית
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  
  // מעקב מגע ראשוני להחלטה אם מדובר בגלילה
  const [touchStartY, setTouchStartY] = useState(0);
  
  // פונקציה שמחליטה אם צריך לעצור פרופגציה של אירוע או לאפשר גלילה
  const handleTouchStart = (e: GestureResponderEvent) => {
    setTouchStartY(e.nativeEvent.pageY);
  };
  
  const handleTouchMove = (e: GestureResponderEvent) => {
    // מחשב את המרחק שהמשתמש הזיז את האצבע
    const touchDelta = Math.abs(e.nativeEvent.pageY - touchStartY);
    
    // אם המשתמש זז יותר מ-10 פיקסלים, זו כנראה גלילה
    if (touchDelta > 10 && !isScrolling) {
      setIsScrolling(true);
      // מעדכן את ה-scrollY
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ 
          y: scrollY + (touchStartY - e.nativeEvent.pageY),
          animated: false 
        });
      }
    }
  };
  
  const handleTouchEnd = () => {
    setIsScrolling(false);
  };
  
  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrollY(e.nativeEvent.contentOffset.y);
  };

  useEffect(() => {
    if (visible) {
      loadInitialData();
    }
  }, [visible]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const allUsers = await getAllUsers();
      setExistingUsers(allUsers.filter(u => u.id !== user.id));

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
      
      // Set initial form and original data based on the user prop
      const initialEmail = user.email || '';
      setFormData({
        name: user.name,
        phone: user.phone,
        email: initialEmail,
        role: user.role,
        isActive: user.isActive
      });
      setOriginalData({
        name: user.name,
        phone: user.phone,
        email: initialEmail,
        role: user.role,
        isActive: user.isActive
      });
      
      if (user.paymentUnitId) {
        const paymentUnit = await getPaymentUnitById(user.paymentUnitId);
        if (paymentUnit) {
          setPaymentUnitActive(paymentUnit.isActive);
          const otherPlayerIdInUnit = paymentUnit.players.find(id => id !== user.id);
          if (otherPlayerIdInUnit) {
            const otherPlayer = allUsers.find(u => u.id === otherPlayerIdInUnit);
            if (otherPlayer) {
              setPaymentUnitDetails({
                unitId: paymentUnit.id,
                unitName: paymentUnit.name,
                otherPlayerId: otherPlayerIdInUnit,
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

  const handleChange = (field: keyof typeof formData, value: string | boolean | UserRole) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'name' && typeof value === 'string') {
      if (value && value !== user.name && !validateName(value)) {
        setNameError('שם המשתמש כבר קיים במערכת');
      } else {
        setNameError('');
      }
    } else if (field === 'email' && typeof value === 'string') {
      if (value && !/^\S+@\S+\.\S+$/.test(value)) {
        setEmailError('כתובת אימייל אינה תקינה');
      } else {
        setEmailError('');
      }
    } else if (field === 'phone' && typeof value === 'string') {
      // Add phone validation if needed
      setPhoneError(''); // Placeholder
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
    if (pendingPaymentUnitToggle !== null) {
      await confirmPaymentUnitToggle();
    }
    if (!hasChanges || nameError || phoneError || emailError) {
      return;
    }

    const updatedUserData: Partial<UserProfile> = {
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      role: formData.role,
      isActive: formData.isActive,
    };

    if (formData.email.trim()) {
      updatedUserData.email = formData.email.trim();
    } else {
      updatedUserData.email = null;
    }

    try {
      setLoading(true);
      setError(null);

      // Handle email deletion - delete from Firebase Auth before updating Firestore
      if (!formData.email.trim() && user.email && user.authUid) {
        console.log(`User email is being removed. Clearing email and authUid from Firestore for: ${user.email}`);
        try {
          const deleteSuccess = await deleteAuthUserByEmail(user.email);
          if (deleteSuccess) {
            console.log(`Successfully cleared email and authUid from Firestore for: ${user.email}`);
            // Also clear the authUid in Firestore - use deleteField() to remove the field
            updatedUserData.authUid = deleteField() as any;
            
            // Show success message
            setError('✅ האימייל נמחק מהמערכת בהצלחה! המשתמש לא יוכל עוד להתחבר עם האימייל הזה.');
            
            // Update Firestore and close dialog
            await updateUser(user.id, updatedUserData);
            
            // Handle groups updates
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
            
            // Close dialog after showing success message for a moment
            setTimeout(() => {
              onSuccess();
              onClose();
            }, 2000);
            
            setLoading(false);
            return; // Don't proceed with other updates
          } else {
            console.warn(`Failed to clear email and authUid from Firestore for ${user.email}.`);
            setError('⚠️ שגיאה במחיקת האימייל. נסה שוב.');
            setLoading(false);
      return;
    }
        } catch (authDeletionError: any) {
          console.error('Failed to clear email and authUid during email removal:', authDeletionError);
          setError('⚠️ שגיאה במחיקת האימייל. נסה שוב.');
          setLoading(false);
      return;
    }
      }

      // Check for email duplication if email is provided and changed
      if (formData.email.trim() && formData.email.trim() !== user.email) {
        const allUsers = await getAllUsers();
        const emailExists = allUsers.some(
          existingUser => existingUser.email?.toLowerCase() === formData.email.trim().toLowerCase() && existingUser.id !== user.id
        );
        if (emailExists) {
          setError('כתובת האימייל שהוזנה כבר קיימת אצל משתמש אחר.');
          setEmailError('כתובת האימייל שהוזנה כבר קיימת אצל משתמש אחר.'); // Set specific error for email field
          setLoading(false);
      return;
    }
      }

      let authUidCreated: string | null = null;
      // Logic for creating auth user if email is new and authUid is missing
      if (formData.email.trim() && !user.authUid) {
        console.log(`Attempting to create auth user for ${user.id} with email ${formData.email.trim()}`);
        try {
          authUidCreated = await createAuthUserAndUpdateFirestore(formData.email.trim(), user.id);
          if (authUidCreated) {
            console.log(`Auth user created successfully with authUid: ${authUidCreated}`);
            // Remove email from updatedUserData since it was already updated by createAuthUserAndUpdateFirestore
            delete updatedUserData.email;
            // The user object prop might be stale here. 
            // onSuccess should probably trigger a re-fetch of users in the parent component.
            
            // Show success message with logout warning
            setError('✅ האימייל נוסף בהצלחה! המערכת תתנתק אוטומטית כדי לשמור על אבטחת המערכת. תוכל להתחבר מחדש כאדמין תוך כמה שניות.');
            
            // Close dialog after showing success message for a moment
            setTimeout(() => {
              onSuccess();
              onClose();
            }, 3000);
            
            setLoading(false);
            return; // Don't proceed with other updates
          } else {
            // Handle case where authUidCreated is null (creation failed but didn't throw an unhandled error)
            setError('שגיאה ביצירת חשבון משתמש להתחברות. האימייל נשמר, אך יש לטפל בקישור ידנית.');
            // Optionally, do not proceed with other updates or allow partial save
          }
        } catch (authCreationError: any) {
          console.error('Failed to create auth user during edit:', authCreationError);
          // Check if it's the specific email-already-in-use error
          if (authCreationError.message && authCreationError.message.includes('כבר קיים במערכת Authentication')) {
            setError(authCreationError.message);
            setEmailError('האימייל כבר קיים במערכת Authentication');
          } else {
            setError('שגיאה קריטית ביצירת חשבון משתמש. האימייל לא נשמר. נסה שוב או פנה לתמיכה.');
          }
          setLoading(false);
          return; // Stop execution if auth creation fails critically
        }
      }

      await updateUser(user.id, updatedUserData);
      
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

  const confirmInactiveStatus = () => {
    setShowInactiveConfirmation(false);
    
    // מעדכן את כל הקבוצות למצב לא נבחר
    setGroups(prev => prev.map(group => ({ ...group, isSelected: false })));
    
    // אם יש יחידת תשלום, מעדכן אותה ללא פעילה
    if (paymentUnitDetails) {
      setPaymentUnitActive(false);
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
          onConfirm={() => {}}
          onCancel={() => {
            setShowGroupRemoveConfirmation(false);
            setGroupToRemove(null);
          }}
          message=""
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
        title={`עריכת משתמש - ${user.name}`}
        confirmText="שמירה"
        cancelText="ביטול"
        onConfirm={handleSave}
        onCancel={onClose}
        message=" "
        confirmButtonProps={{
          disabled: !hasChanges || !!nameError || !!phoneError || !!emailError || loading
        }}
      >
        <View style={styles.contentContainer}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContent}
            showsVerticalScrollIndicator={true}
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
                <Text style={styles.fieldLabel}>אימייל</Text>
                <Input
                  value={formData.email}
                  onChangeText={(value) => handleChange('email', value)}
                  placeholder="הכנס אימייל (אופציונלי)"
                  keyboardType="default"
                  autoCapitalize="none"
                  style={styles.inputField}
                />
                {emailError ? (
                  <Text style={styles.inlineErrorText}>{emailError}</Text>
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
            
            {/* מרווח מטה כדי לאפשר ראות מלאה של תוכן האחרון בעת גלילה */}
            <View style={{ height: 50 }} />
          </ScrollView>
        </View>
      </Dialog>
    </>
  );
}

export default EditUserDialog;

const styles = StyleSheet.create({
  contentContainer: {
    width: '100%',
    height: contentHeight,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
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
    width: '100%',
  },
  sectionTitle: {
    color: CASINO_COLORS.gold,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  field: {
    marginBottom: 12,
    width: '100%',
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
    width: '100%',
    marginBottom: 8,
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
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupActionText: {
    color: CASINO_COLORS.gold,
    fontSize: 14,
  },
});
