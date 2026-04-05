import { Alert, Linking } from 'react-native';
import { authStorage, STORAGE_KEYS } from '@/storage/authStorage';
import { logger } from '@/utils/logger';

export async function openAuthenticatedReportUrl(url: string): Promise<void> {
  const token = await authStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  const withAuth =
    token != null && token !== ''
      ? `${url}${url.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`
      : url;
  try {
    const ok = await Linking.canOpenURL(withAuth);
    if (ok) await Linking.openURL(withAuth);
    else {
      Alert.alert(
        'Export',
        'Fonctionnalité disponible sur l’application installée ou ouvrez le lien depuis un navigateur connecté.'
      );
    }
  } catch (err: unknown) {
    logger.error('[reportOpenUrl]', {
      message: err instanceof Error ? err.message : String(err),
    });
    Alert.alert('Export', 'Impossible d’ouvrir le lien pour le moment.');
  }
}
