import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SCORE_REASON_LABEL } from '@/utils/scoreUtils';
import type { ScoreEventDto } from '@/types/user.types';
import type { ScoreEventReason } from '@/api/types/api.types';

export interface ScoreEventItemProps {
  event: ScoreEventDto;
}

export const ScoreEventItem: React.FC<ScoreEventItemProps> = ({ event }) => {
  const isPositive = event.delta > 0;
  const label =
    SCORE_REASON_LABEL[event.reason as ScoreEventReason] ?? event.reason;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: isPositive ? '#E8F5E9' : '#FFEBEE' },
        ]}
      >
        <Ionicons
          name={isPositive ? 'add-circle' : 'remove-circle'}
          size={24}
          color={isPositive ? '#1A6B3C' : '#D0021B'}
        />
      </View>
      <View style={styles.content}>
        <Text style={styles.reason}>{label}</Text>
        {event.tontineUid && (
          <Text style={styles.tontine}>Tontine associée</Text>
        )}
        <Text style={styles.date}>
          {new Date(event.createdAt).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </Text>
      </View>
      <Text
        style={[
          styles.delta,
          { color: isPositive ? '#1A6B3C' : '#D0021B' },
        ]}
      >
        {isPositive ? `+${event.delta}` : event.delta}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  reason: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  tontine: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  date: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  delta: {
    fontSize: 16,
    fontWeight: '700',
  },
});
