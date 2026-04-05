import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Share, Alert } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { ENDPOINTS } from '@/api/endpoints';
import { COLORS } from '@/theme/colors';
import { RADIUS } from '@/theme/spacing';
import { logger } from '@/utils/logger';
import { openAuthenticatedReportUrl } from '@/utils/reportOpenUrl';
import type { ReportMetrics, TontineReportItem } from '@/types/report.types';

export interface ExportsTabProps {
  userUid: string;
  tontines: TontineReportItem[];
  metrics: ReportMetrics;
  punctualityRate: number;
  currentScore: number;
  onExportGlobalPdf: () => void;
}

function handleDownloadCertificate(userUid: string): void {
  void (async () => {
    await openAuthenticatedReportUrl(ENDPOINTS.REPORTS.USER_CERTIFICATE(userUid).url);
  })();
}

function handleExportTontinePdf(tontineUid: string): void {
  void (async () => {
    await openAuthenticatedReportUrl(ENDPOINTS.REPORTS.TONTINE_SUMMARY(tontineUid).url);
  })();
}

function buildCsvFromTontines(items: TontineReportItem[]): string {
  const header = 'tontineUid;tontineName;totalPaidByUser;cycles\n';
  const rows = items
    .map(
      (t) =>
        `${t.tontineUid};${t.tontineName.replace(/;/g, ',')};${t.totalPaidByUser};${t.cyclesCurrent}/${t.cyclesTotal}`
    )
    .join('\n');
  return header + rows;
}

