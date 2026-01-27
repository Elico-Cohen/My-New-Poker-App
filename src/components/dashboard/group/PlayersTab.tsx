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
  groupId: string;
  permanentPlayers: string[];
  guestPlayers: string[];
  onChange: (permanent: string[], guests: string[]) => void;
  onClose?: () => void;
}

function PlayersTab({
  groupId,
  permanentPlayers,
  guestPlayers,
  onChange,
  onClose = () => {}
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
          groupId={groupId}
          permanentPlayers={permanentPlayers}
          guestPlayers={guestPlayers}
          onUpdatePlayers={onChange}
          onClose={onClose}
        />
      </ScrollView>
    </View>
  );
}

export default PlayersTab;