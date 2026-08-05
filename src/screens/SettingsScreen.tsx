import React from 'react';
import { Alert, Linking, ScrollView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Colors } from '../theme/colors';
import { useAppStore } from '../store/appStore';
import { useGameStore } from '../store/gameStore';
import { useTheme } from '../theme/ThemeContext';
import { changeLanguage } from '../localization/i18n';
import { RootStackParamList } from '../types';
import { useAuthStore } from '../store/authStore';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'> };

const ADMIN_WHATSAPP_NUMBER = '96550540999';

export default function SettingsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { isDark, toggleTheme } = useTheme();
  const updateGameSettings = useGameStore(s => s.updateSettings);
  const {
    language,
    soundEnabled,
    vibrationEnabled,
    setLanguage,
    setSoundEnabled,
    setVibrationEnabled,
    clearAllData,
  } = useAppStore();
  const isArabic = language === 'ar';
  const userRecord = useAuthStore(s => s.userRecord);

  const changeAppLanguage = async (nextLanguage: 'ar' | 'en') => {
    await setLanguage(nextLanguage);
    await changeLanguage(nextLanguage);
    updateGameSettings({ questionLanguage: nextLanguage });
  };

  const confirmClear = () => {
    Alert.alert(t('settings.clearData'), t('settings.clearDataConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          void clearAllData();
        },
      },
    ]);
  };

  const openWhatsApp = async () => {
    const url = `https://wa.me/${ADMIN_WHATSAPP_NUMBER}`;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert(t('common.error'), t('settings.contactUnavailable'));
        return;
      }

      await Linking.openURL(url);
    } catch {
      Alert.alert(t('common.error'), t('settings.contactUnavailable'));
    }
  };

  const Row = ({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) => (
    <View style={styles.row}>
      <Text style={styles.rowText}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: Colors.primary }} thumbColor={Colors.text} />
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.header, isArabic && styles.headerRtl]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
            <Text style={styles.backText}>{isArabic ? '›' : '‹'}</Text>
          </TouchableOpacity>
          <Text style={[styles.title, isArabic && styles.titleRtl]}>{t('settings.title')}</Text>
        </View>

        <View style={styles.panel}>
          <Text style={[styles.panelTitle, isArabic && styles.textRtl]}>{t('settings.language')}</Text>
          <View style={[styles.langRow, isArabic && styles.langRowRtl]}>
            <TouchableOpacity
              style={[styles.langBtn, language === 'ar' && styles.langBtnActive]}
              onPress={() => {
                void changeAppLanguage('ar');
              }}>
              <Text style={styles.langText}>{t('languageSelect.arabic')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
              onPress={() => {
                void changeAppLanguage('en');
              }}>
              <Text style={styles.langText}>{t('languageSelect.english')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={[styles.panelTitle, isArabic && styles.textRtl]}>{t('settings.theme')}</Text>
          <Row label={isDark ? t('settings.darkMode') : t('settings.lightMode')} value={isDark} onValueChange={() => {
            void toggleTheme();
          }} />
          <Row label={t('settings.sound')} value={soundEnabled} onValueChange={value => {
            void setSoundEnabled(value);
          }} />
          <Row label={t('settings.vibration')} value={vibrationEnabled} onValueChange={value => {
            void setVibrationEnabled(value);
          }} />
        </View>

        <View style={styles.panel}>
          <Text style={[styles.panelTitle, isArabic && styles.textRtl]}>{t('settings.contact')}</Text>
          <TouchableOpacity style={styles.contactCard} onPress={() => {
            void openWhatsApp();
          }}>
            <View style={styles.contactInfo}>
              <Text style={[styles.contactTitle, isArabic && styles.textRtl]}>{t('settings.whatsAppAdmin')}</Text>
              <Text style={[styles.contactNumber, isArabic && styles.textRtl]}>+965 5054 0999</Text>
            </View>
            <Text style={styles.contactAction}>{t('settings.contactNow')}</Text>
          </TouchableOpacity>
        </View>

        {(userRecord?.isAdmin || userRecord?.isSuperAdmin) ? (
          <View style={styles.panel}>
            <Text style={[styles.panelTitle, isArabic && styles.textRtl]}>{t('admin.title')}</Text>
            <Text style={[styles.panelNote, isArabic && styles.textRtl]}>{t('admin.settingsHint')}</Text>
            <TouchableOpacity style={styles.adminOpenBtn} onPress={() => navigation.navigate('AdminPanel')}>
              <Text style={styles.adminOpenBtnText}>{t('admin.openPanel')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.panel}>
          <Text style={[styles.panelTitle, isArabic && styles.textRtl]}>{t('settings.dataSection')}</Text>
          <Text style={[styles.panelNote, isArabic && styles.textRtl]}>{t('settings.dataSectionHint')}</Text>
          <TouchableOpacity style={styles.dangerBtn} onPress={confirmClear}>
            <Text style={styles.dangerBtnText}>{t('settings.clearData')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, paddingBottom: 32, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerRtl: { flexDirection: 'row-reverse' },
  back: { padding: 4 },
  backText: { fontSize: 32, color: Colors.primaryLight, lineHeight: 36 },
  title: { color: Colors.text, fontSize: 30, fontWeight: '800' },
  titleRtl: { textAlign: 'right' },
  panel: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 14,
  },
  panelTitle: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  panelNote: { color: Colors.textMuted, fontSize: 13, lineHeight: 20 },
  textRtl: { textAlign: 'right' },
  langRow: { flexDirection: 'row', gap: 10 },
  langRowRtl: { flexDirection: 'row-reverse' },
  langBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  langBtnActive: { borderColor: Colors.primaryLight, backgroundColor: Colors.primary + '22' },
  langText: { color: Colors.text, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowText: { color: Colors.text, fontSize: 16 },
  contactCard: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  contactInfo: { flex: 1 },
  contactTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  contactNumber: { color: Colors.textMuted, fontSize: 14, marginTop: 4 },
  contactAction: { color: Colors.success, fontSize: 14, fontWeight: '700' },
  dangerBtn: {
    backgroundColor: Colors.error,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  dangerBtnText: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  adminOpenBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  adminOpenBtnText: { color: Colors.text, fontSize: 16, fontWeight: '700' },
});