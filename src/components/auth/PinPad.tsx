import React from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PADDING = 48;
const GAP = 8;
const KEY_WIDTH = (SCREEN_WIDTH - PADDING - 2 * GAP) / 3;

export interface PinPadProps {
  value: string;
  onChange: (value: string) => void;
  /** Appelé quand le PIN est complet, avec la valeur finale */
  onComplete: (value: string) => void;
  /** Nombre de chiffres attendus (défaut 4, ex. 6 pour PIN paiement) */
  digitLength?: number;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'backspace'];

export const PinPad: React.FC<PinPadProps> = ({
  value,
  onChange,
  onComplete,
  digitLength = 4,
}) => {
  const handlePress = (key: string) => {
    if (key === 'backspace') {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === '') return;
    const newValue = value + key;
    if (newValue.length <= digitLength) {
      onChange(newValue);
      if (newValue.length === digitLength) {
        onComplete(newValue);
      }
    }
  };

  const dots = Array.from({ length: digitLength }, (_, i) => i);

  return (
    <View style={styles.container}>
      <View style={styles.dotsRow}>
        {dots.map((idx) => (
          <View
            key={idx}
            style={[
              styles.dot,
              value.length > idx ? styles.dotFilled : styles.dotEmpty,
            ]}
          />
        ))}
      </View>
      <View style={styles.keypad}>
        {KEYS.map((key, index) => (
          <Pressable
            key={index}
            style={({ pressed }) => [
              styles.key,
              pressed && styles.keyPressed,
            ]}
            onPress={() => handlePress(key)}
            android_ripple={{ color: 'rgba(0,0,0,0.1)' }}
          >
            {key === 'backspace' ? (
              <Ionicons name="backspace-outline" size={24} color="#1C1C1E" />
            ) : key !== '' ? (
              <Text style={styles.keyText}>{key}</Text>
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: 16,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  dotFilled: {
    backgroundColor: '#1C1C1E',
  },
  dotEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    justifyContent: 'center',
    width: SCREEN_WIDTH - PADDING,
  },
  key: {
    width: KEY_WIDTH,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: {
    opacity: 0.8,
  },
  keyText: {
    fontSize: 28,
    fontWeight: '500',
    color: '#1C1C1E',
  },
});
