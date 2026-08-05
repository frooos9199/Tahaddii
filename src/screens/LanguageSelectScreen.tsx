import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from '../types';
import { Colors } from '../theme/colors';
import { changeLanguage } from '../localization/i18n';
import { useAppStore } from '../store/appStore';
import { useGameStore } from '../store/gameStore';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'LanguageSelect'> };

export default function LanguageSelectScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const setLanguage = useAppStore(s => s.setLanguage);
  const updateGameSettings = useGameStore(s => s.updateSettings);

  const select = async (lang: 'ar' | 'en') => {
    await changeLanguage(lang);
    await setLanguage(lang);
    updateGameSettings({ questionLanguage: lang });
    navigation.replace('Home');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('languageSelect.title')}</Text>
      <Text style={styles.titleEn}>{t('languageSelect.subtitle')}</Text>

      <TouchableOpacity style={styles.btn} onPress={() => select('ar')}>
        <Text style={styles.btnFlag}>🇸🇦</Text>
        <Text style={styles.btnText}>{t('languageSelect.arabic')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, styles.btnEn]} onPress={() => select('en')}>
        <Text style={styles.btnFlag}>🇺🇸</Text>
        <Text style={styles.btnText}>{t('languageSelect.english')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: { fontSize: 28, fontWeight: 'bold', color: Colors.text, marginBottom: 4 },
  titleEn: { fontSize: 18, color: Colors.textMuted, marginBottom: 48 },
  btn: {
    width: '100%',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: Colors.primary,
    flexDirection: 'row',
    gap: 16,
  },
  btnEn: { borderColor: Colors.secondary },
  btnFlag: { fontSize: 32 },
  btnText: { fontSize: 22, fontWeight: 'bold', color: Colors.text },
});
