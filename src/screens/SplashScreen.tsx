import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../types';
import { Colors } from '../theme/colors';
import { useAppStore } from '../store/appStore';
import { useProfileStore } from '../store/profileStore';
import { initI18n } from '../localization/i18n';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from 'react-i18next';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Splash'> };

export default function SplashScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const loadAppData = useAppStore(s => s.loadAppData);
  const loadProfile = useProfileStore(s => s.loadProfile);
  const initAuth = useAuthStore(s => s.initAuth);

  useEffect(() => {
    let isMounted = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const init = async () => {
      let hasLang: string | null = null;

      try {
        initAuth();
        await initI18n();
        await loadAppData();
        await loadProfile();
        hasLang = await AsyncStorage.getItem('language');
      } catch (error) {
        console.warn('Splash initialization failed', error);
      }

      if (!isMounted) {
        return;
      }

      timer = setTimeout(() => {
        navigation.replace(hasLang ? 'Home' : 'LanguageSelect');
      }, 1800);
    };

    init();

    return () => {
      isMounted = false;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [initAuth, loadAppData, loadProfile, navigation]);

  const translatedName = t('app.name', { defaultValue: 'تحدي' });
  const translatedTagline = t('app.tagline', { defaultValue: 'العب، تعلم، تحدى!' });
  const appName = translatedName === 'app.name' ? 'تحدي' : translatedName;
  const tagline = translatedTagline === 'app.tagline' ? 'العب، تعلم، تحدى!' : translatedTagline;

  return (
    <View style={styles.container}>
      <View style={[styles.orb, styles.orbTop]} />
      <View style={[styles.orb, styles.orbBottom]} />

      <View style={styles.symbolGrid}>
        <View style={[styles.symbolTile, styles.tilePrimary]}><Text style={styles.symbol}>؟</Text></View>
        <View style={[styles.symbolTile, styles.tileBlue]}><Text style={styles.symbol}>IQ</Text></View>
        <View style={[styles.symbolTile, styles.tileGold]}><Text style={styles.symbol}>⚡</Text></View>
      </View>

      <View style={styles.logoWrap}>
        <View style={styles.logoRing}>
          <Text style={styles.logoIcon}>🎮</Text>
        </View>
      </View>

      <Text style={styles.title}>{appName}</Text>
      <Text style={styles.subtitle}>Challenge Arena</Text>
      <Text style={styles.tagline}>{tagline}</Text>

      <View style={styles.infoRow}>
        <View style={styles.infoPill}><Text style={styles.infoText}>معلومات</Text></View>
        <View style={styles.infoPill}><Text style={styles.infoText}>ذكاء</Text></View>
        <View style={styles.infoPill}><Text style={styles.infoText}>تحدي</Text></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: 0.18,
  },
  orbTop: {
    top: -70,
    right: -80,
    backgroundColor: Colors.secondaryLight,
  },
  orbBottom: {
    bottom: -90,
    left: -80,
    backgroundColor: Colors.accent,
  },
  symbolGrid: {
    position: 'absolute',
    top: 105,
    flexDirection: 'row',
    gap: 12,
  },
  symbolTile: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  tilePrimary: { backgroundColor: 'rgba(124,58,237,0.28)' },
  tileBlue: { backgroundColor: 'rgba(37,99,235,0.26)' },
  tileGold: { backgroundColor: 'rgba(245,158,11,0.23)' },
  symbol: { color: Colors.text, fontSize: 21, fontWeight: '900' },
  logoWrap: {
    padding: 18,
    borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.22)',
    marginBottom: 24,
  },
  logoRing: {
    width: 118,
    height: 118,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  logoIcon: { fontSize: 62 },
  title: {
    fontSize: 58,
    fontWeight: '900',
    color: Colors.primaryLight,
    letterSpacing: 0,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: Colors.text,
    marginTop: 8,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  tagline: {
    fontSize: 17,
    color: Colors.textSecondary,
    marginTop: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 28,
  },
  infoPill: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  infoText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
});
