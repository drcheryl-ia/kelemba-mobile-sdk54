import React, { useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  Pressable,
  StyleSheet,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';

export interface OtpInputProps {
  value: string;
  onChange: (val: string) => void;
  hasError: boolean;
}

const BOX_SIZE = 48;
const LENGTH = 6;

export const OtpInput: React.FC<OtpInputProps> = ({
  value,
  onChange,
  hasError,
}) => {
  const inputRef = useRef<TextInput>(null);
  const digits = value.split('').concat(Array(LENGTH - value.length).fill(''));

  const handleChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, LENGTH);
    onChange(cleaned);
  };

  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (e.nativeEvent.key === 'Backspace' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const handleBoxPress = () => {
    inputRef.current?.focus();
  };

  return (
    <Pressable onPress={handleBoxPress} style={styles.container}>
      <View style={styles.boxesRow}>
        {Array.from({ length: LENGTH }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.box,
              value.length === i && !hasError && styles.boxActive,
              hasError && styles.boxError,
            ]}
          >
            <Text style={styles.boxText}>
              {digits[i] ? '•' : ''}
            </Text>
          </View>
        ))}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        onKeyPress={handleKeyPress}
        keyboardType="number-pad"
        maxLength={LENGTH}
        style={styles.hiddenInput}
        autoFocus
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 24,
  },
  boxesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  box: {
    width: BOX_SIZE,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: {
    borderColor: '#1A6B3C',
  },
  boxError: {
    borderColor: '#D0021B',
  },
  boxText: {
    fontSize: 24,
    color: '#1C1C1E',
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});
