/**
 * Configuration Expo — Kelemba Mobile.
 * Firebase FCM + expo-notifications.
 *
 * PRÉREQUIS : Placer google-services.json (Android) et GoogleService-Info.plist (iOS)
 * à la racine du projet avant prebuild.
 *
 * Installation des packages (npx expo install obligatoire) :
 *   npx expo install @react-native-firebase/app @react-native-firebase/messaging expo-notifications
 *   npx expo install --check
 */
module.exports = {
  expo: {
    name: 'Kelemba',
    slug: 'kelemba-mobile-sdk54',
    version: '1.0.0',
    extra: {
      eas: {
        projectId: "c714f156-3d40-4eae-92a1-603d1a56a91c"
      }
    },
    
    plugins: [
      //'react-native-reanimated',
      [
        'expo-camera',
        {
          cameraPermission:
            'Kelemba a besoin de la caméra pour scanner les QR codes d\'invitation.',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission:
            'Kelemba a besoin d\'accéder à vos photos pour le KYC.',
          cameraPermission:
            'Kelemba a besoin d\'accéder à votre caméra pour le KYC.',
        },
      ],
      [
        'expo-media-library',
        {
          photosPermission:
            'Kelemba a besoin d\'accéder à votre galerie pour enregistrer le QR code.',
          savePhotosPermission:
            'Kelemba a besoin d\'accéder à votre galerie pour enregistrer le QR code.',
          isAccessMediaLocationEnabled: true,
        },
      ],
      '@react-native-firebase/app',
      '@react-native-firebase/messaging',
      [
        'expo-notifications',
        {
          color: '#1A6B3C',
          // icon et sounds : ajouter quand assets/notification-icon.png et assets/notification-sound.wav existent
        },
      ],
    ],
    android: {
      package: "com.cheryldev63.kelembamobilesdk54",
      googleServicesFile: './google-services.json',
      permissions: ['USE_BIOMETRIC', 'USE_FINGERPRINT'],
    },
    ios: {
      bundleIdentifier: "com.cheryldev63.kelembamobilesdk54",
      googleServicesFile: './GoogleService-Info.plist',
      infoPlist: {
        NSFaceIDUsageDescription:
          'Kelemba utilise Face ID pour sécuriser votre connexion / Kelemba afa Face ID na mbênî sêse.',
        UIBackgroundModes: ['fetch', 'remote-notification'],
      },
      entitlements: {
        'aps-environment': 'production',
      },
    },
  },
};
