# Kelemba — Migration @formatjs vers intl-pluralrules (Expo SDK 54)
# Supprime les warnings Metro liés aux subpaths exports
# Exécuter depuis la racine du projet

npm uninstall @formatjs/intl-getcanonicallocales @formatjs/intl-locale @formatjs/intl-pluralrules
npx expo install intl-pluralrules
npx expo start --reset-cache --clear
