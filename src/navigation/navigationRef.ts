/**
 * Référence du conteneur de navigation — évite les dépendances circulaires.
 */
import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();
