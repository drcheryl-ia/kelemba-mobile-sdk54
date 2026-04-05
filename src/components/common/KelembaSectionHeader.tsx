import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/theme/colors';

export interface KelembaSectionHeaderProps {
  title: string;
  linkLabel?: string;
  onLinkPress?: () => void;
}

export const KelembaSectionHeader: React.FC<KelembaSectionHeaderProps> = ({
  title,
  linkLabel,
  onLinkPress,
}) => {
  const showLink =
    onLinkPress != null &&
    linkLabel != null &&
    linkLabel.length > 0;

  return (
    <View style={styles.row}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {showLink ? (
        <Pressable
          onPress={onLinkPress}
          accessibilityRole="button"
          accessibilityLabel={linkLabel}
          style={styles.linkRow}
        >
          <Text style={styles.link}>{linkLabel}</Text>
          <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textPrimary,
    flex: 1,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  link: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
});
