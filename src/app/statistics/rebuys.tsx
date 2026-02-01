// src/app/statistics/rebuys.tsx

import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Text } from '@/components/common/Text';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { Button } from '@/components/common/Button';
import { Dropdown } from '@/components/common/Dropdown';
import { getRebuyStatistics } from '@/services/statistics/rebuyStatistics';
import { RebuyStats, StatisticsFilter } from '@/models/Statistics';
import StatisticsChart from '@/components/statistics/StatisticsChart';
import StatCard from '@/components/statistics/StatCard';
import StatisticsList from '@/components/statistics/StatisticsList';
import { useGroups } from '@/hooks/useAppStore';
import TabBar from '@/components/common/TabBar';
import HeaderBar from '@/components/navigation/HeaderBar';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { clearStatsCache } from '@/services/statistics/statisticsService';
import { syncService } from '@/store/SyncService';

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

// קטגוריות הטאבים
const TABS = [
  { id: 'general', label: 'משחקים' },
  { id: 'groups', label: 'קבוצות' },
  { id: 'champions', label: 'שיאנים' }
];

export default function RebuyStatisticsScreen() {
 const router = useRouter();
 
 // הוקים לגישה לנתונים
 const { groups, loading: groupsLoading } = useGroups();
 
 // State variables
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [rebuyStats, setRebuyStats] = useState<RebuyStats | null>(null);
 const [filterGroup, setFilterGroup] = useState<string>('all');
 const [filterDate, setFilterDate] = useState('all');
 const [activeTab, setActiveTab] = useState(TABS[0].id);
 const [groupOptions, setGroupOptions] = useState<{label: string; value: string}[]>([]);
 
 // משתני מצב נוספים לכרטיס המאוחד
 const [selectedCategory, setSelectedCategory] = useState('rebuys'); // 'rebuys' או 'purchases'
 const [showMax, setShowMax] = useState(true); // true לגבוה/הרבה, false למעט/נמוך
 
 // אפשרויות סינון תאריך
 const dateFilterOptions = [
  { label: 'כל הזמנים', value: 'all' },
  { label: 'חודש אחרון', value: 'month' },
  { label: 'רבעון אחרון', value: 'quarter' },
  { label: 'שנה אחרונה', value: 'year' }
 ];
 
 // יצירת אפשרויות הקבוצה מהנתונים שהתקבלו מההוק
 useEffect(() => {
   console.log('RebuyScreen: useEffect - עדכון אפשרויות קבוצה. מספר קבוצות:', groups?.length);
   
   if (groups && groups.length > 0) {
     // סינון רק קבוצות פעילות
     const activeGroups = groups.filter(group => group.isActive);
     console.log('RebuyScreen: מספר קבוצות פעילות:', activeGroups.length);
     
     const options = [
       { label: 'כל הקבוצות', value: 'all' },
       ...activeGroups.map(group => ({
         label: group.name,
         value: group.id
       }))
     ];
     setGroupOptions(options);
     console.log('RebuyScreen: אפשרויות קבוצה עודכנו');
   } else {
     console.log('RebuyScreen: אין קבוצות זמינות או הן עדיין בטעינה');
   }
 }, [groups]);
 
 // טעינת הנתונים לפי סינון - גרסה משופרת עם דגל למניעת רענונים כפולים
 const isRefreshingRef = useRef(false);
 const lastRefreshTimeRef = useRef(0);

 const loadData = async (forceRefresh = false) => {
  // מונע טעינות כפולות
  if (isRefreshingRef.current) {
    console.log('RebuyScreen: דילוג על טעינה - כבר מתבצעת טעינה');
    return;
  }

  try {
    isRefreshingRef.current = true;
    setLoading(true);
    setError(null);

    // ניקוי המטמון תמיד לפני טעינה מחדש
    console.log('RebuyScreen: מנקה מטמון סטטיסטיקות');
    clearStatsCache();

    // רק אם נדרש רענון מאולץ
    if (forceRefresh) {
      console.log('RebuyScreen: מבצע רענון מאולץ של הנתונים');
      await syncService.forceRefresh();
    }

    const filter: StatisticsFilter = {
      timeFilter: filterDate as 'all' | 'month' | 'quarter' | 'year',
      groupId: filterGroup !== 'all' ? filterGroup : undefined,
      statuses: ['completed', 'final_results']
    };

    console.log('RebuyScreen: מבקש סטטיסטיקות עם פילטר:', JSON.stringify(filter));
    const stats = await getRebuyStatistics(filter);
    setRebuyStats(stats);
    console.log('RebuyScreen: הנתונים נטענו בהצלחה');

  } catch (error) {
    console.error('RebuyScreen: שגיאה בטעינת הנתונים:', error);
    setError('שגיאה בטעינת הנתונים');
  } finally {
    setLoading(false);
    isRefreshingRef.current = false;
  }
};
 
 // טעינת הנתונים כאשר משתנים הפילטרים או כשחוזרים למסך
 useEffect(() => {
   // אם הקבוצות עדיין נטענות, נחכה
   if (groupsLoading) {
     console.log('RebuyScreen: ממתין לטעינת הקבוצות');
     return;
   }

   // טוען נתונים בכל שינוי של הפילטרים
   console.log('RebuyScreen: טוען נתונים - הפילטרים השתנו');
   loadData(false);
 }, [groupsLoading, filterDate, filterGroup]);
 
 // פונקציית רענון
 const handleRefresh = () => {
   console.log('RebuyScreen: מבצע רענון ידני');
   // מאלץ רענון מלא כולל סנכרון מחדש
   loadData(true);
 };
 
 // מאזין לאירוע focus של המסך
 useFocusEffect(
   React.useCallback(() => {
     console.log('RebuyScreen: המסך קיבל פוקוס - מרענן נתונים');
     loadData(false);
   }, [])
 );
 
 // חזרה למסך הסטטיסטיקה הראשי
 const handleBack = () => {
   router.replace("../index");
 };
 
 // מעקב אחרי שינוי טאב
 useEffect(() => {
   console.log(`RebuyScreen: שינוי טאב - הטאב הפעיל כעת: ${activeTab}`);
   // כאשר נכנסים לטאב הקבוצות, מדפיסים את הנתונים הגולמיים לדיבוג
   if (activeTab === 'groups' && rebuyStats) {
     console.log('=== נתוני סה"כ קניות גולמיים ===');
     
     // מידע על סה"כ ריבאיים
     console.log(`סה"כ ריבאיים: ${rebuyStats.totalRebuys}`);
     
     // מציג את נתוני השחקן עם סה"כ הריבאיים הגבוה ביותר
     console.log(`שחקן עם מספר הריבאיים המצטבר הגבוה ביותר: ${rebuyStats.playerWithMostTotalRebuys?.playerName}, מזהה: ${rebuyStats.playerWithMostTotalRebuys?.playerId}`);
     console.log(`כמות ריבאיים: ${rebuyStats.playerWithMostTotalRebuys?.totalRebuyCount}`);
     
     // מציג את נתוני השחקן עם סה"כ הקניות הגבוה ביותר
     console.log(`שחקן עם סה"כ הקניות הגבוה ביותר: ${rebuyStats.playerWithHighestTotalPurchases?.playerName}, מזהה: ${rebuyStats.playerWithHighestTotalPurchases?.playerId}`);
     console.log(`סכום קניות: ${rebuyStats.playerWithHighestTotalPurchases?.totalPurchaseAmount} ש"ח`);
     
     // מציג את נתוני השחקן עם סה"כ הקניות הנמוך ביותר
     console.log(`שחקן עם סה"כ הקניות הנמוך ביותר: ${rebuyStats.playerWithLowestTotalPurchases?.playerName}, מזהה: ${rebuyStats.playerWithLowestTotalPurchases?.playerId}`);
     console.log(`סכום קניות: ${rebuyStats.playerWithLowestTotalPurchases?.totalPurchaseAmount} ש"ח`);
     
     // מציג את נתוני השחקן עם הקנייה הגבוהה ביותר במשחק בודד
     console.log(`שחקן עם סה"כ הקניות הגבוה ביותר במשחק בודד: ${rebuyStats.playerWithHighestSingleGamePurchase?.playerName}, מזהה: ${rebuyStats.playerWithHighestSingleGamePurchase?.playerId}`);
     console.log(`סכום קנייה: ${rebuyStats.playerWithHighestSingleGamePurchase?.purchaseAmount} ש"ח, במשחק: ${rebuyStats.playerWithHighestSingleGamePurchase?.gameId}`);
     
     // לוג נוסף של המשחק עם הכי הרבה ריבאיים
     if (rebuyStats.gameWithMostRebuys) {
       console.log(`המשחק עם הכי הרבה ריבאיים: מזהה משחק: ${rebuyStats.gameWithMostRebuys.gameId}, תאריך: ${rebuyStats.gameWithMostRebuys.date}`);
       console.log(`כמות ריבאיים: ${rebuyStats.gameWithMostRebuys.rebuyCount}, מספר שחקנים: ${rebuyStats.gameWithMostRebuys.playersCount}, קבוצה: ${rebuyStats.gameWithMostRebuys.groupName}`);
       
       if (rebuyStats.gameWithMostRebuys.topRebuyPlayers && rebuyStats.gameWithMostRebuys.topRebuyPlayers.length > 0) {
         console.log('שחקנים מובילים בריבאיים במשחק זה:');
         rebuyStats.gameWithMostRebuys.topRebuyPlayers.forEach((player, idx) => {
           console.log(`  ${idx + 1}. ${player.playerName}: ${player.rebuyCount} ריבאיים`);
         });
       }
     } else {
       console.log('המשחק עם הכי הרבה ריבאיים: אין נתונים');
     }
     
     // לוג של המשחק עם הכי פחות ריבאיים (אם הוא קיים במודל)
     // הערה: יש לעדכן את ה-API כדי לספק נתון זה
     if ((rebuyStats as any).gameWithLeastRebuys) {
       console.log(`המשחק עם הכי פחות ריבאיים: מזהה משחק: ${(rebuyStats as any).gameWithLeastRebuys.gameId}, תאריך: ${(rebuyStats as any).gameWithLeastRebuys.date}`);
       console.log(`כמות ריבאיים: ${(rebuyStats as any).gameWithLeastRebuys.rebuyCount}, מספר שחקנים: ${(rebuyStats as any).gameWithLeastRebuys.playersCount}, קבוצה: ${(rebuyStats as any).gameWithLeastRebuys.groupName}`);
     } else {
       console.log('המשחק עם הכי פחות ריבאיים: אין נתונים');
     }
     
     console.log('==============================');
   }
 }, [activeTab, rebuyStats]);
 
 // פונקציה לחישוב סה"כ קניות בכסף מעודכנת
 const calculateTotalPurchases = () => {
   if (!rebuyStats) return 0;
   
   console.log('חישוב סה"כ קניות בכסף מנתונים אמיתיים...');
   
   // אם סיננו לפי קבוצה מסוימת
   if (filterGroup !== 'all' && rebuyStats.groupsRebuyStats) {
     const groupStats = rebuyStats.groupsRebuyStats.find(g => g.groupId === filterGroup);
     if (groupStats) {
       console.log(`מחשב את סה"כ הקניות עבור קבוצה ספציפית: ${groupStats.groupName}`);
       return groupStats.totalPurchases;
     }
     return 0;
   }
   
   // אם בחרנו "כל הקבוצות"
   return rebuyStats.totalPurchases || 0;
 };
 
 // פונקציה לחישוב מספר המשחקים
 const calculateGamesCount = () => {
   if (!rebuyStats) return 0;
   
   // אם סיננו לפי קבוצה מסוימת
   if (filterGroup !== 'all' && rebuyStats.groupsRebuyStats) {
     const groupStats = rebuyStats.groupsRebuyStats.find(g => g.groupId === filterGroup);
     if (groupStats) {
       return groupStats.gamesCount || 1;
     }
   }
   
   // אם בחרנו "כל הקבוצות" או לא מצאנו את הקבוצה הספציפית
   return rebuyStats.gamesCount || 1;
 };
 
 // פונקציה לחישוב ממוצע למשחק (ריבאיים או קניות)
 const calculateAveragePerGame = (total: number, type = 'rebuys') => {
   if (!rebuyStats) return 0;
   
   // אם סיננו לפי קבוצה מסוימת
   if (filterGroup !== 'all' && rebuyStats.groupsRebuyStats) {
     const groupStats = rebuyStats.groupsRebuyStats.find(g => g.groupId === filterGroup);
     if (groupStats) {
       const gamesCount = groupStats.gamesCount || 1;
       const value = type === 'rebuys' ? groupStats.totalRebuys : groupStats.totalPurchases;
       return type === 'rebuys' ? +(value / gamesCount).toFixed(1) : +(value / gamesCount).toFixed(0);
     }
   }
   
   // אם לא סיננו או אם לא מצאנו את הקבוצה, מחשבים לפי כל המשחקים
   const gamesCount = rebuyStats.gamesCount || 1;
   console.log(`חישוב ממוצע ${type} עבור כל הקבוצות: ${total} / ${gamesCount} = ${total/gamesCount}`);
   return type === 'rebuys' ? +(total / gamesCount).toFixed(1) : +(total / gamesCount).toFixed(0);
 };
 
 // מחזיר את המשחק עם הכי הרבה ריבאיים, לפי קבוצה אם צוין
 const getGameWithMostRebuysByGroup = () => {
   if (!rebuyStats || !rebuyStats.gameWithMostRebuys) return null;
   
   // בדיקה אם יש נתונים ספציפיים לקבוצה מסוימת
   if (filterGroup) {
     // בעתיד, כאשר ה-API יתמוך בכך, נוכל לחפש את המשחק עם הכי הרבה ריבאיים בקבוצה ספציפית
     console.log(`getGameWithMostRebuysByGroup: מסנן לפי קבוצה ${filterGroup}`);
   }
   
   // כרגע תמיד מחזיר את המשחק הכללי עם הכי הרבה ריבאיים
   return rebuyStats.gameWithMostRebuys;
 };
  
  // מחזיר את המשחק עם הכי מעט ריבאיים, לפי קבוצה אם צוין
  const getGameWithLeastRebuysByGroup = () => {
    if (!rebuyStats || !rebuyStats.gameWithLeastRebuys) return null;
    
    // בדיקה אם יש נתונים ספציפיים לקבוצה מסוימת
    if (filterGroup) {
      console.log(`getGameWithLeastRebuysByGroup: מסנן לפי קבוצה ${filterGroup}`);
      // בעתיד, כאשר ה-API יתמוך בכך, נוכל לחפש את המשחק עם הכי פחות ריבאיים בקבוצה ספציפית
    }
    
    // כרגע תמיד מחזיר את המשחק הכללי עם הכי פחות ריבאיים
    return rebuyStats.gameWithLeastRebuys;
  };
 
 // פונקציה לקבלת המשחק עם הכי הרבה ריבאיים לפי הקבוצה הנבחרת
 const getGameWithMostRebuys = () => {
   if (!rebuyStats || !rebuyStats.gameWithMostRebuys) return null;
   
   // בדיקה אם יש נתונים ספציפיים לקבוצה מסוימת
   if (filterGroup !== 'all') {
     // בעתיד, כאשר ה-API יתמוך בכך, נוכל לחפש את המשחק עם הכי הרבה ריבאיים בקבוצה ספציפית
     // ע"י הוספת gameWithMostRebuys לכל קבוצה בממשק groupsRebuyStats
   }
   
   // בשלב זה, נחזיר תמיד את המשחק הכללי עם הכי הרבה ריבאיים
   return rebuyStats.gameWithMostRebuys;
 }

 // פונקציה לקבלת המשחק עם הכי פחות ריבאיים לפי הקבוצה הנבחרת
 const getGameWithLeastRebuys = () => {
  console.log('getGameWithLeastRebuys: מחפש את המשחק עם הכי פחות ריבאיים');
  
  // בדיקה אם יש נתונים זמינים
  if (!rebuyStats) {
    return null;
  }

  // בדיקה אם כבר קיים מאפיין מוכן עם המשחק עם הכי פחות ריבאיים
  if (rebuyStats.gameWithLeastRebuys) {
    console.log('getGameWithLeastRebuys: נמצא מאפיין מוכן gameWithLeastRebuys');
    return rebuyStats.gameWithLeastRebuys;
  }

  try {
    // אם אין נתונים מוכנים, נחזיר null
    console.log('getGameWithLeastRebuys: אין נתונים מוכנים, נחזיר null');
    return null;
  } catch (err) {
    console.error('שגיאה בחיפוש המשחק עם הכי פחות ריבאיים:', err);
    return null;
  }
}
 
 // פונקציה להצגת פירוט נוסף על הקניות לפי שחקן - מעודכנת
 const showPurchasesDetails = () => {
   console.log('\n==== פירוט קניות לפי שחקן ====');
   if (rebuyStats) {
     // חישוב סה"כ הקניות המוערך
     const estimatedTotal = calculateTotalPurchases();
     
     console.log(`סה"כ קניות מוערך: ${estimatedTotal} ש"ח`);
     console.log(`השחקן עם הקניות הגבוהות ביותר: ${rebuyStats.playerWithHighestTotalPurchases?.playerName}`);
     console.log(`סכום קניות: ${rebuyStats.playerWithHighestTotalPurchases?.totalPurchaseAmount} ש"ח`);
     console.log(`השחקן עם הקניות הנמוכות ביותר: ${rebuyStats.playerWithLowestTotalPurchases?.playerName}`);
     console.log(`סכום קניות: ${rebuyStats.playerWithLowestTotalPurchases?.totalPurchaseAmount} ש"ח`);
     console.log(`השחקן עם הקנייה הגבוהה ביותר במשחק בודד: ${rebuyStats.playerWithHighestSingleGamePurchase?.playerName}, מזהה: ${rebuyStats.playerWithHighestSingleGamePurchase?.playerId}`);
     console.log(`סכום קנייה: ${rebuyStats.playerWithHighestSingleGamePurchase?.purchaseAmount} ש"ח, במשחק: ${rebuyStats.playerWithHighestSingleGamePurchase?.gameId}`);
     console.log('==========================');
   }
 };
 
 // פונקציה שמציגה את תוכן הכרטיס לפי הקטגוריה והמצב הנבחרים
 const renderCardContent = () => {
    // הצגת סטטיסטיקת ריבאיים (הרבה או מעט)
    if (selectedCategory === 'rebuys') {
      if (showMax) {
        // הצגת המשחק עם הכי הרבה ריבאיים
        const gameWithMostRebuys = getGameWithMostRebuysByGroup();
        if (!gameWithMostRebuys) {
          return <Text style={styles.noDataText}>אין נתונים זמינים</Text>;
        }
        
        return (
          <View style={styles.gameDetailContainer}>
            <View style={{
              backgroundColor: "#0D1B1E",
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "#FFD700",
              padding: 12,
              marginBottom: 16
            }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 8
              }}>
                <Icon name="calendar" size="medium" color="#FFFFFF" />
                <Text style={{
                  fontSize: 14,
                  color: "#FFFFFF",
                  marginEnd: 8,
                  fontWeight: '500'
                }}>
                  בתאריך {rebuyStats?.gameWithMostRebuys.date || 'לא ידוע'}
                </Text>
              </View>
              <Text style={{
                fontSize: 20,
                fontWeight: 'bold',
                color: "#FFD700",
                textAlign: 'right'
              }}>
                סה"כ {rebuyStats?.gameWithMostRebuys.rebuyCount || 0} ריבאיים
              </Text>
            </View>
            
            <View style={styles.gameStatsRow}>
              <View style={{...styles.gameStatItem, flex: 1}}>
                <Text style={styles.gameStatLabel}>קבוצה:</Text>
                <Text style={[styles.gameStatValue, styles.highlightedValue]}>
                  {rebuyStats?.gameWithMostRebuys.groupName || 'לא ידוע'}
                </Text>
              </View>
            </View>
            
            <View style={styles.gameStatsRow}>
              <View style={{...styles.gameStatItem, flex: 1}}>
                <Text style={styles.gameStatLabel}>שחקנים:</Text>
                <Text style={[styles.gameStatValue, styles.highlightedValue]}>{rebuyStats?.gameWithMostRebuys.playersCount || 0}</Text>
              </View>
            </View>
            
            {rebuyStats?.gameWithMostRebuys.topRebuyPlayers && rebuyStats.gameWithMostRebuys.topRebuyPlayers.length > 0 ? (
              <View style={[styles.topPlayersContainer, {padding: 0}]}>
                <Text style={[styles.topPlayersTitle, {paddingEnd: 0}]}>שחקנים מובילים בריבאיים:</Text>
                {rebuyStats.gameWithMostRebuys.topRebuyPlayers.map((player, index) => (
                  <View key={index} style={[styles.topPlayerRow, {paddingHorizontal: 0, marginHorizontal: 0}]}>
                    <Text style={styles.topPlayerIndex}>.{index + 1}</Text>
                    <Text style={[styles.topPlayerName, styles.highlightedValue, {paddingEnd: 0, marginEnd: 0}]}>{player.playerName || 'שחקן לא ידוע'}</Text>
                    <Text style={[styles.topPlayerRebuys, styles.boldValue]}>{player.rebuyCount || 0} ריבאיים</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={[styles.topPlayersContainer, {padding: 0}]}>
                <Text style={[styles.topPlayersTitle, {paddingEnd: 0}]}>שחקנים מובילים בריבאיים:</Text>
                <Text style={styles.noDataText}>אין נתונים על שחקנים מובילים</Text>
              </View>
            )}
            
            <TouchableOpacity 
              style={styles.viewGameButton}
              onPress={() => router.push(`/history/${rebuyStats?.gameWithMostRebuys.gameId}`)}
            >
              <Text style={styles.viewGameText}>צפה במשחק</Text>
            </TouchableOpacity>
          </View>
        );
      } else {
        // הצגת המשחק עם הכי מעט ריבאיים
        const gameWithLeastRebuys = getGameWithLeastRebuysByGroup();
        if (!gameWithLeastRebuys) {
          return (
            <View style={styles.noDataWithNotice}>
              <Text style={styles.noDataText}>אין נתונים זמינים על המשחק עם הכי פחות ריבאיים</Text>
              <Text style={styles.noticeText}>יש לעדכן את ה-API כדי לקבל נתונים אמיתיים</Text>
            </View>
          );
        }
        
        return (
          <View style={styles.gameDetailContainer}>
            <View style={{
              backgroundColor: "#0D1B1E",
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "#FFD700",
              padding: 12,
              marginBottom: 16
            }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 8
              }}>
                <Icon name="calendar" size="medium" color="#FFFFFF" />
                <Text style={{
                  fontSize: 14,
                  color: "#FFFFFF",
                  marginEnd: 8,
                  fontWeight: '500'
                }}>
                  בתאריך {gameWithLeastRebuys.date || 'לא ידוע'}
                </Text>
              </View>
              <Text style={{
                fontSize: 20,
                fontWeight: 'bold',
                color: "#FFD700",
                textAlign: 'right'
              }}>
                סה"כ {gameWithLeastRebuys.rebuyCount || 0} ריבאיים
              </Text>
            </View>
            
            <View style={styles.gameStatsRow}>
              <View style={{...styles.gameStatItem, flex: 1}}>
                <Text style={styles.gameStatLabel}>קבוצה:</Text>
                <Text style={[styles.gameStatValue, styles.highlightedValue]}>
                  {gameWithLeastRebuys.groupName || 'לא ידוע'}
                </Text>
              </View>
            </View>
            
            <View style={styles.gameStatsRow}>
              <View style={{...styles.gameStatItem, flex: 1}}>
                <Text style={styles.gameStatLabel}>שחקנים:</Text>
                <Text style={[styles.gameStatValue, styles.highlightedValue]}>{gameWithLeastRebuys.playersCount || 0}</Text>
              </View>
            </View>
            
            {gameWithLeastRebuys.topRebuyPlayers && gameWithLeastRebuys.topRebuyPlayers.length > 0 ? (
              <View style={[styles.topPlayersContainer, {padding: 0}]}>
                <Text style={[styles.topPlayersTitle, {paddingEnd: 0}]}>שחקנים מובילים בריבאיים:</Text>
                {gameWithLeastRebuys.topRebuyPlayers.map((player: any, index: number) => (
                  <View key={index} style={[styles.topPlayerRow, {paddingHorizontal: 0, marginHorizontal: 0}]}>
                    <Text style={styles.topPlayerIndex}>.{index + 1}</Text>
                    <Text style={[styles.topPlayerName, styles.highlightedValue, {paddingEnd: 0, marginEnd: 0}]}>{player.playerName || 'שחקן לא ידוע'}</Text>
                    <Text style={[styles.topPlayerRebuys, styles.boldValue]}>{player.rebuyCount || 0} ריבאיים</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={[styles.topPlayersContainer, {padding: 0}]}>
                <Text style={[styles.topPlayersTitle, {paddingEnd: 0}]}>שחקנים מובילים בריבאיים:</Text>
                <Text style={styles.noDataText}>אין שחקנים שביצעו ריבאיים במשחק זה</Text>
              </View>
            )}
            
            <TouchableOpacity 
              style={styles.viewGameButton}
              onPress={() => router.push(`/history/${gameWithLeastRebuys.gameId}`)}
            >
              <Text style={styles.viewGameText}>צפה במשחק</Text>
            </TouchableOpacity>
          </View>
        );
      }
    } 
    // הצגת סטטיסטיקת קניות (גבוה או נמוך)
    else {
      if (showMax) {
        // הצגת המשחק עם סה"כ הקניות הגבוה ביותר
        if (!rebuyStats?.gameWithMostPurchases?.gameId) {
          return <Text style={styles.noDataText}>אין נתונים זמינים</Text>;
        }
        
        return (
          <View style={styles.gameDetailContainer}>
            <View style={{
              backgroundColor: "#0D1B1E",
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "#FFD700",
              padding: 12,
              marginBottom: 16
            }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 8
              }}>
                <Icon name="calendar" size="medium" color="#FFFFFF" />
                <Text style={{
                  fontSize: 14,
                  color: "#FFFFFF",
                  marginEnd: 8,
                  fontWeight: '500'
                }}>
                  בתאריך {rebuyStats.gameWithMostPurchases.date || 'לא ידוע'}
                </Text>
              </View>
              <Text style={{
                fontSize: 20,
                fontWeight: 'bold',
                color: "#FFD700",
                textAlign: 'right'
              }}>
                סה"כ {rebuyStats.gameWithMostPurchases.purchaseAmount?.toLocaleString() || 0} ש"ח
              </Text>
            </View>
            
            <View style={styles.gameStatsRow}>
              <View style={{...styles.gameStatItem, flex: 1}}>
                <Text style={styles.gameStatLabel}>קבוצה:</Text>
                <Text style={[styles.gameStatValue, styles.highlightedValue]}>
                  {rebuyStats.gameWithMostPurchases.groupName || 'לא ידוע'}
                </Text>
              </View>
            </View>
            
            <View style={styles.gameStatsRow}>
              <View style={{...styles.gameStatItem, flex: 1}}>
                <Text style={styles.gameStatLabel}>שחקנים:</Text>
                <Text style={[styles.gameStatValue, styles.highlightedValue]}>{rebuyStats.gameWithMostPurchases.playersCount || 0}</Text>
              </View>
            </View>
            
            {rebuyStats.gameWithMostPurchases.topPurchasePlayers && rebuyStats.gameWithMostPurchases.topPurchasePlayers.length > 0 ? (
              <View style={[styles.topPlayersContainer, {padding: 0}]}>
                <Text style={[styles.topPlayersTitle, {paddingEnd: 0}]}>שחקנים מובילים בקניות:</Text>
                {rebuyStats.gameWithMostPurchases.topPurchasePlayers.map((player, index) => (
                  <View key={index} style={[styles.topPlayerRow, {paddingHorizontal: 0, marginHorizontal: 0}]}>
                    <Text style={styles.topPlayerIndex}>.{index + 1}</Text>
                    <Text style={[styles.topPlayerName, styles.highlightedValue, {paddingEnd: 0, marginEnd: 0}]}>{player.playerName || 'שחקן לא ידוע'}</Text>
                    <Text style={[styles.topPlayerRebuys, styles.boldValue]}>{player.purchaseAmount?.toLocaleString() || 0} ש"ח</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={[styles.topPlayersContainer, {padding: 0}]}>
                <Text style={[styles.topPlayersTitle, {paddingEnd: 0}]}>שחקנים מובילים בקניות:</Text>
                <Text style={styles.noDataText}>אין נתונים על שחקנים מובילים</Text>
              </View>
            )}
            
            <TouchableOpacity 
              style={styles.viewGameButton}
              onPress={() => router.push(`/history/${rebuyStats?.gameWithMostPurchases.gameId}`)}
            >
              <Text style={styles.viewGameText}>צפה במשחק</Text>
            </TouchableOpacity>
          </View>
        );
      } else {
        // הצגת המשחק עם סה"כ הקניות הנמוך ביותר
        if (!rebuyStats?.gameWithLeastPurchases?.gameId) {
          return <Text style={styles.noDataText}>אין נתונים זמינים</Text>;
        }
        
        return (
          <View style={styles.gameDetailContainer}>
            <View style={{
              backgroundColor: "#0D1B1E",
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "#FFD700",
              padding: 12,
              marginBottom: 16
            }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 8
              }}>
                <Icon name="calendar" size="medium" color="#FFFFFF" />
                <Text style={{
                  fontSize: 14,
                  color: "#FFFFFF",
                  marginEnd: 8,
                  fontWeight: '500'
                }}>
                  בתאריך {rebuyStats.gameWithLeastPurchases.date || 'לא ידוע'}
                </Text>
              </View>
              <Text style={{
                fontSize: 20,
                fontWeight: 'bold',
                color: "#FFD700",
                textAlign: 'right'
              }}>
                סה"כ {rebuyStats.gameWithLeastPurchases.purchaseAmount?.toLocaleString() || 0} ש"ח
              </Text>
            </View>
            
            <View style={styles.gameStatsRow}>
              <View style={{...styles.gameStatItem, flex: 1}}>
                <Text style={styles.gameStatLabel}>קבוצה:</Text>
                <Text style={[styles.gameStatValue, styles.highlightedValue]}>
                  {rebuyStats.gameWithLeastPurchases.groupName || 'לא ידוע'}
                </Text>
              </View>
            </View>
            
            <View style={styles.gameStatsRow}>
              <View style={{...styles.gameStatItem, flex: 1}}>
                <Text style={styles.gameStatLabel}>שחקנים:</Text>
                <Text style={[styles.gameStatValue, styles.highlightedValue]}>{rebuyStats.gameWithLeastPurchases.playersCount || 0}</Text>
              </View>
            </View>
            
            {rebuyStats.gameWithLeastPurchases.topPurchasePlayers && rebuyStats.gameWithLeastPurchases.topPurchasePlayers.length > 0 ? (
              <View style={[styles.topPlayersContainer, {padding: 0}]}>
                <Text style={[styles.topPlayersTitle, {paddingEnd: 0}]}>שחקנים מובילים בקניות:</Text>
                {rebuyStats.gameWithLeastPurchases.topPurchasePlayers.map((player, index) => (
                  <View key={index} style={[styles.topPlayerRow, {paddingHorizontal: 0, marginHorizontal: 0}]}>
                    <Text style={styles.topPlayerIndex}>.{index + 1}</Text>
                    <Text style={[styles.topPlayerName, styles.highlightedValue, {paddingEnd: 0, marginEnd: 0}]}>{player.playerName || 'שחקן לא ידוע'}</Text>
                    <Text style={[styles.topPlayerRebuys, styles.boldValue]}>{player.purchaseAmount?.toLocaleString() || 0} ש"ח</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={[styles.topPlayersContainer, {padding: 0}]}>
                <Text style={[styles.topPlayersTitle, {paddingEnd: 0}]}>שחקנים מובילים בקניות:</Text>
                <Text style={styles.noDataText}>אין נתונים על שחקנים מובילים</Text>
              </View>
            )}
            
            <TouchableOpacity 
              style={styles.viewGameButton}
              onPress={() => router.push(`/history/${rebuyStats.gameWithLeastPurchases.gameId}`)}
            >
              <Text style={styles.viewGameText}>צפה במשחק</Text>
            </TouchableOpacity>
          </View>
        );
      }
    }
 };
 
 // יצירת אלמנט כפתור רענון לכותרת
 const refreshButtonElement = (
   <TouchableOpacity 
     onPress={handleRefresh}
     style={styles.headerButton}
     activeOpacity={0.6}
   >
     <Icon name="refresh" size={28} color={CASINO_COLORS.gold} />
   </TouchableOpacity>
 );

 // פונקציה לחישוב סה"כ ריבאיים מעודכנת
 const calculateTotalRebuys = () => {
   if (!rebuyStats) return 0;
   
   console.log('חישוב סה"כ ריבאיים מנתונים אמיתיים...');
   
   // אם סיננו לפי קבוצה מסוימת
   if (filterGroup !== 'all' && rebuyStats.groupsRebuyStats) {
     const groupStats = rebuyStats.groupsRebuyStats.find(g => g.groupId === filterGroup);
     if (groupStats) {
       console.log(`מחשב את סה"כ הריבאיים עבור קבוצה ספציפית: ${groupStats.groupName}`);
       return groupStats.totalRebuys;
     }
     return 0;
   }
   
   // אם בחרנו "כל הקבוצות"
   return rebuyStats.totalRebuys || 0;
 };

 return (
   <View style={styles.container}>
     {/* Header */}
     <HeaderBar
       title="סטטיסטיקת ריבאיים"
       showBack={true}
       backgroundColor={CASINO_COLORS.primary}
       onBackPress={handleBack}
       textColor={CASINO_COLORS.gold}
       borderColor={CASINO_COLORS.gold}
       leftElement={refreshButtonElement}
     />

     {/* טאבים */}
     <TabBar
       tabs={TABS.map(tab => ({
         label: tab.label,
         isActive: activeTab === tab.id,
         onPress: () => setActiveTab(tab.id)
       }))}
     />
     
     {/* Filters */}
     {activeTab !== 'general' && (
       <View style={styles.filtersContainer}>
         <View style={styles.filterRow}>
           <Text style={styles.filterLabel}>קבוצה:</Text>
           <View style={styles.filterControl}>
             <Dropdown
               value={filterGroup}
               onSelect={(groupId) => {
                 setFilterGroup(groupId);
               }}
               items={groupOptions}
             />
           </View>
         </View>
         
         <View style={styles.filterRow}>
           <Text style={styles.filterLabel}>תקופה:</Text>
           <View style={styles.filterControl}>
             <Dropdown
               value={filterDate}
               onSelect={setFilterDate}
               items={dateFilterOptions}
             />
           </View>
         </View>
       </View>
     )}
     
     {loading ? (
       <View style={styles.loadingContainer}>
         <ActivityIndicator size="large" color={CASINO_COLORS.gold} />
         <Text style={styles.loadingText}>טוען סטטיסטות...</Text>
       </View>
     ) : error ? (
       <View style={styles.errorContainer}>
         <Icon name="alert-circle" size="large" color={CASINO_COLORS.error} />
         <Text style={styles.errorText}>{error}</Text>
       </View>
     ) : (
       <ScrollView 
         style={styles.scrollView}
         contentContainerStyle={styles.scrollViewContent}
       >
         {/* תוכן לפי הטאב הנבחר */}
         {activeTab === 'general' && (
           <>
             {/* כפתורי קטגוריה לבחירה */}
             <View style={styles.categoryButtonsContainer}>
               <TouchableOpacity 
                 style={[styles.categoryButton, selectedCategory === 'rebuys' && styles.selectedCategoryButton]}
                 onPress={() => setSelectedCategory('rebuys')}
               >
                 <Text style={[styles.categoryButtonText, selectedCategory === 'rebuys' && styles.selectedCategoryButtonText]}>ריבאיים</Text>
               </TouchableOpacity>
               <TouchableOpacity 
                 style={[styles.categoryButton, selectedCategory === 'purchases' && styles.selectedCategoryButton]}
                 onPress={() => setSelectedCategory('purchases')}
               >
                 <Text style={[styles.categoryButtonText, selectedCategory === 'purchases' && styles.selectedCategoryButtonText]}>סה"כ קניות</Text>
               </TouchableOpacity>
             </View>
             
             {/* כרטיס מאוחד עם תצוגה דינמית */}
             <Card style={styles.card}>
               <View style={[styles.cardTitleContainer, {justifyContent: 'flex-end'}]}>
                 {selectedCategory === 'rebuys' ? (
                   // כותרת לסטטיסטת ריבאיים
                   <Text style={styles.cardTitle}>
                     <View style={styles.titleTextContainer}>
                       <Text style={styles.titleText}>משחק עם הכי</Text>
                       <TouchableOpacity 
                         style={styles.toggleButton}
                         onPress={() => setShowMax(!showMax)}
                       >
                         <Text style={styles.toggleButtonText}>{showMax ? 'הרבה' : 'מעט'}</Text>
                       </TouchableOpacity>
                       <Text style={styles.titleText}>ריבאיים</Text>
                     </View>
                   </Text>
                 ) : (
                   // כותרת לסטטיסטיקת קניות
                   <Text style={styles.cardTitle}>
                     <View style={styles.titleTextContainer}>
                       <Text style={styles.titleText}>משחק עם סה"כ הקניות ה</Text>
                       <TouchableOpacity 
                         style={styles.toggleButton}
                         onPress={() => setShowMax(!showMax)}
                       >
                         <Text style={styles.toggleButtonText}>{showMax ? 'גבוה' : 'נמוך'}</Text>
                       </TouchableOpacity>
                       <Text style={styles.titleText}>ביותר</Text>
                     </View>
                   </Text>
                 )}
                 <View />
               </View>
               
               {/* תוכן דינמי של הכרטיס על פי הבחירה */}
               {renderCardContent()}
             </Card>
           </>
         )}

         {activeTab === 'groups' && (
           <>
             {groups.length === 0 ? (
               <Text style={styles.noDataText}>אין קבוצות להצגה</Text>
             ) : (
               <>
                 {/* כרטיסים של סטטיסטיקת קבוצות זה לצד זה */}
                 <View style={styles.rowCardsContainer}>
                   {/* כרטיס 1: סה״כ ריבאיים */}
                   <View style={[styles.simpleStatCard, styles.halfWidthCard]}>
                     <View style={styles.headerRow}>
                       <Text style={styles.simpleStatTitle}>סה״כ ריבאיים</Text>
                     </View>
                     <Text style={styles.simpleStatValue}>
                       {filterGroup === 'all'
                         ? (calculateTotalRebuys() || 0).toLocaleString()
                         : (rebuyStats?.groupsRebuyStats?.find(g => g.groupId === filterGroup)?.totalRebuys || 0).toLocaleString()}
                     </Text>
                   </View>
                   
                   {/* כרטיס 2: סה״כ קניות */}
                   <View style={[styles.simpleStatCard, styles.halfWidthCard]}>
                     <View style={styles.headerRow}>
                       <Text style={styles.simpleStatTitle}>סה״כ קניות</Text>
                     </View>
                     <Text style={styles.simpleStatValue}>
                       {(filterGroup === 'all'
                         ? calculateTotalPurchases()
                         : (rebuyStats?.groupsRebuyStats?.find(g => g.groupId === filterGroup)?.totalPurchases || 0)).toLocaleString()} ש״ח
                     </Text>
                   </View>
                 </View>
                 
                 {/* כרטיסי ממוצעים לשחקן */}
                 <View style={styles.rowCardsContainer}>
                   {/* כרטיס 3: ממוצע ריבאיים לשחקן */}
                   <View style={[styles.simpleStatCard, styles.halfWidthCard]}>
                     <View style={styles.headerRow}>
                       <Text style={styles.simpleStatTitle}>ממוצע ריבאיים לשחקן</Text>
                     </View>
                     <Text style={styles.simpleStatValue}>
                       {rebuyStats?.averageRebuysPerPlayer ? Math.floor(rebuyStats.averageRebuysPerPlayer) : 0}
                     </Text>
                   </View>
                   
                   {/* כרטיס 4: ממוצע קניות לשחקן */}
                   <View style={[styles.simpleStatCard, styles.halfWidthCard]}>
                     <View style={styles.headerRow}>
                       <Text style={styles.simpleStatTitle}>ממוצע קניות לשחקן</Text>
                     </View>
                     <Text style={styles.simpleStatValue}>
                       {rebuyStats?.totalPurchases && rebuyStats?.totalRebuys && rebuyStats?.averageRebuysPerPlayer ? 
                         Math.round((rebuyStats.totalPurchases / rebuyStats.totalRebuys) * rebuyStats.averageRebuysPerPlayer).toLocaleString()
                         : 0} ש״ח
                     </Text>
                   </View>
                 </View>

                 {/* כרטיסי ממוצעים למשחק */}
                 <View style={styles.rowCardsContainer}>
                   {/* כרטיס 5: ממוצע ריבאיים למשחק */}
                   <View style={[styles.simpleStatCard, styles.halfWidthCard]}>
                     <View style={styles.headerRow}>
                       <Text style={styles.simpleStatTitle}>ממוצע ריבאיים למשחק</Text>
                     </View>
                     <Text style={styles.simpleStatValue}>
                       {rebuyStats?.totalRebuys ? calculateAveragePerGame(rebuyStats.totalRebuys, 'rebuys') : 0}
                     </Text>
                   </View>
                   
                   {/* כרטיס 6: ממוצע קניות למשחק */}
                   <View style={[styles.simpleStatCard, styles.halfWidthCard]}>
                     <View style={styles.headerRow}>
                       <Text style={styles.simpleStatTitle}>ממוצע קניות למשחק</Text>
                     </View>
                     <Text style={styles.simpleStatValue}>
                       {rebuyStats?.totalPurchases ? calculateAveragePerGame(rebuyStats.totalPurchases, 'purchases') : 0} ש״ח
                     </Text>
                   </View>
                 </View>
               </>
             )}
           </>
         )}

         {activeTab === 'champions' && (
           <>
             {/* Player with Most Rebuys */}
             <Card style={styles.card}>
               <Text style={styles.cardTitle}>מקסימום ריבאיים במשחק בודד</Text>
               
               {rebuyStats?.playerWithMostRebuys.playerName ? (
                 <View style={styles.customPlayerCardContainer}>
                   <View style={styles.customPlayerDataRow}>
                     <Text style={styles.playerNameText}>
                       {rebuyStats.playerWithMostRebuys.playerName}
                     </Text>
                     <Text style={styles.rebuyCountText}>
                       {rebuyStats.playerWithMostRebuys.rebuyCount} ריבאיים
                     </Text>
                   </View>
                 </View>
               ) : (
                 <Text style={styles.noDataText}>אין נתונים זמינים</Text>
               )}
             </Card>
             
             {/* Player with Most Total Rebuys */}
             <Card style={styles.card}>
               <Text style={styles.cardTitle}>מקסימום ריבאיים במצטבר</Text>
               
               {rebuyStats?.playerWithMostTotalRebuys.playerName ? (
                 <View style={styles.customPlayerCardContainer}>
                   <View style={styles.customPlayerDataRow}>
                     <Text style={styles.playerNameText}>
                       {rebuyStats.playerWithMostTotalRebuys.playerName}
                     </Text>
                     <Text style={styles.rebuyCountText}>
                       {rebuyStats.playerWithMostTotalRebuys.totalRebuyCount} ריבאיים סה״כ
                     </Text>
                   </View>
                 </View>
               ) : (
                 <Text style={styles.noDataText}>אין נתונים זמינים</Text>
               )}
             </Card>
             
             {/* Player with Least Total Rebuys */}
             <Card style={styles.card}>
               <Text style={styles.cardTitle}>מינימום ריבאיים במצטבר</Text>
               
               {rebuyStats?.playerWithLeastTotalRebuys.playerName ? (
                 <View style={styles.customPlayerCardContainer}>
                   <View style={styles.customPlayerDataRow}>
                     <Text style={styles.playerNameText}>
                       {rebuyStats.playerWithLeastTotalRebuys.playerName}
                     </Text>
                     <Text style={styles.rebuyCountText}>
                       {rebuyStats.playerWithLeastTotalRebuys.totalRebuyCount} ריבאיים סה״כ
                     </Text>
                   </View>
                   
                   <View style={styles.gamesCountRow}>
                     <Text style={styles.gamesCountText}>
                       במהלך {rebuyStats.playerWithLeastTotalRebuys.gamesCount} משחקים
                     </Text>
                   </View>
                 </View>
               ) : (
                 <Text style={styles.noDataText}>אין נתונים זמינים</Text>
               )}
             </Card>
             
             {/* Player with Lowest Rebuy Average */}
             <Card style={styles.card}>
               <Text style={styles.cardTitle}>ממוצע הריבאיים הנמוך ביותר</Text>
               
               {rebuyStats?.playerWithLowestRebuyAverage.playerName ? (
                 <View style={styles.customPlayerCardContainer}>
                   <View style={styles.customPlayerDataRow}>
                     <Text style={styles.playerNameText}>
                       {rebuyStats.playerWithLowestRebuyAverage.playerName}
                     </Text>
                     <Text style={styles.rebuyCountText}>
                       {rebuyStats.playerWithLowestRebuyAverage.rebuyAverage.toFixed(2)} ריבאיים למשחק
                     </Text>
                   </View>
                   
                   <View style={styles.gamesCountRow}>
                     <Text style={styles.gamesCountText}>
                       סה"כ {rebuyStats.playerWithLowestRebuyAverage.totalRebuyCount} ריבאיים ב-{rebuyStats.playerWithLowestRebuyAverage.gamesCount} משחקים
                     </Text>
                   </View>
                   
                   <View style={styles.infoRow}>
                     <Text style={styles.infoText}>
                       *נמדד רק עבור שחקנים עם משחק אחד לפחות
                     </Text>
                   </View>
                 </View>
               ) : (
                 <Text style={styles.noDataText}>אין נתונים זמינים</Text>
               )}
             </Card>
             
             {/* Player with Largest Difference Between Purchases and Result */}
             <Card style={styles.card}>
               <Text style={styles.cardTitle}>ההתאוששות הכי בולטת</Text>
               
               {rebuyStats?.playerWithLargestSingleGameDifference.playerName ? (
                 <View style={styles.playerDetailContainer}>
                   <View style={styles.customPlayerCardContainer}>
                     <View style={styles.customPlayerDataRow}>
                       <Text style={styles.playerNameText}>
                         {rebuyStats.playerWithLargestSingleGameDifference.playerName}
                       </Text>
                       <Text style={styles.rebuyCountText}>
                         {Math.abs(rebuyStats.playerWithLargestSingleGameDifference.difference).toLocaleString()} ש״ח
                       </Text>
                     </View>
                   </View>
                   
                   <View style={styles.gameInfoRow}>
                     <View style={styles.infoItem}>
                       <Text style={styles.infoLabel}>קניות:</Text>
                       <Text style={[
                         styles.infoValue,
                         styles.negativeValue
                       ]}>
                         {rebuyStats.playerWithLargestSingleGameDifference.purchaseAmount.toLocaleString()} ש״ח
                       </Text>
                     </View>
                     
                     <View style={styles.infoItem}>
                       <Text style={styles.infoLabel}>רווח:</Text>
                       <Text style={[
                         styles.infoValue,
                         styles.positiveValue
                       ]}>
                         {rebuyStats.playerWithLargestSingleGameDifference.finalResult.toLocaleString()} ש״ח
                       </Text>
                     </View>
                   </View>
                   
                   <View style={styles.dateRow}>
                     <Text style={styles.dateText}>
                       משחק מתאריך {rebuyStats.playerWithLargestSingleGameDifference.date}
                     </Text>
                   </View>
                   
                   <TouchableOpacity 
                     style={styles.viewGameButton}
                     onPress={() => router.push(`/history/${rebuyStats.playerWithLargestSingleGameDifference.gameId}`)}
                   >
                     <Text style={styles.viewGameText}>צפה במשחק</Text>
                   </TouchableOpacity>
                 </View>
               ) : (
                 <Text style={styles.noDataText}>אין נתונים זמינים</Text>
               )}
             </Card>
             
             {/* Player with Largest Cumulative Difference */}
             <Card style={styles.card}>
               <Text style={styles.cardTitle}>ההתאוששות המצטברת הגדולה ביותר</Text>
               
               {rebuyStats?.playerWithLargestCumulativeDifference.playerName ? (
                 <View style={styles.playerDetailContainer}>
                   <View style={styles.customPlayerCardContainer}>
                     <View style={styles.customPlayerDataRow}>
                       <Text style={styles.playerNameText}>
                         {rebuyStats.playerWithLargestCumulativeDifference.playerName}
                       </Text>
                       <Text style={styles.rebuyCountText}>
                         {Math.abs(rebuyStats.playerWithLargestCumulativeDifference.totalDifference).toLocaleString()} ש״ח
                       </Text>
                     </View>
                   </View>
                   
                   <View style={styles.gameInfoRow}>
                     <View style={styles.infoItem}>
                       <Text style={styles.infoLabel}>סה"כ קניות:</Text>
                       <Text style={[
                         styles.infoValue,
                         styles.negativeValue
                       ]}>
                         {rebuyStats.playerWithLargestCumulativeDifference.totalPurchaseAmount.toLocaleString()} ש״ח
                       </Text>
                     </View>
                     
                     <View style={styles.infoItem}>
                       <Text style={styles.infoLabel}>סה"כ זכיות:</Text>
                       <Text style={[
                         styles.infoValue,
                         rebuyStats.playerWithLargestCumulativeDifference.totalFinalResult < 0 
                           ? styles.negativeValue 
                           : styles.positiveValue
                       ]}>
                         {rebuyStats.playerWithLargestCumulativeDifference.totalFinalResult.toLocaleString()} ש״ח
                       </Text>
                     </View>
                   </View>
                   
                   <View style={styles.dateRow}>
                     <Text style={styles.dateText}>
                       במהלך {rebuyStats.playerWithLargestCumulativeDifference.gamesCount} משחקים
                     </Text>
                   </View>
                 </View>
               ) : (
                 <Text style={styles.noDataText}>אין נתונים זמינים</Text>
               )}
             </Card>
             
             {/* Player with Highest Single Game Purchase */}
             <Card style={styles.card}>
               <Text style={styles.cardTitle}>סה"כ הקניות הגבוה ביותר במשחק בודד</Text>
               
               {rebuyStats?.playerWithHighestSingleGamePurchase.playerName ? (
                 <View style={styles.playerDetailContainer}>
                   <View style={styles.customPlayerCardContainer}>
                     <View style={styles.customPlayerDataRow}>
                       <Text style={styles.playerNameText}>
                         {rebuyStats.playerWithHighestSingleGamePurchase.playerName}
                       </Text>
                       <Text style={styles.rebuyCountText}>
                         {rebuyStats.playerWithHighestSingleGamePurchase.purchaseAmount.toLocaleString()} ש״ח
                       </Text>
                     </View>
                   </View>
                   
                   <View style={styles.gameInfoRow}>
                     <Text style={styles.gameInfoText}>
                       במשחק מתאריך {rebuyStats.playerWithHighestSingleGamePurchase.date}
                     </Text>
                   </View>
                   
                   <TouchableOpacity 
                     style={styles.viewGameButton}
                     onPress={() => router.push(`/history/${rebuyStats.playerWithHighestSingleGamePurchase.gameId}`)}
                   >
                     <Text style={styles.viewGameText}>צפה במשחק</Text>
                   </TouchableOpacity>
                 </View>
               ) : (
                 <Text style={styles.noDataText}>אין נתונים זמינים</Text>
               )}
             </Card>
           </>
         )}
         
         {/* Extra space at bottom */}
         <View style={styles.bottomPadding} />
       </ScrollView>
     )}
   </View>
 );
}

const styles = StyleSheet.create({
 container: {
   flex: 1,
   backgroundColor: CASINO_COLORS.background,
 },
 header: {
   flexDirection: 'row',
   justifyContent: 'space-between',
   alignItems: 'center',
   backgroundColor: CASINO_COLORS.primary,
   padding: 16,
   borderBottomWidth: 1,
   borderBottomColor: CASINO_COLORS.gold,
 },
 headerTitle: {
   color: CASINO_COLORS.gold,
   fontSize: 20,
   fontWeight: 'bold',
 },
 backButton: {
   padding: 8,
 },
 filtersContainer: {
   backgroundColor: CASINO_COLORS.surface,
   padding: 16,
   borderBottomWidth: 1,
   borderBottomColor: 'rgba(255, 215, 0, 0.3)',
 },
 filterRow: {
   flexDirection: 'row',
   alignItems: 'center',
   marginBottom: 8,
 },
 filterLabel: {
   color: CASINO_COLORS.text,
   fontSize: 16,
   fontWeight: 'bold',
   width: 80,
   textAlign: 'right',
 },
 filterControl: {
   flex: 1,
 },
 loadingContainer: {
   flex: 1,
   justifyContent: 'center',
   alignItems: 'center',
   padding: 20,
 },
 loadingText: {
   color: CASINO_COLORS.gold,
   marginTop: 12,
   fontSize: 16,
 },
 errorContainer: {
   flex: 1,
   justifyContent: 'center',
   alignItems: 'center',
   padding: 20,
 },
 errorText: {
   color: CASINO_COLORS.error,
   marginTop: 12,
   fontSize: 16,
   textAlign: 'center',
 },
 scrollView: {
   flex: 1,
 },
 scrollViewContent: {
   padding: 16,
 },
 statCardsContainer: {
   flexDirection: 'row',
   flexWrap: 'wrap',
   justifyContent: 'space-between',
   marginBottom: 16,
 },
 statCard: {
   width: '31%',
   marginBottom: 12,
 },
 card: {
   marginBottom: 16,
   padding: 16,
   borderRadius: 8,
   backgroundColor: CASINO_COLORS.surface,
   borderWidth: 1,
   borderColor: CASINO_COLORS.gold,
 },
 cardTitle: {
   color: '#FFD700', // CASINO_COLORS.gold
   fontSize: 18,
   fontWeight: 'bold',
   marginBottom: 12,
   textAlign: 'right',
   display: 'flex',
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'flex-end',
 },
 playerDetailContainer: {
   alignItems: 'center',
 },
 gamesCountRow: {
   marginBottom: 8,
 },
 gamesCountText: {
   color: CASINO_COLORS.textSecondary,
   fontSize: 14,
   textAlign: 'center',
 },
 noDataText: {
   color: CASINO_COLORS.textSecondary,
   textAlign: 'center',
   fontSize: 16,
   padding: 16,
 },
 infoRow: {
   marginTop: 4,
 },
 infoText: {
   color: CASINO_COLORS.textSecondary,
   fontSize: 12,
   fontStyle: 'italic',
   textAlign: 'center',
 },
 purchaseInfoRow: {
   marginBottom: 8,
 },
 purchaseInfoText: {
   color: CASINO_COLORS.textSecondary,
   fontSize: 14,
   textAlign: 'center',
 },
 gameInfoRow: {
   flexDirection: 'row',
   justifyContent: 'space-around',
   marginVertical: 8,
   width: '100%',
 },
 infoItem: {
   alignItems: 'center',
 },
 infoLabel: {
   color: CASINO_COLORS.textSecondary,
   fontSize: 14,
   marginBottom: 4,
 },
 infoValue: {
   fontSize: 16,
   fontWeight: 'bold',
 },
 positiveValue: {
   color: CASINO_COLORS.success,
 },
 negativeValue: {
   color: CASINO_COLORS.error,
 },
 dateRow: {
   marginBottom: 12,
 },
 dateText: {
   color: CASINO_COLORS.textSecondary,
   fontSize: 14,
   textAlign: 'center',
 },
 viewGameButton: {
   backgroundColor: CASINO_COLORS.primary,
   paddingVertical: 8,
   paddingHorizontal: 16,
   borderRadius: 4,
   borderWidth: 1,
   borderColor: CASINO_COLORS.gold,
 },
 viewGameText: {
   color: CASINO_COLORS.gold,
   fontSize: 14,
   fontWeight: 'bold',
   textAlign: 'center',
 },
 gameInfoText: {
   color: CASINO_COLORS.textSecondary,
   fontSize: 14,
   textAlign: 'center',
 },
 gameDetailContainer: {
   alignItems: 'center',
 },
 bottomPadding: {
   height: 20,
 },
 emptyTabContent: {
   padding: 40,
   alignItems: 'center',
   justifyContent: 'center',
 },
 emptyTabText: {
   color: CASINO_COLORS.textSecondary,
   fontSize: 18,
   textAlign: 'center',
   marginTop: 16,
 },
 gameStatsRow: {
   flexDirection: 'row',
   justifyContent: 'center',
   alignItems: 'center',
   marginBottom: 16,
 },
 gameStatItem: {
   flexDirection: 'row',
   alignItems: 'center',
   marginHorizontal: 8,
   justifyContent: 'flex-start',
   width: '100%',
 },
 gameStatLabel: {
   color: CASINO_COLORS.textSecondary,
   fontSize: 14,
   marginStart: 8,
   textAlign: 'right',
 },
 gameStatValue: {
   fontSize: 14,
   fontWeight: 'bold',
   textAlign: 'right',
   marginEnd: 0,
 },
 topPlayersContainer: {
   marginBottom: 16,
   paddingHorizontal: 0,
   paddingEnd: 0,
   paddingStart: 0,
 },
 topPlayersTitle: {
   color: CASINO_COLORS.gold,
   fontSize: 18,
   fontWeight: 'bold',
   marginBottom: 8,
   textAlign: 'right',
   paddingEnd: 0,
 },
 topPlayerRow: {
   flexDirection: 'row',
   alignItems: 'center',
   marginBottom: 4,
   paddingEnd: 0,
   paddingStart: 0,
   marginEnd: 0,
   marginStart: 0,
   width: '100%',
 },
 topPlayerIndex: {
   width: 24,
   fontSize: 14,
   fontWeight: 'bold',
   textAlign: 'right',
   paddingStart: 0,
   color: CASINO_COLORS.gold,
 },
 topPlayerName: {
   flex: 1,
   fontSize: 14,
   textAlign: 'right',
   paddingEnd: 0,
   marginEnd: 0,
 },
 topPlayerRebuys: {
   fontSize: 14,
   textAlign: 'left',
 },
 topPlayersNote: {
   color: CASINO_COLORS.textSecondary,
   fontSize: 14,
   marginTop: 8,
   textAlign: 'right',
 },
 highlightedValue: {
   color: CASINO_COLORS.gold,
 },
 boldValue: {
   fontWeight: 'bold',
   color: CASINO_COLORS.success,
 },
 sectionHeader: {
   marginBottom: 16,
   paddingHorizontal: 4,
 },
 sectionTitle: {
   color: CASINO_COLORS.gold,
   fontSize: 20,
   fontWeight: 'bold',
   textAlign: 'center',
   marginBottom: 4,
 },
 sectionSubtitle: {
   color: CASINO_COLORS.textSecondary,
   fontSize: 14,
   textAlign: 'center',
   marginBottom: 16,
 },
 groupStatContainer: {
   width: '100%',
 },
 estimationNote: {
   color: CASINO_COLORS.textSecondary,
   fontSize: 12,
   textAlign: 'center',
 },
 cardTitleContainer: {
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'space-between',
 },
 topGroupsContainer: {
   marginBottom: 16,
   paddingHorizontal: 0,
   paddingEnd: 0,
   paddingStart: 0,
 },
 topGroupsTitle: {
   color: CASINO_COLORS.gold,
   fontSize: 18,
   fontWeight: 'bold',
   marginBottom: 8,
   textAlign: 'right',
   paddingEnd: 0,
 },
 topGroupRow: {
   flexDirection: 'row',
   alignItems: 'center',
   marginBottom: 4,
   paddingHorizontal: 0,
   marginHorizontal: 0,
   width: '100%',
 },
 rowCardsContainer: {
   flexDirection: 'row',
   justifyContent: 'space-between',
   marginBottom: 16,
 },
 halfWidthCard: {
   width: '49%',
 },
 simpleStatCard: {
   flexDirection: 'column',
   backgroundColor: CASINO_COLORS.surface,
   borderWidth: 1,
   borderColor: CASINO_COLORS.gold,
   padding: 14,
   borderRadius: 8,
 },
 headerRow: {
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'flex-start',
   marginBottom: 6,
 },
 simpleStatTitle: {
   color: CASINO_COLORS.text,
   fontSize: 15,
   fontWeight: 'bold',
   textAlign: 'right',
 },
 simpleStatValue: {
   color: CASINO_COLORS.gold,
   fontSize: 18,
   fontWeight: 'bold',
   textAlign: 'right',
   marginTop: 4,
 },
 noDataWithNotice: {
   alignItems: 'center',
   padding: 16,
 },
 noticeText: {
   color: CASINO_COLORS.warning,
   fontSize: 12,
   marginTop: 8,
   textAlign: 'center',
 },
 categoryButtonsContainer: {
   flexDirection: 'row',
   justifyContent: 'center',
   marginBottom: 16,
 },
 categoryButton: {
   paddingHorizontal: 16,
   paddingVertical: 8,
   borderRadius: 20,
   backgroundColor: '#1C2C2E',  // CASINO_COLORS.surface
   marginHorizontal: 8,
 },
 selectedCategoryButton: {
   backgroundColor: '#35654d',  // CASINO_COLORS.primary במקום זהב
 },
 categoryButtonText: {
   color: '#B8B8B8',  // CASINO_COLORS.textSecondary
   fontWeight: 'bold',
 },
 selectedCategoryButtonText: {
   color: '#FFFFFF',  // CASINO_COLORS.text במקום שחור
 },
 toggleButton: {
   backgroundColor: '#35654d',  // CASINO_COLORS.primary
   paddingHorizontal: 10,
   paddingVertical: 4,
   borderRadius: 16,
   alignSelf: 'center',
   justifyContent: 'center',
   marginHorizontal: 2,
 },
 toggleButtonText: {
   color: '#FFFFFF',  // CASINO_COLORS.text
   fontWeight: 'bold',
   fontSize: 14,
   textAlign: 'center',
   lineHeight: 16,
 },
 titleTextContainer: {
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'flex-end',
 },
 titleText: {
   color: '#FFD700',
   fontSize: 18,
   fontWeight: 'bold',
   marginHorizontal: 2,
 },
 fullWidthCard: {
   width: '100%',
 },
 customPlayerCardContainer: {
   alignItems: 'center',
   justifyContent: 'center',
   width: '100%',
   paddingVertical: 12,
 },
 customPlayerDataRow: {
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'center',
   padding: 12,
   backgroundColor: '#1C2C2E',
   borderRadius: 8,
   borderWidth: 1,
   borderColor: '#FFD700',
   width: '90%',
 },
 playerNameText: {
   color: '#FFFFFF',
   fontWeight: 'bold',
   fontSize: 18,
   marginStart: 8,
 },
 rebuyCountText: {
   color: '#FFD700',
   fontWeight: 'bold',
   fontSize: 18,
 },
 refreshButton: {
   padding: 8,
 },
 headerButton: {
   width: 40,
   height: 40,
   borderRadius: 20,
   justifyContent: 'center',
   alignItems: 'center',
   backgroundColor: 'rgba(255, 255, 255, 0.1)',
   marginStart: 8,
 },
});