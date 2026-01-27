// src/app/gameFlow/PaymentCalculations.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, ActivityIndicator, TouchableOpacity, BackHandler } from 'react-native';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { Dialog } from '@/components/common/Dialog';
import { ReadOnlyIndicator } from '@/components/auth/ReadOnlyIndicator';
import { useRouter } from 'expo-router';
import { useGameContext, GameData } from '@/contexts/GameContext';
import { saveOrUpdateActiveGame } from '@/services/gameSnapshot';
import { getAllActivePaymentUnits } from '@/services/paymentUnits';
import { validateGameDate, formatGameDate } from '@/utils/dateUtils';
import { useAuth } from '@/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import gameDataManager from '@/services/gameDataManager';
import { clearStatsCache } from '@/services/statistics/statisticsService';
import NetInfo from '@react-native-community/netinfo';
import { getUserById } from '@/services/users';
import {
  generateGroupMessage,
  generatePayerMessage,
  generateReceiverMessage,
  copyToClipboard,
  openWhatsAppWithMessage
} from '@/utils/whatsappPayment';
import { UserProfile } from '@/models/UserProfile';

interface PaymentEntity {
  id: string;
  type: 'player' | 'unit';
  name: string;
  amount: number;
  players?: { id: string; name: string }[];
}

interface Payment {
  from: PaymentEntity;
  to: PaymentEntity;
  amount: number;
}

