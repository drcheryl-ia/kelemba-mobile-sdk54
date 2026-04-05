import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  type KeyboardTypeOptions,
} from 'react-native';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { COLORS } from '@/theme/colors';

export interface FormFieldInputProps<T extends FieldValues = FieldValues> {
  name: Path<T>;
  control: Control<T>;
  label: string;
  placeholder?: string;
  suffix?: string;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  formatValue?: (val: string) => string;
}

function isNumericKeyboard(k: KeyboardTypeOptions): boolean {
  return k === 'number-pad' || k === 'decimal-pad';
}

function FieldBody({
  label,
  placeholder,
  suffix,
  keyboardType,
  maxLength,
  formatValue,
  value,
  onChange,
  onBlur,
  errorMessage,
}: {
  label: string;
  placeholder?: string;
  suffix?: string;
  keyboardType: KeyboardTypeOptions;
  maxLength?: number;
  formatValue?: (val: string) => string;
  value: unknown;
  onChange: (v: string | number | undefined) => void;
  onBlur: () => void;
  errorMessage?: string;
}) {
  const [focused, setFocused] = useState(false);
  const focusedRef = useRef(false);
  const rawStr = value === null || value === undefined ? '' : String(value);
  const useFormat = keyboardType === 'number-pad' && formatValue != null;
  const numericPlain = isNumericKeyboard(keyboardType) && formatValue == null;

  const [displayValue, setDisplayValue] = useState(() =>
    useFormat && formatValue ? formatValue(rawStr.replace(/\D/g, '')) : rawStr
  );

  useEffect(() => {
    if (focusedRef.current) return;
    if (useFormat && formatValue) {
      const digits = rawStr.replace(/\D/g, '');
      setDisplayValue(formatValue(digits));
    } else if (numericPlain) {
      if (value === null || value === undefined) {
        setDisplayValue('');
      } else {
        setDisplayValue(String(value));
      }
    } else {
      setDisplayValue(rawStr);
    }
  }, [rawStr, value, useFormat, formatValue, numericPlain]);

  const handleChangeText = useCallback(
    (text: string) => {
      if (useFormat && formatValue) {
        const raw = text.replace(/\D/g, '');
        onChange(raw === '' ? '' : raw);
        setDisplayValue(formatValue(raw));
        return;
      }
      if (numericPlain) {
        const raw = text.replace(/[^0-9]/g, '');
        setDisplayValue(raw);
        if (raw === '') {
          onChange(undefined);
        } else {
          onChange(Number(raw));
        }
        return;
      }
      onChange(text);
      setDisplayValue(text);
    },
    [onChange, useFormat, formatValue, numericPlain]
  );

  const showText = useFormat ? displayValue : numericPlain ? displayValue : rawStr;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.fieldWrap, focused && styles.fieldWrapFocused]}>
        <TextInput
          style={styles.input}
          value={showText}
          onChangeText={handleChangeText}
          onBlur={() => {
            setFocused(false);
            focusedRef.current = false;
            onBlur();
          }}
          onFocus={() => {
            setFocused(true);
            focusedRef.current = true;
          }}
          placeholder={placeholder}
          placeholderTextColor={COLORS.gray500}
          keyboardType={keyboardType}
          maxLength={maxLength}
          editable
          accessibilityLabel={label}
        />
        {suffix != null && suffix !== '' ? (
          <Text style={styles.suffix}>{suffix}</Text>
        ) : null}
      </View>
      {errorMessage != null && errorMessage !== '' ? (
        <Text style={styles.err}>{errorMessage}</Text>
      ) : null}
    </View>
  );
}

export function FormFieldInput<T extends FieldValues = FieldValues>({
  name,
  control,
  label,
  placeholder,
  suffix,
  keyboardType = 'default',
  maxLength,
  formatValue,
}: FormFieldInputProps<T>) {
  return (
    <Controller
      key={String(name)}
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
        <FieldBody
          label={label}
          placeholder={placeholder}
          suffix={suffix}
          keyboardType={keyboardType}
          maxLength={maxLength}
          formatValue={formatValue}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          errorMessage={error?.message}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.gray500,
    marginBottom: 5,
  },
  fieldWrap: {
    backgroundColor: COLORS.gray100,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldWrapFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textPrimary,
    padding: 0,
  },
  suffix: {
    fontSize: 11,
    color: COLORS.gray500,
    marginLeft: 6,
  },
  err: {
    fontSize: 10,
    color: COLORS.dangerText,
    marginTop: 4,
  },
});
