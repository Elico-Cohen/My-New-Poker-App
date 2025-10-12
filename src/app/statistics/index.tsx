// src/app/statistics/index.tsx

import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/common/Text';
import { Icon } from '@/components/common/Icon';
import { Dropdown } from '@/components/common/Dropdown';
import { Button } from '@/components/common/Button';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { getStatsSummary } from '@/services/statistics/statisticsService';
import { StatisticsFilter } from '@/models/Statistics';
import { useGroups } from '@/hooks/useAppStore';
import { useUsers } from '@/hooks/useAppStore';
import { formatCurrency } from '@/utils/formatters/currencyFormatter';
import HeaderBar from '@/components/navigation/HeaderBar';

// הוספת לוג בסיסי ברמת המודול
console.log("מודול סטטיסטיקה: טעינת המודול");

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

// תיקון חתימת הפונקציה לקבלת סטטיסטיקות לפי הספרייה
type TimeFilterType = 'all' | 'month' | 'quarter' | 'year';

// הוספת ממשק עבור המבנה המצופה של הנתונים
interface StatsSummaryData {
  totalGames: number;
  totalPlayers: number;
  totalMoney: number;
  totalRebuys: number;
  averagePlayersPerGame: number;
}

export default function StatisticsScreen() {
  console.log("מסך סטטיסטיקה: קומפוננטה StatisticsScreen מופעלת");
  
  try {
    const router = useRouter();
    console.log("מסך סטטיסטיקה: router נטען בהצלחה");
    
    const [selectedTimeFilter, setSelectedTimeFilter] = useState<TimeFilterType>('all');
    const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statsSummary, setStatsSummary] = useState<StatsSummaryData | null>(null);
    
    console.log("מסך סטטיסטיקה: סטייט ראשוני הוגדר");
    
    // שימוש בהוקים החדשים לקבלת קבוצות ומשתמשים
    try {
      const { groups, loading: groupsLoading } = useGroups();
      const { users, loading: usersLoading } = useUsers();
      console.log(`מסך סטטיסטיקה: הוקים נטענו, groupsLoading=${groupsLoading}, usersLoading=${usersLoading}, groups.length=${groups.length}, users.length=${users?.length || 0}`);
    
      // אפשרויות סינון זמן
      const timeFilterOptions = [
        { label: 'כל הזמנים', value: 'all' },
        { label: 'חודש אחרון', value: 'month' },
        { label: 'רבעון אחרון', value: 'quarter' },
        { label: 'שנה אחרונה', value: 'year' }
      ];
      
      // יצירת אפשרויות קבוצה לדרופדאון
      const groupOptions = [
        { label: 'כל הקבוצות', value: '' },
        ...groups
          .filter(group => group.isActive) // סינון רק קבוצות פעילות
          .map(group => ({
            label: group.name,
            value: group.id
          }))
      ];
      
      console.log(`מסך סטטיסטיקה: נוצרו אפשרויות סינון, קבוצות=${groupOptions.length}`);
      
      // פונקציה לטעינת הנתונים
      const loadData = async () => {
        try {
          console.log('מסך סטטיסטיקה: התחלת טעינת נתונים');
          setIsLoading(true);
          setError(null);
          
          // יצירת אובייקט פילטר
          const filter: StatisticsFilter = {
            timeFilter: selectedTimeFilter,
            groupId: selectedGroupId
          };
          
          console.log('מסך סטטיסטיקה: אובייקט פילטר:', filter);
          
          // טעינת נתונים מהשירותים
          console.log('מסך סטטיסטיקה: קורא לפונקציית getStatsSummary');
          try {
            const summaryData = await getStatsSummary(filter) as StatsSummaryData;
            console.log('מסך סטטיסטיקה: התקבלו נתונים מ-getStatsSummary:', summaryData);
            setStatsSummary(summaryData);
          } catch (summaryErr) {
            console.error('שגיאה בקריאה ל-getStatsSummary:', summaryErr);
            throw summaryErr;
          }
          
        } catch (err) {
          console.error('שגיאה בטעינת נתוני סטטיסטיקה:', err);
          setError('אירעה שגיאה בטעינת הנתונים. אנא נסה שוב מאוחר יותר.');
        } finally {
          setIsLoading(false);
        }
      };
      
      // טעינת נתונים בעת טעינת המסך או שינוי פילטרים
      useEffect(() => {
        console.log('מסך סטטיסטיקה: useEffect הופעל עם פילטרים:', 
                   'timeFilter=', selectedTimeFilter, 
                   'groupId=', selectedGroupId, 
                   'groupsLoading=', groupsLoading,
                   'usersLoading=', usersLoading);
                   
        if (!groupsLoading && !usersLoading) {
          console.log('מסך סטטיסטיקה: טעינת נתונים מתחילה כי הקבוצות והמשתמשים נטענו');
          loadData();
        } else {
          console.log('מסך סטטיסטיקה: מחכה לסיום טעינת קבוצות ומשתמשים');
        }
      }, [selectedTimeFilter, selectedGroupId, groupsLoading, usersLoading]);
      
      // ניווט למסך סטטיסטיקת משחקים
      const navigateToGamesStats = () => {
        console.log('מסך סטטיסטיקה: ניווט למסך סטטיסטיקת משחקים');
        router.navigate('statistics/games');
      };
      
      // רענון נתונים
      const handleRefresh = () => {
        console.log('מסך סטטיסטיקה: רענון נתונים');
        loadData();
      };
      
      // חזרה אחורה
      const handleBack = () => {
        console.log('מסך סטטיסטיקה: חזרה למסך הקודם');
        router.back();
      };
      
      console.log(`מסך סטטיסטיקה: לפני רינדור, isLoading=${isLoading}, error=${error != null}, hasSummary=${statsSummary != null}`);
      
      if (isLoading) {
        console.log('מסך סטטיסטיקה: מציג מסך טעינה');
        return (
          <View style={styles.container}>
            <HeaderBar title="statistics" showBack={true} onBackPress={handleBack} />
            <View style={styles.loadingContainer}>
              <LoadingIndicator size="large" />
              <Text style={styles.loadingText}>טוען נתוני סטטיסטיקה...</Text>
            </View>
          </View>
        );
      }
      
      if (error) {
        console.log('מסך סטטיסטיקה: מציג מסך שגיאה', error);
        return (
          <View style={styles.container}>
            <HeaderBar title="statistics" showBack={true} onBackPress={handleBack} />
            <View style={styles.errorContainer}>
              <Icon name="alert-circle" size={48} color={CASINO_COLORS.error} />
              <Text style={styles.errorText}>{error}</Text>
              <Button title="נסה שוב" onPress={handleRefresh} />
            </View>
          </View>
        );
      }
      
      console.log('מסך סטטיסטיקה: מציג מסך סטטיסטיקה מלא');
      return (
        <View style={styles.container}>
          <HeaderBar title="statistics" showBack={true} onBackPress={handleBack} />
          
          {/* כותרת ירוקה למעלה */}
          <View style={styles.greenHeader}>
            <Text style={styles.headerTitle}>סטטיסטיקת משחקים</Text>
            <TouchableOpacity style={styles.navButton} onPress={navigateToGamesStats}>
              <Icon name="arrow-left" size={24} color={CASINO_COLORS.gold} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.scrollContainer}>
            {/* פילטרים */}
            <View style={styles.filterSection}>
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>קבוצה:</Text>
                <Dropdown
                  items={groupOptions}
                  value={selectedGroupId || ''}
                  onSelect={(value) => setSelectedGroupId(value as string)}
                  placeholder="בחר קבוצה"
                  style={styles.dropdown}
                />
              </View>
              
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>תקופה:</Text>
                <Dropdown
                  items={timeFilterOptions.map(option => ({
                    label: option.label,
                    value: option.value
                  }))}
                  value={selectedTimeFilter}
                  onSelect={(value) => setSelectedTimeFilter(value as TimeFilterType)}
                  placeholder="בחר תקופה"
                  style={styles.dropdown}
                />
              </View>
            </View>
            
            {/* כרטיסי סיכום */}
            {statsSummary && (
              <>
                <View style={styles.cardsRow}>
                  <View style={styles.statCard}>
                    <Icon name="cards" size={24} color={CASINO_COLORS.gold} style={styles.cardIcon} />
                    <Text style={styles.cardValue}>{statsSummary.totalGames}</Text>
                    <Text style={styles.cardLabel}>סה"כ משחקים</Text>
                  </View>
                  
                  <View style={styles.statCard}>
                    <Icon name="account-group" size={24} color={CASINO_COLORS.gold} style={styles.cardIcon} />
                    <Text style={styles.cardValue}>{statsSummary.totalPlayers}</Text>
                    <Text style={styles.cardLabel}>שחקנים פעילים</Text>
                  </View>
                </View>
                
                <View style={styles.cardsRow}>
                  <View style={styles.statCard}>
                    <Icon name="cash" size={24} color={CASINO_COLORS.gold} style={styles.cardIcon} />
                    <Text style={styles.cardValue}>{formatCurrency(statsSummary.totalMoney)}</Text>
                    <Text style={styles.cardLabel}>סה"כ קניות</Text>
                  </View>
                  
                  <View style={styles.statCard}>
                    <Icon name="refresh" size={24} color={CASINO_COLORS.gold} style={styles.cardIcon} />
                    <Text style={styles.cardValue}>{statsSummary.totalRebuys}</Text>
                    <Text style={styles.cardLabel}>ריבאיים</Text>
                  </View>
                </View>
                
                {/* כרטיס פעילות */}
                <View style={styles.activitySection}>
                  <Text style={styles.activityTitle}>פעילות משחקים ושחקנים</Text>
                  
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Text style={styles.statItemValue}>
                        {statsSummary.totalRebuys > 0 && statsSummary.totalGames > 0 
                          ? (statsSummary.totalRebuys / statsSummary.totalGames).toFixed(1) 
                          : '0'}
                      </Text>
                      <Text style={styles.statItemLabel}>ממוצע ריבאיים למשחק</Text>
                    </View>
                    
                    <View style={styles.statItem}>
                      <Text style={styles.statItemValue}>
                        {formatCurrency(statsSummary.totalGames > 0 
                          ? statsSummary.totalMoney / statsSummary.totalGames 
                          : 0)}
                      </Text>
                      <Text style={styles.statItemLabel}>ממוצע קניות למשחק</Text>
                    </View>
                  </View>
                  
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Text style={styles.statItemValue}>
                        {statsSummary.averagePlayersPerGame 
                          ? statsSummary.averagePlayersPerGame.toFixed(1) 
                          : '0'}
                      </Text>
                      <Text style={styles.statItemLabel}>ממוצע שחקנים למשחק</Text>
                    </View>
                    
                    <View style={styles.statItem}>
                      <Text style={styles.statItemValue}>
                        {formatCurrency(statsSummary.totalPlayers > 0 
                          ? statsSummary.totalMoney / statsSummary.totalPlayers 
                          : 0)}
                      </Text>
                      <Text style={styles.statItemLabel}>ממוצע קניות לשחקן</Text>
                    </View>
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      );
    } catch (hookError) {
      console.error('שגיאה בהוקים:', hookError);
      return (
        <View style={styles.container}>
          <HeaderBar title="statistics" showBack={true} />
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>שגיאה בטעינת הוקים ומידע בסיסי</Text>
          </View>
        </View>
      );
    }
  } catch (generalError) {
    console.error('שגיאה כללית במסך הסטטיסטיקה:', generalError);
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0D1B1E' }}>
        <Text style={{ color: '#ef4444', fontSize: 16, textAlign: 'center', padding: 20 }}>
          שגיאה כללית: אנא נסה שוב
        </Text>
      </View>
    );
  }
}

