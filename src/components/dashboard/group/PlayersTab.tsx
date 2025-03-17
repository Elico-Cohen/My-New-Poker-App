import React from 'react';
import { View, ScrollView, I18nManager } from 'react-native';
import { PlayersInGroupManagement } from '@/components/dashboard/PlayersInGroupManagement';

// Enable RTL
I18nManager.forceRTL(true);

const CASINO_COLORS = {
  background: '#0D1B1E',
  primary: '#35654d',
  gold: '#FFD700',
  surface: '#1C2C2E',
  text: '#B8B8B8'
};

interface PlayersTabProps {
  permanentPlayers: string[];
  guestPlayers: string[];
  onChange: (permanent: string[], guests: string[]) => void;
}

function PlayersTab({
  permanentPlayers,
  guestPlayers,
  onChange
}: PlayersTabProps) {
  return (
    <View style={{ 
      flex: 1,
      backgroundColor: CASINO_COLORS.background
    }}>
      <ScrollView 
        contentContainerStyle={{ 
          flexGrow: 1,
          padding: 16,
          paddingTop: 24
        }}
      >
        <PlayersInGroupManagement
          permanentPlayers={permanentPlayers}
          guestPlayers={guestPlayers}
          onUpdatePlayers={onChange}
        />
      </ScrollView>
    </View>
  );
}

export default PlayersTab;