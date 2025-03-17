// src/app/dashboard/payment-units.tsx

import React from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/common/Text';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { Dialog } from '@/components/common/Dialog';
import { NewPaymentUnitDialog } from '@/components/dashboard/NewPaymentUnitDialog';
import { EditPaymentUnitDialog } from '@/components/dashboard/EditPaymentUnitDialog';
import { PaymentUnit } from '@/models/PaymentUnit';
import { UserProfile } from '@/models/UserProfile';
import { 
  getAllPaymentUnits,    // טוען את כל היחידות, גם פעילות וגם לא פעילות
  deletePaymentUnit, 
  updatePaymentUnit 
} from '@/services/paymentUnits';
import { getAllUsers, updateUser } from '@/services/users';

const CASINO_COLORS = {
  background: '#0D1B1E',
  primary: '#35654d',
  gold: '#FFD700',
  surface: '#1C2C2E',
  text: '#B8B8B8',
  success: '#22c55e',
  error: '#ef4444'
};

interface EnrichedPaymentUnit extends PaymentUnit {
  players: {
    id: string;
    name: string;
  }[];
}

export default function PaymentUnitsScreen() {
  const router = useRouter();

  // מצבי נתונים
  const [paymentUnits, setPaymentUnits] = React.useState<EnrichedPaymentUnit[]>([]);
  const [users, setUsers] = React.useState<UserProfile[]>([]);
  
  // מצבי UI
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = React.useState(false);
  const [showEditDialog, setShowEditDialog] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [selectedUnit, setSelectedUnit] = React.useState<EnrichedPaymentUnit | null>(null);

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      // טוענים את כל יחידות התשלום (פעילות ולא פעילות)
      const [unitsData, usersData] = await Promise.all([
        getAllPaymentUnits(),
        getAllUsers()
      ]);
      setUsers(usersData);

      // העשרת יחידות התשלום עם פרטי השחקנים
      const enrichedUnits: EnrichedPaymentUnit[] = unitsData.map(unit => ({
        ...unit,
        players: unit.players.map(playerId => {
          const user = usersData.find(u => u.id === playerId);
          return {
            id: playerId,
            name: user?.name || 'משתמש לא נמצא'
          };
        })
      }));
      setPaymentUnits(enrichedUnits);
    } catch (error) {
      console.error('Failed to load payment units data:', error);
      setError('טעינת נתוני יחידות התשלום נכשלה. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  // פונקציה להחלפת סטטוס היחידה (toggle)
  const handleToggleUnitStatus = async (unit: EnrichedPaymentUnit) => {
    try {
      setLoading(true);
      if (unit.isActive) {
        // אם היחידה פעילה – להפוך אותה ללא פעילה:
        await Promise.all(
          unit.players.map(player => 
            updateUser(player.id, { paymentUnitId: null })
          )
        );
        await updatePaymentUnit(unit.id, { isActive: false });
      } else {
        // אם היחידה לא פעילה – להפוך אותה לפעילה:
        await updatePaymentUnit(unit.id, { isActive: true });
        await Promise.all(
          unit.players.map(player => 
            updateUser(player.id, { paymentUnitId: unit.id })
          )
        );
      }
      await loadData();
    } catch (error) {
      console.error('Failed to toggle payment unit status:', error);
      setError('שינוי סטטוס יחידת התשלום נכשל. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  // טיפול במחיקת יחידת תשלום – מופעל דרך דיאלוג אישור מחיקה
  const confirmDelete = async () => {
    if (!selectedUnit) return;
    try {
      setLoading(true);
      await deletePaymentUnit(selectedUnit.id);
      await loadData();
      setShowDeleteDialog(false);
      setSelectedUnit(null);
    } catch (error) {
      console.error('Failed to delete payment unit:', error);
      setError('מחיקת יחידת התשלום נכשלה. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.fullScreen}>
        <LoadingIndicator text="טוען יחידות תשלום..." fullscreen />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.push('/dashboard')}
          style={styles.backButton}
        >
          <Icon name="arrow-right" size="medium" color={CASINO_COLORS.gold} />
        </TouchableOpacity>
        <Text variant="h4" style={styles.headerTitle}>
          ניהול יחידות תשלום
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Add Payment Unit Button */}
      <View style={styles.addButtonContainer}>
        <Button
          title="יחידת תשלום חדשה"
          icon="plus"
          onPress={() => setShowNewDialog(true)}
          style={styles.addButton}
          textStyle={styles.addButtonText}
        />
      </View>

      {/* Payment Units List */}
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {paymentUnits.length === 0 ? (
          <View style={styles.noUnitsContainer}>
            <Icon
              name="card-account-details-outline"
              size="xlarge"
              color={CASINO_COLORS.gold}
              style={{ marginBottom: 16 }}
            />
            <Text variant="bodyLarge" style={styles.noUnitsText}>
              אין יחידות תשלום להצגה.
            </Text>
          </View>
        ) : (
          paymentUnits.map((unit) => (
            <Card key={unit.id} style={styles.card}>
              {/* Payment Unit Header */}
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View
                    style={[
                      styles.statusIndicator,
                      { backgroundColor: unit.isActive ? CASINO_COLORS.success : CASINO_COLORS.error }
                    ]}
                  />
                  <Text variant="h4" style={styles.unitName}>
                    {unit.name}
                  </Text>
                </View>
                <View style={styles.cardHeaderRight}>
                  <Button
                    variant="ghost"
                    icon="pencil"
                    iconColor={CASINO_COLORS.gold}
                    iconSize={24}
                    onPress={() => {
                      setSelectedUnit(unit);
                      setShowEditDialog(true);
                    }}
                    style={styles.editButton}
                  />
                  <Button
                    variant="ghost"
                    icon="trash-can"
                    iconColor={CASINO_COLORS.gold}
                    iconSize={24}
                    onPress={() => {
                      setSelectedUnit(unit);
                      setShowDeleteDialog(true);
                    }}
                    style={styles.deleteButton}
                  />
                </View>
              </View>

              {/* Players List */}
              <View style={styles.playersContainer}>
                <Text variant="bodyNormal" style={styles.playersTitle}>
                  שחקנים:
                </Text>
                <View style={styles.playersList}>
                  {unit.players.map(player => (
                    <View key={player.id} style={styles.playerCard}>
                      <Text variant="bodyNormal" style={styles.playerName}>
                        {player.name}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Toggle Button */}
              <View style={styles.toggleButtonContainer}>
                <Button
                  title={unit.isActive ? "הפוך ללא פעילה" : "הפוך לפעילה"}
                  variant="outline"
                  onPress={() => handleToggleUnitStatus(unit)}
                />
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* New Payment Unit Dialog */}
      <NewPaymentUnitDialog
        visible={showNewDialog}
        onClose={() => setShowNewDialog(false)}
        onSuccess={() => {
          setShowNewDialog(false);
          loadData();
        }}
      />

      {/* Edit Payment Unit Dialog */}
      {selectedUnit && showEditDialog && (
        <EditPaymentUnitDialog
          visible={showEditDialog}
          onClose={() => {
            setShowEditDialog(false);
            setSelectedUnit(null);
          }}
          onSuccess={() => {
            setShowEditDialog(false);
            setSelectedUnit(null);
            loadData();
          }}
          unit={selectedUnit}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {selectedUnit && (
        <Dialog
          visible={showDeleteDialog}
          title="אישור מחיקה"
          message=""
          onConfirm={confirmDelete}
          onCancel={() => {
            setShowDeleteDialog(false);
            setSelectedUnit(null);
          }}
          type="danger"
          children={
            <Text
              variant="bodyNormal"
              style={{ color: '#FFFFFF', textAlign: 'center', marginBottom: 24 }}
            >
              {`האם אתה בטוח שברצונך למחוק את יחידת התשלום "${selectedUnit.name}"?\nפעולה זו אינה ניתנת לביטול.`}
            </Text>
          }
          confirmText="מחק"
          cancelText="ביטול"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: CASINO_COLORS.background,
  },
  container: {
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
  header: {
    padding: 16,
    backgroundColor: CASINO_COLORS.primary,
    borderBottomWidth: 2,
    borderBottomColor: CASINO_COLORS.gold,
    flexDirection: 'row-reverse',
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
  noUnitsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  noUnitsText: {
    color: CASINO_COLORS.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  card: {
    marginBottom: 16,
    backgroundColor: CASINO_COLORS.surface,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: `${CASINO_COLORS.gold}30`,
  },
  cardHeaderLeft: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  unitName: {
    color: CASINO_COLORS.gold,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    gap: 12,
  },
  editButton: {
    // ניתן להוסיף התאמות סגנוניות נוספות במידת הצורך
  },
  deleteButton: {
    // ניתן להוסיף התאמות סגנוניות נוספות במידת הצורך
  },
  playersContainer: {
    backgroundColor: `${CASINO_COLORS.primary}20`,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: `${CASINO_COLORS.gold}30`,
    alignItems: 'flex-end',
  },
  playersTitle: {
    color: CASINO_COLORS.gold,
    marginBottom: 8,
    textAlign: 'right',
    width: '100%',
  },
  playersList: {
    flexDirection: 'row-reverse', // RTL – מוצגים מימין לשמאל
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
  },
  playerCard: {
    backgroundColor: `${CASINO_COLORS.primary}30`,
    padding: 8,
    borderRadius: 8,
    marginLeft: 8,
    marginBottom: 8,
  },
  playerName: {
    color: CASINO_COLORS.gold,
    textAlign: 'right',
  },
  toggleButtonContainer: {
    padding: 16,
    alignItems: 'center',
  },
});

export default PaymentUnitsScreen;
