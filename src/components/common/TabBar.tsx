import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@/components/common/Text';
import { I18nManager } from 'react-native';

// Enable RTL
I18nManager.forceRTL(true);

interface TabProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
}

interface TabBarProps {
  tabs: TabProps[];
}

const CASINO_COLORS = {
  background: '#0D1B1E',
  primary: '#35654d',
  gold: '#FFD700',
  surface: '#1C2C2E',
  text: '#B8B8B8'
};

function TabBar({ tabs }: TabBarProps) {
  return (
    <View>
      {/* Dark separator above tabs */}
      <View style={{
        height: 8,
        backgroundColor: CASINO_COLORS.background,
        borderTopWidth: 1,
        borderTopColor: `${CASINO_COLORS.gold}30`,
      }} />
      
      {/* Tabs container - שימו לב שהפכנו את כיוון ה-flex ל-row-reverse */}
      <View style={styles.container}>
        {[...tabs].reverse().map((tab, index) => (
          <TouchableOpacity
            key={tab.label}
            onPress={tab.onPress}
            style={[
              styles.tab,
              tab.isActive && styles.activeTab,
              index === tabs.length - 1 && styles.firstTab,
              index === 0 && styles.lastTab,
            ]}
          >
            <Text
              variant="bodyNormal"
              style={[
                styles.tabText,
                tab.isActive && styles.activeTabText
              ]}
            >
              {tab.label}
            </Text>
            {tab.isActive && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row-reverse', // שינוי לתמיכה ב-RTL
    backgroundColor: CASINO_COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: CASINO_COLORS.gold,
    gap: 2,
    padding: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    position: 'relative',
    alignItems: 'center',
    backgroundColor: CASINO_COLORS.surface,
    borderColor: CASINO_COLORS.gold,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  activeTab: {
    backgroundColor: CASINO_COLORS.primary,
    zIndex: 1,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
  },
  firstTab: {
    borderTopRightRadius: 8,
    borderTopLeftRadius: 0,
  },
  lastTab: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 0,
  },
  tabText: {
    color: CASINO_COLORS.text,
    fontSize: 14,
    textAlign: 'center',
  },
  activeTabText: {
    color: CASINO_COLORS.gold,
    fontWeight: 'bold',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: CASINO_COLORS.gold,
  },
});

export default TabBar;