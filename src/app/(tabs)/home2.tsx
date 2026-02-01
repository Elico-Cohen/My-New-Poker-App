// src/app/(tabs)/home2.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Alert, Dimensions, Image, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Text } from '@/components/common/Text';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { Button } from '@/components/common/Button';
import { getActiveUsers } from '@/services/users';
import { getAllActiveGroups } from '@/services/groups';
import { getDocs, collection, query, where, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { auth } from '@/config/firebase';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { Game, GameDate } from '@/models/Game';
import { useAuth } from '@/contexts/AuthContext';
import { useGameContext } from '@/contexts/GameContext';
import { UserProfile } from '@/models/UserProfile';
import { getLocalGames, clearAllLocalGames } from '@/services/gameSnapshot';
import StatCard from '@/components/statistics/StatCard';
import { getGroupStatistics } from '@/services/statistics/statisticsService';
import { getWinnersLosersStatistics } from '@/services/statistics/playerStatistics';
import { clearStatsCache } from '@/services/statistics/statisticsService';
import { syncService } from '@/store/SyncService';
import { GroupStats } from '@/models/Statistics';
import HeaderBar from '@/components/navigation/HeaderBar';
import ActiveGameBanner from '@/components/common/ActiveGameBanner';
import ConfirmationModal from '@/components/common/ConfirmationModal';

// הגדרת צבעי המערכת
const CASINO_COLORS = {
  background: '#0D1B1E',
  primary: '#35654d',
  gold: '#FFD700',
  surface: '#1C2C2E',
  text: '#FFFFFF',
  inactive: '#666666',
  error: '#ff4444'
};

// Define fallback date object to use when date is invalid
const DEFAULT_GAME_DATE = {
  day: 1,
  month: 1,
  year: 2023,
  timestamp: Date.now()
};

export type RecentGame = {
  groupId: string;
  groupName: string;
  gameId: string;
  gameDate: GameDate;
  playersCount: number;
  totalInvestment?: number;
};

export default function HomeScreen() {
  const router = useRouter();
  const { logout, user, canManageEntity, canAccessDashboard, canStartNewGame, isAuthenticated, isLoading } = useAuth();
  const { refreshActiveGameStatus } = useGameContext();

  // State for Quick Stats
  const [gamesCount, setGamesCount] = useState<number>(0);
  const [playersCount, setPlayersCount] = useState<number>(0);
  const [groupsCount, setGroupsCount] = useState<number>(0);

  // State for group statistics data
  const [groupStats, setGroupStats] = useState<GroupStats[]>([]);
  const [winnersLosersStats, setWinnersLosersStats] = useState<any>(null);

  // State for Recent Games and Groups
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Add state for user profile
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const [localGamesCount, setLocalGamesCount] = useState(0);
  const [showLocalGamesAlert, setShowLocalGamesAlert] = useState(false);
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);

  // Function to fetch user profile by email
  const fetchUserProfileByEmail = async (email: string | null | undefined) => {
    if (!email) {
      console.log('fetchUserProfileByEmail: No email provided or email is null');
      return null;
    }
    try {
      console.log('Fetching user profile for email:', email);
      const usersQuery = query(collection(db, 'users'), where('email', '==', email));
      const querySnapshot = await getDocs(usersQuery);
      
      if (!querySnapshot.empty) {
        // Get the first matching user document
        const userDoc = querySnapshot.docs[0];
        const userData = { id: userDoc.id, ...userDoc.data() } as UserProfile;
        console.log('Found user profile:', userData);
        return userData;
      } else {
        console.log('No user document found for email:', email);
        return null;
      }
    } catch (error) {
      console.error('Error fetching user profile by email:', error);
      return null;
    }
  };

  // Process a game to ensure it has valid data
  const processGame = (game: any): Game | null => {
    if (!game || !game.id) {
      console.warn('Invalid game object, skipping:', game);
      return null;
    }
    
    try {
      // Create a safe copy
      const safeGame = { ...game };
      
      // Ensure we have the arrays
      safeGame.players = Array.isArray(safeGame.players) ? safeGame.players : [];
      safeGame.payments = Array.isArray(safeGame.payments) ? safeGame.payments : [];
      
      // Debug the original date
      console.log(`Game ${game.id} fields:`, Object.keys(safeGame));
      
      // Check if date object exists
      const dateSource = safeGame.gameDate || safeGame.date;
      console.log(`Game ID ${game.id}, date source:`, dateSource);
      
      if (!dateSource || typeof dateSource !== 'object') {
        console.warn(`Game ${game.id} missing date fields, using createdAt or default`);
        
        // Check if createdAt exists and use it as a fallback
        if (typeof safeGame.createdAt === 'number') {
          const createdDate = new Date(safeGame.createdAt);
          safeGame.date = {
            day: createdDate.getDate(),
            month: createdDate.getMonth() + 1,
            year: createdDate.getFullYear(),
            timestamp: safeGame.createdAt
          };
        } else {
          safeGame.date = { ...DEFAULT_GAME_DATE };
        }
      } else {
        // Create a new date object based on what's available
        safeGame.date = {
          day: typeof dateSource.day === 'number' ? dateSource.day : DEFAULT_GAME_DATE.day,
          month: typeof dateSource.month === 'number' ? dateSource.month : DEFAULT_GAME_DATE.month,
          year: typeof dateSource.year === 'number' ? dateSource.year : DEFAULT_GAME_DATE.year,
          timestamp: typeof dateSource.timestamp === 'number' ? 
            dateSource.timestamp : 
            (typeof safeGame.createdAt === 'number' ? safeGame.createdAt : DEFAULT_GAME_DATE.timestamp)
        };
      }
      
      return safeGame;
    } catch (err) {
      console.error(`Error processing game ${game?.id}:`, err);
      return null;
    }
  };

  // Fetch all games at once from Firestore
  const fetchAllGames = async () => {
    try {
      console.log('Fetching all games from Firestore');
      
      // בדיקה אם המשתמש מחובר
      if (!auth.currentUser) {
        console.warn('User not authenticated when trying to get games');
        return []; // החזרת מערך ריק במקום לזרוק שגיאה
      }
      
      const gamesSnapshot = await getDocs(collection(db, 'games'));
      
      const processedGames: Game[] = [];
      
      for (const gameDoc of gamesSnapshot.docs) {
        const gameData = gameDoc.data();
        console.log(`Game ${gameDoc.id} fields:`, Object.keys(gameData));
        
        // Check if this game has a valid date
        if (gameData.gameDate || gameData.date) {
          // בדיקה אם יש שדה date או gameDate
          const dateSource = gameData.gameDate || gameData.date;
          console.log(`Game ID ${gameDoc.id}, date source:`, dateSource);
          
          const game = processGame({
            id: gameDoc.id,
            ...gameData
          });
          
          if (game) {
            processedGames.push(game);
          }
        } else {
          console.log(`Game ${gameDoc.id} has no valid date field, skipping`);
        }
      }
      
      // Sort games by date in descending order (newest first)
      const sortedGames = processedGames.sort((a, b) => {
        // בדיקה עם טיימסטמפ (מבנה ישן)
        if (a.date?.timestamp && b.date?.timestamp) {
          return b.date.timestamp - a.date.timestamp;
        }
        
        // בדיקה עם המבנה החדש - createdAt
        const aTimestamp = a.createdAt || 0;
        const bTimestamp = b.createdAt || 0;
        return bTimestamp - aTimestamp;
      });
      
      console.log(`Successfully processed ${sortedGames.length} games`);
      return sortedGames;
    } catch (error) {
      console.error('Error fetching games:', error);
      
      // אם יש שגיאת הרשאות, ננסה להחזיר רשימה ריקה במקום לזרוק שגיאה
      if (error instanceof Error && error.toString().includes('Missing or insufficient permissions')) {
        console.log('משתמש חסר הרשאות, מחזיר רשימת משחקים ריקה');
        return [];
      }
      
      throw error;
    }
  };

  // Get the most recent game for each group
  const getMostRecentGamesForGroups = (games: Game[], groupsData: { id: string; name: string }[]) => {
    try {
      const groupMap = new Map<string, Game>();
      
      // Group games by groupId, keeping only the most recent one
      games.forEach(game => {
        const groupId = game.groupId;
        if (!groupId) return;
        
        if (!groupMap.has(groupId) || 
            (game.date?.timestamp || 0) > (groupMap.get(groupId)?.date?.timestamp || 0)) {
          groupMap.set(groupId, game);
        }
      });
      
      // Convert to RecentGame format
      const recentGames: RecentGame[] = [];
      
      groupsData.forEach(group => {
        const recentGame = groupMap.get(group.id);
        if (recentGame) {
          // Calculate total investment
          let totalInvestment = 0;
          if (recentGame.players && Array.isArray(recentGame.players)) {
            totalInvestment = recentGame.players.reduce((total, player) => {
              const buyInTotal = (player.buyInCount || 0) * 
                ((recentGame.buyInSnapshot && recentGame.buyInSnapshot.amount) || 0);
              const rebuyTotal = (player.rebuyCount || 0) * 
                ((recentGame.rebuySnapshot && recentGame.rebuySnapshot.amount) || 0);
              return total + buyInTotal + rebuyTotal;
            }, 0);
          }
          
          recentGames.push({
            groupId: group.id,
            groupName: group.name,
            gameId: recentGame.id,
            gameDate: recentGame.date,
            playersCount: recentGame.players?.length || 0,
            totalInvestment: totalInvestment || undefined
          });
        }
      });
      
      return recentGames;
    } catch (error) {
      console.error('Error processing recent games:', error);
      return [];
    }
  };

  // הגדרת פונקציית טעינת נתונים סטטיסטיים
  const fetchStats = async () => {
    try {
      console.log('HomeScreen: מתחיל טעינת נתונים סטטיסטיים');
      
      // ניקוי מטמון הסטטיסטיקות ורענון נתונים מהשרת
      console.log('HomeScreen: מנקה מטמון ומרענן נתונים');
      clearStatsCache();
      await syncService.forceRefresh();
      
      try {
        // ממשיך הלאה להביא נתונים...
        console.log('HomeScreen: מביא משתמשים פעילים...');
        const users = await getActiveUsers();
        
        // טען את פרופיל המשתמש
        const userProfileResult = await fetchUserProfileByEmail(user?.email);
        if (userProfileResult) {
          console.log('HomeScreen: מגדיר פרופיל משתמש');
          setUserProfile(userProfileResult);
        }
        
        // טען את נתונים סטטיסטיים של המשתמש
        console.log('HomeScreen: מביא סטטיסטיקות קבוצה');
        const groupStats = await getGroupStatistics();
        setGroupStats(groupStats);
        
        // טען את נתונים סטטיסטיים של מנצחים והפסדים
        console.log('HomeScreen: מביא סטטיסטיקות מנצחים ומפסידים');
        const winnersLosers = await getWinnersLosersStatistics(3);
        setWinnersLosersStats(winnersLosers);
        
        // טען את נתונים סטטיסטיים של המשתמש
        console.log('HomeScreen: מביא קבוצות פעילות');
        const groupData = await getAllActiveGroups();
        setGroups(groupData);
        setGroupsCount(groupData.length);
        
        // טען את כל המשחקים
        console.log('HomeScreen: מביא את כל המשחקים');
        const allGames = await fetchAllGames();
        setGamesCount(allGames.length);
        
        // טען את המשחקים האחרונים עבור כל קבוצה
        console.log('HomeScreen: מחשב משחקים אחרונים לכל קבוצה');
        const recentGamesData = getMostRecentGamesForGroups(allGames, groupData);
        setRecentGames(recentGamesData);
        
        console.log('HomeScreen: טעינת נתונים הושלמה בהצלחה:', {
          gamesCount: allGames.length,
          groupsCount: groupData.length,
          usersCount: users.length
        });
      } catch (error) {
        console.error('שגיאה בטעינת נתונים:', error);
        setError('אירעה שגיאה בטעינת הנתונים. נסה שוב מאוחר יותר.');
      }
    } catch (error) {
      console.error('שגיאה בטעינת נתונים:', error);
      setError('אירעה שגיאה בטעינת הנתונים. נסה שוב מאוחר יותר.');
    }
  };

  // הוספת פונקציית טעינת פרופיל המשתמש
  const loadUserProfile = async () => {
    if (user && user.email) {
      console.log('Attempting to fetch user profile for email:', user.email);
      try {
        const profile = await fetchUserProfileByEmail(user.email);
        if (profile) {
          console.log('Setting user profile:', profile);
          setUserProfile(profile);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        // המשך למרות השגיאה
      }
    }
  };
  
  // טעינת נתונים אחרי שהמשתמש התחבר
  useEffect(() => {
    // רק אם המשתמש מחובר ולא במצב טעינה
    if (user && !isLoading) {
      // טען את פרופיל המשתמש
      loadUserProfile().catch(error => {
        console.error("שגיאה בטעינת פרופיל המשתמש:", error);
        // ממשיך למרות השגיאה
      });
      
      // טען נתונים סטטיסטיים
      fetchStats().catch(error => {
        console.error("שגיאה בטעינת נתונים סטטיסטיים:", error);
        // ממשיך למרות השגיאה, השגיאה כבר מטופלת בתוך fetchStats
      });
    } else {
      // אם אין משתמש או עדיין בטעינה, הפסק את מצב הטעינה
      setLoading(false);
    }
  }, [user, isLoading]);

  // הוספת קריאה לפונקציה של סטטיסטיקות קבוצה במסגרת טעינת הנתונים
  useEffect(() => {
    if (isAuthenticated && !isLoading && user) {
      console.log('Starting to fetch data with user:', user.email);
      
      const loadAppData = async () => {
        try {
          setError(null);
          
          // Don't set loading to true here - let content show immediately
          await Promise.all([
            fetchStats(),
            loadUserProfile(),
            getGroupStatistics()
          ]);
          
          // Only set loading to false if it was actually loading
        } catch (err) {
          console.error('Error loading app data:', err);
          setError('אירעה שגיאה בטעינת הנתונים');
        }
      };
      
      loadAppData();
    }
  }, [isAuthenticated, isLoading, user]);

  // רענון נתונים כשחוזרים למסך הבית (אחרי סיום משחק)
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated && !isLoading && user) {
        console.log('Home screen focused - refreshing data');
        fetchStats();
        refreshActiveGameStatus(); // רענון מצב המשחק הפעיל
      }
    }, [isAuthenticated, isLoading, user, refreshActiveGameStatus])
  );

  // בדיקת משחקים מקומיים ומחיקתם
  useEffect(() => {
    const cleanLocalGames = async () => {
      try {
        // מנקה משחקים מקומיים כי כעת פיירבייס עובד
        await clearAllLocalGames();
        setLocalGamesCount(0);
        setShowLocalGamesAlert(false);
      } catch (error) {
        console.error('שגיאה בניקוי משחקים מקומיים:', error);
      }
    };
    
    cleanLocalGames();
  }, []);

  // פונקציית התנתקות עם ניווט מובנה
  // Show logout confirmation modal
  const handleLogout = () => {
    console.log('=== handleLogout called ===');
    setShowLogoutConfirmation(true);
  };

  // Perform the actual logout
  const performLogout = async () => {
    setShowLogoutConfirmation(false);
    try {
      console.log('Logout requested');
      await logout();
      console.log('Logout successful, navigating to login screen');
      router.replace('/login');
    } catch (error) {
      console.error('Error during logout:', error);
      Alert.alert("שגיאה", "אירעה שגיאה במהלך ההתנתקות");
    }
  };

  // Handle settings
  const handleSettings = () => {
    // Only navigate to dashboard if user has permission
    if (canAccessDashboard()) {
      router.push('/dashboard');
    } else {
      Alert.alert(
        "אין הרשאה",
        "אין לך הרשאות גישה להגדרות המערכת",
        [{ text: "הבנתי" }]
      );
    }
  };

  // Format date for display with safety checks
  const formatGameDate = (gameDate: GameDate) => {
    try {
      // More defensive check for all required properties
      if (!gameDate || typeof gameDate.year !== 'number' || typeof gameDate.month !== 'number' || typeof gameDate.day !== 'number') {
        console.log('Invalid date properties:', gameDate);
        return 'תאריך לא זמין';
      }
      
      const date = new Date(gameDate.year, gameDate.month - 1, gameDate.day);
      return date.toLocaleDateString('he-IL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'Asia/Jerusalem'
      });
    } catch (error) {
      console.error('Error formatting date:', error, gameDate);
      return 'תאריך לא זמין';
    }
  };

  // Calculate the height of the footer to use for scroll padding
  const footerHeight = 80; // Approximation of the footer height including padding

  // Add debug logging for render state
  console.log('Render state:', {
    loading,
    error,
    userExists: !!user,
    userName: user?.name,
    userRole: user?.role,
    userProfileExists: !!userProfile,
    userProfileName: userProfile?.name,
    gamesCount,
    playersCount,
    groupsCount,
    recentGamesLength: recentGames.length,
    groupsLength: groups.length
  });

  // הוספת קוד הגנה שמבטיח שהמסך יציג משהו גם במקרה של בעיות נתונים
  if (!user) {
    console.log('Home2: No user data available, returning minimal UI');
    return (
      <View style={styles.container}>
        <Text style={styles.headerTitle}>ברוך הבא</Text>
        <Text style={styles.headerSubtitle}>מידע המשתמש נמצא בטעינה...</Text>
        <Button 
          title="רענן" 
          onPress={() => {
            console.log('Manual refresh requested');
            setLoading(true);
            setTimeout(() => setLoading(false), 500);
          }}
          style={{marginTop: 20}}
        />
      </View>
    );
  }

  if (error) {
    console.log('Rendering error state');
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.greeting}>שלום {user?.name || 'משתמש'}</Text>
          <TouchableOpacity 
            style={styles.logoutButton}
            onPress={() => {
              handleLogout();
            }}
          >
            <Text style={styles.logoutText}>התנתקות</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Button 
            title="נסה שוב" 
            onPress={() => window.location.reload()}
            style={styles.retryButton}
          />
        </View>
      </View>
    );
  }

  console.log('Rendering main content with user:', {
    userExists: !!user,
    userName: user?.name,
    userRole: user?.role,
    userProfileExists: !!userProfile,
    userProfileName: userProfile?.name
  });

  return (
    <View style={styles.container}>
      {/* Header with Dashboard Icon and Logout */}
      <HeaderBar
        title="ברוכים הבאים"
        showBack={false}
        backgroundColor={CASINO_COLORS.primary}
        textColor={CASINO_COLORS.gold}
        borderColor={CASINO_COLORS.gold}
        rightElement={
          canAccessDashboard() ? (
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={handleSettings}
              accessibilityLabel="לחץ כאן כדי לגשת ללוח הניהול">
              <Icon name="cog" size={24} color="#FFD700" />
            </TouchableOpacity>
          ) : null
        }
        leftElement={
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={handleLogout}
            accessibilityLabel="לחץ כאן כדי להתנתק">
            <Icon name="logout" size={24} color="#FFD700" />
          </TouchableOpacity>
        }
      />

      {/* Active Game Banner - shows when there's an active game */}
      <ActiveGameBanner />

      {/* Main Content Container - padding at bottom for footer */}
      <View style={styles.mainContentContainer}>
        <ScrollView 
          style={styles.scrollContainer}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 40, // פחות padding כי כבר אין footer
          }}
        >
          
          <View style={styles.logoContainer}>
            <Image 
              source={require('src/assets/images/poker-logo.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          
          {/* כפתור התחל משחק חדש - מתחת לתמונה */}
          <View style={styles.newGameButtonContainer}>
            {canStartNewGame() && (
              <Button
                title="התחל משחק חדש"
                variant="primary"
                icon="cards-playing-outline"
                iconColor="#FFD700"
                textStyle={{ color: "#FFD700", fontWeight: "bold" }}
                onPress={() => router.push('/gameFlow/NewGameSetup')}
              />
            )}
          </View>
        </ScrollView>
      </View>

      {/* Logout Confirmation Modal */}
      <ConfirmationModal
        visible={showLogoutConfirmation}
        title="אישור התנתקות"
        message="האם אתה בטוח שברצונך להתנתק?"
        confirmText="התנתק"
        cancelText="ביטול"
        onConfirm={performLogout}
        onCancel={() => setShowLogoutConfirmation(false)}
        confirmButtonColor="#ff4444"
        cancelButtonColor="#35654d"
      />
    </View>
  );
}

