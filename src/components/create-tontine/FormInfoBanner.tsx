import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';

export interface FormInfoBannerProps {
  message: string;
}

export const FormInfoBanner: React.FC<FormInfoBannerProps> = ({ message }) => {
  return (
    <View style={styles.info}>
      <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={10} stroke={COLORS.primaryDark} strokeWidth={2} />
        <Path
          d="M12 16v-4M12 8h.01"
          stroke={COLORS.primaryDark}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </Svg>
      <Text style={styles.infoTxt}>{message}</Text>
    </View>
  );
};

export interface FormWarnBannerProps {
  message: string;
}

export const FormWarnBanner: React.FC<FormWarnBannerProps> = ({ message }) => {
  return (
    <View style={styles.warn}>
      <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
          stroke={COLORS.secondaryText}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <Text style={styles.warnTxt}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  info: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  infoTxt: {
    flex: 1,
    fontSize: 11,
    color: COLORS.primaryDark,
    lineHeight: 15,
  },
  warn: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: COLORS.secondaryBg,
    borderRadius: RADIUS.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  warnTxt: {
    flex: 1,
    fontSize: 11,
    color: COLORS.secondaryText,
    lineHeight: 15,
  },
});
