import React, { useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { COLORS } from '@/theme/colors';

const TRACK_W = 40;
const TRACK_H = 22;
const THUMB = 18;
const PADDING = 2;
const TRAVEL = TRACK_W - PADDING * 2 - THUMB;

export interface FormToggleRowProps<T extends FieldValues = FieldValues> {
  name: Path<T>;
  control: Control<T>;
  label: string;
  sublabel?: string;
}

function ToggleTrack({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [value, anim]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, TRAVEL],
  });

  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <View
        style={[
          styles.track,
          { backgroundColor: value ? COLORS.primary : COLORS.gray200 },
        ]}
      >
        <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]} />
      </View>
    </Pressable>
  );
}

export function FormToggleRow<T extends FieldValues = FieldValues>({
  name,
  control,
  label,
  sublabel,
}: FormToggleRowProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value } }) => {
        const bool = Boolean(value);
        return (
          <View style={styles.row}>
            <View style={styles.textCol}>
              <Text style={styles.label}>{label}</Text>
              {sublabel != null && sublabel !== '' ? (
                <Text style={styles.sublabel}>{sublabel}</Text>
              ) : null}
            </View>
            <ToggleTrack value={bool} onChange={onChange} />
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  textCol: {
    flex: 1,
    marginRight: 12,
  },
  label: {
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  sublabel: {
    fontSize: 11,
    color: COLORS.gray500,
    marginTop: 1,
  },
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: 11,
    padding: PADDING,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 9,
    backgroundColor: COLORS.white,
  },
});
