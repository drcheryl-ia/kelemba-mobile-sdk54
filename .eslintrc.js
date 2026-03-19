module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-empty-catch-block': 'error',
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'react/react-in-jsx-scope': 'off',
  },
  settings: {
    react: { version: 'detect' },
  },
  env: {
    node: true,
    es2022: true,
  },
  ignorePatterns: ['node_modules', 'android', 'ios', '.expo', 'dist'],
};
