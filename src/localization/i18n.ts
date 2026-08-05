import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ar from './ar.json';
import en from './en.json';

export type Language = 'ar' | 'en';

const resources = { ar: { translation: ar }, en: { translation: en } };

const i18nReady = i18n.use(initReactI18next).init({
  resources,
  lng: 'ar',
  fallbackLng: 'ar',
  interpolation: { escapeValue: false },
});

export const initI18n = async () => {
  await i18nReady;

  const savedLang = await AsyncStorage.getItem('language') as Language | null;
  const lang: Language = savedLang || 'ar';

  if (i18n.language !== lang) {
    await i18n.changeLanguage(lang);
  }

  applyRTL(lang);
};

export const changeLanguage = async (lang: Language) => {
  await i18n.changeLanguage(lang);
  await AsyncStorage.setItem('language', lang);
  applyRTL(lang);
};

const applyRTL = (lang: Language) => {
  const isRTL = lang === 'ar';
  if (I18nManager.isRTL !== isRTL) {
    I18nManager.forceRTL(isRTL);
  }
};

export const isRTL = () => i18n.language === 'ar';

export default i18n;
