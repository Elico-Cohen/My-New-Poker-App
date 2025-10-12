import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@/components/common/Text';
import { Icon } from '@/components/common/Icon';
import { useRouter } from 'expo-router';
import { useGameContext } from '@/contexts/GameContext';
import { useAuth } from '@/contexts/AuthContext';

const CASINO_COLORS = {
  primary: '#35654d',
  gold: '#FFD700',
  surface: '#1C2C2E',
  success: '#22c55e'
};

interface ActiveGameBannerProps {
  style?: any;
}

export const ActiveGameBanner: React.FC<ActiveGameBannerProps> = ({ style }) => {
  const router = useRouter();
  const { isGameActive, gameData, determineCorrectGameScreen, canUserContinueThisGame } = useGameContext();
  const { canContinueGame, canViewGameAsReadOnly } = useAuth();

  const handleReturnToGame = () => {
    // שימוש בלוגיקה החדשה להחזרה למשחק
    const canContinue = canContinueGame(gameData);
    const canViewOnly = canViewGameAsReadOnly();
    
    const targetScreen = determineCorrectGameScreen(
      gameData.status, 
      { canContinue, canViewOnly },
      gameData.id
    );
    
    router.push(targetScreen as any);
  };

  // Don't render if no active game or if game is completed
  if (!isGameActive || gameData.status === 'completed') {
    return null;
  }

  return (
    <TouchableOpacity 
      style={[styles.banner, style]} 
      onPress={handleReturnToGame}
      activeOpacity={0.8}
    >
      <View style={styles.bannerContent}>
        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Icon name="cards-playing-outline" size={20} color={CASINO_COLORS.gold} />
            <Text style={styles.title}>משחק פעיל</Text>
          </View>
          <Text style={styles.subtitle}>
            {gameData.groupNameSnapshot || 'קבוצה'} • {gameData.players?.length || 0} שחקנים
          </Text>
        </View>
        <View style={styles.actionContainer}>
          <Text style={styles.actionText}>חזור למשחק</Text>
          <Icon name="arrow-left" size={16} color={CASINO_COLORS.gold} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: CASINO_COLORS.success,
    borderRadius: 8,
    margin: 16,
    marginBottom: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  bannerContent: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
  },
  actionContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  actionText: {
    color: CASINO_COLORS.gold,
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 8,
  },
});

export default ActiveGameBanner; 