import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';

export interface DangerZoneProps {
  onLogout: () => void;
}

export const DangerZone: React.FC<DangerZoneProps> = ({ onLogout }) => {
  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() =>
          Alert.alert(
            'Se déconnecter ?',
            'Vous devrez vous reconnecter avec votre code PIN.',
            [
              { text: 'Annuler', style: 'cancel' },
              {
                text: 'Se déconnecter',
                style: 'destructive',
                onPress: onLogout,
              },
            ],
            { cancelable: true }
          )
        }
        style={styles.btn}
        accessibilityRole="button"
        accessibilityLabel="Se déconnecter du compte"
      >
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path
            d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
            stroke={COLORS.dangerText}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        <Text style={styles.txt}>Se déconnecter</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    marginBottom: 8,
  },
  btn: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: COLORS.dangerLight,
    paddingVertical: 13,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  txt: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.dangerText,
    flex: 1,
  },
});
