import React, { useEffect, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from '../types';
import { Colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import { useProfileStore } from '../store/profileStore';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Auth'> };

export default function AuthScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const profile = useProfileStore(s => s.profile);
  const { user, userRecord, loading, error, clearError, login, register, continueAsGuest } = useAuthStore();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [displayName, setDisplayName] = useState(profile.name);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);

  useEffect(() => {
    if (error) {
      Alert.alert(t('common.error'), error);
      clearError();
    }
  }, [clearError, error, t]);

  useEffect(() => {
    if (user) {
      navigation.goBack();
    }
  }, [navigation, user]);

  const handleSubmit = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('', t('auth.emailPasswordRequired'));
      return;
    }

    if (mode === 'register') {
      void register(email.trim(), password, displayName.trim());
      return;
    }

    void login(email.trim(), password);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>{t('auth.title')}</Text>
            <Text style={styles.heroSub}>{t('auth.subtitle')}</Text>
          </View>
        </View>

        {userRecord ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>{t('auth.currentSession')}</Text>
            <Text style={styles.statusText}>{userRecord.displayName || userRecord.email || userRecord.uid}</Text>
            <Text style={styles.statusMeta}>{userRecord.isGuest ? t('auth.guestMode') : userRecord.email ?? ''}</Text>
          </View>
        ) : null}

        <View style={styles.switcher}>
          <TouchableOpacity style={[styles.switchBtn, mode === 'login' && styles.switchBtnActive]} onPress={() => setMode('login')}>
            <Text style={styles.switchText}>{t('auth.login')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.switchBtn, mode === 'register' && styles.switchBtnActive]} onPress={() => setMode('register')}>
            <Text style={styles.switchText}>{t('auth.register')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          {mode === 'register' ? (
            <>
              <Text style={styles.label}>{t('auth.displayName')}</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder={t('auth.displayNamePlaceholder')}
                placeholderTextColor={Colors.textMuted}
              />
            </>
          ) : null}

          <Text style={styles.label}>{t('auth.email')}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder={t('auth.emailPlaceholder')}
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>{t('auth.password')}</Text>
          <View style={styles.passwordField}>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              placeholder={t('auth.passwordPlaceholder')}
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!passwordVisible}
            />
            <TouchableOpacity
              style={styles.passwordToggle}
              onPress={() => setPasswordVisible(visible => !visible)}
              accessibilityRole="button"
              accessibilityLabel={passwordVisible ? t('auth.hidePassword') : t('auth.showPassword')}>
              <Text style={styles.passwordToggleText}>{passwordVisible ? t('auth.hidePassword') : t('auth.showPassword')}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.primaryBtn, loading && styles.disabledBtn]} disabled={loading} onPress={handleSubmit}>
            <Text style={styles.primaryBtnText}>{mode === 'login' ? t('auth.loginNow') : t('auth.createAccount')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cardAlt}>
          <Text style={styles.altTitle}>{t('auth.guestTitle')}</Text>
          <Text style={styles.altText}>{t('auth.guestHint')}</Text>
          <TouchableOpacity
            style={[styles.secondaryBtn, loading && styles.disabledBtn]}
            disabled={loading}
            onPress={() => {
              void continueAsGuest(displayName.trim() || profile.name || 'Guest');
            }}>
            <Text style={styles.secondaryBtnText}>{t('auth.continueAsGuest')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, gap: 16, paddingBottom: 36 },
  header: { gap: 16 },
  backBtn: { alignSelf: 'flex-start', padding: 4 },
  backText: { fontSize: 32, color: Colors.primaryLight, lineHeight: 36 },
  hero: { gap: 6 },
  heroTitle: { color: Colors.text, fontSize: 30, fontWeight: '900' },
  heroSub: { color: Colors.textMuted, lineHeight: 22 },
  statusCard: {
    backgroundColor: Colors.secondary + '22',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.secondary,
    padding: 16,
    gap: 6,
  },
  statusTitle: { color: Colors.text, fontWeight: '800' },
  statusText: { color: Colors.primaryLight, fontSize: 16, fontWeight: '700' },
  statusMeta: { color: Colors.textMuted },
  switcher: { flexDirection: 'row', gap: 10 },
  switchBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundCard,
    alignItems: 'center',
  },
  switchBtnActive: { borderColor: Colors.primaryLight, backgroundColor: Colors.primary + '22' },
  switchText: { color: Colors.text, fontWeight: '700' },
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 10,
  },
  cardAlt: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 10,
  },
  label: { color: Colors.textSecondary, fontWeight: '700', marginTop: 4 },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  passwordField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
  },
  passwordInput: {
    flex: 1,
    color: Colors.text,
    paddingVertical: 14,
  },
  passwordToggle: { paddingVertical: 10, paddingLeft: 12 },
  passwordToggleText: { color: Colors.primaryLight, fontWeight: '800' },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: Colors.text, fontSize: 16, fontWeight: '800' },
  altTitle: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  altText: { color: Colors.textMuted, lineHeight: 22 },
  secondaryBtn: {
    backgroundColor: Colors.secondary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
  },
  secondaryBtnText: { color: Colors.text, fontSize: 16, fontWeight: '800' },
  disabledBtn: { opacity: 0.55 },
});