export default function PaymentCalculations() {
  const router = useRouter();
  const { gameData, setGameData, updateGameStatus, clearActiveGame, shouldUpdateStatus, canUserContinueThisGame } = useGameContext();
  const [optimizedPayments, setOptimizedPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [userPhones, setUserPhones] = useState<Map<string, string>>(new Map());
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());
  const [sendingMessages, setSendingMessages] = useState(false);
  const [messageProgress, setMessageProgress] = useState({ current: 0, total: 0 });
  const [pendingMessages, setPendingMessages] = useState<Array<{
    recipientName: string;
    recipientPhone: string;
    message: string;
  }>>([]);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const { canManageEntity } = useAuth();

  // בדיקת הרשאות להמשך המשחק
  const canContinue = canUserContinueThisGame(gameData);

  // פונקציה לרענון נתוני ההיסטוריה והסטטיסטיקות אחרי השלמת המשחק
  const refreshDataAfterGameCompletion = async () => {
    try {
      console.log('PaymentCalculations: Starting data refresh after game completion...');
      
      // בדיקת מצב החיבור לרשת
      const netInfo = await NetInfo.fetch();
      const isConnected = netInfo.isConnected;
      
      if (isConnected) {
        console.log('PaymentCalculations: Online - refreshing from Firestore');
        
        // במצב ONLINE - רענן מ-Firestore
        // ניקוי מטמון ההיסטוריה
        gameDataManager.clearGamesCache();
        
        // ניקוי מטמון הסטטיסטיקות
        clearStatsCache();
        
        // טעינה מחדש מ-Firestore (יתבצע ברקע)
        gameDataManager.fetchAllGames({ skipCache: true, onlyCompleted: true })
          .then(games => {
            console.log(`PaymentCalculations: Successfully refreshed ${games.length} games from Firestore`);
          })
          .catch(error => {
            console.error('PaymentCalculations: Error refreshing games from Firestore:', error);
          });
        
      } else {
        console.log('PaymentCalculations: Offline - updating local cache');
        
        // במצב OFFLINE - עדכן מטמון מקומי
        // הוסף את המשחק החדש למטמון המקומי
        // (זה יתבצע אוטומטיט כשהחיבור יחזור)
        console.log('PaymentCalculations: Game will be synced when connection is restored');
      }
      
    } catch (error) {
      console.error('PaymentCalculations: Error refreshing data after game completion:', error);
    }
  };

  // Fetch user phone numbers and names for WhatsApp functionality
  useEffect(() => {
    const fetchUserData = async () => {
      const phones = new Map<string, string>();
      const names = new Map<string, string>();
      const playerIds = gameData.players.map(p => p.id);

      for (const playerId of playerIds) {
        try {
          const user = await getUserById(playerId);
          if (user?.phone) {
            phones.set(playerId, user.phone);
          }
          if (user?.name) {
            names.set(playerId, user.name);
          }
        } catch (err) {
          console.error(`Error fetching data for user ${playerId}:`, err);
        }
      }

      // Also add names from gameData.players for fallback
      gameData.players.forEach(p => {
        if (!names.has(p.id)) {
          names.set(p.id, p.name);
        }
      });

      setUserPhones(phones);
      setUserNames(names);
    };

    fetchUserData();
  }, [gameData.players]);

  // Group players by payment units
  useEffect(() => {
    const calculatePayments = async () => {
      try {
        const paymentUnits = await getAllActivePaymentUnits();
        const players = gameData.players;
        const entities: PaymentEntity[] = [];

        // Group players into payment units
        const playersInUnits = new Set<string>();
        
        paymentUnits.forEach(unit => {
          // Check if all unit players are in the game
          const unitPlayers = players.filter(p => unit.players.includes(p.id));
          if (unitPlayers.length === unit.players.length) {
            // Calculate total amount for unit
            const totalAmount = unitPlayers.reduce((sum, p) => sum + (p.finalResultMoney || 0), 0);
            
            // Add unit as an entity
            entities.push({
              id: unit.id,
              type: 'unit',
              name: unit.name,
              amount: totalAmount,
              players: unitPlayers.map(p => ({ id: p.id, name: p.name }))
            });

            // Mark these players as handled
            unitPlayers.forEach(p => playersInUnits.add(p.id));
          }
        });

        // Add remaining players as individual entities
        players.forEach(player => {
          if (!playersInUnits.has(player.id)) {
            entities.push({
              id: player.id,
              type: 'player',
              name: player.name,
              amount: player.finalResultMoney || 0
            });
          }
        });

        // Optimize payments
        const payments = optimizePayments(entities);
        setOptimizedPayments(payments);

      } catch (error) {
        console.error('Error calculating payments:', error);
        setError('שגיאה בחישוב התשלומים');
      }
    };

    calculatePayments();
  }, [gameData.players]);

  // Optimize payments between entities
  const optimizePayments = (entities: PaymentEntity[]): Payment[] => {
    const payments: Payment[] = [];
    let workingEntities = [...entities];

    while (workingEntities.length > 1) {
      // Sort entities by amount
      const winners = workingEntities
        .filter(e => e.amount > 0)
        .sort((a, b) => b.amount - a.amount);
      
      const losers = workingEntities
        .filter(e => e.amount < 0)
        .sort((a, b) => a.amount - b.amount);

      if (winners.length === 0 || losers.length === 0) break;

      const winner = winners[0];
      const loser = losers[0];
      const amount = Math.min(winner.amount, Math.abs(loser.amount));

      // Create payment
      payments.push({
        from: loser,
        to: winner,
        amount: amount
      });

      // Update amounts
      winner.amount -= amount;
      loser.amount += amount;

      // Remove zeroed entities
      workingEntities = workingEntities.filter(e => 
        Math.abs(e.amount) > 0.01
      );
    }

    return payments;
  };

  // הסרת עדכון אוטומטי של סטטוס - נעשה באופן ידני במקומות המתאימים

  // Handle hardware back press
  useEffect(() => {
    const backAction = () => {
      setShowExitDialog(true);
      return true; // Prevent default behavior (exiting the app)
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );
    return () => backHandler.remove();
  }, []);

  // Group payments by payer for display
  const groupedPayments = useMemo(() => {
    const groups = new Map<string, Payment[]>();
    
    optimizedPayments.forEach(payment => {
      const payerId = payment.from.id;
      if (!groups.has(payerId)) {
        groups.set(payerId, []);
      }
      groups.get(payerId)!.push(payment);
    });

    return Array.from(groups.entries()).map(([payerId, payments]) => ({
      payer: payments[0].from,
      payments
    }));
  }, [optimizedPayments]);

  const handleFinishGame = async () => {
    // הגנה מפני קריאות כפולות
    if (loading) {
      console.log('PaymentCalculations: handleFinishGame already in progress, ignoring');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('PaymentCalculations: Starting game completion process...');
      
      // Validate the game date before saving
      const validatedGameDate = validateGameDate(gameData.gameDate);
      console.log('PaymentCalculations: Validated game date:', validatedGameDate);
      
      // Update game status and payments with validated date
      const finalGameData = {
        ...gameData,
        gameDate: validatedGameDate,
        status: 'completed' as const,
        payments: optimizedPayments.map(p => ({
          from: {
            userId: p.from.type === 'player' ? p.from.id : undefined,
            unitId: p.from.type === 'unit' ? p.from.id : undefined 
          },
          to: {
            userId: p.to.type === 'player' ? p.to.id : undefined,
            unitId: p.to.type === 'unit' ? p.to.id : undefined 
          },
          amount: p.amount
        }))
      };

      console.log('PaymentCalculations: Game data prepared for saving');
      
      // Clean the data before saving
      const cleanGameData = JSON.parse(JSON.stringify(finalGameData));
      
      // בדיקה שיש למשתמש הרשאות לשמור משחק
      if (!canManageEntity('game')) {
        Alert.alert(
          "שגיאת הרשאות",
          "אין לך הרשאות לשמור משחק. יש צורך בהרשאות מנהל או סופר.",
          [{ text: "הבנתי" }]
        );
        console.error("PaymentCalculations: User does not have permission to save games");
        setLoading(false);
        return;
      }

      // Save to Firebase
      console.log('PaymentCalculations: Saving game data to Firebase...');
      await saveOrUpdateActiveGame(cleanGameData);

      // Update local state in one atomic operation
      setGameData(finalGameData);

      console.log('PaymentCalculations: Game saved successfully, starting cleanup...');

      // Clear active game ID from AsyncStorage first
      await AsyncStorage.removeItem('active_game_id');

      // Clear active game since it's now completed
      await clearActiveGame();

      // רענון נתוני ההיסטוריה והסטטיסטיקות אחרי שמירת המשחק
      console.log('PaymentCalculations: Refreshing history and statistics data...');
      await refreshDataAfterGameCompletion();

      console.log('PaymentCalculations: Cleanup completed, navigating home...');

      // Navigate home
      router.push('/(tabs)/home2');

    } catch (error) {
      console.error('PaymentCalculations: Error finishing game:', error);
      setError('שגיאה בשמירת המשחק');
      setLoading(false);
    }
  };

  // Game info for messages
  const gameInfo = {
    groupName: gameData.groupNameSnapshot,
    gameDate: formatGameDate(gameData.gameDate)
  };

  // Get all players who should receive messages (including payment unit members)
  const getMessageRecipients = () => {
    const recipients: Array<{
      recipientName: string;
      recipientPhone?: string;
      type: 'payer' | 'receiver';
      payments: Array<{ fromName: string; toName: string; amount: number }>;
    }> = [];

    // Group payments by payer entity
    const payerGroups = new Map<string, Payment[]>();
    optimizedPayments.forEach(payment => {
      const key = payment.from.id;
      if (!payerGroups.has(key)) {
        payerGroups.set(key, []);
      }
      payerGroups.get(key)!.push(payment);
    });

    // Group payments by receiver entity
    const receiverGroups = new Map<string, Payment[]>();
    optimizedPayments.forEach(payment => {
      const key = payment.to.id;
      if (!receiverGroups.has(key)) {
        receiverGroups.set(key, []);
      }
      receiverGroups.get(key)!.push(payment);
    });

    // Add payers
    payerGroups.forEach((payments, entityId) => {
      const entity = payments[0].from;
      const paymentInfos = payments.map(p => ({
        fromName: p.from.name,
        toName: p.to.name,
        amount: p.amount
      }));

      if (entity.type === 'unit' && entity.players) {
        // For payment units, add both players
        entity.players.forEach(player => {
          recipients.push({
            recipientName: player.name,
            recipientPhone: userPhones.get(player.id),
            type: 'payer',
            payments: paymentInfos
          });
        });
      } else {
        // Individual player
        recipients.push({
          recipientName: entity.name,
          recipientPhone: userPhones.get(entity.id),
          type: 'payer',
          payments: paymentInfos
        });
      }
    });

    // Add receivers
    receiverGroups.forEach((payments, entityId) => {
      const entity = payments[0].to;
      const paymentInfos = payments.map(p => ({
        fromName: p.from.name,
        toName: p.to.name,
        amount: p.amount
      }));

      if (entity.type === 'unit' && entity.players) {
        // For payment units, add both players
        entity.players.forEach(player => {
          recipients.push({
            recipientName: player.name,
            recipientPhone: userPhones.get(player.id),
            type: 'receiver',
            payments: paymentInfos
          });
        });
      } else {
        // Individual player
        recipients.push({
          recipientName: entity.name,
          recipientPhone: userPhones.get(entity.id),
          type: 'receiver',
          payments: paymentInfos
        });
      }
    });

    return recipients;
  };

  // Handle copy group message to clipboard
  const handleCopyGroupMessage = async () => {
    const payments = optimizedPayments.map(p => ({
      fromName: p.from.name,
      toName: p.to.name,
      amount: p.amount
    }));

    const message = generateGroupMessage(payments, gameInfo);
    const success = await copyToClipboard(message);

    if (success) {
      Alert.alert('הועתק!', 'ההודעה הועתקה ללוח. כעת ניתן להדביק אותה בקבוצת WhatsApp.');
    } else {
      Alert.alert('שגיאה', 'לא ניתן להעתיק את ההודעה');
    }
  };

  // Handle sending individual messages
  const handleSendIndividualMessages = async () => {
    const recipients = getMessageRecipients();

    // Filter recipients with valid phone numbers
    const validRecipients = recipients.filter(r => r.recipientPhone);
    const invalidRecipients = recipients.filter(r => !r.recipientPhone);

    if (validRecipients.length === 0) {
      Alert.alert(
        'אין מספרי טלפון',
        'לא נמצאו מספרי טלפון לשחקנים. יש לוודא שהמספרים מוגדרים במערכת.'
      );
      return;
    }

    // Prepare messages
    const messages = validRecipients.map(r => ({
      recipientName: r.recipientName,
      recipientPhone: r.recipientPhone!,
      message: r.type === 'payer'
        ? generatePayerMessage(r.recipientName, r.payments, gameInfo)
        : generateReceiverMessage(r.recipientName, r.payments, gameInfo)
    }));

    // Warn about missing phone numbers
    if (invalidRecipients.length > 0) {
      const missingNames = invalidRecipients.map(r => r.recipientName).join(', ');
      Alert.alert(
        'שים לב',
        `לא נמצאו מספרי טלפון עבור: ${missingNames}\nיישלחו ${messages.length} הודעות.`,
        [
          { text: 'ביטול', style: 'cancel' },
          { text: 'המשך', onPress: () => startSendingMessages(messages) }
        ]
      );
    } else {
      startSendingMessages(messages);
    }
  };

  // Start the sequential message sending process
  const startSendingMessages = (messages: Array<{ recipientName: string; recipientPhone: string; message: string }>) => {
    setPendingMessages(messages);
    setMessageProgress({ current: 0, total: messages.length });
    setSendingMessages(true);
    setShowMessageDialog(true);
  };

  // Send the next pending message
  const sendNextMessage = async () => {
    if (pendingMessages.length === 0) {
      setSendingMessages(false);
      setShowMessageDialog(false);
      Alert.alert('הושלם!', 'כל ההודעות נשלחו בהצלחה.');
      return;
    }

    const [nextMessage, ...remaining] = pendingMessages;

    const success = await openWhatsAppWithMessage(nextMessage.recipientPhone, nextMessage.message);

    if (success) {
      setPendingMessages(remaining);
      setMessageProgress(prev => ({ ...prev, current: prev.current + 1 }));
    } else {
      Alert.alert(
        'שגיאה',
        `לא ניתן לשלוח הודעה ל${nextMessage.recipientName}`,
        [
          { text: 'דלג', onPress: () => {
            setPendingMessages(remaining);
            setMessageProgress(prev => ({ ...prev, current: prev.current + 1 }));
          }},
          { text: 'נסה שוב', onPress: sendNextMessage }
        ]
      );
    }
  };

  // Cancel sending messages
  const cancelSendingMessages = () => {
    setSendingMessages(false);
    setShowMessageDialog(false);
    setPendingMessages([]);
    setMessageProgress({ current: 0, total: 0 });
  };

  // Count total messages
  const totalMessageCount = getMessageRecipients().length;

  // Get formatted date for display
  const displayDate = formatGameDate(gameData.gameDate);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {/* Back Button */}
        <TouchableOpacity onPress={() => setShowExitDialog(true)} style={styles.backButton}>
           <Icon name="arrow-right" size={24} color="#FFD700" />
        </TouchableOpacity>
        
        {/* Header Content */}
        <View style={styles.headerContent}>
        <Text variant="h4" style={styles.headerTitle}>
          חישוב תשלומים
        </Text>
        <Text style={styles.headerSubtitle}>
          {gameData.groupNameSnapshot}
        </Text>
        <Text style={styles.headerSubtitle}>
          {displayDate}
        </Text>
        </View>
        
        <TouchableOpacity 
          onPress={async () => {
            await AsyncStorage.removeItem('active_game_id');
            router.push('/(tabs)/home2');
          }} 
          style={styles.homeButton}
        >
          <Icon name="home" size={24} color="#FFD700" />
        </TouchableOpacity>
      </View>

      <ReadOnlyIndicator />

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Payments List */}
      <ScrollView style={styles.scrollView}>
        {groupedPayments.map(({ payer, payments }) => (
          <Card key={payer.id} style={styles.payerCard}>
            <View style={styles.payerHeader}>
              <Text style={styles.payerName}>
                {`${payer.type === 'unit' ? payer.name : payer.name} :`}
              </Text>
            </View>

            {/* List of Payments */}
            <View style={styles.paymentsContainer}>
              {payments.map((payment, index) => (
                <View key={index} style={styles.paymentRow}>
                  <Text style={styles.receiverName}>
                    {`${payment.amount.toFixed(0)} ש"ח ל${payment.to.name}`}
                  </Text>
                </View>
              ))}
            </View>

            {/* Total Row */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>סה"כ לתשלום:</Text>
              <Text style={styles.totalAmount}>
                {payments.reduce((sum, p) => sum + p.amount, 0).toFixed(0)} ש"ח
              </Text>
            </View>
          </Card>
        ))}
      </ScrollView>

      {/* WhatsApp Buttons */}
      <View style={styles.whatsappSection}>
        <TouchableOpacity
          style={styles.copyGroupButton}
          onPress={handleCopyGroupMessage}
        >
          <Icon name="content-save" size="small" color="#FFD700" />
          <Text style={styles.whatsappButtonText}>העתק הודעה לקבוצה</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sendIndividualButton}
          onPress={handleSendIndividualMessages}
          disabled={sendingMessages}
        >
          <Icon name="whatsapp" size="small" color="#25D366" />
          <Text style={styles.whatsappButtonText}>
            {sendingMessages
              ? `שולח... (${messageProgress.current}/${messageProgress.total})`
              : `שלח הודעות פרטיות (${totalMessageCount})`
            }
          </Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      {canContinue && (
        <View style={styles.footer}>
          <Button
            title={loading ? "מסיים משחק..." : "סיים משחק"}
            onPress={handleFinishGame}
            style={styles.finishButton}
            disabled={loading}
          />
        </View>
      )}

      {/* Message Sending Dialog */}
      <Dialog
        visible={showMessageDialog}
        title="שליחת הודעות WhatsApp"
        message={pendingMessages.length > 0
          ? `הודעה הבאה: ${pendingMessages[0]?.recipientName}\n\nלחץ "שלח הבא" לפתיחת WhatsApp`
          : 'כל ההודעות נשלחו!'
        }
        onCancel={cancelSendingMessages}
        onConfirm={sendNextMessage}
        confirmText={pendingMessages.length > 0 ? "שלח הבא" : "סיום"}
        cancelText="ביטול"
      />
      
      {/* Exit Confirmation Dialog */}
      <Dialog
        visible={showExitDialog}
        title="חזרה למסך הקודם"
        message="האם אתה בטוח שברצונך לחזור למסך הקודם?"
        onCancel={() => setShowExitDialog(false)}
        onConfirm={() => {
          setShowExitDialog(false);
          router.back(); // פשוט חזרה למסך הקודם במחסנית הניווט
        }}
        confirmText="כן, חזור"
        cancelText="לא, המשך כאן"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1B1E',
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#35654d',
    borderBottomWidth: 2,
    borderBottomColor: '#FFD700',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8, 
  },
  headerContent: {
    flex: 1, 
    alignItems: 'center', 
  },
  headerTitle: {
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    color: '#FFD700',
    textAlign: 'center',
    fontSize: 16,
    opacity: 0.9,
  },
  errorContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  payerCard: {
    marginBottom: 16,
    backgroundColor: '#1C2C2E',
    borderColor: '#FFD700',
    borderWidth: 1,
    padding: 16,
  },
  payerHeader: {
    marginBottom: 12,
  },
  payerName: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  paymentsContainer: {
    backgroundColor: 'rgba(53, 101, 77, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  paymentRow: {
    marginBottom: 8,
    paddingVertical: 4,
  },
  receiverName: {
    color: '#FFD700',
    fontSize: 16,
    textAlign: 'right',
  },
  whatsappSection: {
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 215, 0, 0.3)',
  },
  copyGroupButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFD700',
    gap: 10,
  },
  sendIndividualButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37, 211, 102, 0.15)',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#25D366',
    gap: 10,
  },
  whatsappButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 215, 0, 0.3)',
  },
  totalLabel: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalAmount: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    padding: 16,
    backgroundColor: '#0D1B1E',
    borderTopWidth: 1,
    borderTopColor: '#FFD700',
  },
  finishButton: {
    backgroundColor: '#35654d',
    borderColor: '#FFD700',
    borderWidth: 2,
  },
  homeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});