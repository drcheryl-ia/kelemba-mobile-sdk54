import 'intl-pluralrules';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
const fr = require('./fr.json') as Record<string, unknown>;
const sango = require('./sg.json') as Record<string, unknown>;

i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v3',
    lng: 'fr',
    fallbackLng: 'fr',
    resources: {
      fr: { translation: fr },
      sango: { translation: sango },
    },
    interpolation: {
      escapeValue: false,
    },
  });

const locale = Localization.getLocales()[0]?.languageCode ?? 'fr';
if (locale.startsWith('sg')) {
  i18n.changeLanguage('sango');
}

export default i18n;
