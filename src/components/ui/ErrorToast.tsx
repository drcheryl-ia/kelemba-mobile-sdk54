import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ErrorToastProps {
  message: string;
  severity?: 'error' | 'warning' | 'info';
  visible: boolean;
  onHide?: () => void;
  duration?: number;
}

const SEVERITY_STYLES = {
  error: {
    bg: '#D0021B',
    icon: 'alert-circle' as const,
  },
  warning: {
    bg: '#F5A623',
    icon: 'warning' as const,
  },
  info: {
    bg: '#0055A5',
    icon: 'information-circle' as const,
  },
};

export const ErrorToast: React.FC<ErrorToastProps> = ({
  message,
  severity = 'error',
  visible,
  onHide,
  duration = 4000,
}) => {
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(duration),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onHide?.());
  }, [visible, duration, opacity, onHide]);

  if (!visible) return null;

  const s = SEVERITY_STYLES[severity];
  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: s.bg, opacity },
      ]}
    >
      <Ionicons name={s.icon} size={20} color="#FFFFFF" />
      <Text style={styles.message} numberOfLines={2}>
        {message}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  message: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },
});
