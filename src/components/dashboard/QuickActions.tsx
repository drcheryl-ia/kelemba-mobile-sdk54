import React, { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '@/navigation/types';
import { navigationRef } from '@/navigation/navigationRef';
import { useNextPayment } from '@/hooks/useNextPayment';
import { KelembaSectionHeader } from '@/components/common/KelembaSectionHeader';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';

export interface QuickActionsProps {
  /** Si défini, utilisé à la place du hook interne (tests). */
  hasNextPayment?: boolean;
}

type ActionDef = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  onPress: () => void;
};

export const QuickActions: React.FC<QuickActionsProps> = ({
  hasNextPayment: hasNextPaymentProp,
}) => {
  const navigation =
    useNavigation<BottomTabNavigationProp<MainTabParamList, 'Dashboard'>>();
  const { nextPayment } = useNextPayment();
  const hasNext = hasNextPaymentProp ?? nextPayment != null;
  const { width: screenW } = useWindowDimensions();
  const contentW = screenW - 32;
  const gap = 10;
  const columns = screenW >= 380 ? 4 : 2;
  const cellW = (contentW - gap * (columns - 1)) / columns;

  const actions = useMemo<ActionDef[]>(
    () => [
      {
        id: 'new',
        label: 'Nouvelle tontine',
        icon: 'add',
        iconBg: '#1A6B3C15',
        iconColor: COLORS.primaryDark,
        onPress: () => {
          if (navigationRef.isReady()) {
            navigationRef.navigate('TontineTypeSelectionScreen');
          }
        },
      },
      {
        id: 'pay',
        label: 'Payer',
        icon: 'card-outline',
        iconBg: '#F5A62315',
        iconColor: COLORS.secondaryText,
        onPress: () => {
          if (hasNext) {
            const p = nextPayment;
            if (p?.cycleUid && p.tontineUid && navigationRef.isReady()) {
              navigationRef.navigate('PaymentScreen', {
                cycleUid: p.cycleUid,
                tontineUid: p.tontineUid,
                tontineName: p.tontineName,
                baseAmount: p.amountDue,
                penaltyAmount: p.penaltyAmount,
                cycleNumber: p.cycleNumber,
              });
              return;
            }
          }
          navigation.navigate('Tontines');
        },
      },
      {
        id: 'invite',
        label: 'Inviter',
        icon: 'people-outline',
        iconBg: '#0055A515',
        iconColor: COLORS.accentDark,
        onPress: () => {
          navigation.navigate('Tontines');
        },
      },
      {
        id: 'reports',
        label: 'Rapports',
        icon: 'document-text-outline',
        iconBg: '#66666615',
        iconColor: COLORS.gray700,
        onPress: () => {
          navigation.navigate('Payments');
        },
      },
    ],
    [navigation, hasNext, nextPayment]
  );

  return (
    <View>
      <KelembaSectionHeader title="Actions rapides" />
      <View style={styles.grid}>
        {actions.map((a) => (
          <Pressable
            key={a.id}
            onPress={a.onPress}
            style={({ pressed }) => [
              styles.cell,
              {
                width: cellW,
                opacity: pressed ? 0.75 : 1,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={a.label}
          >
            <View style={{ width: '100%', alignItems: 'center', gap: 5 }}>
              <View style={[styles.iconBox, { backgroundColor: a.iconBg }]}>
                <Ionicons
                  name={a.icon}
                  size={18}
                  color={a.iconColor}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
              </View>
              <Text style={styles.label}>{a.label}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  cell: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    color: COLORS.gray700,
    textAlign: 'center',
    lineHeight: 14,
  },
});
