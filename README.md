# Kelemba Mobile — Expo SDK 54

Application mobile de gestion de tontines numériques (RCA).

## Prérequis

- Node.js 18+
- npm ou yarn
- Expo CLI

## Installation

```powershell
npm install --legacy-peer-deps
npx expo install --check
```

Pour toute dépendance React Native, utiliser **uniquement** :

```bash
npx expo install <package>
```

## Démarrage

```bash
npx expo start --dev-client
```

## Structure

- `src/screens/` — Écrans (auth, dashboard, tontines, payments, profile, admin)
- `src/components/` — Composants réutilisables
- `src/hooks/` — Hooks personnalisés
- `src/store/` — Redux Toolkit + redux-persist (SecureStore pour auth)
- `src/api/` — Client Axios, intercepteurs JWT
- `src/navigation/` — React Navigation v6
- `src/i18n/` — Français / Sango
- `src/security/` — SecureStore, certificate pinning (placeholder)
- `src/theme/` — Couleurs, typographie, espacements
- `src/types/` — Types TypeScript
- `src/utils/` — Logger, formatters, validators

## Règles (CLAUDE.md)

- Expo SDK 54 verrouillé — `react-native-reanimated` ~3.16.7 (jamais 4.x)
- `npx expo install` pour tous les packages RN
- `index.js` : `import 'react-native-gesture-handler'` en première ligne
- `babel.config.js` : `react-native-reanimated/plugin` en dernier
- TypeScript strict, pas de `any`
- SecureStore pour JWT, PIN, KYC — jamais AsyncStorage
