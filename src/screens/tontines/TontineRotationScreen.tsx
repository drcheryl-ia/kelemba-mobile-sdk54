/**
 * Écran — rotation complète d'une tontine (timeline des tours).
 */
import React from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useTontineRotation } from '@/hooks/useTontineRotation';
import {
  RotationStatsHeader,
  DelayBanner,
  RotationTimelineItem,
} from '@/components/rotation';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';

type Props = NativeStackScreenProps<RootStackParamList, 'TontineRotation'>;

export const TontineRotationScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const { tontineUid } = route.params;
  const { t } = useTranslation();

  const {
    rotationList,
    currentCycle,
    totalAmount,
    memberCount,
    tontineName,
    currentCycleNumber,
    totalCycles,
    currentRotationRound,
    maxRotationRound,
    pendingReason,
    isDelayedByOthers,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useTontineRotation(tontineUid);

  const nextTourNumber = currentCycleNumber + 1;
  const showRotationBadge = maxRotationRound > 1;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
          </Pressable>
          <Text style={styles.headerTitle}>{t('rotation.title')}</Text>
          <Pressable style={styles.infoBtn}>
            <Ionicons name="information-circle-outline" size={24} color="#1A1A1A" />
          </Pressable>
        </View>
        <View style={styles.skeleton}>
          <SkeletonBlock width="100%" height={100} borderRadius={16} />
          <SkeletonBlock width="100%" height={80} borderRadius={16} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
          </Pressable>
          <Text style={styles.headerTitle}>{t('rotation.title')}</Text>
        </View>
        <View style={styles.errorState}>
          <Text style={styles.errorText}>{t('common.error')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </Pressable>
        <Text style={styles.headerTitle}>{t('rotation.title')}</Text>
        <Pressable style={styles.infoBtn} accessibilityRole="button">
          <Ionicons name="information-circle-outline" size={24} color="#1A1A1A" />
        </Pressable>
      </View>

      <FlatList
        data={rotationList}
        keyExtractor={(item) => item.uid}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={refetch}
            tintColor="#1A6B3C"
          />
        }
        ListHeaderComponent={
          <>
            <RotationStatsHeader
              totalAmount={totalAmount}
              nextTourNumber={nextTourNumber}
              currentRotation={currentRotationRound}
            />
            {isDelayedByOthers && pendingReason && (
              <DelayBanner pendingReason={pendingReason} />
            )}
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>
                {t('rotation.calendarTitle')}
              </Text>
              <View style={styles.participantsBadge}>
                <Text style={styles.participantsText}>
                  {t('rotation.participants', { count: memberCount })}
                </Text>
              </View>
            </View>
          </>
        }
        renderItem={({ item, index }) => (
          <View style={styles.timelineRow}>
            <View
              style={[
                styles.timelineLine,
                index === 0 && styles.timelineLineFirst,
              ]}
            />
            <RotationTimelineItem
              cycle={item}
              showProgressBar={
                item.displayStatus === 'PROCHAIN' && item.totalExpected > 0
              }
              showRotationBadge={showRotationBadge}
            />
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  infoBtn: {
    padding: 8,
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
    flexGrow: 1,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  participantsBadge: {
    backgroundColor: '#E5E5EA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  participantsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },
  timelineRow: {
    paddingLeft: 20,
    marginHorizontal: -20,
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    left: 39,
    top: 0,
    bottom: -16,
    width: 2,
    backgroundColor: '#E5E5EA',
  },
  timelineLineFirst: {
    top: 20,
  },
  skeleton: {
    padding: 20,
    gap: 12,
  },
  errorState: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#D0021B',
    textAlign: 'center',
  },
});
