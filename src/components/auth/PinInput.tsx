import React, { useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Animated,
  Platform,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';

export interface PinInputProps {
  length?: number;
  /** true = point masqué dans la case ; false = chiffre visible (OTP) */
  masked?: boolean;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  /** Case active (index 0..length-1) = valeur.length */
  error?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const BOX = 48;
const GAP = 10;

export const PinInput: React.FC<PinInputProps> = ({
  length = 6,
  masked = true,
  value,
  onChange,
  onComplete,
  error = false,
  accessibilityLabel = 'Code à 6 chiffres',
  accessibilityHint,
}) => {
  const inputRef = useRef<TextInput>(null);
  const cellScales = useRef(
    Array.from({ length: 6 }, () => new Animated.Value(1))
  ).current;

  const activeIndex = Math.min(value.length, length - 1);

  useEffect(() => {
    cellScales.forEach((anim, i) => {
      const target = !error && i === activeIndex ? 1.05 : 1;
      Animated.spring(anim, {
        toValue: target,
        useNativeDriver: true,
        speed: 50,
        bounciness: 8,
      }).start();
    });
  }, [activeIndex, error, cellScales]);

  const handleChange = useCallback(
    (text: string) => {
      const cleaned = text.replace(/\D/g, '').slice(0, length);
      onChange(cleaned);
      if (cleaned.length === length) {
        onComplete?.(cleaned);
      }
    },
    [length, onChange, onComplete]
  );

  const handleKeyPress = useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (e.nativeEvent.key === 'Backspace' && value.length > 0) {
        onChange(value.slice(0, -1));
      }
    },
    [onChange, value]
  );

  const focusHidden = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <View
      style={styles.wrap}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
    >
      <View style={styles.row}>
        {Array.from({ length }).map((_, i) => {
          const filled = i < value.length;
          const isActive = !error && value.length === i;
          const digit = value[i] ?? '';
          return (
            <Animated.View
              key={i}
              style={{ transform: [{ scale: cellScales[i] ?? 1 }] }}
            >
              <Pressable
                onPress={focusHidden}
                style={[
                  styles.cell,
                  filled && styles.cellFilled,
                  isActive && styles.cellActive,
                  error && styles.cellError,
                ]}
              >
                {filled ? (
                  masked ? (
                    <View style={styles.dot} />
                  ) : (
                    <Text style={styles.digitText}>{digit}</Text>
                  )
                ) : null}
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        onKeyPress={handleKeyPress}
        keyboardType="number-pad"
        maxLength={length}
        secureTextEntry={false}
        importantForAutofill="no"
        autoComplete="off"
        textContentType="oneTimeCode"
        style={styles.hidden}
        caretHidden
      />
    </View>
  );
};

const hiddenDims =
  Platform.OS === 'android'
    ? { width: 1, height: 1 }
    : { width: 0, height: 0 };

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: GAP,
  },
  cell: {
    width: BOX,
    height: BOX,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
    borderWidth: 0.5,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellActive: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  cellFilled: {
    backgroundColor: '#1A6B3C1A',
    borderColor: COLORS.primary,
    borderWidth: 0.5,
  },
  cellError: {
    borderColor: COLORS.danger,
    borderWidth: 1.5,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  digitText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.white,
  },
  hidden: {
    opacity: 0,
    position: 'absolute',
    ...hiddenDims,
    left: 0,
    top: 0,
  },
});
