import React from 'react';
import { View, ScrollView, TextInput, TouchableOpacity, I18nManager } from 'react-native';
import { router } from 'expo-router';
import { Dropdown } from '@/components/common/Dropdown';
import { Text } from '@/components/common/Text';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { DeleteConfirmation } from '@/components/dashboard/DeleteConfirmation';
import { NewUserDialog } from '@/components/dashboard/NewUserDialog';
import { EditUserDialog } from '@/components/dashboard/EditUserDialog';
import { RoleChangeConfirmation } from '@/components/dashboard/RoleChangeConfirmation';
import { UserRoleSelector } from '@/components/UserRoleSelector';
import _ from 'lodash';
import { UserProfile, UserRole } from '@/models/UserProfile';
import { Group } from '@/models/Group';
import { PaymentUnit } from '@/models/PaymentUnit';
import { getAllUsers, deleteUser, updateUser } from '@/services/users';
import { getAllActiveGroups, updateGroup } from '@/services/groups';
import { getAllActivePaymentUnits, updatePaymentUnit } from '@/services/paymentUnits';
import { hasPlayerActiveGames } from '@/services/games';
import { updateUserRole } from '@/services/userManagement';
import { useAuth } from '@/contexts/AuthContext';

// Enable RTL
I18nManager.forceRTL(true);

const CASINO_COLORS = {
  background: '#0D1B1E',
  primary: '#35654d',
  gold: '#FFD700',
  surface: '#1C2C2E',
  text: '#FFFFFF'
};

interface UserDetails extends UserProfile {
  groups: {
    groupId: string;
    groupName: string;
    isPermanent: boolean;
  }[];
  paymentUnit?: {
    unitId: string;
    unitName: string;
    otherPlayerId: string;
    otherPlayerName: string;
  };
}

