import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
} from 'react-native';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { COLORS } from '@/theme/colors';

export interface FormSliderFieldProps<T extends FieldValues = FieldValues> {
  name: Path<T>;
  control: Control<T>;
  label: string;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  valueColor?: string;
  warningThreshold?: number;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function parseSliderValue(value: unknown, min: number, max: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clamp(value, min, max);
  }
  if (typeof value === 'string' && value !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return clamp(n, min, max);
  }
  return min;
}

function SliderFallbackBody({
  label,
  min,
  max,
  step,
  suffix,
  valueColor,
  warningThreshold,
  value,
  onChange,
  errorMessage,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  valueColor?: string;
  warningThreshold?: number;
  value: unknown;
  onChange: (v: number) => void;
  errorMessage?: string;
}) {
  const num = useMemo(
    () => parseSliderValue(value, min, max),
    [value, min, max]
  );
  const pct = useMemo(() => {
    if (max <= min) return 0;
    return ((num - min) / (max - min)) * 100;
  }, [num, min, max]);

  const displayColor = useMemo(() => {
    if (warningThreshold != null && num > warningThreshold) return COLORS.dangerText;
    return valueColor ?? COLORS.primary;
  }, [num, warningThreshold, valueColor]);

  const onChangeText = useCallback(
    (text: string) => {
      const raw = text.replace(/[^\d.-]/g, '');
      if (raw === '' || raw === '-') {
        onChange(min);
        return;
      }
      const parsed = Math.round(Number(raw));
      if (Number.isNaN(parsed)) return;
      const stepped = step > 1 ? Math.round(parsed / step) * step : parsed;
      onChange(clamp(stepped, min, max));
    },
    [min, max, step, onChange]
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Text style={styles.bound}>{min}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, pct))}%` }]} />
        </View>
        <Text style={styles.bound}>{max}</Text>
      </View>
      <TextInput
        style={[styles.valueCenter, { color: displayColor }]}
        value={String(Math.round(num))}
        onChangeText={onChangeText}
        keyboardType="number-pad"
        accessibilityLabel={label}
      />
      {suffix != null && suffix !== '' ? (
        <Text style={styles.suffixHint}>{suffix}</Text>
      ) : null}
      {errorMessage != null && errorMessage !== '' ? (
        <Text style={styles.err}>{errorMessage}</Text>
      ) : null}
    </View>
  );
}

export function FormSliderField<T extends FieldValues = FieldValues>({
  name,
  control,
  label,
  min,
  max,
  step = 1,
  suffix,
  valueColor,
  warningThreshold,
}: FormSliderFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <SliderFallbackBody
          label={label}
          min={min}
          max={max}
          step={step}
          suffix={suffix}
          valueColor={valueColor}
          warningThreshold={warningThreshold}
          value={value}
          onChange={onChange}
          errorMessage={error?.message}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.gray500,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bound: {
    fontSize: 11,
    color: COLORS.gray500,
    minWidth: 28,
    textAlign: 'center',
  },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primaryLight,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  valueCenter: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 8,
    paddingVertical: 4,
  },
  suffixHint: {
    fontSize: 10,
    color: COLORS.gray500,
    textAlign: 'center',
    marginTop: 2,
  },
  err: {
    fontSize: 10,
    color: COLORS.dangerText,
    marginTop: 4,
  },
});
