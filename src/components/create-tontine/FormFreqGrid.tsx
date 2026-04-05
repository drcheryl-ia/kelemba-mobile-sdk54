import React from 'react';
import { View, Text, Pressable, StyleSheet, type DimensionValue } from 'react-native';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { COLORS } from '@/theme/colors';

export interface FormFreqGridProps<T extends FieldValues = FieldValues> {
  name: Path<T>;
  control: Control<T>;
  options: Array<{ value: string; label: string }>;
  columns?: 2 | 3;
}

export function FormFreqGrid<T extends FieldValues = FieldValues>({
  name,
  control,
  options,
  columns = 2,
}: FormFreqGridProps<T>) {
  const cellWidth: DimensionValue = columns === 2 ? '48%' : '31%';

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <View style={styles.wrap}>
          <View style={styles.grid}>
            {options.map((opt) => {
              const selected = value === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => onChange(opt.value)}
                  style={[
                    styles.btn,
                    { width: cellWidth },
                    selected ? styles.btnOn : styles.btnOff,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.btnTxt, selected ? styles.btnTxtOn : styles.btnTxtOff]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {error?.message != null ? (
            <Text style={styles.err}>{error.message}</Text>
          ) : null}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 4 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  btn: {
    minHeight: 48,
    borderRadius: 9,
    paddingVertical: 9,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
  },
  btnOn: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  btnOff: {
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.gray200,
  },
  btnTxt: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  btnTxtOn: {
    color: COLORS.primaryDark,
  },
  btnTxtOff: {
    color: COLORS.gray700,
  },
  err: {
    fontSize: 10,
    color: COLORS.dangerText,
    marginTop: 6,
  },
});
