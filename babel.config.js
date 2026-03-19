module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['.'],
          alias: { '@': './src' },
        },
      ],
      // ✅ NE PAS ajouter 'react-native-reanimated/plugin' ici.
      // babel-preset-expo l'injecte automatiquement pour SDK 54 + Reanimated 4.
    ],
  };
};
