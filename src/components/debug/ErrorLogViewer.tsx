/**
 * Composant de debug pour visualiser et partager le fichier de log d'erreurs.
 * Accessible uniquement en __DEV__ ou via un écran admin.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getErrorLogPath, clearErrorLog } from '@/utils/errorFileLogger';

export function ErrorLogViewer(): React.JSX.Element {
  const [content, setContent] = useState<string>('Chargement…');

  const load = async (): Promise<void> => {
    const text = await FileSystem.readAsStringAsync(getErrorLogPath()).catch(
      () => 'Aucune erreur enregistrée.'
    );
    setContent(text || 'Aucune erreur enregistrée.');
  };

  useEffect(() => {
    void load();
  }, []);

  const handleShare = async (): Promise<void> => {
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) return;
    const path = getErrorLogPath();
    const info = await FileSystem.getInfoAsync(path).catch(() => null);
    if (!info?.exists) return; // Fichier absent (ex. mode DEV — logs sur PC)
    try {
      await Sharing.shareAsync(path);
    } catch {
      /* partage annulé ou indisponible */
    }
  };

  const handleClear = async (): Promise<void> => {
    await clearErrorLog();
    setContent('Aucune erreur enregistrée.');
  };

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <TouchableOpacity onPress={handleShare} style={styles.btn}>
          <Text style={styles.btnText}>📤 Partager</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleClear} style={[styles.btn, styles.btnDanger]}>
          <Text style={styles.btnText}>🗑️ Vider</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void load()} style={styles.btn}>
          <Text style={styles.btnText}>🔄 Rafraîchir</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.scroll}>
        <Text style={styles.log} selectable>
          {content}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  actions: { flexDirection: 'row', gap: 8, padding: 12 },
  btn: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },
  btnDanger: { backgroundColor: '#3d1515' },
  btnText: { color: '#e0e0e0', fontSize: 12 },
  scroll: { flex: 1, padding: 12 },
  log: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#c8f7c5',
    lineHeight: 18,
  },
});
