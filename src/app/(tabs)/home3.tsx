// src/app/(tabs)/home3.tsx

import React from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@/components/common/Text';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { Button } from '@/components/common/Button';

class Home3Screen extends React.Component {
  state = {
    // נתוני Quick Stats – לדוגמה (ניתן להחליף לשאיבת נתונים אמיתית)
    playersCount: 50,
    gamesCount: 120,
    groupsCount: 3,
    // מערך קבוצות לדוגמה – כל קבוצה מכילה id, name, ואופציונלית lastGame
    groupsData: [
      {
        id: '1',
        name: 'Group A',
        lastGame: {
          date: '2023-01-15',
          totalInvestment: 100,
          playersCount: 6,
        },
      },
      {
        id: '2',
        name: 'Group B',
        // אין משחק אחרון
      },
      {
        id: '3',
        name: 'Group C',
        lastGame: {
          date: '2023-02-20',
          totalInvestment: 150,
          playersCount: 7,
        },
      },
    ],
  };

  renderGroupCard = (group: any) => {
    return (
      <Card
        key={group.id}
        style={styles.groupCard}
      >
        <View style={styles.groupCardHeader}>
          <Text variant="h4" style={styles.groupName}>
            {group.name}
          </Text>
        </View>
        {group.lastGame ? (
          <View style={styles.groupCardBody}>
            <Text style={styles.groupDetail}>
              משחק אחרון: {group.lastGame.date}
            </Text>
            <Text style={styles.groupDetail}>
              השקעה: {group.lastGame.totalInvestment} ₪
            </Text>
            <Text style={styles.groupDetail}>
              שחקנים: {group.lastGame.playersCount}
            </Text>
          </View>
        ) : (
          <View style={styles.groupCardBody}>
            <Text style={styles.groupDetail}>
              עדיין לא שוחקו משחקים בקבוצה
            </Text>
          </View>
        )}
      </Card>
    );
  };

  render() {
    const { playersCount, gamesCount, groupsCount, groupsData } = this.state;
    
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text variant="h4" style={styles.headerText}>Start New Game</Text>
        </View>

        <ScrollView style={styles.scrollContainer}>
          {/* Quick Stats */}
          <Card style={styles.statsCard}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Icon name="trophy" size="large" color="#FFD700" />
                <Text variant="bodyNormal" style={styles.statText}>
                  {gamesCount} משחקים
                </Text>
              </View>
              <View style={styles.statItem}>
                <Icon name="account-group" size="large" color="#FFD700" />
                <Text variant="bodyNormal" style={styles.statText}>
                  {playersCount} שחקנים
                </Text>
              </View>
              <View style={styles.statItem}>
                <Icon name="account-group-outline" size="large" color="#FFD700" />
                <Text variant="bodyNormal" style={styles.statText}>
                  {groupsCount} קבוצות
                </Text>
              </View>
            </View>
          </Card>

          {/* Group Cards */}
          {groupsData.map((group: any) => this.renderGroupCard(group))}
        </ScrollView>

        {/* Footer – כפתור קבוע */}
        <View style={styles.footer}>
          <Button
            title="Start New Game"
            variant="primary"
            icon="cards-playing-outline"
          />
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1B1E' },
  header: {
    padding: 16,
    backgroundColor: '#35654d',
    borderBottomWidth: 2,
    borderBottomColor: '#FFD700',
  },
  headerText: {
    color: '#FFD700',
    textAlign: 'center',
  },
  scrollContainer: { flex: 1, padding: 16 },
  statsCard: {
    backgroundColor: '#1C2C2E',
    borderColor: '#FFD700',
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
  },
  groupCard: {
    backgroundColor: '#1C2C2E',
    borderColor: '#FFD700',
    marginBottom: 16,
    padding: 16,
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
    marginTop: 4,
  },
  groupDetail: {
    color: '#FFD700',
    fontSize: 16,
    textAlign: 'right',
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
  },
});

export default Home3Screen;
