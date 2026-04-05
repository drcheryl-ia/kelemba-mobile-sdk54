import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';

export interface FormSectionCardProps {
  title?: string;
  children: React.ReactNode;
  /** Override fond (ex. encarts récap) */
  backgroundColor?: string;
  borderColor?: string;
}

export const FormSectionCard: React.FC<FormSectionCardProps> = ({
  title,
  children,
  backgroundColor = COLORS.white,
  borderColor = COLORS.gray200,
}) => {
  return (
    <View style={[styles.card, { backgroundColor, borderColor }]}>
      {title != null && title !== '' ? (
        <Text style={styles.title}>{title}</Text>
      ) : null}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    padding: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
});