// הסגנונות
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CASINO_COLORS.background,
  },
  greenHeader: {
    backgroundColor: CASINO_COLORS.primary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 3,
    borderBottomColor: CASINO_COLORS.gold,
  },
  headerTitle: {
    color: CASINO_COLORS.gold,
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
  navButton: {
    marginLeft: 10,
  },
  scrollContainer: {
    flex: 1,
    padding: 0,
  },
  filterSection: {
    padding: 15,
    borderBottomWidth: 2,
    borderBottomColor: CASINO_COLORS.gold,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  filterLabel: {
    color: CASINO_COLORS.text,
    fontSize: 16,
    marginLeft: 10,
    width: 60,
    textAlign: 'left',
  },
  dropdown: {
    flex: 1,
  },
  cardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: CASINO_COLORS.surface,
    borderRadius: 10,
    padding: 15,
    margin: 5,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
  },
  cardIcon: {
    marginBottom: 5,
  },
  cardValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: CASINO_COLORS.gold,
    marginBottom: 5,
  },
  cardLabel: {
    fontSize: 14,
    color: CASINO_COLORS.textSecondary,
    textAlign: 'center',
  },
  activitySection: {
    backgroundColor: CASINO_COLORS.surface,
    borderRadius: 10,
    padding: 15,
    margin: 15,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
  },
  activityTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: CASINO_COLORS.gold,
    marginBottom: 15,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    backgroundColor: '#0A1517',
    borderRadius: 8,
    padding: 10,
  },
  statItemValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: CASINO_COLORS.gold,
    marginBottom: 5,
    textAlign: 'center',
  },
  statItemLabel: {
    fontSize: 12,
    color: CASINO_COLORS.textSecondary,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: CASINO_COLORS.gold,
    marginTop: 16,
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
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
});