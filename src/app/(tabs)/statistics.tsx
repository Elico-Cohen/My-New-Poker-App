// src/app/(tabs)/statistics.tsx
import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Text } from '@/components/common/Text';
import { Icon } from '@/components/common/Icon';
import { useAuth } from '@/contexts/AuthContext';
import HeaderBar from '@/components/navigation/HeaderBar';

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

// Statistics categories
const STAT_CATEGORIES = [
  {
    id: 'games',
    icon: 'cards',
    title: 'סטטיסטיקת משחקים',
    description: 'כמות משחקים, סכומי כסף במשחקים לפי קבוצה ותקופה'
  },
  {
    id: 'openGames',
    icon: 'cards-playing-outline',
    title: 'סטטיסטיקת משחקים פתוחים',
    description: 'שחקנים עם מספר הזכיות הגבוה ביותר במשחקים פתוחים'
  },
  {
    id: 'rebuys',
    icon: 'refresh',
    title: 'סטטיסטיקת ריבאיים',
    description: 'מספר ריבאיים והשקעה מקסימלית במשחק יחיד'
  },
  {
    id: 'participation',
    icon: 'account-group',
    title: 'סטטיסטיקת השתתפות',
    description: 'כמות משחקים שכל שחקן השתתף בהם'
  },
  {
    id: 'winnersLosers',
    icon: 'trophy',
    title: 'מנצחים ומפסידים',
    description: 'זכיות והפסדים מקסימליים, שחקנים עם הכי הרבה ניצחונות/הפסדים, רצפי ניצחונות'
  },
  {
    id: 'playerStats',
    icon: 'account-circle',
    title: 'סטטיסטיקת שחקן',
    description: 'סטטיסטיקות מפורטות עבור שחקן נבחר'
  }
];

export default function StatisticsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const windowWidth = Dimensions.get('window').width;
  const isSmallScreen = windowWidth < 400;
  const cardWidth = isSmallScreen ? '100%' : '48%';
  
  // State for statistics data
  const [refreshing, setRefreshing] = useState(false);
  
  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false, header: () => null }} />
      
      {/* Header */}
      <HeaderBar 
        title="סטטיסטיקות"
        showLogout={false}
      />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#FFD700']}
            tintColor="#FFD700"
          />
        }
      >
        {/* Statistics Categories */}
        <Text style={styles.sectionTitle}>קטגוריות סטטיסטיקה</Text>
        
        <View style={styles.categoriesContainer}>
          {STAT_CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[styles.categoryCard, { width: cardWidth }]}
              onPress={() => router.push(`/statistics/${category.id}` as any)}
            >
              <Icon name={category.icon as any} size="large" color={CASINO_COLORS.gold} />
              <Text style={styles.categoryTitle}>{category.title}</Text>
              <Text style={styles.categoryDescription}>{category.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Personal Stats Banner (only if user is logged in) */}
        {user && (
          <TouchableOpacity 
            style={styles.personalStatsBanner}
            onPress={() => router.push(`/statistics/playerStats?playerId=${user.id}` as any)}
          >
            <View style={styles.personalStatsContent}>
              <Icon name="account-circle" size="medium" color={CASINO_COLORS.gold} />
              <Text style={styles.personalStatsText}>
                צפה בסטטיסטיקה האישית שלך
              </Text>
            </View>
            <Icon name="arrow-left" size="small" color={CASINO_COLORS.gold} />
          </TouchableOpacity>
        )}
        
        {/* Extra space at bottom */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CASINO_COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 16,
    paddingBottom: 24,
  },
  sectionTitle: {
    color: CASINO_COLORS.gold,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    marginTop: 8,
    textAlign: 'right',
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  categoryCard: {
    backgroundColor: CASINO_COLORS.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
    alignItems: 'center',
  },
  categoryTitle: {
    color: CASINO_COLORS.gold,
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  categoryDescription: {
    color: CASINO_COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
  personalStatsBanner: {
    backgroundColor: CASINO_COLORS.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: CASINO_COLORS.gold,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  personalStatsContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  personalStatsText: {
    color: CASINO_COLORS.gold,
    fontSize: 16,
    fontWeight: 'bold',
    marginEnd: 8,
    textAlign: 'right',
  },
  bottomPadding: {
    height: 20,
  },
});