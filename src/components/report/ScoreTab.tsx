import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';
import { computeDailyScores } from '@/utils/reportScoreChart';
import type { ScoreEventDisplay } from '@/types/report.types';
import type { ScoreLabel } from '@/api/types/api.types';

export interface ScoreTabProps {
  score: number;
  scoreLabel: ScoreLabel | string;
  history: ScoreEventDisplay[];
  stats: {
    totalEvents: number;
    positiveEvents: number;
    negativeEvents: number;
    netDelta: number;
  };
  isLoading: boolean;
}

const LEVEL_LINES: { label: ScoreLabel; text: string }[] = [
  { label: 'EXCELLENT', text: 'Excellent 800+' },
  { label: 'BON', text: 'BON 600–799' },
  { label: 'MOYEN', text: 'Moyen 400–599' },
  { label: 'FAIBLE', text: 'Faible <400' },
];

function levelBorderColor(lab: ScoreLabel | string): string {
  if (lab === 'EXCELLENT') return COLORS.primary;
  if (lab === 'BON') return COLORS.secondary;
  if (lab === 'MOYEN') return COLORS.secondary;
  if (lab === 'FAIBLE' || lab === 'CRITIQUE') return COLORS.danger;
  return COLORS.gray200;
}

export const ScoreTab: React.FC<ScoreTabProps> = ({
  score,
  scoreLabel,
  history,
  stats,
  isLoading,
}) => {
  const daily = useMemo(
    () => computeDailyScores(history, score),
    [history, score]
  );

  const netFmt = useMemo(() => {
    const d = stats.netDelta;
    if (d > 0) return `+${Math.round(d)} pts`;
    if (d < 0) return `−${Math.round(Math.abs(d))} pts`;
    return '0 pts';
  }, [stats.netDelta]);

  const recent = useMemo(() => history.slice(0, 8), [history]);

  const df = useMemo(
    () =>
      new Intl.DateTimeFormat('fr-FR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
    []
  );

  if (isLoading) {
    return (
      <View style={styles.loadingBox}>
        <Text style={styles.loadingText}>Chargement du score…</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.headRow}>
          <View>
            <Text style={styles.scoreBig}>
              {Math.round(score)}
              <Text style={styles.scoreDenom}> / 1000</Text>
            </Text>
            <Text
              style={[
                styles.subLine,
                {
                  color:
                    stats.netDelta >= 0 ? COLORS.secondaryText : COLORS.dangerText,
                },
              ]}
            >
              {String(scoreLabel)} · {netFmt}
            </Text>
          </View>
          <View style={styles.levelCol}>
            {LEVEL_LINES.map((line) => {
              const sel = line.label === scoreLabel;
              return (
                <View
                  key={line.text}
                  style={[
                    styles.levelPill,
                    sel && {
                      borderWidth: 1,
                      borderColor: levelBorderColor(scoreLabel),
                    },
                  ]}
                >
                  <Text style={styles.levelTxt}>{line.text}</Text>
                </View>
              );
            })}
          </View>
        </View>
        <View style={styles.chartRow}>
          {daily.map((d, idx) => {
            const hPct = Math.max(
              20,
              Math.min(100, ((d.score - 400) / 600) * 100)
            );
            const barHeight = Math.max(8, Math.round((hPct / 100) * 44));
            const last = idx === daily.length - 1;
            return (
              <View
                key={d.date}
                style={[
                  styles.bar,
                  {
                    height: barHeight,
                    backgroundColor: last ? COLORS.primary : COLORS.primaryLight,
                  },
                ]}
              />
            );
          })}
        </View>
        <View style={styles.chartFoot}>
          <Text style={styles.tiny}>Il y a 14 jours</Text>
          <Text style={styles.tiny}>Aujourd&apos;hui</Text>
        </View>
      </View>

      <View style={[styles.card, { marginTop: 10, padding: 0, overflow: 'hidden' }]}>
        {recent.map((ev, i) => (
          <View key={ev.uid}>
            {i > 0 ? <View style={styles.evSep} /> : null}
            <View style={styles.evRow}>
              <View style={[styles.dot, { backgroundColor: ev.dotColor }]} />
              <View style={styles.evMid}>
                <Text numberOfLines={1} style={styles.evTitle}>
                  {ev.reasonLabel}
                </Text>
                <Text style={styles.evDate}>{df.format(new Date(ev.createdAt))}</Text>
              </View>
              <Text
                style={[
                  styles.evDelta,
                  {
                    color:
                      ev.delta > 0
                        ? COLORS.primaryDark
                        : ev.delta < 0
                          ? COLORS.dangerText
                          : COLORS.gray500,
                  },
                ]}
              >
                {ev.delta > 0 ? '+' : ''}
                {ev.delta}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingTop: 8, paddingBottom: 24 },
  loadingBox: { padding: 48 },
  loadingText: { textAlign: 'center', color: COLORS.gray500 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    marginHorizontal: 16,
    padding: 14,
  },
  headRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  scoreBig: { fontSize: 24, fontWeight: '500', color: COLORS.primary },
  scoreDenom: { fontSize: 13, color: COLORS.gray500, fontWeight: '400' },
  subLine: { fontSize: 11, fontWeight: '500', marginTop: 4 },
  levelCol: { alignItems: 'flex-end', gap: 3 },
  levelPill: {
    borderRadius: RADIUS.pill,
    paddingVertical: 1,
    paddingHorizontal: 6,
  },
  levelTxt: { fontSize: 9, color: COLORS.gray700 },
  chartRow: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    gap: 2,
    paddingBottom: 4,
  },
  bar: {
    flex: 1,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    minHeight: 8,
    alignSelf: 'flex-end',
  },
  chartFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  tiny: { fontSize: 9, color: COLORS.gray500 },
  evSep: { height: 0.5, backgroundColor: COLORS.gray100 },
  evRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  evMid: { flex: 1, minWidth: 0 },
  evTitle: { fontSize: 12, color: COLORS.textPrimary },
  evDate: { fontSize: 10, color: COLORS.gray500, marginTop: 2 },
  evDelta: { fontSize: 12, fontWeight: '500' },
});
