import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { KelembaBadge } from '@/components/common/KelembaBadge';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';
import { formatFcfa, formatFcfaAmount } from '@/utils/formatters';
import type { TontineReportItem } from '@/types/report.types';

export interface TontinesReportTabProps {
  items: TontineReportItem[];
  isLoading: boolean;
  onTontinePress: (uid: string) => void;
  onCompletedPress?: () => void;
  onExportTontinePdf: (tontineUid: string) => void;
}

function TontineReportCard({
  t,
  onDetail,
  onPdf,
}: {
  t: TontineReportItem;
  onDetail: () => void;
  onPdf: () => void;
}) {
  const isActive = t.status === 'ACTIVE';
  const pct =
    t.cyclesTotal > 0 ? Math.round((t.cyclesCurrent / t.cyclesTotal) * 100) : 0;
  const badgeVariant = t.status === 'ACTIVE' ? 'active' : 'completed';
  const badgeLabel =
    t.status === 'ACTIVE' ? 'En cours' : t.status === 'COMPLETED' ? 'Terminée' : t.status;

  return (
    <View style={styles.card}>
      <View style={styles.cardMain}>
        <View style={styles.cardTop}>
          <View style={styles.flex1}>
            <Text style={styles.tName}>{t.tontineName}</Text>
            <Text style={styles.tSub}>
              {t.isCreator ? 'Créatrice' : 'Membre'} · {t.memberCount} membres · {t.frequency}
            </Text>
          </View>
          <KelembaBadge variant={badgeVariant} label={badgeLabel} size="sm" />
        </View>
        <View style={styles.metricsGrid}>
          <View style={styles.mCell}>
            <Text style={styles.mVal}>{formatFcfaAmount(t.totalPaidByUser)}</Text>
            <Text style={styles.mUnit}>FCFA</Text>
            <Text style={styles.mLbl}>Versé total</Text>
          </View>
          <View style={[styles.mSep, styles.mCell]}>
            <Text style={styles.mValMid}>
              {t.cyclesCurrent}/{t.cyclesTotal}
            </Text>
            <Text style={styles.mLbl}>Cycles</Text>
          </View>
          <View style={styles.mCell}>
            {isActive ? (
              <>
                <Text
                  style={[
                    styles.mValMid,
                    { color: t.myPayoutCycleNumber != null ? COLORS.secondaryText : COLORS.gray500 },
                  ]}
                >
                  {t.myPayoutCycleNumber != null ? `C${t.myPayoutCycleNumber}` : '—'}
                </Text>
                <Text style={styles.mLbl}>Mon tour</Text>
              </>
            ) : (
              <>
                <Text style={[styles.mValMid, { color: COLORS.primary }]}>
                  {Math.round(t.punctualityRate)}%
                </Text>
                <Text style={styles.mLbl}>Ponctualité</Text>
              </>
            )}
          </View>
        </View>
        {isActive ? (
          <>
            <View style={styles.progTrack}>
              <View style={[styles.progFill, { width: `${Math.min(100, pct)}%` }]} />
            </View>
            <View style={styles.progRow}>
              <Text style={styles.smallMuted}>Progression {pct} %</Text>
              {t.penaltiesCount > 0 ? (
                <Text style={styles.smallDanger}>
                  {t.penaltiesCount} retard{t.penaltiesCount > 1 ? 's' : ''} · −
                  {t.penaltiesCount * 10} pts score
                </Text>
              ) : (
                <Text style={styles.smallMuted}> </Text>
              )}
            </View>
          </>
        ) : null}
      </View>
      <View style={styles.strip}>
        <Pressable onPress={onDetail} style={styles.stripBtn} accessibilityRole="button">
          <Text style={styles.stripPrimary}>Rapport détaillé</Text>
        </Pressable>
        <View style={styles.stripSep} />
        <Pressable onPress={onPdf} style={styles.stripBtn} accessibilityRole="button">
          <Text style={styles.stripGray}>Exporter PDF</Text>
        </Pressable>
      </View>
    </View>
  );
}

export const TontinesReportTab: React.FC<TontinesReportTabProps> = ({
  items,
  isLoading,
  onTontinePress,
  onCompletedPress,
  onExportTontinePdf,
}) => {
  const { active, completed, receivedSum } = useMemo(() => {
    const a = items.filter((i) => i.status === 'ACTIVE');
    const c = items.filter((i) => i.status === 'COMPLETED');
    const sum = c.reduce((s, i) => s + i.totalReceivedAsBeneficiary, 0);
    return { active: a, completed: c, receivedSum: sum };
  }, [items]);

  if (isLoading) {
    return (
      <View style={styles.loadingBox}>
        <Text style={styles.loadingText}>Chargement des tontines…</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>Performance par tontine</Text>
      {active.map((t) => (
        <TontineReportCard
          key={t.tontineUid}
          t={t}
          onDetail={() => onTontinePress(t.tontineUid)}
          onPdf={() => onExportTontinePdf(t.tontineUid)}
        />
      ))}
      {completed.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Tontines terminées</Text>
          <Pressable
            onPress={onCompletedPress}
            style={styles.doneCard}
            accessibilityRole="button"
          >
            <View style={styles.doneIcon}>
              <Text style={styles.doneCheck}>✓</Text>
            </View>
            <View style={styles.flex1}>
              <Text style={styles.doneTitle}>
                {completed.length} tontine{completed.length > 1 ? 's' : ''} complétée
                {completed.length > 1 ? 's' : ''} avec succès
              </Text>
              <Text style={styles.doneSub}>Total perçu : {formatFcfa(receivedSum)}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingTop: 8, paddingBottom: 24 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  loadingBox: { padding: 48 },
  loadingText: { textAlign: 'center', color: COLORS.gray500 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
    marginHorizontal: 16,
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardMain: { padding: 14 },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  flex1: { flex: 1, minWidth: 0 },
  tName: { fontSize: 14, fontWeight: '500', color: COLORS.textPrimary },
  tSub: { fontSize: 11, color: COLORS.gray500, marginTop: 2 },
  metricsGrid: {
    flexDirection: 'row',
    borderWidth: 0.5,
    borderColor: COLORS.primaryLight,
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 6,
  },
  mCell: {
    flex: 1,
    backgroundColor: COLORS.gray100,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  mSep: {
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderColor: COLORS.primaryLight,
  },
  mVal: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  mValMid: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  mUnit: { fontSize: 8, color: COLORS.gray500 },
  mLbl: { fontSize: 8, color: COLORS.gray500, marginTop: 2 },
  progTrack: {
    height: 4,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progFill: { height: 4, backgroundColor: COLORS.primary, borderRadius: 2 },
  progRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  smallMuted: { fontSize: 10, color: COLORS.gray500 },
  smallDanger: { fontSize: 10, color: COLORS.dangerText },
  strip: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: COLORS.gray100,
  },
  stripBtn: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  stripPrimary: { fontSize: 10, fontWeight: '500', color: COLORS.primary },
  stripGray: { fontSize: 10, fontWeight: '500', color: COLORS.gray500 },
  stripSep: { width: 0.5, backgroundColor: COLORS.gray100 },
  doneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    padding: 14,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: COLORS.gray200,
  },
  doneIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneCheck: { fontSize: 18, color: COLORS.primary, fontWeight: '700' },
  doneTitle: { fontSize: 13, fontWeight: '500', color: COLORS.textPrimary },
  doneSub: { fontSize: 11, color: COLORS.gray500, marginTop: 2 },
  chevron: { fontSize: 14, color: COLORS.gray500 },
});
