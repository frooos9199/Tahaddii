import React, { useEffect, useState } from 'react';
import { Alert, Linking, PermissionsAndroid, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Camera, CameraType } from 'react-native-camera-kit';
import { RootStackParamList } from '../types';
import { Colors } from '../theme/colors';
import { useGameStore } from '../store/gameStore';
import { useAppStore } from '../store/appStore';
import { pairTvDisplaySession } from '../services/tv/tvDisplayService';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'TvPairingScanner'> };

const extractTvCode = (value: string) => {
  const trimmed = value.trim();

  try {
    const url = new URL(trimmed);
    const codeFromQuery = url.searchParams.get('code');
    if (codeFromQuery) return codeFromQuery.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const codeFromPath = url.pathname.split('/').filter(Boolean).pop();
    if (codeFromPath) return codeFromPath.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  } catch {}

  return trimmed.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
};

export default function TvPairingScannerScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const language = useAppStore(s => s.language);
  const setPendingTvDisplayCode = useGameStore(s => s.setPendingTvDisplayCode);
  const [permission, setPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    let mounted = true;

    const request = async () => {
      if (Platform.OS !== 'android') {
        setPermission('granted');
        return;
      }

      const status = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
      if (!mounted) return;
      setPermission(status === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied');
    };

    void request();
    return () => { mounted = false; };
  }, []);

  const handleReadCode = async (rawValue?: string) => {
    if (scanned || !rawValue) return;

    const code = extractTvCode(rawValue);
    if (!code) return;

    setScanned(true);
    try {
      await pairTvDisplaySession(code, language === 'en' ? 'en' : 'ar');
      setPendingTvDisplayCode(code);
      navigation.goBack();
    } catch (error) {
      setScanned(false);
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('tvDisplay.startFailed'));
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('tvDisplay.scanTitle')}</Text>
      </View>

      <View style={styles.body}>
        {permission === 'pending' ? (
          <Text style={styles.message}>{t('common.loading')}</Text>
        ) : permission === 'denied' ? (
          <View style={styles.permissionCard}>
            <Text style={styles.permissionTitle}>{t('tvDisplay.cameraPermissionTitle')}</Text>
            <Text style={styles.permissionText}>{t('tvDisplay.cameraPermissionText')}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => { void Linking.openSettings(); }}>
              <Text style={styles.primaryBtnText}>{t('settings.title')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cameraWrap}>
            <Camera
              style={StyleSheet.absoluteFill}
              cameraType={CameraType.Back}
              scanBarcode={!scanned}
              showFrame
              laserColor={Colors.primaryLight}
              frameColor={Colors.primaryLight}
              onReadCode={event => { void handleReadCode(event.nativeEvent.codeStringValue); }}
            />
            <Text style={styles.scanHint}>{t('tvDisplay.scanHint')}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  backBtn: { padding: 4 },
  backText: { fontSize: 32, color: Colors.primaryLight, lineHeight: 36 },
  title: { fontSize: 20, color: Colors.text, fontWeight: '900' },
  body: { flex: 1, padding: 16 },
  cameraWrap: {
    flex: 1,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.backgroundCard,
  },
  scanHint: {
    position: 'absolute',
    bottom: 28,
    left: 24,
    right: 24,
    color: Colors.text,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    backgroundColor: Colors.overlay,
    borderRadius: 16,
    padding: 12,
  },
  message: { color: Colors.text, fontSize: 16, textAlign: 'center', marginTop: 40 },
  permissionCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 12,
  },
  permissionTitle: { color: Colors.text, fontSize: 18, fontWeight: '900' },
  permissionText: { color: Colors.textMuted, fontSize: 14, lineHeight: 21 },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: 14, padding: 14, alignItems: 'center' },
  primaryBtnText: { color: Colors.text, fontSize: 15, fontWeight: '900' },
});