export const ExportsTab: React.FC<ExportsTabProps> = ({
  userUid,
  tontines,
  metrics,
  punctualityRate,
  currentScore,
  onExportGlobalPdf,
}) => {
  const handleExportCSV = useCallback(async () => {
    try {
      const csv = buildCsvFromTontines(tontines);
      await Share.share({
        message: csv,
        title: 'Export Kelemba',
      });
    } catch (err: unknown) {
      logger.error('[ExportsTab] Share CSV', {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [tontines]);

  const handleSharePunctuality = useCallback(async () => {
    const msg = `Mon Score Kelemba : ${Math.round(currentScore)}/1000 · Ponctualité : ${Math.round(punctualityRate)}% · ${metrics.completedTontinesCount} tontine(s) complétée(s).\nTéléchargez Kelemba !`;
    try {
      await Share.share({ message: msg });
    } catch (err: unknown) {
      logger.error('[ExportsTab] Share punctuality', {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [currentScore, punctualityRate, metrics.completedTontinesCount]);

  const showTontinePickerForExport = useCallback(() => {
    const buttons = tontines.map((t) => ({
      text: t.tontineName,
      onPress: () => handleExportTontinePdf(t.tontineUid),
    }));
    Alert.alert('Choisir une tontine', undefined, [
      ...buttons,
      { text: 'Annuler', style: 'cancel' },
    ]);
  }, [tontines]);

  const eligible = punctualityRate >= 90 && metrics.completedTontinesCount >= 1;
  const scoreOk = currentScore >= 600;

  return (
    <View style={styles.wrap}>
      <View style={styles.certCard}>
        <Pressable
          onPress={() => handleDownloadCertificate(userUid)}
          style={styles.certRow}
          accessibilityRole="button"
          accessibilityLabel="Télécharger le certificat de participation"
        >
          <View style={styles.certIcon}>
            <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                stroke={COLORS.primary}
                strokeWidth={2}
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <View style={styles.certMid}>
            <Text style={styles.certTitle}>Certificat de participation</Text>
            <Text style={styles.certSub}>
              Score {Math.round(currentScore)} · Ponctualité {Math.round(punctualityRate)}% ·{' '}
              {metrics.completedTontinesCount} tontine(s) complétée(s) · Signé SHA-256
            </Text>
          </View>
          <Pressable
            onPress={() => handleDownloadCertificate(userUid)}
            style={styles.dlBtn}
            accessibilityLabel="Télécharger le certificat de participation"
          >
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path
                d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"
                stroke={COLORS.white}
                strokeWidth={2}
                strokeLinecap="round"
              />
            </Svg>
          </Pressable>
        </Pressable>
      </View>
      <Text style={styles.note}>
        Ce certificat peut être utilisé comme preuve de fiabilité financière auprès des microfinances
        partenaires.
      </Text>

      <View style={styles.grid2}>
        <ExportButton
          label="Rapport PDF"
          sub="Bilan personnel complet"
          bg={COLORS.dangerLight}
          onPress={onExportGlobalPdf}
          accessibilityLabel="Exporter le rapport PDF global"
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6"
              stroke={COLORS.dangerText}
              strokeWidth={2}
            />
          </Svg>
        </ExportButton>
        <ExportButton
          label="Export CSV"
          sub="Toutes les transactions"
          bg={COLORS.accentLight}
          onPress={() => void handleExportCSV()}
          accessibilityLabel="Exporter les transactions en CSV"
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Rect x={3} y={3} width={7} height={7} stroke={COLORS.accentDark} strokeWidth={2} />
            <Rect x={14} y={3} width={7} height={7} stroke={COLORS.accentDark} strokeWidth={2} />
            <Rect x={14} y={14} width={7} height={7} stroke={COLORS.accentDark} strokeWidth={2} />
            <Rect x={3} y={14} width={7} height={7} stroke={COLORS.accentDark} strokeWidth={2} />
          </Svg>
        </ExportButton>
        <ExportButton
          label="Rapport tontine"
          sub="PDF par tontine"
          bg={COLORS.primaryLight}
          onPress={showTontinePickerForExport}
          accessibilityLabel="Exporter un rapport PDF par tontine"
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75"
              stroke={COLORS.primaryDark}
              strokeWidth={2}
            />
          </Svg>
        </ExportButton>
        <ExportButton
          label="Partager"
          sub="Relevé de ponctualité"
          bg="#EEEDFE"
          onPress={() => void handleSharePunctuality()}
          accessibilityLabel="Partager le relevé de ponctualité"
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8 M16 6l-4-4-4 4 M12 2v13"
              stroke="#534AB7"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </Svg>
        </ExportButton>
      </View>

      <View style={styles.mfCard}>
        <View style={styles.mfRow}>
          <View style={styles.mfIcon}>
            <Text style={styles.mfDollar}>$</Text>
          </View>
          <View style={styles.flex1}>
            <Text
              style={[
                styles.mfTitle,
                { color: eligible ? COLORS.accentDark : COLORS.gray500 },
              ]}
            >
              {eligible ? 'Éligible au microcrédit' : 'Pas encore éligible'}
            </Text>
            <Text style={styles.mfCrit}>
              Score ≥ 600 · Ponctualité ≥ 90% · au moins 1 tontine complétée
            </Text>
          </View>
        </View>
        <View style={styles.mfEncart}>
          <Text style={styles.mfEncartTxt}>
            {eligible
              ? 'Votre historique Kelemba peut être utilisé comme preuve de solvabilité auprès des microfinances partenaires.'
              : [
                  !scoreOk ? 'Score minimum 600' : null,
                  punctualityRate < 90 ? 'Ponctualité ≥ 90%' : null,
                  metrics.completedTontinesCount < 1 ? 'Au moins 1 tontine complétée' : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Continuez à cotiser à temps pour progresser.'}
          </Text>
        </View>
      </View>
    </View>
  );
};

function ExportButton({
  label,
  sub,
  bg,
  onPress,
  children,
  accessibilityLabel,
}: {
  label: string;
  sub: string;
  bg: string;
  onPress: () => void;
  children: React.ReactNode;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.exBtn, { backgroundColor: COLORS.white, borderColor: COLORS.gray200 }]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.exIconWrap, { backgroundColor: bg }]}>{children}</View>
      <Text style={styles.exLabel}>{label}</Text>
      <Text style={styles.exSub}>{sub}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 8, paddingBottom: 32 },
  certCard: {
    marginHorizontal: 16,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    padding: 16,
    backgroundColor: COLORS.white,
  },
  certRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  certIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  certMid: { flex: 1, minWidth: 0 },
  certTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
    marginBottom: 3,
  },
  certSub: { fontSize: 11, color: COLORS.gray500, lineHeight: 16 },
  dlBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  note: {
    fontSize: 11,
    color: COLORS.gray500,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
  },
  grid2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  exBtn: {
    width: '48%',
    minWidth: '45%',
    flexGrow: 1,
    borderWidth: 0.5,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 6,
  },
  exIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: 15,
  },
  exSub: { fontSize: 9, color: COLORS.gray500, textAlign: 'center' },
  mfCard: {
    marginHorizontal: 16,
    borderWidth: 0.5,
    borderColor: COLORS.accent,
    borderRadius: RADIUS.lg,
    padding: 14,
    backgroundColor: COLORS.white,
  },
  mfRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  mfIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: COLORS.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mfDollar: { fontSize: 16, fontWeight: '600', color: COLORS.accentDark },
  flex1: { flex: 1, minWidth: 0 },
  mfTitle: { fontSize: 13, fontWeight: '500' },
  mfCrit: { fontSize: 11, color: COLORS.gray500, marginTop: 4 },
  mfEncart: {
    backgroundColor: COLORS.accentLight,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  mfEncartTxt: { fontSize: 11, color: COLORS.accentDark, lineHeight: 16 },
});
