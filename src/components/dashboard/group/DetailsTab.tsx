// src/components/dashboard/group/DetailsTab.tsx
import React from 'react';
import { View, ScrollView, I18nManager } from 'react-native';
import { Text } from '@/components/common/Text';
import { Input } from '@/components/common/Input';
import { Switch } from '@/components/common/Switch';
import { Group } from '@/models/Group';

// Enable RTL
I18nManager.forceRTL(true);

const CASINO_COLORS = {
  background: '#0D1B1E',
  primary: '#35654d',
  gold: '#FFD700',
  surface: '#1C2C2E',
  text: '#B8B8B8'
};

interface DetailsTabProps {
  initialData: Partial<Group>;
  onChange: (data: Partial<Group>) => void;
  error?: string;
}

function DetailsTab({
  initialData,
  onChange,
  error
}: DetailsTabProps) {
  const [name, setName] = React.useState(initialData?.name || '');
  const [buyInChips, setBuyInChips] = React.useState(initialData?.buyIn?.chips?.toString() || '');
  const [buyInAmount, setBuyInAmount] = React.useState(initialData?.buyIn?.amount?.toString() || '');
  const [rebuyChips, setRebuyChips] = React.useState(initialData?.rebuy?.chips?.toString() || '');
  const [rebuyAmount, setRebuyAmount] = React.useState(initialData?.rebuy?.amount?.toString() || '');
  const [useRoundingRule, setUseRoundingRule] = React.useState(initialData?.useRoundingRule || false);
  const [roundingRulePercentage, setRoundingRulePercentage] = React.useState(
    initialData?.roundingRulePercentage?.toString() || '80'
  );

  React.useEffect(() => {
    const buyInChipsNum = parseInt(buyInChips);
    const buyInAmountNum = parseInt(buyInAmount);
    const rebuyChipsNum = parseInt(rebuyChips);
    const rebuyAmountNum = parseInt(rebuyAmount);
    const roundingRulePercentageNum = parseInt(roundingRulePercentage);

    const formData: Partial<Group> = {
      name: name.trim(),
      buyIn: {
        chips: isNaN(buyInChipsNum) ? 0 : buyInChipsNum,
        amount: isNaN(buyInAmountNum) ? 0 : buyInAmountNum
      },
      rebuy: {
        chips: isNaN(rebuyChipsNum) ? 0 : rebuyChipsNum,
        amount: isNaN(rebuyAmountNum) ? 0 : rebuyAmountNum
      },
      useRoundingRule,
      roundingRulePercentage: isNaN(roundingRulePercentageNum) ? 80 : roundingRulePercentageNum
    };

    onChange(formData);
  }, [name, buyInChips, buyInAmount, rebuyChips, rebuyAmount, useRoundingRule, roundingRulePercentage]);

  return (
    <ScrollView 
      style={{ flex: 1 }}
      contentContainerStyle={{ 
        padding: 16,
        paddingTop: 24
      }}
    >
      <View style={{ gap: 24 }}>
        {error && (
          <Text variant="bodyNormal" style={{ 
            color: CASINO_COLORS.gold,
            textAlign: 'right'
          }}>
            {error}
          </Text>
        )}

        {/* שם הקבוצה */}
        <View style={{ 
          flexDirection: 'row-reverse', 
          alignItems: 'center',
          gap: 12 
        }}>
          <Text variant="bodyNormal" style={{ 
            color: CASINO_COLORS.gold,
            width: 120,
            fontSize: 16,
            textAlign: 'right'
          }}>
            שם הקבוצה:
          </Text>
          <View style={{ flex: 1 }}>
            <Input
              value={name}
              onChangeText={setName}
              placeholder="הכנס שם קבוצה"
              style={{ 
                backgroundColor: CASINO_COLORS.primary,
                borderColor: CASINO_COLORS.gold,
                height: 48
              }}
              inputStyle={{ 
                color: CASINO_COLORS.gold,
                fontSize: 16,
                textAlign: 'right',
                paddingRight: 12
              }}
            />
          </View>
        </View>

        {/* הגדרות Buy-in ו-Rebuy */}
        <View style={{ gap: 24 }}>
          {/* Buy-in */}
          <View>
            <Text variant="h4" style={{ 
              color: CASINO_COLORS.gold,
              marginBottom: 12,
              textAlign: 'right'
            }}>
              Buy-in
            </Text>
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
                <Text style={{ 
                  color: CASINO_COLORS.text,
                  width: 120,
                  textAlign: 'right'
                }}>
                  כמות צ'יפים:
                </Text>
                <View style={{ flex: 1 }}>
                  <Input
                    value={buyInChips}
                    onChangeText={setBuyInChips}
                    keyboardType="numeric"
                    style={{ 
                      backgroundColor: CASINO_COLORS.primary,
                      borderColor: CASINO_COLORS.gold,
                      height: 48,
                      maxWidth: 120
                    }}
                    inputStyle={{ 
                      color: CASINO_COLORS.gold,
                      fontSize: 16,
                      textAlign: 'left',
                      paddingRight: 12
                    }}
                  />
                </View>
              </View>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
                <Text style={{ 
                  color: CASINO_COLORS.text,
                  width: 120,
                  textAlign: 'right'
                }}>
                  סכום בש"ח:
                </Text>
                <View style={{ flex: 1 }}>
                  <Input
                    value={buyInAmount}
                    onChangeText={setBuyInAmount}
                    keyboardType="numeric"
                    style={{ 
                      backgroundColor: CASINO_COLORS.primary,
                      borderColor: CASINO_COLORS.gold,
                      height: 48,
                      maxWidth: 120
                    }}
                    inputStyle={{ 
                      color: CASINO_COLORS.gold,
                      fontSize: 16,
                      textAlign: 'left',
                      paddingRight: 12
                    }}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Rebuy */}
          <View>
            <Text variant="h4" style={{ 
              color: CASINO_COLORS.gold,
              marginBottom: 12,
              textAlign: 'right'
            }}>
              Rebuy
            </Text>
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
                <Text style={{ 
                  color: CASINO_COLORS.text,
                  width: 120,
                  textAlign: 'right'
                }}>
                  כמות צ'יפים:
                </Text>
                <View style={{ flex: 1 }}>
                  <Input
                    value={rebuyChips}
                    onChangeText={setRebuyChips}
                    keyboardType="numeric"
                    style={{ 
                      backgroundColor: CASINO_COLORS.primary,
                      borderColor: CASINO_COLORS.gold,
                      height: 48,
                      maxWidth: 120
                    }}
                    inputStyle={{ 
                      color: CASINO_COLORS.gold,
                      fontSize: 16,
                      textAlign: 'left',
                      paddingRight: 12
                    }}
                  />
                </View>
              </View>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
                <Text style={{ 
                  color: CASINO_COLORS.text,
                  width: 120,
                  textAlign: 'right'
                }}>
                  סכום בש"ח:
                </Text>
                <View style={{ flex: 1 }}>
                  <Input
                    value={rebuyAmount}
                    onChangeText={setRebuyAmount}
                    keyboardType="numeric"
                    style={{ 
                      backgroundColor: CASINO_COLORS.primary,
                      borderColor: CASINO_COLORS.gold,
                      height: 48,
                      maxWidth: 120
                    }}
                    inputStyle={{ 
                      color: CASINO_COLORS.gold,
                      fontSize: 16,
                      textAlign: 'left',
                      paddingRight: 12
                    }}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Rounding Rule */}
          <View style={{ gap: 12 }}>
            <Text variant="h4" style={{ 
              color: CASINO_COLORS.gold,
              marginBottom: 12,
              textAlign: 'right'
            }}>
              חוק האחוזים
            </Text>
            <View style={{ 
              flexDirection: 'row-reverse',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <Switch
                value={useRoundingRule}
                onValueChange={setUseRoundingRule}
              />
              <View style={{ 
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 8,
                opacity: useRoundingRule ? 1 : 0.5
              }}>
                <Input
                  value={roundingRulePercentage}
                  onChangeText={setRoundingRulePercentage}
                  keyboardType="numeric"
                  editable={useRoundingRule}
                  style={{ 
                    width: 60,
                    backgroundColor: CASINO_COLORS.primary,
                    borderColor: CASINO_COLORS.gold,
                    height: 40,
                  }}
                  inputStyle={{ 
                    color: CASINO_COLORS.gold,
                    fontSize: 14,
                    textAlign: 'center',
                    paddingVertical: 0
                  }}
                />
                <Text style={{ 
                  color: CASINO_COLORS.text,
                  fontSize: 14
                }}>
                  %
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

export default DetailsTab;
