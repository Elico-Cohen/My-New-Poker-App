import React from 'react';
import { View, ScrollView } from 'react-native';
import { Modal } from '@/components/common/Modal';
import { Text } from '@/components/common/Text';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { Switch } from '@/components/common/Switch';
import Colors from '@/theme/colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Group } from '@/models/Group';

interface GroupDialogProps {
  visible: boolean;
  onClose: () => void;
  onSave: (group: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  group?: Group;  // אם מועבר, מדובר בעריכה
}

export function GroupDialog({
  visible,
  onClose,
  onSave,
  group
}: GroupDialogProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Form fields
  const [name, setName] = React.useState(group?.name || '');
  const [buyInChips, setBuyInChips] = React.useState(group?.buyIn.chips.toString() || '');
  const [buyInAmount, setBuyInAmount] = React.useState(group?.buyIn.amount.toString() || '');
  const [rebuyChips, setRebuyChips] = React.useState(group?.rebuy.chips.toString() || '');
  const [rebuyAmount, setRebuyAmount] = React.useState(group?.rebuy.amount.toString() || '');
  const [useRoundingRule, setUseRoundingRule] = React.useState(group?.useRoundingRule || false);
  const [roundingRulePercentage, setRoundingRulePercentage] = React.useState(
    group?.roundingRulePercentage?.toString() || '80'
  );

  // Reset form when dialog is opened
  React.useEffect(() => {
    if (visible) {
      setError(null);
      if (!group) {
        setName('');
        setBuyInChips('');
        setBuyInAmount('');
        setRebuyChips('');
        setRebuyAmount('');
        setUseRoundingRule(false);
        setRoundingRulePercentage('80');
      }
    }
  }, [visible, group]);

  const handleSave = async () => {
    try {
      setError(null);
      setLoading(true);

      // Validation
      if (!name.trim()) {
        throw new Error('Group name is required');
      }
      
      const buyInChipsNum = parseInt(buyInChips);
      const buyInAmountNum = parseInt(buyInAmount);
      const rebuyChipsNum = parseInt(rebuyChips);
      const rebuyAmountNum = parseInt(rebuyAmount);
      const roundingRulePercentageNum = parseInt(roundingRulePercentage);

      if (isNaN(buyInChipsNum) || buyInChipsNum <= 0) {
        throw new Error('Invalid buy-in chips amount');
      }
      if (isNaN(buyInAmountNum) || buyInAmountNum <= 0) {
        throw new Error('Invalid buy-in amount');
      }
      if (isNaN(rebuyChipsNum) || rebuyChipsNum <= 0) {
        throw new Error('Invalid rebuy chips amount');
      }
      if (isNaN(rebuyAmountNum) || rebuyAmountNum <= 0) {
        throw new Error('Invalid rebuy amount');
      }
      if (useRoundingRule) {
        if (isNaN(roundingRulePercentageNum) || 
            roundingRulePercentageNum <= 0 || 
            roundingRulePercentageNum > 100) {
          throw new Error('Rounding rule percentage must be between 1 and 100');
        }
      }

      const newGroup = {
        name: name.trim(),
        currency: group?.currency || '₪',
        createdBy: group?.createdBy || '',
        buyIn: {
          chips: buyInChipsNum,
          amount: buyInAmountNum
        },
        rebuy: {
          chips: rebuyChipsNum,
          amount: rebuyAmountNum
        },
        useRoundingRule,
        roundingRulePercentage: roundingRulePercentageNum,
        isActive: true,
        permanentPlayers: group?.permanentPlayers || [],
        guestPlayers: group?.guestPlayers || []
      };

      await onSave(newGroup);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={group ? 'Edit Group' : 'New Group'}
    >
      <ScrollView style={{ maxHeight: 500 }}>
        {error && (
          <View style={{
            backgroundColor: theme.error,
            padding: 12,
            borderRadius: 8,
            marginBottom: 16
          }}>
            <Text style={{ color: theme.onPrimary }}>{error}</Text>
          </View>
        )}

        <View style={{ gap: 16 }}>
          {/* Group Name */}
          <Input
            value={name}
            onChangeText={setName}
            placeholder="Group Name"
            style={{ marginBottom: 16 }}
          />

          {/* Buy-in Settings */}
          <Text variant="h4" style={{ marginBottom: 8 }}>Buy-in Settings</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Input
              value={buyInChips}
              onChangeText={setBuyInChips}
              placeholder="Chips"
              keyboardType="numeric"
              style={{ flex: 1 }}
            />
            <Input
              value={buyInAmount}
              onChangeText={setBuyInAmount}
              placeholder="Amount (₪)"
              keyboardType="numeric"
              style={{ flex: 1 }}
            />
          </View>

          {/* Rebuy Settings */}
          <Text variant="h4" style={{ marginBottom: 8 }}>Rebuy Settings</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Input
              value={rebuyChips}
              onChangeText={setRebuyChips}
              placeholder="Chips"
              keyboardType="numeric"
              style={{ flex: 1 }}
            />
            <Input
              value={rebuyAmount}
              onChangeText={setRebuyAmount}
              placeholder="Amount (₪)"
              keyboardType="numeric"
              style={{ flex: 1 }}
            />
          </View>

          {/* Rounding Rule */}
          <View style={{ marginBottom: 8 }}>
            <Switch
              value={useRoundingRule}
              onValueChange={setUseRoundingRule}
              label="Use Rounding Rule"
            />
          </View>

          {useRoundingRule && (
            <Input
              value={roundingRulePercentage}
              onChangeText={setRoundingRulePercentage}
              placeholder="Percentage (e.g., 80)"
              keyboardType="numeric"
            />
          )}
        </View>
      </ScrollView>

      <View style={{ 
        flexDirection: 'row', 
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 24
      }}>
        <Button
          title="Cancel"
          onPress={onClose}
          variant="ghost"
        />
        <Button
          title="Save"
          onPress={handleSave}
          loading={loading}
        />
      </View>
    </Modal>
  );
}