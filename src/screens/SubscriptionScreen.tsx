import React, { useCallback, useState } from 'react';
import { Alert, Linking, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { listPackages } from '../services/packages/packageService';
import { getContactConfig, buildWhatsAppUrl } from '../services/config/appConfigService';
import { useAuthStore } from '../store/authStore';
import { Package, RootStackParamList } from '../types';
import { Colors } from '../theme/colors';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Subscription'> };

export default function SubscriptionScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { user, userRecord, refreshUserRecord } = useAuthStore();
  const [packages, setPackages] = useState<Package[]>([]);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const isGuest = Boolean(user?.isAnonymous || userRecord?.isGuest);
  const hasActiveAccess = Boolean(userRecord?.entitlementExpiresAtMs && userRecord.entitlementExpiresAtMs > Date.now());

  useFocusEffect(useCallback(() => {
    let isMounted = true;
    setLoading(true);
    void refreshUserRecord();
    Promise.all([listPackages(), getContactConfig()]).then(([nextPackages, contact]) => {
      if (!isMounted) return;
      setPackages(nextPackages);
      setWhatsappNumber(contact.whatsappNumber);
    }).finally(() => {
      if (isMounted) setLoading(false);
    });
    return () => { isMounted = false; };
  }, [refreshUserRecord]));

  const canPurchaseInApp = Platform.OS !== 'ios';

  const buyPackage = (pkg: Package) => {
    if (!whatsappNumber) {
      Alert.alert('', t('categories.contactNotConfigured'));
      return;
    }
    const message = t('subscription.whatsappBuyMessage', {
      package: pkg.nameAr,
      customerNumber: userRecord?.customerNumber ?? '-',
    });
    Linking.openURL(buildWhatsAppUrl(whatsappNumber, message)).catch(() => {
      Alert.alert('', t('categories.whatsappOpenFailed'));
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('subscription.title')}</Text>
        </View>

        {isGuest ? (
          <View style={styles.card}>
            <Text style={styles.cardText}>{t('promoRedeem.guestNotice')}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Auth')}>
              <Text style={styles.primaryBtnText}>{t('promoRedeem.registerNow')}</Text>
            </TouchableOpacity>
          </View>
        ) : hasActiveAccess ? (
          <View style={[styles.card, styles.activeCard]}>
            <Text style={styles.activeTitle}>✅ {t('subscription.activeTitle')}</Text>
            <Text style={styles.cardText}>
              {t('admin.subscriptionUntil', { date: new Date(userRecord!.entitlementExpiresAtMs as number).toLocaleDateString() })}
            </Text>
            <Text style={styles.cardMuted}>
              {(userRecord?.unlockedCategoryIds || []).includes('*')
                ? t('adminEntitlements.fromPackage')
                : (userRecord?.unlockedCategoryIds || []).map(id => t(`categories.${id}`, { defaultValue: id })).join('، ')}
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardText}>{t('subscription.noneActive')}</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>{t('subscription.availablePackages')}</Text>
        {loading ? <Text style={styles.cardMuted}>{t('common.loading')}</Text> : null}
        {!loading && !packages.length ? <Text style={styles.cardMuted}>{t('adminEntitlements.noPackagesYet')}</Text> : null}
        {packages.map(pkg => (
          <View key={pkg.id} style={styles.packageCard}>
            <Text style={styles.packageName}>{pkg.nameAr}</Text>
            <Text style={styles.packageMeta}>{pkg.priceLabel || `${pkg.priceKwd} د.ك`} · {pkg.durationDays} {t('admin.days')}</Text>
            <Text style={styles.packageCategories}>
              {pkg.categoryIds.includes('*') ? t('admin.packageAllCategories') : pkg.categoryIds.map(id => t(`categories.${id}`, { defaultValue: id })).join('، ')}
            </Text>
            {canPurchaseInApp ? (
              <TouchableOpacity style={styles.buyBtn} onPress={() => buyPackage(pkg)}>
                <Text style={styles.buyBtnText}>{t('subscription.buyBtn')}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.cardMuted}>{t('subscription.notAvailableIos')}</Text>
            )}
          </View>
        ))}

        <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('PromoCodeRedeem')}>
          <Text style={styles.secondaryBtnText}>🎫 {t('subscription.havePromoCode')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, gap: 14, paddingBottom: 36 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { padding: 4 },
  backText: { fontSize: 32, color: Colors.primaryLight, lineHeight: 36 },
  title: { fontSize: 22, fontWeight: 'bold', color: Colors.text },
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 10,
  },
  activeCard: { borderColor: Colors.success },
  activeTitle: { color: Colors.success, fontSize: 16, fontWeight: '900' },
  cardText: { color: Colors.text, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  cardMuted: { color: Colors.textMuted, fontSize: 13, textAlign: 'center' },
  sectionTitle: { color: Colors.text, fontSize: 17, fontWeight: '800', marginTop: 6 },
  packageCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 6,
  },
  packageName: { color: Colors.text, fontSize: 16, fontWeight: '900' },
  packageMeta: { color: Colors.accent, fontSize: 14, fontWeight: '800' },
  packageCategories: { color: Colors.textMuted, fontSize: 12 },
  buyBtn: {
    marginTop: 6,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buyBtnText: { color: Colors.text, fontSize: 14, fontWeight: '900' },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { color: Colors.text, fontSize: 15, fontWeight: '900' },
  secondaryBtn: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  secondaryBtnText: { color: Colors.primaryLight, fontSize: 14, fontWeight: '800' },
});
