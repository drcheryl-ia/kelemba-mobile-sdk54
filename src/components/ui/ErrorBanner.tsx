import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ErrorBannerProps {
  message: string;
  severity?: 'error' | 'warning' | 'info';
  onDismiss?: () => void;
}

const SEVERITY_STYLES = {
  error: {
    bg: '#FEE2E2',
    border: '#D0021B',
    icon: 'alert-circle' as const,
    color: '#D0021B',
  },
  warning: {
    bg: '#FEF3C7',
    border: '#F5A623',
    icon: 'warning' as const,
    color: '#B45309',
  },
  info: {
    bg: '#E0F2FE',
    border: '#0055A5',
    icon: 'information-circle' as const,
    color: '#0055A5',
  },
};

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  message,
  severity = 'error',
  onDismiss,
}) => {
  const s = SEVERITY_STYLES[severity];
  return (
    <View
      style={[styles.container, { backgroundColor: s.bg, borderColor: s.border }]}
    >
      <Ionicons name={s.icon} size={18} color={s.color} />
      <Text style={[styles.message, { color: s.color }]}>{message}</Text>
      {onDismiss && (
        <Pressable onPress={onDismiss} hitSlop={8} style={styles.dismiss}>
          <Ionicons name="close" size={16} color={s.color} />
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 8,
    marginBottom: 16,
  },
  message: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  dismiss: {
    padding: 4,
    minHeight: 48,
    justifyContent: 'center',
  },
});
