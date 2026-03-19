/**
 * Écran attente KYC — SUBMITTED / UNDER_REVIEW.
 */
import React, { useCallback, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CommonActions, useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ErrorBanner } from '@/components/ui';
import { useKycStatus } from '@/hooks/useKyc';
import { setKycStatus } from '@/store/authSlice';
import { useDispatch } from 'react-redux';
import type { KycStackParamList } from '@/navigation/types';
import {
  KYC_STATUS_LABEL_KEYS,
  KYC_STATUS_MESSAGE_KEYS,
  KYC_STATUS_SEVERITY,
  isKycUnderReview,
} from '@/utils/kyc';

type Props = NativeStackScreenProps<KycStackParamList, 'KycPending'>;

export const KycPendingScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { data, isFetching, refetch } = useKycStatus();

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  useEffect(() => {
    if (data?.status !== 'VERIFIED') {
      return;
    }

    dispatch(setKycStatus({ kycStatus: 'VERIFIED' }));
    navigation.getParent()?.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      })
    );
  }, [data?.status, dispatch, navigation]);

  const status = data?.status ?? 'SUBMITTED';
  const statusLabel = t(KYC_STATUS_LABEL_KEYS[status]);
  const statusMessage =
    status === 'REJECTED' && data?.rejectionReason
      ? t('kyc.statusRejectedReason', { reason: data.rejectionReason })
      : t(KYC_STATUS_MESSAGE_KEYS[status]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <View style={styles.iconWrapper}>
          <Ionicons
            name={status === 'REJECTED' ? 'refresh-circle-outline' : 'document-text-outline'}
            size={64}
            color={status === 'REJECTED' ? '#D0021B' : '#F5A623'}
          />
        </View>
        <Text style={styles.title}>{statusLabel}</Text>
        <Text style={styles.subtitle}>{statusMessage}</Text>

        <ErrorBanner
          message={`${statusLabel} - ${statusMessage}`}
          severity={KYC_STATUS_SEVERITY[status]}
        />

        {isKycUnderReview(status) ? (
          <>
            <ActivityIndicator size="large" color="#1A6B3C" style={styles.spinner} />
            <Pressable style={styles.secondaryButton} onPress={() => void refetch()}>
              <Text style={styles.secondaryButtonText}>
                {isFetching ? t('common.loading') : t('kyc.refreshStatus')}
              </Text>
            </Pressable>
          </>
        ) : null}

        {status === 'REJECTED' ? (
          <Pressable
            style={styles.primaryButton}
            onPress={() => navigation.replace('KycUpload', { origin: 'kycGate' })}
          >
            <Text style={styles.primaryButtonText}>{t('kyc.resubmit')}</Text>
          </Pressable>
        ) : null}

        {status === 'PENDING' ? (
          <Pressable
            style={styles.primaryButton}
            onPress={() => navigation.replace('KycUpload', { origin: 'kycGate' })}
          >
            <Text style={styles.primaryButtonText}>{t('kyc.startKyc')}</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    padding: 24,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  spinner: {
    marginTop: 32,
    marginBottom: 20,
  },
  primaryButton: {
    minHeight: 48,
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#1A6B3C',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    minHeight: 48,
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1A6B3C',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A6B3C',
  },
});
