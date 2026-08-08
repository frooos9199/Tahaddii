import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../types';
import { useAppStore } from '../store/appStore';
import { useProfileStore } from '../store/profileStore';
import { initI18n } from '../localization/i18n';
import { useAuthStore } from '../store/authStore';

const splashImage = require('../assets/splash.png');

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Splash'> };

export default function SplashScreen({ navigation }: Props) {
  const loadAppData = useAppStore(s => s.loadAppData);
  const loadProfile = useProfileStore(s => s.loadProfile);
  const initAuth = useAuthStore(s => s.initAuth);

  useEffect(() => {
    let isMounted = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const init = async () => {
      let hasLang: string | null = null;

      try {
        await initI18n();
        await loadAppData();
        await loadProfile();
        initAuth();
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

  return (
    <View style={styles.container}>
      <Image source={splashImage} style={styles.image} resizeMode="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  image: { width: '100%', height: '100%' },
});
