/**
 * Modal — filtres avancés (période, statut, mode).
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import type {
  StatusFilter,
  PeriodPreset,
  MethodFilterOption,
} from '@/hooks/useContributionHistory';
import type { PaymentRoleFilterOption } from '../paymentViewModels';

const GREEN = '#1A6B3C';

const PERIOD_PRESETS: { id: PeriodPreset; label: string }[] = [
  { id: 'all', label: 'Toute période' },
  { id: '7d', label: '7 jours' },
  { id: '30d', label: '30 jours' },
  { id: 'custom', label: 'Personnalisée' },
];

const STATUS_OPTS: { id: StatusFilter; label: string }[] = [
  { id: undefined, label: 'Tous statuts' },
  { id: 'PENDING', label: 'En attente' },
  { id: 'PROCESSING', label: 'En traitement' },
  { id: 'COMPLETED', label: 'Validé' },
  { id: 'FAILED', label: 'Rejeté' },
  { id: 'REFUNDED', label: 'Remboursé' },
];

const METHOD_OPTS: { id: MethodFilterOption; label: string }[] = [
  { id: 'all', label: 'Tous modes' },
  { id: 'ORANGE_MONEY', label: 'Orange Money' },
  { id: 'TELECEL_MONEY', label: 'Telecel Money' },
  { id: 'CASH', label: 'Espèces' },
];

const ROLE_OPTS: { id: PaymentRoleFilterOption; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'member', label: 'Comme membre' },
  { id: 'creator', label: 'Comme organisateur' },
];

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

type Props = {
  visible: boolean;
  onClose: () => void;
  periodPreset: PeriodPreset;
  customFrom: string;
  customTo: string;
  statusFilter: StatusFilter;
  methodFilter: MethodFilterOption;
  roleFilter: PaymentRoleFilterOption;
  onApply: (p: {
    periodPreset: PeriodPreset;
    customFrom: string;
    customTo: string;
    statusFilter: StatusFilter;
    methodFilter: MethodFilterOption;
    roleFilter: PaymentRoleFilterOption;
  }) => void;
};

type PickerTarget = 'from' | 'to' | null;

export const PaymentFiltersModal: React.FC<Props> = ({
  visible,
  onClose,
  periodPreset: initialPeriod,
  customFrom: initialFrom,
  customTo: initialTo,
  statusFilter: initialStatus,
  methodFilter: initialMethod,
  roleFilter: initialRole,
  onApply,
}) => {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>(initialPeriod);
  const [customFrom, setCustomFrom] = useState(initialFrom);
  const [customTo, setCustomTo] = useState(initialTo);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [methodFilter, setMethodFilter] = useState<MethodFilterOption>(initialMethod);
  const [roleFilter, setRoleFilter] = useState<PaymentRoleFilterOption>(initialRole);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);

  useEffect(() => {
    if (visible) {
      setPeriodPreset(initialPeriod);
      setCustomFrom(initialFrom);
      setCustomTo(initialTo);
      setStatusFilter(initialStatus);
      setMethodFilter(initialMethod);
      setRoleFilter(initialRole);
    } else {
      setPickerTarget(null);
    }
  }, [visible, initialPeriod, initialFrom, initialTo, initialStatus, initialMethod, initialRole]);

  const onDateChange = useCallback(
    (_: unknown, date?: Date) => {
      if (Platform.OS === 'android') setPickerTarget(null);
      if (!date) return;
      const ymd = toYmd(date);
      if (pickerTarget === 'from') setCustomFrom(ymd);
      if (pickerTarget === 'to') setCustomTo(ymd);
    },
    [pickerTarget]
  );

  const handleApply = useCallback(() => {
    if (periodPreset === 'custom') {
      if (!customFrom || !customTo) {
        return;
      }
      if (customFrom > customTo) {
        return;
      }
    }
    onApply({
      periodPreset,
      customFrom,
      customTo,
      statusFilter,
      methodFilter,
      roleFilter,
    });
    onClose();
  }, [
    periodPreset,
    customFrom,
    customTo,
    statusFilter,
    methodFilter,
    roleFilter,
    onApply,
    onClose,
  ]);

  const pickerDate =
    pickerTarget === 'from'
      ? parseYmd(customFrom || toYmd(new Date()))
      : pickerTarget === 'to'
        ? parseYmd(customTo || toYmd(new Date()))
        : new Date();

  const customInvalid =
    periodPreset === 'custom' &&
    (!customFrom || !customTo || customFrom > customTo);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.box} onPress={(e) => e.stopPropagation()}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Filtres</Text>
            <Pressable onPress={onClose} accessibilityLabel="Fermer">
              <Ionicons name="close" size={26} color="#6B7280" />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionTitle}>Période</Text>
            <View style={styles.chipWrap}>
              {PERIOD_PRESETS.map((p) => (
                <Pressable
                  key={p.id}
                  style={[styles.chip, periodPreset === p.id && styles.chipOn]}
                  onPress={() => {
                    if (p.id === 'custom') {
                      setPeriodPreset('custom');
                      setCustomFrom((prev) => {
                        if (prev) return prev;
                        const from = new Date();
                        from.setDate(from.getDate() - 30);
                        return toYmd(from);
                      });
                      setCustomTo((prev) => prev || toYmd(new Date()));
                    } else {
                      setPeriodPreset(p.id);
                    }
                  }}
                >
                  <Text style={[styles.chipTxt, periodPreset === p.id && styles.chipTxtOn]}>
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {periodPreset === 'custom' ? (
              <View style={styles.customRow}>
                <Pressable
                  style={styles.dateBtn}
                  onPress={() => setPickerTarget('from')}
                  accessibilityLabel="Choisir la date de début"
                >
                  <Text style={styles.dateLabel}>Du</Text>
                  <Text style={styles.dateValue}>{customFrom || '—'}</Text>
                </Pressable>
                <Pressable
                  style={styles.dateBtn}
                  onPress={() => setPickerTarget('to')}
                  accessibilityLabel="Choisir la date de fin"
                >
                  <Text style={styles.dateLabel}>Au</Text>
                  <Text style={styles.dateValue}>{customTo || '—'}</Text>
                </Pressable>
              </View>
            ) : null}
            {customInvalid ? (
              <Text style={styles.errorHint}>Choisissez deux dates valides (du ≤ au).</Text>
            ) : null}

            <Text style={styles.sectionTitle}>Statut</Text>
            <View style={styles.chipWrap}>
              {STATUS_OPTS.map((p) => (
                <Pressable
                  key={p.label}
                  style={[styles.chip, statusFilter === p.id && styles.chipOn]}
                  onPress={() => setStatusFilter(p.id)}
                >
                  <Text style={[styles.chipTxt, statusFilter === p.id && styles.chipTxtOn]}>
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Mode de paiement</Text>
            <View style={styles.chipWrap}>
              {METHOD_OPTS.map((p) => (
                <Pressable
                  key={p.id}
                  style={[styles.chip, methodFilter === p.id && styles.chipOn]}
                  onPress={() => setMethodFilter(p.id)}
                >
                  <Text style={[styles.chipTxt, methodFilter === p.id && styles.chipTxtOn]}>
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Rôle dans la tontine</Text>
            <View style={styles.chipWrap}>
              {ROLE_OPTS.map((p) => (
                <Pressable
                  key={p.id}
                  style={[styles.chip, roleFilter === p.id && styles.chipOn]}
                  onPress={() => setRoleFilter(p.id)}
                >
                  <Text style={[styles.chipTxt, roleFilter === p.id && styles.chipTxtOn]}>
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {pickerTarget != null ? (
            <DateTimePicker
              value={pickerDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onDateChange}
            />
          ) : null}

          <View style={styles.footer}>
            <Pressable
              style={[styles.applyBtn, customInvalid && styles.applyBtnDisabled]}
              onPress={handleApply}
              disabled={customInvalid}
              accessibilityRole="button"
              accessibilityLabel="Appliquer les filtres"
            >
              <Text style={styles.applyBtnText}>Appliquer</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  box: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    maxHeight: '88%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginTop: 12,
    marginBottom: 8,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipOn: {
    backgroundColor: '#DCFCE7',
    borderColor: GREEN,
  },
  chipTxt: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  chipTxtOn: {
    color: GREEN,
  },
  customRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  dateBtn: {
    flex: 1,
    minHeight: 48,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
  },
  dateLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  errorHint: {
    fontSize: 13,
    color: '#D0021B',
    marginBottom: 8,
  },
  footer: {
    marginTop: 16,
    paddingBottom: 8,
  },
  applyBtn: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnDisabled: {
    opacity: 0.5,
  },
  applyBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
