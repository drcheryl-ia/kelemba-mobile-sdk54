# Kelemba — Reset complet (Expo SDK 54)
# Exécuter dans l'ordre depuis la racine du projet

Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
npm cache clean --force
npm install
npx expo start --reset-cache --clear
