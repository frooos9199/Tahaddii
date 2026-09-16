import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from '../types';
import { Colors } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import { useProfileStore } from '../store/profileStore';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Auth'> };

export default function AuthScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const profile = useProfileStore(s => s.profile);
  const { user, loading, error, clearError, login, register, resetPassword } = useAuthStore();

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
    if (user && !user.isAnonymous) {
      navigation.goBack();
    }
  }, [navigation, user]);

  const handleSubmit = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('', t('auth.emailPasswordRequired'));
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      Alert.alert('', t('auth.invalidEmail'));
      return;
    }

    if (password.length < 6) {
      Alert.alert('', t('auth.passwordTooShort'));
      return;
    }

    if (mode === 'register') {
      if (!displayName.trim()) {
        Alert.alert('', t('auth.nameRequired'));
        return;
      }
      void register(email.trim(), password, displayName.trim());
      return;
    }

    void login(email.trim(), password);
  };

  const handlePasswordReset = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      Alert.alert('', t('auth.resetEmailRequired'));
      return;
    }

    const sent = await resetPassword(email.trim());
    if (sent) {
      Alert.alert(t('auth.resetSentTitle'), t('auth.resetSentMessage'));
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, 16) + 20 }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>{t('auth.title')}</Text>
            <Text style={styles.heroSub}>{t('auth.subtitle')}</Text>
          </View>
        </View>

        <View style={styles.switcher}>
          <TouchableOpacity style={[styles.switchBtn, mode === 'login' && styles.switchBtnActive]} onPress={() => { clearError(); setMode('login'); }}>
            <Text style={styles.switchText}>{t('auth.login')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.switchBtn, mode === 'register' && styles.switchBtnActive]} onPress={() => { clearError(); setMode('register'); }}>
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
                autoComplete="name"
                returnKeyType="next"
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
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
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
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              textContentType={mode === 'login' ? 'password' : 'newPassword'}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
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
            <Text style={styles.primaryBtnText}>{loading ? t('common.loading') : mode === 'login' ? t('auth.loginNow') : t('auth.createAccount')}</Text>
          </TouchableOpacity>
          {mode === 'login' ? (
            <TouchableOpacity disabled={loading} onPress={() => { void handlePasswordReset(); }}>
              <Text style={styles.forgotPasswordText}>{t('auth.forgotPassword')}</Text>
            </TouchableOpacity>
          ) : null}
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
  forgotPasswordText: { color: Colors.primaryLight, fontWeight: '700', textAlign: 'center', paddingVertical: 8 },
  disabledBtn: { opacity: 0.55 },
});