import React, { useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { redeemPromoCode } from '../services/promo/promoRedeemService';
import { getContactConfig, buildWhatsAppUrl } from '../services/config/appConfigService';
import { useAuthStore } from '../store/authStore';
import { RootStackParamList } from '../types';
import { Colors } from '../theme/colors';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'PromoCodeRedeem'> };

export default function PromoCodeRedeemScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user, userRecord, refreshUserRecord } = useAuthStore();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const requiresAccount = !user || user.isAnonymous || Boolean(userRecord?.isGuest);

  const redeem = async () => {
    if (!code.trim()) return;
    setBusy(true);
    setResultMessage(null);
    try {
      const result = await redeemPromoCode(code);
      if (result.status === 'granted') {
        setResultMessage(t('promoRedeem.grantedMessage', {
          package: result.packageNameAr,
          date: new Date(result.expiresAtMs).toLocaleDateString(),
        }));
        await refreshUserRecord();
      } else {
        const discountLabel = result.type === 'discountPercent'
          ? `${result.discountValue}%`
          : `${result.discountValue} د.ك`;
        if (Platform.OS === 'ios') {
          setResultMessage(t('subscription.notAvailableIos'));
        } else {
          setResultMessage(t('promoRedeem.discountMessage', { discount: discountLabel }));
          const contact = await getContactConfig();
          if (contact.whatsappNumber) {
            const url = buildWhatsAppUrl(contact.whatsappNumber, t('promoRedeem.discountWhatsappMessage', { code: code.trim().toUpperCase(), discount: discountLabel }));
            void Linking.openURL(url).catch(() => {});
          }
        }
      }
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('promoRedeem.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 20 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('promoRedeem.title')}</Text>

        {requiresAccount ? (
          <View style={styles.accountCard}>
            <Text style={styles.accountText}>{t('promoRedeem.accountNotice')}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Auth')}>
              <Text style={styles.primaryBtnText}>{t('promoRedeem.registerNow')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.subtitle}>{t('promoRedeem.subtitle')}</Text>
            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={value => setCode(value.toUpperCase())}
              placeholder={t('promoRedeem.codePlaceholder')}
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={[styles.primaryBtn, busy && styles.primaryBtnDisabled]} disabled={busy || !code.trim()} onPress={() => { void redeem(); }}>
              <Text style={styles.primaryBtnText}>{busy ? '...' : t('promoRedeem.redeemBtn')}</Text>
            </TouchableOpacity>
            {resultMessage ? <Text style={styles.resultText}>{resultMessage}</Text> : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { flexGrow: 1, padding: 24, gap: 16 },
  backBtn: { padding: 4, alignSelf: 'flex-start' },
  backText: { fontSize: 32, color: Colors.primaryLight, lineHeight: 36 },
  title: { color: Colors.text, fontSize: 26, fontWeight: '900' },
  subtitle: { color: Colors.textMuted, fontSize: 14, lineHeight: 20 },
  codeInput: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
    paddingVertical: 16,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: Colors.text, fontSize: 16, fontWeight: '900' },
  resultText: {
    color: Colors.success,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    backgroundColor: Colors.success + '18',
    borderWidth: 1,
    borderColor: Colors.success + '44',
    borderRadius: 12,
    padding: 14,
  },
  accountCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 12,
  },
  accountText: { color: Colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
