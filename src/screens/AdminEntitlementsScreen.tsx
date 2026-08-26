import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { listAppUsers } from '../services/admin/adminService';
import { listPackages } from '../services/packages/packageService';
import { grantEntitlementDirectly } from '../services/entitlements/adminEntitlementService';
import { useAuthStore } from '../store/authStore';
import { AppUserRecord, CategoryId, Package, RootStackParamList } from '../types';
import { Colors } from '../theme/colors';
import { CATEGORY_EMOJIS, FREE_CATEGORY_IDS } from '../constants';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'AdminEntitlements'> };

const PAID_CATEGORY_IDS = Object.keys(CATEGORY_EMOJIS).filter(id => !FREE_CATEGORY_IDS.includes(id)) as CategoryId[];

const getCategoryName = (t: (key: string, options?: Record<string, unknown>) => string, categoryId: CategoryId) =>
  t(`categories.${categoryId}`, { defaultValue: categoryId });

export default function AdminEntitlementsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { userRecord } = useAuthStore();
  const [users, setUsers] = useState<AppUserRecord[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [grantMethod, setGrantMethod] = useState<'package' | 'custom'>('package');
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [customCategoryIds, setCustomCategoryIds] = useState<CategoryId[]>([]);
  const [customDurationDays, setCustomDurationDays] = useState('30');
  const [mode, setMode] = useState<'extend' | 'replace'>('extend');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(false);

  const canOpen = Boolean(userRecord?.isAdmin || userRecord?.isSuperAdmin);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [nextUsers, nextPackages] = await Promise.all([listAppUsers(), listPackages()]);
      setUsers(nextUsers);
      setPackages(nextPackages);
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('admin.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!canOpen) {
      Alert.alert('', t('admin.accessDenied'));
      navigation.goBack();
      return;
    }
    void loadData();
  }, [canOpen, loadData, navigation, t]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter(user =>
      String(user.customerNumber ?? '').includes(query)
      || user.displayName?.toLowerCase().includes(query)
      || user.email?.toLowerCase().includes(query));
  }, [users, search]);

  const toggleUser = (uid: string) => {
    setSelectedUids(current => current.includes(uid) ? current.filter(id => id !== uid) : [...current, uid]);
  };

  const selectAllFiltered = () => {
    setSelectedUids(filteredUsers.map(user => user.uid));
  };

  const toggleCustomCategory = (categoryId: CategoryId) => {
    setCustomCategoryIds(current => current.includes(categoryId) ? current.filter(id => id !== categoryId) : [...current, categoryId]);
  };

  const activate = async () => {
    if (!selectedUids.length) {
      Alert.alert('', t('adminEntitlements.selectUserFirst'));
      return;
    }

    let categoryIds: CategoryId[];
    let durationDays: number;
    let packageId: string | undefined;

    if (grantMethod === 'package') {
      const pkg = packages.find(item => item.id === selectedPackageId);
      if (!pkg) {
        Alert.alert('', t('adminEntitlements.selectPackageFirst'));
        return;
      }
      categoryIds = pkg.categoryIds;
      durationDays = pkg.durationDays;
      packageId = pkg.id;
    } else {
      if (!customCategoryIds.length) {
        Alert.alert('', t('adminEntitlements.selectCategoryFirst'));
        return;
      }
      const parsedDays = Number(customDurationDays);
      if (!Number.isFinite(parsedDays) || parsedDays <= 0) {
        Alert.alert('', t('adminEntitlements.invalidDuration'));
        return;
      }
      categoryIds = customCategoryIds;
      durationDays = parsedDays;
    }

    const expiresAtMs = Date.now() + durationDays * 86400000;

    setActivating(true);
    try {
      const { results } = await grantEntitlementDirectly({
        uids: selectedUids,
        categoryIds,
        expiresAtMs,
        mode,
        note: note.trim() || undefined,
        packageId,
      });
      const failed = results.filter(result => !result.ok);
      if (failed.length) {
        Alert.alert(t('common.error'), t('adminEntitlements.someFailed', { count: failed.length }));
      } else {
        Alert.alert('', t('adminEntitlements.activatedSuccess', { count: results.length }));
      }
      setSelectedUids([]);
      setNote('');
      await loadData();
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('adminEntitlements.activateFailed'));
    } finally {
      setActivating(false);
    }
  };

  if (!canOpen) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>{t('adminEntitlements.title')}</Text>
            <Text style={styles.subtitle}>{t('adminEntitlements.subtitle')}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('adminEntitlements.searchSection')}</Text>
          <TextInput
            style={styles.textInput}
            value={search}
            onChangeText={setSearch}
            placeholder={t('adminEntitlements.searchPlaceholder')}
            placeholderTextColor={Colors.textMuted}
          />
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.roleBtn} onPress={selectAllFiltered}>
              <Text style={styles.roleBtnText}>{t('adminEntitlements.selectAllFiltered')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.roleBtn} onPress={() => setSelectedUids([])}>
              <Text style={styles.roleBtnText}>{t('adminEntitlements.clearSelection')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.exportHint}>{t('adminEntitlements.selectedCount', { count: selectedUids.length })}</Text>

          {loading ? <Text style={styles.emptyText}>{t('common.loading')}</Text> : null}
          {filteredUsers.slice(0, 60).map(user => {
            const isSelected = selectedUids.includes(user.uid);
            const hasActiveAccess = Boolean(user.entitlementExpiresAtMs && user.entitlementExpiresAtMs > Date.now());
            return (
              <TouchableOpacity key={user.uid} style={[styles.userRow, isSelected && styles.userRowSelected]} onPress={() => toggleUser(user.uid)}>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user.displayName || 'User'}{user.customerNumber ? ` · #${user.customerNumber}` : ''}</Text>
                  <Text style={styles.userMeta}>{user.email || t('admin.guestUser')}</Text>
                  {hasActiveAccess ? (
                    <Text style={styles.userMetaActive}>{t('admin.subscriptionUntil', { date: new Date(user.entitlementExpiresAtMs as number).toLocaleDateString() })}</Text>
                  ) : null}
                </View>
                <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                  {isSelected ? <Text style={styles.checkboxMark}>✓</Text> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('adminEntitlements.grantMethodSection')}</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.roleBtn, grantMethod === 'package' && styles.roleBtnActive]} onPress={() => setGrantMethod('package')}>
              <Text style={styles.roleBtnText}>{t('adminEntitlements.fromPackage')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.roleBtn, grantMethod === 'custom' && styles.roleBtnActive]} onPress={() => setGrantMethod('custom')}>
              <Text style={styles.roleBtnText}>{t('adminEntitlements.customRange')}</Text>
            </TouchableOpacity>
          </View>

          {grantMethod === 'package' ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipStrip}>
              {packages.map(pkg => (
                <TouchableOpacity key={pkg.id} style={[styles.chip, selectedPackageId === pkg.id && styles.chipActive]} onPress={() => setSelectedPackageId(pkg.id)}>
                  <Text style={styles.chipText}>{pkg.nameAr}</Text>
                  <Text style={styles.chipSubText}>{pkg.priceKwd} د.ك · {pkg.durationDays} {t('admin.days')}</Text>
                </TouchableOpacity>
              ))}
              {!packages.length ? <Text style={styles.emptyText}>{t('adminEntitlements.noPackagesYet')}</Text> : null}
            </ScrollView>
          ) : (
            <>
              <Text style={styles.inputLabel}>{t('admin.packageCategories')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipStrip}>
                {PAID_CATEGORY_IDS.map(categoryId => (
                  <TouchableOpacity key={categoryId} style={[styles.chip, customCategoryIds.includes(categoryId) && styles.chipActive]} onPress={() => toggleCustomCategory(categoryId)}>
                    <Text style={styles.chipText}>{CATEGORY_EMOJIS[categoryId]} {getCategoryName(t, categoryId)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.inputLabel}>{t('adminEntitlements.durationDays')}</Text>
              <TextInput style={styles.textInput} value={customDurationDays} onChangeText={setCustomDurationDays} keyboardType="number-pad" placeholder="30" placeholderTextColor={Colors.textMuted} />
            </>
          )}

          <Text style={styles.inputLabel}>{t('adminEntitlements.modeLabel')}</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.roleBtn, mode === 'extend' && styles.roleBtnActive]} onPress={() => setMode('extend')}>
              <Text style={styles.roleBtnText}>{t('adminEntitlements.extend')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.roleBtn, mode === 'replace' && styles.roleBtnActive]} onPress={() => setMode('replace')}>
              <Text style={styles.roleBtnText}>{t('adminEntitlements.replace')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.inputLabel}>{t('adminEntitlements.noteLabel')}</Text>
          <TextInput style={styles.textInput} value={note} onChangeText={setNote} placeholder={t('adminEntitlements.notePlaceholder')} placeholderTextColor={Colors.textMuted} multiline />

          <TouchableOpacity style={[styles.activateBtn, activating && styles.roleBtnDisabled]} disabled={activating} onPress={() => { void activate(); }}>
            <Text style={styles.activateBtnText}>{activating ? '...' : t('adminEntitlements.activateBtn')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, gap: 16, paddingBottom: 36 },
  header: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  backBtn: { padding: 4 },
  backText: { fontSize: 32, color: Colors.primaryLight, lineHeight: 36 },
  headerTextWrap: { flex: 1, gap: 4 },
  title: { color: Colors.text, fontSize: 24, fontWeight: '900' },
  subtitle: { color: Colors.textMuted, lineHeight: 20 },
  section: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 12,
  },
  sectionTitle: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  inputLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '800' },
  exportHint: { color: Colors.textMuted, fontSize: 12, lineHeight: 18 },
  emptyText: { color: Colors.textMuted, textAlign: 'center', paddingVertical: 10 },
  textInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: 'right',
  },
  actionsRow: { flexDirection: 'row', gap: 8 },
  roleBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  roleBtnActive: { borderColor: Colors.primaryLight, backgroundColor: Colors.primary + '22' },
  roleBtnDisabled: { opacity: 0.45 },
  roleBtnText: { color: Colors.text, fontWeight: '700', fontSize: 12 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  userRowSelected: { borderColor: Colors.primaryLight, backgroundColor: Colors.primary + '18' },
  userInfo: { flex: 1, gap: 3 },
  userName: { color: Colors.text, fontSize: 15, fontWeight: '800' },
  userMeta: { color: Colors.textMuted, fontSize: 12 },
  userMetaActive: { color: Colors.success, fontSize: 12, fontWeight: '700' },
  checkbox: {
    width: 26, height: 26, borderRadius: 8,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { borderColor: Colors.success, backgroundColor: Colors.success + '33' },
  checkboxMark: { color: Colors.success, fontWeight: '900' },
  chipStrip: { gap: 8, paddingVertical: 2 },
  chip: {
    minWidth: 120,
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    gap: 4,
  },
  chipActive: { borderColor: Colors.primaryLight, backgroundColor: Colors.primary + '22' },
  chipText: { color: Colors.text, fontSize: 12, fontWeight: '800' },
  chipSubText: { color: Colors.textMuted, fontSize: 11 },
  activateBtn: {
    backgroundColor: Colors.success,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activateBtnText: { color: Colors.text, fontSize: 16, fontWeight: '900' },
});
