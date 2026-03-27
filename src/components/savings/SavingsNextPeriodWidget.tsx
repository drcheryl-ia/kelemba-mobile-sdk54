/**
 * Rappel prochaine période OPEN — épargne (dashboard).
 */
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useSavingsPeriods } from '@/hooks/useSavings';
import { formatFcfa } from '@/utils/formatters';

export interface SavingsNextPeriodWidgetProps {
  /** UID de la tontine épargne */
  uid: string;
}

export const SavingsNextPeriodWidget: React.FC<SavingsNextPeriodWidgetProps> = ({
  uid,
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data: periodsRaw, isLoading } = useSavingsPeriods(uid);
  const periods = Array.isArray(periodsRaw) ? periodsRaw : [];

  const openPeriod = useMemo(
    () => periods.find((p) => p.status === 'OPEN') ?? null,
    [periods]
  );

  if (!uid || isLoading || openPeriod == null) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>
        Période ouverte · minimum {formatFcfa(openPeriod.minimumAmount)}
      </Text>
      <Pressable
        style={styles.btn}
        onPress={() =>
          navigation.navigate('SavingsContributeScreen', {
            uid,
            periodUid: openPeriod.uid,
            minimumAmount: openPeriod.minimumAmount,
          })
        }
        accessibilityRole="button"
        accessibilityLabel="Verser pour cette période"
      >
        <Text style={styles.btnText}>Verser</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  text: { flex: 1, fontSize: 14, color: '#166534', fontWeight: '600' },
  btn: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#1A6B3C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