// Helper function to display role in Hebrew
function getRoleDisplay(role: string): string {
  switch (role) {
    case 'admin':
      return 'מנהל מערכת';
    case 'super':
      return 'משתמש מתקדם';
    case 'regular':
      return 'משתמש רגיל';
    default:
      return role;
  }
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0D1B1E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0D1B1E',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FFD700',
  },
  headerTitle: {
    color: '#FFD700',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 8,
  },
  greeting: {
    fontSize: 18,
    color: '#FFD700',
  },
  logoutButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#35654d',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  logoutText: {
    color: '#FFD700',
    fontSize: 14,
  },
  contentContainer: {
    flex: 1, 
    position: 'relative',
  },
  scrollContainer: {
    flex: 1,
    padding: 16,
  },
  welcomeText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  statsCard: {
    backgroundColor: CASINO_COLORS.surface,
    borderColor: CASINO_COLORS.gold,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statText: {
    color: '#FFD700',
    marginTop: 4,
    fontSize: 18,
  },
  groupCardHeader: {
    marginBottom: 8,
  },
  groupName: {
    color: '#FFD700',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  groupCardBody: {
    marginTop: 8,
  },
  groupDetail: {
    color: '#FFD700',
    fontSize: 16,
    textAlign: 'right',
    marginBottom: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#0D1B1E',
    borderTopWidth: 1,
    borderTopColor: '#FFD700',
    zIndex: 1, // Ensure footer appears above scroll content
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
    padding: 20,
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#35654d',
    borderColor: '#FFD700',
    borderWidth: 2,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#FFD700',
    textAlign: 'center',
  },
  mainContentContainer: {
    flex: 1,
  },
  sectionTitle: {
    color: CASINO_COLORS.gold,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    marginTop: 16,
    textAlign: 'right',
  },
  groupTitle: {
    color: CASINO_COLORS.gold,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  groupStatsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  groupStatCard: {
    width: '48%',
    marginBottom: 8,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 20,
    width: '100%',
  },
  logo: {
    width: '90%',
    height: 300,
  },
  newGameButtonContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 15,
    marginBottom: 30,
  },
});
