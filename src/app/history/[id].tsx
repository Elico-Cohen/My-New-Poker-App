// src/app/history/[id].tsx
import React, { useEffect, useState, useMemo } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Text } from '@/components/common/Text';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { Button } from '@/components/common/Button';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { Game, PlayerInGame, Payment, OpenGame } from '@/models/Game';
import { getGameById, deleteGame } from '@/services/games';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { PaymentUnit } from '@/models/PaymentUnit';
import { UserProfile } from '@/models/UserProfile';
import { Ionicons } from '@expo/vector-icons';
import { DeleteGameDialog } from '@/components/games/DeleteGameDialog';
import { useAuth } from '@/contexts/AuthContext';

const CASINO_COLORS = {
  background: '#0D1B1E',
  primary: '#35654d',
  gold: '#FFD700',
  surface: '#1C2C2E',
  text: '#FFFFFF',
  textSecondary: '#B8B8B8',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444'
};

// Cache for payment units and user data
const paymentUnitsCache = new Map<string, PaymentUnit>();
const usersCache = new Map<string, UserProfile>();

// העברת הקומפוננטים מחוץ לקומפוננט הראשי
// קומפוננטת כרטיס משלם - מציגה את כל התשלומים של משלם אחד
function PayerCard({ 
  payments, 
  game,
  getEntityName
}: { 
  payments: Payment[], 
  game: Game,
  getEntityName: (userId?: string, unitId?: string) => Promise<string>
}) {
  const [payerName, setPayerName] = useState<string>('טוען...');
  const firstPayment = payments[0];
  
  // חישוב הסכום הכולל של התשלומים
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  
  useEffect(() => {
    const loadPayerName = async () => {
      try {
        if (firstPayment.from.userId) {
          // חיפוש השחקן ברשימת השחקנים במשחק קודם
          const player = game.players?.find(p => p.userId === firstPayment.from.userId);
          if (player?.name) {
            setPayerName(player.name);
          } else {
            const name = await getEntityName(firstPayment.from.userId, undefined);
            setPayerName(name);
          }
        } else if (firstPayment.from.unitId) {
          const name = await getEntityName(undefined, firstPayment.from.unitId);
          setPayerName(name);
        }
      } catch (error) {
        console.error('Error loading payer name:', error);
      }
    };
    
    loadPayerName();
  }, [firstPayment, game, getEntityName]);

  return (
    <Card style={styles.payerCard}>
      <View style={styles.payerHeader}>
        <Text style={styles.payerName}>
          {payerName} :
        </Text>
      </View>

      {/* רשימת התשלומים */}
      <View style={styles.paymentsContainer}>
        {payments.map((payment, index) => (
          <PaymentRow 
            key={index} 
            payment={payment} 
            game={game}
            getEntityName={getEntityName}
          />
        ))}
      </View>

      {/* שורת סיכום */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>סה"כ לתשלום:</Text>
        <Text style={styles.totalAmount}>
          {totalAmount.toFixed(0)} ₪
        </Text>
      </View>
    </Card>
  );
}

// שורת תשלום בודדת
function PaymentRow({ 
  payment, 
  game,
  getEntityName
}: { 
  payment: Payment, 
  game: Game,
  getEntityName: (userId?: string, unitId?: string) => Promise<string>
}) {
  const [receiverName, setReceiverName] = useState<string>('טוען...');
  
  useEffect(() => {
    const loadReceiverName = async () => {
      try {
        if (payment.to.userId) {
          // חיפוש המקבל ברשימת השחקנים במשחק קודם
          const player = game.players?.find(p => p.userId === payment.to.userId);
          if (player?.name) {
            setReceiverName(player.name);
          } else {
            const name = await getEntityName(payment.to.userId, undefined);
            setReceiverName(name);
          }
        } else if (payment.to.unitId) {
          const name = await getEntityName(undefined, payment.to.unitId);
          setReceiverName(name);
        }
      } catch (error) {
        console.error('Error loading receiver name:', error);
      }
    };
    
    loadReceiverName();
  }, [payment, game, getEntityName]);

  return (
    <View style={styles.paymentRow}>
      <Text style={styles.receiverName}>
        {payment.amount.toFixed(0)} ₪ ל{receiverName}
      </Text>
    </View>
  );
}

export default function GameDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { canDeleteEntity } = useAuth();
  
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'results' | 'payments' | 'openGames'>('results');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Hook לקיבוץ התשלומים - הועבר לרמה העליונה של הקומפוננט
  const groupedPayments = useMemo(() => {
    if (!game?.payments) return [];
    
    // קיבוץ תשלומים לפי משלם
    const groups = new Map<string, Payment[]>();
    
    game.payments.forEach(payment => {
      const payerId = payment.from.userId || payment.from.unitId || 'unknown';
      if (!groups.has(payerId)) {
        groups.set(payerId, []);
      }
      groups.get(payerId)!.push(payment);
    });

    return Array.from(groups.entries()).map(([payerId, payments]) => ({
      payerId,
      payments
    }));
  }, [game?.payments]);
  
  // Helper function to fetch document by ID from a collection
  const fetchDocument = async (collectionName: string, docId: string) => {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  };
  
  useEffect(() => {
    const loadGame = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // Fetch game directly from Firestore for more reliable data
        const gameData = await fetchDocument('games', id as string) as Game;
        
        if (!gameData) {
          throw new Error('המשחק המבוקש לא נמצא');
        }
        
        console.log('Loaded game data:', gameData);
        
        // Ensure date is properly formatted
        if (gameData.date && !gameData.date.timestamp && gameData.createdAt) {
          gameData.date.timestamp = gameData.createdAt;
        }
        
        setGame(gameData);
      } catch (err) {
        console.error('Failed to load game details:', err);
        setError('טעינת נתוני המשחק נכשלה');
      } finally {
        setLoading(false);
      }
    };
    
    loadGame();
  }, [id]);
  
  // Format date for display - improved version
  const formatDate = (gameDate: any): string => {
    if (!gameDate) return 'תאריך לא זמין';
    
    try {
      // Try different date formats and fallbacks
      
      // 1. Try using day/month/year if available
      if (typeof gameDate.day === 'number' && typeof gameDate.month === 'number' && typeof gameDate.year === 'number') {
        const date = new Date(gameDate.year, gameDate.month - 1, gameDate.day);
        return date.toLocaleDateString('he-IL');
      }
      
      // 2. Try using timestamp if available
      if (gameDate.timestamp) {
        const date = new Date(gameDate.timestamp);
        return date.toLocaleDateString('he-IL');
      }
      
      // 3. If it's a string, try parsing directly
      if (typeof gameDate === 'string') {
        return new Date(gameDate).toLocaleDateString('he-IL');
      }
    } catch (e) {
      console.error('Error formatting date:', e);
    }
    
    return 'תאריך לא זמין';
  };
  
  // Helper function to get payment unit or user name
  const getEntityName = async (
    userId?: string, 
    unitId?: string
  ): Promise<string> => {
    if (!userId && !unitId) return 'לא ידוע';
    
    try {
      if (unitId) {
        // Check cache first
        if (paymentUnitsCache.has(unitId)) {
          return paymentUnitsCache.get(unitId)!.name;
        }
        
        // Fetch payment unit
        const unit = await fetchDocument('paymentUnits', unitId) as PaymentUnit;
        if (unit) {
          paymentUnitsCache.set(unitId, unit);
          return unit.name;
        }
      }
      
      if (userId) {
        // Check player list in current game first
        const player = game?.players?.find(p => p.userId === userId);
        if (player?.name) {
          return player.name;
        }
        
        // Check cache
        if (usersCache.has(userId)) {
          return usersCache.get(userId)!.name;
        }
        
        // Fetch user
        const user = await fetchDocument('users', userId) as UserProfile;
        if (user) {
          usersCache.set(userId, user);
          return user.name;
        }
      }
    } catch (error) {
      console.error('Error fetching entity name:', error);
    }
    
    return userId ? `שחקן (${userId.slice(0, 4)}...)` : `יחידת תשלום (${unitId?.slice(0, 4)}...)`;
  };
  
  // פונקציה לפתיחת דיאלוג המחיקה
  const handleDeleteGame = () => {
    if (!game) return;
    setShowDeleteDialog(true);
  };
  
  // פונקציה לטיפול בהצלחת המחיקה
  const handleDeleteSuccess = () => {
    // ניתוב למסך ההיסטוריה עם פרמטר ריענון
    router.replace({
      pathname: "/(tabs)/history",
      params: { refresh: Date.now().toString() }
    });
  };
  
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Icon name="arrow-right" size="medium" color="#FFD700" />
          </TouchableOpacity>
          <Text variant="h4" style={styles.headerTitle}>
            פרטי המשחק
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <LoadingIndicator text="טוען פרטי משחק..." />
        </View>
      </View>
    );
  }
  
  if (error || !game) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Icon name="arrow-right" size="medium" color="#FFD700" />
          </TouchableOpacity>
          <Text variant="h4" style={styles.headerTitle}>
            פרטי המשחק
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size="xlarge" color={CASINO_COLORS.error} />
          <Text style={styles.errorText}>{error || 'המשחק לא נמצא'}</Text>
          <Button 
            title="חזור להיסטוריה" 
            onPress={() => router.back()} 
            style={styles.backToHistoryButton}
          />
        </View>
      </View>
    );
  }
  
  // Sort players by final result (winners first)
  const sortedPlayers = game.players ? 
    [...game.players].sort((a, b) => {
      // מיון ראשוני לפי סכום כסף (מהגבוה לנמוך)
      const aAmount = a.finalResultMoney || 0;
      const bAmount = b.finalResultMoney || 0;
      
      // מיון לפי סכום - מהגבוה לנמוך
      if (bAmount !== aAmount) {
        return bAmount - aAmount;
      }
      
      // אם הסכומים שווים, מיין לפי שם (א'-ב')
      return (a.name || '').localeCompare(b.name || '', 'he');
    }) : [];
  
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false, header: () => null }} />
      
      {/* עדכון האייקונים לפי קומפוננט Icon הקיים */}
      <View style={styles.header}>
        {canDeleteEntity('game') ? (
          <TouchableOpacity 
            onPress={handleDeleteGame} 
            style={styles.deleteButton}
          >
            <Icon name="delete" size="medium" color="#ef4444" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            onPress={() => {
              Alert.alert(
                "אין הרשאה",
                "רק מנהל מערכת יכול למחוק משחקים.",
                [{ text: "הבנתי" }]
              );
            }}
            style={[styles.deleteButton, { opacity: 0.5 }]}
          >
            <Icon name="delete" size="medium" color="#666" />
          </TouchableOpacity>
        )}
        
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            פרטי משחק
          </Text>
          
          <Text style={styles.headerSubtitle}>
            {game ? formatDate(game.date) : ''}
          </Text>
        </View>
        
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backButton}
        >
          <Icon name="arrow-right" size="medium" color="#FFD700" />
        </TouchableOpacity>
      </View>
      
      {/* Game summary */}
      <Card style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>קבוצה</Text>
            <Text style={styles.summaryValue}>{game.groupNameSnapshot}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>תאריך</Text>
            <Text style={styles.summaryValue}>{formatDate(game.date)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>שחקנים</Text>
            <Text style={styles.summaryValue}>{game.players?.length || 0}</Text>
          </View>
        </View>
      </Card>
      
      {/* Tab selection */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[
            styles.tab, 
            activeTab === 'results' && styles.activeTab
          ]}
          onPress={() => setActiveTab('results')}
        >
          <Text style={[
            styles.tabText,
            activeTab === 'results' && styles.activeTabText
          ]}>
            תוצאות
          </Text>
        </TouchableOpacity>
        
        {game.openGames && game.openGames.length > 0 && (
          <TouchableOpacity 
            style={[
              styles.tab, 
              activeTab === 'openGames' && styles.activeTab
            ]}
            onPress={() => setActiveTab('openGames')}
          >
            <Text style={[
              styles.tabText,
              activeTab === 'openGames' && styles.activeTabText
            ]}>
              משחקים פתוחים
            </Text>
          </TouchableOpacity>
        )}
        
        {game.payments && game.payments.length > 0 && (
          <TouchableOpacity 
            style={[
              styles.tab, 
              activeTab === 'payments' && styles.activeTab
            ]}
            onPress={() => setActiveTab('payments')}
          >
            <Text style={[
              styles.tabText,
              activeTab === 'payments' && styles.activeTabText
            ]}>
              תשלומים
            </Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Tab content */}
      <ScrollView style={styles.scrollView}>
        {activeTab === 'results' && game.players && (
          <View style={styles.tabContent}>
            {/* מיון השחקנים לפי סכום הכסף (מהגבוה לנמוך) ואז לפי שם כמיון משני */}
            {[...game.players]
              .sort((a, b) => {
                // משתמשים ב-|| 0 כדי לוודא שנתקבל מספר גם אם finalResultMoney הוא undefined
                const aAmount = a.finalResultMoney || 0;
                const bAmount = b.finalResultMoney || 0;
                
                // מיון לפי סכום - מהגבוה לנמוך
                if (bAmount !== aAmount) {
                  return bAmount - aAmount;
                }
                
                // אם הסכומים שווים, מיין לפי שם (א'-ב')
                return (a.name || '').localeCompare(b.name || '', 'he');
              })
              .map((player) => (
                <PlayerResultCard key={player.id || player.userId} player={player} game={game} />
              ))
            }
          </View>
        )}
        
        {activeTab === 'openGames' && game.openGames && (
          <View style={styles.tabContent}>
            <Card style={styles.openGamesCard}>
              <Text style={styles.openGamesTitle}>משחקים פתוחים ({game.openGames.length})</Text>
              {game.openGames.map((openGame) => {
                // מציאת הזוכה לפי שני סוגי מזהים אפשריים
                const winnerId = openGame.winner;
                const winner = winnerId && game.players ? 
                  game.players.find(p => p.userId === winnerId || p.id === winnerId) : 
                  null;
                
                return (
                  <View key={`open-game-${openGame.id || openGame.createdAt || Math.random().toString()}`} style={styles.openGameItem}>
                    <Text style={styles.openGameNumber}>משחק {openGame.id || 'פתוח'}</Text>
                    <View style={styles.openGameDetail}>
                      <Text style={styles.openGameLabel}>זוכה:</Text>
                      <Text style={styles.openGameValue}>
                        {winner ? winner.name : 'לא ידוע'}
                      </Text>
                    </View>
                    <View style={styles.openGameDetail}>
                      <Text style={styles.openGameLabel}>זכייה:</Text>
                      <Text style={styles.openGameValue}>{game.rebuySnapshot?.amount || 0} ₪</Text>
                    </View>
                  </View>
                );
              })}
            </Card>
          </View>
        )}
        
        {activeTab === 'payments' && game?.payments && (
          <View style={styles.tabContent}>
            {groupedPayments.map(({ payerId, payments }) => (
              <PayerCard 
                key={payerId} 
                payments={payments} 
                game={game}
                getEntityName={getEntityName}
              />
            ))}
          </View>
        )}
      </ScrollView>
      
      {/* דיאלוג מחיקת משחק */}
      {game && (
        <DeleteGameDialog
          visible={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          onSuccess={handleDeleteSuccess}
          game={game}
        />
      )}
    </View>
  );
}

// PlayerResultCard component - מימוש העיצוב מקובץ FinalResults.tsx
const PlayerResultCard = ({ player, game }: { player: PlayerInGame; game: Game }) => {
  const [expanded, setExpanded] = useState(false);
  
  // Format money values for display
  const formatMoney = (value: number) => {
    return value >= 0 ? `+${value.toFixed(2)} ₪` : `${value.toFixed(2)} ₪`;
  };
  
  // Calculate player investment
  const calculatePlayerInvestment = (player: PlayerInGame) => {
    const buyInTotal = (player.buyInCount || 0) * (game.buyInSnapshot?.amount || 0);
    const rebuyTotal = (player.rebuyCount || 0) * (game.rebuySnapshot?.amount || 0);
    return buyInTotal + rebuyTotal;
  };
  
  // Check if this player won any open games
  const wonOpenGames = game.openGames?.filter(og => og.winner === player.userId || og.winner === player.id) || [];
  const openGamesBonus = wonOpenGames.length * (game.rebuySnapshot?.amount || 0);
  
  const toggleExpansion = () => {
    setExpanded(!expanded);
  };
  
  return (
    <TouchableOpacity
      onPress={toggleExpansion}
      activeOpacity={0.8}
    >
      <Card style={[
        styles.playerCard, 
        expanded ? styles.expandedCard : null
      ]}>
        {/* Compact View (Always Visible) */}
        <View style={styles.compactView}>
          <View style={styles.playerInfo}>
            <Text style={styles.playerName}>{player.name}</Text>
            <Text style={[
              styles.resultText,
              (player.finalResultMoney || 0) >= 0 ? styles.positive : styles.negative
            ]}>
              {formatMoney(player.finalResultMoney || 0)}
            </Text>
          </View>
          <Icon
            name={expanded ? "chevron-up" : "chevron-down"}
            size="small"
            color="#FFD700"
          />
        </View>
        
        {/* Expanded View */}
        {expanded && (
          <View style={styles.expandedView}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>תוצאות ראשוניות</Text>
              <View style={styles.detailsGrid}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>השקעה כוללת</Text>
                  <Text style={styles.detailValue}>
                    {calculatePlayerInvestment(player).toFixed(2)} ₪
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>שווי צ'יפים</Text>
                  <Text style={styles.detailValue}>
                    {(player.exactChipsValue || 0).toFixed(2)} ₪
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>צ'יפים נותרו</Text>
                  <Text style={styles.detailValue}>
                    {player.remainingChips || '0'}
                  </Text>
                </View>
                <View style={[styles.detailItem, styles.totalItem]}>
                  <Text style={styles.detailLabel}>תוצאה ראשונית</Text>
                  <Text style={[
                    styles.detailValue,
                    (player.resultBeforeOpenGames || 0) >= 0 ? styles.positive : styles.negative
                  ]}>
                    {(player.resultBeforeOpenGames || 0).toFixed(2)} ₪
                  </Text>
                </View>
              </View>
            </View>
            
            {(game.openGames && game.openGames.length > 0) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>משחקים פתוחים</Text>
                <View style={styles.detailsGrid}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>מספר זכיות</Text>
                    <Text style={styles.detailValue}>
                      {wonOpenGames.length} משחקים
                    </Text>
                  </View>
                  <View style={[styles.detailItem, styles.totalItem]}>
                    <Text style={styles.detailLabel}>בונוס ממשחקים פתוחים</Text>
                    <Text style={[styles.detailValue, openGamesBonus > 0 && styles.positive]}>
                      {openGamesBonus.toFixed(2)} ₪
                    </Text>
                  </View>
                </View>
              </View>
            )}
            
            <View style={[
              styles.resultSection,
              (player.finalResultMoney || 0) >= 0 ? styles.positiveResult : styles.negativeResult
            ]}>
              <Text style={styles.resultLabel}>תוצאה סופית</Text>
              <Text style={styles.resultValue}>
                {(player.finalResultMoney || 0).toFixed(2)} ₪
              </Text>
            </View>
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CASINO_COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: CASINO_COLORS.background,
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: CASINO_COLORS.gold,
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: CASINO_COLORS.textSecondary,
    fontSize: 14,
  },
  deleteButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    color: CASINO_COLORS.error,
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 16,
  },
  backToHistoryButton: {
    backgroundColor: CASINO_COLORS.primary,
    borderColor: CASINO_COLORS.gold,
    borderWidth: 1,
    marginTop: 16,
  },
  summaryCard: {
    backgroundColor: CASINO_COLORS.surface,
    borderRadius: 8,
    padding: 16,
    margin: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
    minWidth: '30%',
  },
  summaryLabel: {
    color: CASINO_COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 4,
  },
  summaryValue: {
    color: CASINO_COLORS.gold,
    fontSize: 16,
    fontWeight: 'bold',
  },
  chipsInfo: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 215, 0, 0.3)',
    paddingTop: 12,
  },
  chipsItem: {
    flex: 1,
    alignItems: 'center',
  },
  chipsLabel: {
    color: CASINO_COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 4,
  },
  chipsValue: {
    color: CASINO_COLORS.gold,
    fontSize: 14,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: CASINO_COLORS.surface,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: CASINO_COLORS.gold,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  activeTab: {
    backgroundColor: CASINO_COLORS.primary,
  },
  tabText: {
    color: CASINO_COLORS.textSecondary,
    fontSize: 16,
  },
  activeTabText: {
    color: CASINO_COLORS.gold,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
    backgroundColor: CASINO_COLORS.surface,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
    borderRadius: 8,
  },
  tabContent: {
    padding: 16,
  },
  playerCard: {
    backgroundColor: '#1C2C2E',
    borderColor: '#FFD700',
    borderWidth: 1,
    marginBottom: 10,
    padding: 10,
    borderRadius: 8,
  },
  expandedCard: {
    borderWidth: 2,
  },
  compactView: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  playerInfo: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  playerName: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 8,
  },
  expandedView: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 215, 0, 0.3)',
    paddingTop: 10,
  },
  section: {
    marginBottom: 16,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 8,
    padding: 12,
  },
  sectionTitle: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'right',
  },
  detailsGrid: {
    gap: 8,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalItem: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 215, 0, 0.3)',
    marginTop: 4,
    paddingTop: 8,
  },
  detailLabel: {
    color: '#FFD700',
    opacity: 0.8,
  },
  detailValue: {
    color: '#FFD700',
    fontWeight: 'bold',
  },
  resultSection: {
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  positiveResult: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderColor: '#22c55e',
    borderWidth: 1,
  },
  negativeResult: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#ef4444',
    borderWidth: 1,
  },
  resultLabel: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultValue: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
  },
  positive: {
    color: '#22c55e',
  },
  negative: {
    color: '#ef4444',
  },
  highlightedPlayer: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderColor: '#FFD700',
    borderWidth: 1,
  },
  openGamesCard: {
    backgroundColor: 'rgba(53, 101, 77, 0.2)',
    borderColor: CASINO_COLORS.gold,
    borderWidth: 1,
    padding: 16,
    borderRadius: 8,
  },
  openGamesTitle: {
    color: CASINO_COLORS.gold,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  openGameItem: {
    backgroundColor: CASINO_COLORS.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  openGameNumber: {
    color: CASINO_COLORS.gold,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  openGameDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  openGameLabel: {
    color: CASINO_COLORS.textSecondary,
  },
  openGameValue: {
    color: CASINO_COLORS.text,
    fontWeight: 'bold',
  },
  paymentCard: {
    backgroundColor: 'rgba(53, 101, 77, 0.2)',
    borderColor: CASINO_COLORS.gold,
    borderWidth: 1,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  paymentFlow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentEntity: {
    flex: 1,
    alignItems: 'center',
  },
  paymentEntityName: {
    color: CASINO_COLORS.gold,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  paymentEntityRole: {
    color: CASINO_COLORS.textSecondary,
    fontSize: 14,
  },
  paymentArrow: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  paymentAmount: {
    color: CASINO_COLORS.gold,
    fontWeight: 'bold',
    fontSize: 16,
    marginTop: 4,
  },
  payerCard: {
    backgroundColor: 'rgba(53, 101, 77, 0.2)',
    borderColor: CASINO_COLORS.gold,
    borderWidth: 1,
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  payerHeader: {
    marginBottom: 12,
  },
  payerName: {
    color: CASINO_COLORS.gold,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  paymentsContainer: {
    backgroundColor: 'rgba(13, 27, 30, 0.5)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  paymentRow: {
    marginBottom: 8,
    paddingVertical: 4,
  },
  receiverName: {
    color: CASINO_COLORS.gold,
    fontSize: 16,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 215, 0, 0.3)',
  },
  totalLabel: {
    color: CASINO_COLORS.gold,
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalAmount: {
    color: CASINO_COLORS.gold,
    fontSize: 18,
    fontWeight: 'bold',
  },
});