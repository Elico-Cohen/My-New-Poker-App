import React from 'react';
import { View, ScrollView } from 'react-native';
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
import { getAllActiveUsers, createUser } from '@/services/users';
import { getAllActiveGroups, getGroupById, updateGroup } from '@/services/groups';

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
  const [role, setRole] = React.useState<UserRole>('regular');
  const [groups, setGroups] = React.useState<UserGroup[]>([]);
  
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
    setRole('regular');
    setGroups([]);
    setError(null);
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // טעינת כל המשתמשים לבדיקת שמות כפולים
      const users = await getAllActiveUsers();
      setExistingUsers(users);
      
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

  const handleNameChange = (value: string) => {
    setName(value);
    if (value && !validateName(value)) {
      setError('שם המשתמש כבר קיים במערכת');
    } else {
      setError(null);
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
      onClose={onClose}
      title="הוספת משתמש חדש"
    >
      <ScrollView style={{ maxHeight: 600 }}>
        <View style={{ gap: 16 }}>
          {error && (
            <Text 
              variant="bodyNormal" 
              style={{ color: theme.error }}
            >
              {error}
            </Text>
          )}

          {/* פרטי משתמש */}
          <View style={{ gap: 16 }}>
            <View>
              <Text variant="bodySmall" style={{ marginBottom: 4 }}>שם משתמש</Text>
              <Input
                value={name}
                onChangeText={handleNameChange}
                placeholder="הכנס שם משתמש"
              />
            </View>

            <View>
              <Text variant="bodySmall" style={{ marginBottom: 4 }}>מספר טלפון</Text>
              <Input
                value={phone}
                onChangeText={setPhone}
                placeholder="05X-XXXXXXX"
                keyboardType="phone-pad"
              />
            </View>

            <View>
              <Text variant="bodySmall" style={{ marginBottom: 4 }}>סוג משתמש</Text>
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
            <View>
              <Text variant="h4" style={{ marginBottom: 12 }}>קבוצות</Text>
              <View style={{ gap: 8 }}>
                {groups.map(group => (
                  <View key={group.groupId} style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: theme.surfaceVariant,
                    padding: 8,
                    borderRadius: 4
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Switch
                        value={group.isSelected}
                        onValueChange={() => handleGroupToggle(group.groupId)}
                      />
                      <Text variant="bodyNormal" style={{ marginLeft: 8 }}>
                        {group.groupName}
                      </Text>
                    </View>
                    {group.isSelected && (
                      <Button
                        title={group.isPermanent ? "קבוע" : "אורח"}
                        size="small"
                        variant="outline"
                        onPress={() => handleGroupStatusToggle(group.groupId)}
                      />
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* כפתורי פעולה */}
      <View style={{ 
        flexDirection: 'row', 
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 24,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: theme.border
      }}>
        <Button
          title="ביטול"
          onPress={onClose}
          variant="ghost"
        />
        <Button
          title="שמירה"
          onPress={handleSave}
          loading={loading}
        />
      </View>
    </Dialog>
  );
}