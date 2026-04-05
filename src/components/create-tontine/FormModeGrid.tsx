import React from 'react';
import { View, Text, Pressable, StyleSheet, type DimensionValue } from 'react-native';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { COLORS } from '@/theme/colors';

export interface FormModeGridProps<T extends FieldValues = FieldValues> {
  name: Path<T>;
  control: Control<T>;
  options: Array<{ value: string; label: string; icon: React.ReactNode }>;
}

export function FormModeGrid<T extends FieldValues = FieldValues>({
  name,
  control,
  options,
}: FormModeGridProps<T>) {
  const cellWidth: DimensionValue = '32%';

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
                    styles.cell,
                    { width: cellWidth },
                    selected ? styles.cellOn : styles.cellOff,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  {opt.icon}
                  <Text
                    style={[styles.cellTxt, selected ? styles.cellTxtOn : styles.cellTxtOff]}
                    numberOfLines={3}
                  >
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
    justifyContent: 'space-between',
  },
  cell: {
    minHeight: 48,
    borderRadius: 9,
    paddingVertical: 9,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 4,
    borderWidth: 0.5,
    justifyContent: 'center',
  },
  cellOn: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  cellOff: {
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.gray200,
  },
  cellTxt: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  cellTxtOn: {
    color: COLORS.primaryDark,
  },
  cellTxtOff: {
    color: COLORS.gray700,
  },
  err: {
    fontSize: 10,
    color: COLORS.dangerText,
    marginTop: 6,
  },
});
