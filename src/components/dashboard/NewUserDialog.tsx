import React from 'react';
import { 
  View, 
  ScrollView, 
  I18nManager, 
  StyleSheet, 
  Dimensions 
} from 'react-native';
import { Dialog } from '@/components/common/Dialog';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { Text } from '@/components/common/Text';
import { Dropdown } from '@/components/common/Dropdown';
import { Switch } from '@/components/common/Switch';
import Colors from '@/theme/colors';
import { useColorScheme } from '@/components/useColorScheme';
import { UserProfile, UserRole } from '@/models/UserProfile';
import { Group } from '@/models/Group';
import { getAllUsers, createUser } from '@/services/users';
import { getAllActiveGroups, getGroupById, updateGroup } from '@/services/groups';

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

interface NewUserDialogProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface UserGroup {
  groupId: string;
  groupName: string;
  isSelected: boolean;
  isPermanent: boolean;
}

export function NewUserDialog({
  visible,
  onClose,
  onSuccess
}: NewUserDialogProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  // מצב טופס
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<UserRole>('regular');
  const [groups, setGroups] = React.useState<UserGroup[]>([]);
  
  // הודעות שגיאה מתחת לשדות
  const [nameError, setNameError] = React.useState('');
  const [phoneError, setPhoneError] = React.useState('');
  const [emailError, setEmailError] = React.useState('');
  
  // מצבי UI
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [existingUsers, setExistingUsers] = React.useState<UserProfile[]>([]);

  // איפוס הטופס כשנפתח הדיאלוג
  React.useEffect(() => {
    if (visible) {
      resetForm();
      loadInitialData();
    }
  }, [visible]);

  const resetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setRole('regular');
    setGroups([]);
    setError(null);
    setNameError('');
    setPhoneError('');
    setEmailError('');
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // טעינת כל המשתמשים לבדיקת שמות כפולים
      const allUsersForValidation = await getAllUsers();
      setExistingUsers(allUsersForValidation);
      
      // טעינת קבוצות פעילות
      const activeGroups = await getAllActiveGroups();
      setGroups(activeGroups.map(group => ({
        groupId: group.id,
        groupName: group.name,
        isSelected: false,
        isPermanent: true // ברירת מחדל: שחקן קבוע
      })));
      
    } catch (error) {
      console.error('Failed to load initial data:', error);
      setError('טעינת הנתונים נכשלה');
    } finally {
      setLoading(false);
    }
  };

  // בדיקת תקינות שם
  const validateName = (name: string): boolean => {
    return !existingUsers.some(
      user => user.name.toLowerCase() === name.toLowerCase()
    );
  };

  // בדיקת תקינות אימייל
  const validateEmail = (email: string): boolean => {
    if (!email.trim()) return true; // אימייל אופציונלי
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // בדיקת כפילות אימייל
  const validateEmailUnique = (email: string): boolean => {
    if (!email.trim()) return true; // אימייל אופציונלי
    return !existingUsers.some(
      user => user.email && user.email.toLowerCase() === email.toLowerCase()
    );
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (!value.trim()) {
      setNameError('נדרש להזין שם משתמש');
    } else if (!validateName(value)) {
      setNameError('שם המשתמש כבר קיים במערכת');
    } else {
      setNameError('');
    }
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    if (!value.trim()) {
      setPhoneError('נדרש להזין מספר טלפון');
    } else if (!/^05\d{8}$/.test(value)) {
      setPhoneError('מספר הטלפון אינו תקין');
    } else {
      setPhoneError('');
    }
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (value.trim() && !validateEmail(value)) {
      setEmailError('פורמט האימייל אינו תקין');
    } else if (value.trim() && !validateEmailUnique(value)) {
      setEmailError('האימייל כבר קיים במערכת');
    } else {
      setEmailError('');
    }
  };

  // טיפול בשינויים בקבוצות
  const handleGroupToggle = (groupId: string) => {
    setGroups(prev => prev.map(group => 
      group.groupId === groupId
        ? { ...group, isSelected: !group.isSelected }
        : group
    ));
  };

  const handleGroupStatusToggle = (groupId: string) => {
    setGroups(prev => prev.map(group =>
      group.groupId === groupId
        ? { ...group, isPermanent: !group.isPermanent }
        : group
    ));
  };

  // אימות נתונים
  const validateForm = (): string | null => {
    if (!name.trim()) {
      return 'נדרש להזין שם משתמש';
    }
    if (!validateName(name)) {
      return 'שם המשתמש כבר קיים במערכת';
    }
    if (!phone.trim()) {
      return 'נדרש להזין מספר טלפון';
    }
    if (!/^05\d{8}$/.test(phone)) {
      return 'מספר הטלפון אינו תקין';
    }
    if (email.trim() && !validateEmail(email)) {
      return 'פורמט האימייל אינו תקין';
    }
    if (email.trim() && !validateEmailUnique(email)) {
      return 'האימייל כבר קיים במערכת';
    }
    return null;
  };

  // שמירת משתמש חדש
  const handleSave = async () => {
    try {
      const validationError = validateForm();
      if (validationError) {
        setError(validationError);
        return;
      }

      setLoading(true);
      setError(null);

      // יצירת אובייקט המשתמש החדש
      const newUser: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'> = {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        role,
        isActive: true
      };

      // שמירת המשתמש
      const userId = await createUser(newUser);

      // עדכון קבוצות שנבחרו
      const selectedGroups = groups.filter(g => g.isSelected);
      for (const group of selectedGroups) {
        const currentGroup = await getGroupById(group.groupId);
        if (currentGroup) {
          // מעדכנים את רשימות השחקנים בקבוצה בהתאם לסטטוס שנבחר
          const updatedGroup = {
            ...currentGroup,
            permanentPlayers: group.isPermanent 
              ? [...currentGroup.permanentPlayers, userId]
              : currentGroup.permanentPlayers,
            guestPlayers: !group.isPermanent
              ? [...currentGroup.guestPlayers, userId]
              : currentGroup.guestPlayers
          };
          
          await updateGroup(group.groupId, updatedGroup);
        }
      }

      onSuccess();
      onClose();

    } catch (error) {
      console.error('Failed to create user:', error);
      setError('שמירת המשתמש נכשלה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      visible={visible}
      title="הוספת משתמש חדש"
      message=" "
      confirmText="שמירה"
      cancelText="ביטול"
      onConfirm={handleSave}
      onCancel={onClose}
      confirmButtonProps={{
        disabled: !!nameError || !!phoneError || !!emailError || !name.trim() || !phone.trim() || loading 
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
                value={name}
                onChangeText={handleNameChange}
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
                value={phone}
                onChangeText={handlePhoneChange}
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
                value={email}
                onChangeText={handleEmailChange}
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
                value={role}
                onSelect={(value) => setRole(value as UserRole)}
                items={[
                  { label: 'רגיל', value: 'regular' },
                  { label: 'סופר', value: 'super' },
                  { label: 'מנהל', value: 'admin' }
                ]}
              />
            </View>
          </View>

          {/* רישום לקבוצות */}
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
                          style={styles.groupActionButton}
                          textStyle={styles.groupActionText}
                      />
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}
          
          {/* מרווח מטה כדי לאפשר ראות מלאה של תוכן האחרון בעת גלילה */}
          <View style={{ height: 50 }} />
      </ScrollView>
      </View>
    </Dialog>
  );
}

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
  groupsContainer: {
    // אין שינוי כאן
  },
  groupRow: {
    flexDirection: 'row',
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupName: {
    color: CASINO_COLORS.text,
    marginEnd: 8,
    textAlign: 'right',
  },
  groupActions: {
    flexDirection: 'row',
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