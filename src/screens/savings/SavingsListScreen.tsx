/**
 * Liste des tontines épargne — useSavingsList.
 */
import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useSavingsList } from '@/hooks/savings/useSavingsList';
import type { SavingsListItem } from '@/types/savings.types';
import { SavingsCard } from '@/components/savings/SavingsCard';

export const SavingsListScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data, isLoading, isError, refetch, isFetching } = useSavingsList();
  const list = Array.isArray(data) ? data : [];

  const onPressItem = useCallback(
    (item: SavingsListItem) => {
      navigation.navigate('SavingsDetailScreen', {
        tontineUid: item.uid,
        isCreator: item.isCreator,
      });
    },
    [navigation]
  );

  const renderItem = useCallback(
    ({ item }: { item: SavingsListItem }) => (
      <View style={styles.cardWrap}>
        <SavingsCard
          item={item}
          onPress={() => onPressItem(item)}
          containerStyle={styles.cardFullWidth}
        />
      </View>
    ),
    [onPressItem]
  );

  if (isLoading && !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Retour"
          >
            <Ionicons name="arrow-back" size={24} color="#1A6B3C" />
          </Pressable>
          <Text style={styles.headerTitle}>Mes tontines épargne</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1A6B3C" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={styles.backBtn}
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={24} color="#1A6B3C" />
          </Pressable>
          <Text style={styles.headerTitle}>Mes tontines épargne</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Impossible de charger la liste.</Text>
          <Pressable style={styles.retryBtn} onPress={() => void refetch()}>
            <Text style={styles.retryText}>Réessayer</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <Ionicons name="arrow-back" size={24} color="#1A6B3C" />
        </Pressable>
        <Text style={styles.headerTitle}>Mes tontines épargne</Text>
        <Pressable
          onPress={() => navigation.navigate('CreateTontine', { initialType: 'EPARGNE' })}
          hitSlop={12}
          style={styles.addBtn}
          accessibilityRole="button"
          accessibilityLabel="Créer une tontine épargne"
        >
          <Ionicons name="add" size={28} color="#1A6B3C" />
        </Pressable>
      </View>

      <FlatList
        data={list}
        keyExtractor={(item) => item.uid}
        renderItem={renderItem}
        contentContainerStyle={
          list.length === 0 ? styles.emptyList : styles.listContent
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyHint}>Aucune tontine épargne pour le moment.</Text>
            <Pressable
              style={styles.cta}
              onPress={() => navigation.navigate('CreateTontine', { initialType: 'EPARGNE' })}
            >
              <Text style={styles.ctaText}>Créer ma première tontine épargne</Text>
            </Pressable>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={() => void refetch()}
            tintColor="#1A6B3C"
          />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  backBtn: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    textAlign: 'center',
  },
  headerRight: { width: 44, height: 48 },
  addBtn: {
    width: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: { padding: 16, paddingBottom: 40, gap: 12 },
  cardWrap: { marginBottom: 4 },
  cardFullWidth: { width: '100%', maxWidth: '100%', alignSelf: 'stretch' },
  emptyList: { flexGrow: 1 },
  empty: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 280,
  },
  emptyHint: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 20 },
  cta: {
    minHeight: 48,
    paddingHorizontal: 24,
    backgroundColor: '#1A6B3C',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { fontSize: 15, color: '#4B5563', marginBottom: 16 },
  retryBtn: {
    backgroundColor: '#1A6B3C',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
});
