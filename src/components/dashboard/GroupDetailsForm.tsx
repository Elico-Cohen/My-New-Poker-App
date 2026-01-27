import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/common/Text';
import TabBar from '@/components/common/TabBar';
import DetailsTab from '@/components/dashboard/group/DetailsTab';
import PlayersTab from '@/components/dashboard/group/PlayersTab';
import { Group } from '@/models/Group';

const CASINO_COLORS = {
  background: '#0D1B1E',
  primary: '#35654d',
  gold: '#FFD700',
  surface: '#1C2C2E',
  text: '#B8B8B8'
};

interface GroupDetailsFormProps {
  initialData?: Partial<Group>;
  onChange: (data: Partial<Group>) => void;
  error?: string;
}

export function GroupDetailsForm({
  initialData = {},
  onChange,
  error
}: GroupDetailsFormProps) {
  const [activeTab, setActiveTab] = React.useState(0);

  const tabs = [
    { 
      label: 'פרטים',
      isActive: activeTab === 0,
      onPress: () => setActiveTab(0)
    },
    { 
      label: 'שחקנים',
      isActive: activeTab === 1,
      onPress: () => setActiveTab(1)
    }
  ];

  // Handler for PlayersTab changes
  const handlePlayersChange = (permanent: string[], guests: string[]) => {
    onChange({
      ...initialData,
      permanentPlayers: permanent,
      guestPlayers: guests
    });
  };

  return (
    <View style={{ 
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      backgroundColor: CASINO_COLORS.background,
    }}>
      {/* Fixed Tab Bar */}
      <View style={{
        position: 'sticky',
        top: 0,
        zIndex: 1,
        backgroundColor: CASINO_COLORS.background,
      }}>
        <TabBar tabs={tabs} />
      </View>
      
      {/* Scrollable Content */}
      <View style={{ 
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 16,
        width: '100%',
      }}>
        {activeTab === 0 ? (
          <DetailsTab
            initialData={initialData}
            onChange={onChange}
            error={error}
          />
        ) : (
          <PlayersTab
            groupId={initialData.id || ''}
            permanentPlayers={initialData.permanentPlayers || []}
            guestPlayers={initialData.guestPlayers || []}
            onChange={handlePlayersChange}
          />
        )}
      </View>
    </View>
  );
}