export default function UsersScreen() {
  // Get current user from auth context
  const { user: currentUser } = useAuth();

  // מצבי נתונים
  const [users, setUsers] = React.useState<UserDetails[]>([]);
  const [groups, setGroups] = React.useState<Group[]>([]);
  const [paymentUnits, setPaymentUnits] = React.useState<PaymentUnit[]>([]);

  // מצבי UI
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [expandedCards, setExpandedCards] = React.useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = React.useState<string>('all');

  // מצבי דיאלוגים
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [userToDelete, setUserToDelete] = React.useState<UserDetails | null>(null);
  const [showNewUserDialog, setShowNewUserDialog] = React.useState(false);
  const [showEditDialog, setShowEditDialog] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState<UserDetails | null>(null);

  // Role change states
  const [showRoleChangeDialog, setShowRoleChangeDialog] = React.useState(false);
  const [roleChangeUser, setRoleChangeUser] = React.useState<UserDetails | null>(null);
  const [newRole, setNewRole] = React.useState<UserRole | null>(null);

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [usersData, groupsData, unitsData] = await Promise.all([
        getAllUsers(),
        getAllActiveGroups(),
        getAllActivePaymentUnits()
      ]);

      setGroups(groupsData);
      setPaymentUnits(unitsData);

      const enrichedUsers: UserDetails[] = usersData.map(user => ({
        ...user,
        groups: groupsData
          .filter(group => 
            group.permanentPlayers.includes(user.id) || 
            group.guestPlayers.includes(user.id)
          )
          .map(group => ({
            groupId: group.id,
            groupName: group.name,
            isPermanent: group.permanentPlayers.includes(user.id)
          })),
        paymentUnit: user.paymentUnitId ? enrichPaymentUnitData(user, unitsData, usersData) : undefined
      }));

      setUsers(enrichedUsers);
    } catch (error) {
      console.error('Failed to load users data:', error);
      setError('טעינת נתוני המשתמשים נכשלה');
    } finally {
      setLoading(false);
    }
  };

  const enrichPaymentUnitData = (
    user: UserProfile,
    units: PaymentUnit[],
    allUsers: UserProfile[]
  ) => {
    const unit = units.find(u => u.id === user.paymentUnitId);
    if (!unit) return undefined;

    const otherPlayerId = unit.players.find(id => id !== user.id);
    if (!otherPlayerId) return undefined;

    const otherPlayer = allUsers.find(u => u.id === otherPlayerId);
    if (!otherPlayer) return undefined;

    return {
      unitId: unit.id,
      unitName: unit.name,
      otherPlayerId,
      otherPlayerName: otherPlayer.name
    };
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      setLoading(true);

      // בדיקה אם המשתמש משתתף במשחק פעיל
      const hasActiveGames = await hasPlayerActiveGames(userToDelete.id);
      if (hasActiveGames) {
        setError('לא ניתן למחוק שחקן שמשתתף במשחק פעיל');
        return;
      }

      // בדיקה אם המשתמש הוא מנהל האחרון
      if (userToDelete.role === 'admin') {
        const activeAdmins = users.filter(
          u => u.role === 'admin' && u.isActive && u.id !== userToDelete.id
        );
        if (activeAdmins.length === 0) {
          setError('לא ניתן למחוק את המנהל האחרון במערכת');
          return;
        }
      }

      // טיפול ביחידת תשלום אם קיימת
      if (userToDelete.paymentUnit) {
        const { unitId, otherPlayerId } = userToDelete.paymentUnit;
        await updateUser(otherPlayerId, { 
          paymentUnitId: undefined,
          updatedAt: Date.now()
        });
        await updatePaymentUnit(unitId, {
          isActive: false,
          players: [],
          updatedAt: Date.now()
        });
      }

      // הסרה מכל הקבוצות
      const groupUpdates = userToDelete.groups.map(async (group) => {
        const currentGroup = groups.find(g => g.id === group.groupId);
        if (currentGroup) {
          return updateGroup(group.groupId, {
            permanentPlayers: currentGroup.permanentPlayers.filter(id => id !== userToDelete.id),
            guestPlayers: currentGroup.guestPlayers.filter(id => id !== userToDelete.id),
            updatedAt: Date.now()
          });
        }
      });
      await Promise.all(groupUpdates);

      await deleteUser(userToDelete.id);

      setUsers(prevUsers => prevUsers.filter(user => user.id !== userToDelete.id));
      setShowDeleteDialog(false);
      setUserToDelete(null);

    } catch (error) {
      console.error('Failed to delete user:', error);
      setError('מחיקת המשתמש נכשלה');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUserGroupStatus = async (
    userId: string,
    groupId: string,
    newIsPermanent: boolean
  ) => {
    try {
      setLoading(true);

      const group = groups.find(g => g.id === groupId);
      if (!group) throw new Error('הקבוצה לא נמצאה');

      const updatedGroup = {
        ...group,
        permanentPlayers: newIsPermanent
          ? [...group.permanentPlayers, userId]
          : group.permanentPlayers.filter(id => id !== userId),
        guestPlayers: newIsPermanent
          ? group.guestPlayers.filter(id => id !== userId)
          : [...group.guestPlayers, userId]
      };

      await updateGroup(groupId, updatedGroup);
      await loadData();

    } catch (error) {
      console.error('Failed to toggle user group status:', error);
      setError('שינוי סטטוס המשתמש בקבוצה נכשל');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChangeRequest = (user: UserDetails, role: UserRole) => {
    if (!currentUser || currentUser.role !== 'admin') {
      setError('רק מנהל יכול לשנות תפקידים');
      return;
    }

    if (user.id === currentUser.id) {
      setError('לא ניתן לשנות את התפקיד שלך');
      return;
    }

    setRoleChangeUser(user);
    setNewRole(role);
    setShowRoleChangeDialog(true);
  };

  const handleRoleChangeConfirm = async () => {
    if (!roleChangeUser || !newRole || !currentUser) return;

    try {
      setLoading(true);
      setShowRoleChangeDialog(false);

      // Optimistic update
      setUsers(prevUsers =>
        prevUsers.map(u =>
          u.id === roleChangeUser.id ? { ...u, role: newRole } : u
        )
      );

      // Call service to update role
      await updateUserRole({
        userId: roleChangeUser.id,
        newRole,
        updatedBy: currentUser.id
      });

      console.log('Role updated successfully');
    } catch (error: any) {
      console.error('Failed to update user role:', error);
      setError(error.message || 'שגיאה בעדכון התפקיד');

      // Revert optimistic update on error
      await loadData();
    } finally {
      setRoleChangeUser(null);
      setNewRole(null);
      setLoading(false);
    }
  };

  const handleRoleChangeCancel = () => {
    setShowRoleChangeDialog(false);
    setRoleChangeUser(null);
    setNewRole(null);
  };

  // סינון ומיון משתמשים לפי שם וקבוצה
  const filteredAndSortedUsers = React.useMemo(() => {
    return _.chain(users)
      .filter(user => {
        // בדיקה אם שם המשתמש קיים לפני קריאה ל-toLowerCase
        const matchesName = user.name ? user.name.toLowerCase().includes(searchQuery.toLowerCase()) : false;
        const matchesGroup = selectedGroup === 'all' || user.groups.some(g => g.groupId === selectedGroup);
        return matchesName && matchesGroup;
      })
      .orderBy(['name'], ['asc'])
      .value();
  }, [users, searchQuery, selectedGroup]);

  // רכיב כרטיס משתמש
  const UserCard = ({ user }: { user: UserDetails }) => {
    const isExpanded = expandedCards.includes(user.id);

    return (
      <Card style={{
        backgroundColor: CASINO_COLORS.surface,
        borderColor: CASINO_COLORS.gold,
        borderWidth: 1,
        marginBottom: 8
      }}>
        <TouchableOpacity
          onPress={() =>
            setExpandedCards(prev =>
              isExpanded ? prev.filter(id => id !== user.id) : [...prev, user.id]
            )
          }
          style={{ padding: 16 }}
        >
          {/* תצוגה מצומצמת */}
          <View style={{
            flexDirection: 'row-reverse',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: CASINO_COLORS.gold, fontSize: 18 }}>{user.name}</Text>
              {/* Role Badge */}
              <View style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                backgroundColor: user.role === 'admin' ? 'rgba(255, 215, 0, 0.2)'
                             : user.role === 'super' ? 'rgba(53, 101, 77, 0.3)'
                             : 'rgba(136, 136, 136, 0.2)',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: user.role === 'admin' ? CASINO_COLORS.gold
                           : user.role === 'super' ? CASINO_COLORS.primary
                           : '#888'
              }}>
                <Icon
                  name={user.role === 'admin' ? 'crown' : user.role === 'super' ? 'star' : 'account'}
                  size="tiny"
                  color={user.role === 'admin' ? CASINO_COLORS.gold
                       : user.role === 'super' ? CASINO_COLORS.primary
                       : '#888'}
                />
                <Text style={{
                  fontSize: 12,
                  marginRight: 4,
                  color: user.role === 'admin' ? CASINO_COLORS.gold
                       : user.role === 'super' ? CASINO_COLORS.primary
                       : '#888'
                }}>
                  {user.role === 'admin' ? 'מנהל' : user.role === 'super' ? 'על' : 'רגיל'}
                </Text>
              </View>
              {/* Active Status Indicator */}
              <View style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: user.isActive ? '#22c55e' : '#ef4444',
              }} />
            </View>
            <Icon
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size="small"
              color={CASINO_COLORS.gold}
            />
          </View>

          {/* תצוגה מורחבת */}
          {isExpanded && (
            <View style={{ marginTop: 16, gap: 12 }}>
              <View>
                <Text style={{ color: CASINO_COLORS.text, textAlign: 'right' }}>{user.phone}</Text>
              </View>

              {/* Role Selector - Only for admins */}
              {currentUser?.role === 'admin' && (
                <View style={{
                  backgroundColor: 'rgba(255, 215, 0, 0.05)',
                  borderRadius: 8,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(255, 215, 0, 0.2)'
                }}>
                  <UserRoleSelector
                    currentRole={user.role}
                    onRoleChange={(role) => handleRoleChangeRequest(user, role)}
                    disabled={user.id === currentUser.id}
                  />
                  {user.id === currentUser.id && (
                    <Text style={{
                      fontSize: 12,
                      color: '#f59e0b',
                      textAlign: 'right',
                      marginTop: 8
                    }}>
                      לא ניתן לשנות את התפקיד שלך
                    </Text>
                  )}
                </View>
              )}

              {user.groups.length > 0 && (
                <View>
                  <Text style={{ color: CASINO_COLORS.gold, marginBottom: 8, textAlign: 'right' }}>קבוצות:</Text>
                  <View style={{ gap: 8 }}>
                    {user.groups.map(group => (
                      <View key={group.groupId} style={{
                        flexDirection: 'row-reverse',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: 'rgba(255, 215, 0, 0.1)',
                        padding: 8,
                        borderRadius: 4
                      }}>
                        <Text style={{ color: CASINO_COLORS.text }}>{group.groupName}</Text>
                        <Button
                          title={group.isPermanent ? "קבוע" : "אורח"}
                          size="small"
                          variant="outline"
                          style={{
                            borderColor: CASINO_COLORS.gold,
                            backgroundColor: 'rgba(255, 215, 0, 0.1)',
                          }}
                          textStyle={{ color: CASINO_COLORS.gold }}
                          onPress={() => handleToggleUserGroupStatus(
                            user.id,
                            group.groupId,
                            !group.isPermanent
                          )}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {user.paymentUnit && (
                <View>
                  <Text style={{ color: CASINO_COLORS.gold, marginBottom: 8, textAlign: 'right' }}>יחידת תשלום:</Text>
                  <View style={{
                    backgroundColor: 'rgba(255, 215, 0, 0.1)',
                    padding: 8,
                    borderRadius: 4
                  }}>
                    <Text style={{ color: CASINO_COLORS.text, textAlign: 'right' }}>
                      {user.paymentUnit.unitName} - עם {user.paymentUnit.otherPlayerName}
                    </Text>
                  </View>
                </View>
              )}

              <View style={{ 
                flexDirection: 'row', 
                justifyContent: 'space-between',
                marginTop: 8 
              }}>
                <Button
                  icon="pencil"
                  iconColor={CASINO_COLORS.gold}
                  iconSize={24}
                  variant="ghost"
                  style={{ 
                    backgroundColor: 'rgba(255, 215, 0, 0.1)',
                    padding: 10,
                    marginHorizontal: 12
                  }}
                  textStyle={{ color: CASINO_COLORS.text }}
                  onPress={() => {
                    setSelectedUser(user);
                    setShowEditDialog(true);
                  }}
                />
                <Button
                  icon="trash-can"
                  iconColor="#ef4444"
                  iconSize={24}
                  variant="ghost"
                  style={{ 
                    backgroundColor: 'rgba(255, 215, 0, 0.1)',
                    padding: 10,
                    marginHorizontal: 12
                  }}
                  textStyle={{ color: CASINO_COLORS.text }}
                  onPress={() => {
                    setUserToDelete(user);
                    setShowDeleteDialog(true);
                  }}
                />
              </View>
            </View>
          )}
        </TouchableOpacity>
      </Card>
    );
  };

  if (loading) {
    return <LoadingIndicator text="טוען נתוני משתמשים..." fullscreen />;
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
          onPress={loadData}
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

  return (
    <View style={{ flex: 1, backgroundColor: CASINO_COLORS.background }}>
      {/* כותרת עם חץ המנווט למסך הראשי */}
      <View style={{ 
        flexDirection: 'row-reverse',
        alignItems: 'center',
        padding: 16,
        backgroundColor: CASINO_COLORS.primary,
        borderBottomWidth: 2,
        borderBottomColor: CASINO_COLORS.gold,
      }}>
        <TouchableOpacity 
          onPress={() => router.replace('/dashboard')}
          style={{ padding: 8 }}
        >
          <Icon name="arrow-right" size="medium" color={CASINO_COLORS.gold} />
        </TouchableOpacity>
        <Text variant="h4" style={{ flex: 1, color: CASINO_COLORS.gold, textAlign: 'center' }}>
          ניהול שחקנים
        </Text>
      </View>

      {/* Dropdown לסינון לפי קבוצה */}
      <View style={{ paddingHorizontal: 16, backgroundColor: CASINO_COLORS.primary, paddingVertical: 8 }}>
        <Dropdown
          value={selectedGroup}
          items={[
            { label: "כל הקבוצות", value: "all" },
            ...groups.map(group => ({ label: group.name, value: group.id }))
          ]}
          onSelect={(value) => setSelectedGroup(value)}
          style={{ marginVertical: 8 }}
        />
      </View>

      {/* סרגל "משתמש חדש" + חיפוש */}
      <View style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 12,
        padding: 16
      }}>
        <Button
          title="משתמש חדש"
          icon="account-plus"
          onPress={() => setShowNewUserDialog(true)}
          style={{
            backgroundColor: 'rgba(255, 215, 0, 0.1)',
            borderColor: CASINO_COLORS.gold,
            borderWidth: 1,
            height: 48,
            justifyContent: 'center'
          }}
          textStyle={{ color: CASINO_COLORS.gold }}
        />
        <View style={{
          flex: 1,
          flexDirection: 'row-reverse',
          alignItems: 'center',
          backgroundColor: 'rgba(255, 215, 0, 0.1)',
          borderRadius: 8,
          borderWidth: 1,
          borderColor: CASINO_COLORS.gold,
          paddingHorizontal: 12,
          height: 48,
          justifyContent: 'center'
        }}>
          <TextInput
            placeholder="חיפוש שחקן..."
            placeholderTextColor={CASINO_COLORS.gold}
            style={{
              color: CASINO_COLORS.text,
              flex: 1,
              padding: 8,
              textAlign: 'right'
            }}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <Icon name="magnify" size="small" color={CASINO_COLORS.gold} />
        </View>
      </View>

      {/* רשימת המשתמשים */}
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {filteredAndSortedUsers.map(user => (
          <UserCard key={user.id} user={user} />
        ))}
      </ScrollView>

      {/* דיאלוגים */}
      <DeleteConfirmation
        visible={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setUserToDelete(null);
        }}
        onConfirm={handleDeleteUser}
        itemName={userToDelete?.name || ''}
        itemType="שחקן"
        message={`האם אתה בטוח שברצונך למחוק את המשתמש "${userToDelete?.name}"?\nפעולה זו תסיר את המשתמש מכל הקבוצות ומיחידת התשלום שלו.`}
      />

      <NewUserDialog
        visible={showNewUserDialog}
        onClose={() => setShowNewUserDialog(false)}
        onSuccess={() => {
          setShowNewUserDialog(false);
          loadData();
        }}
      />

      {selectedUser && (
        <EditUserDialog
          visible={showEditDialog}
          onClose={() => {
            setShowEditDialog(false);
            setSelectedUser(null);
          }}
          onSuccess={() => {
            setShowEditDialog(false);
            setSelectedUser(null);
            loadData();
          }}
          user={selectedUser}
          userGroups={selectedUser.groups}
        />
      )}

      {roleChangeUser && newRole && (
        <RoleChangeConfirmation
          visible={showRoleChangeDialog}
          userName={roleChangeUser.name}
          currentRole={roleChangeUser.role}
          newRole={newRole}
          onConfirm={handleRoleChangeConfirm}
          onCancel={handleRoleChangeCancel}
        />
      )}
    </View>
  );
}
