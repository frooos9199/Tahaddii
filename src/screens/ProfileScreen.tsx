import React, { useState } from 'react';
import {
  Alert, Image, ScrollView, StatusBar, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from '../types';
import { Colors } from '../theme/colors';
import { useProfileStore } from '../store/profileStore';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { updateCurrentUserDisplayName } from '../services/auth/authService';
import { uploadProfileAvatar } from '../services/storage/profileAvatarService';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Profile'> };

const EMOJIS = ['🎮','🦁','🐯','🤖','⭐','🚀','🔥','⚡','🏆','👑','🎯','💎'];
const COLORS = [
  '#7C3AED','#2563EB','#10B981','#F59E0B',
  '#EF4444','#EC4899','#06B6D4','#84CC16',
  '#F97316','#8B5CF6','#14B8A6','#F43F5E',
];

export default function ProfileScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { profile, updateProfile, clearProfile } = useProfileStore();
  const stats = useAppStore(s => s.stats);
  const { user, userRecord, logout, loading: authLoading, refreshUserRecord } = useAuthStore();

  const [name, setName] = useState(profile.name);
  const [emoji, setEmoji] = useState(profile.avatarEmoji);
  const [color, setColor] = useState(profile.color);
  const [avatarUri, setAvatarUri] = useState<string | null>(profile.avatarUri);
  const [saving, setSaving] = useState(false);

  const pickImage = () => {
    Alert.alert(t('profileScreen.profilePhoto'), t('profileScreen.photoSource'), [
      {
        text: t('profileScreen.camera'),
        onPress: () => launchCamera({ mediaType: 'photo', quality: 0.7, includeBase64: false }, res => {
          if (res.assets?.[0]?.uri) setAvatarUri(res.assets[0].uri!);
        }),
      },
      {
        text: t('profileScreen.photoLibrary'),
        onPress: () => launchImageLibrary({ mediaType: 'photo', quality: 0.7, includeBase64: false }, res => {
          if (res.assets?.[0]?.uri) setAvatarUri(res.assets[0].uri!);
        }),
      },
      { text: t('profileScreen.removePhoto'), style: 'destructive', onPress: () => setAvatarUri(null) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const save = async () => {
    if (!name.trim()) { Alert.alert('', t('profileScreen.enterName')); return; }
    setSaving(true);
    try {
      const trimmedName = name.trim();
      let sharedAvatarUri = avatarUri;
      if (avatarUri && user) {
        sharedAvatarUri = await uploadProfileAvatar(user.uid, avatarUri).catch(() => avatarUri);
      }
      await updateProfile({ name: trimmedName, avatarEmoji: emoji, color, avatarUri: sharedAvatarUri });
      if (userRecord && !userRecord.isGuest) {
        await updateCurrentUserDisplayName(trimmedName);
        await refreshUserRecord();
      }
      Alert.alert('✅', t('profileScreen.saved'));
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('profileScreen.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const confirmClear = () => {
    Alert.alert(t('profileScreen.deleteProfile'), t('profileScreen.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => { await clearProfile(); navigation.goBack(); } },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('profileScreen.title')}</Text>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={save} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? '...' : t('common.save')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickImage} style={[styles.avatarWrap, { borderColor: color }]}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: color + '33' }]}>
                <Text style={styles.avatarEmoji}>{emoji}</Text>
              </View>
            )}
            <View style={[styles.editBadge, { backgroundColor: color }]}>
              <Text style={styles.editBadgeText}>✏️</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>{t('profileScreen.changePhotoHint')}</Text>
        </View>

        {/* Name */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('profileScreen.name')}</Text>
          <TextInput
            style={[styles.nameInput, { borderColor: color }]}
            value={name}
            onChangeText={setName}
            placeholder={t('profileScreen.namePlaceholder')}
            placeholderTextColor={Colors.textMuted}
            maxLength={20}
            textAlign="right"
          />
        </View>

        {/* Emoji picker */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('profileScreen.avatarEmoji')}</Text>
          <View style={styles.emojiGrid}>
            {EMOJIS.map(e => (
              <TouchableOpacity
                key={e}
                style={[styles.emojiBtn, emoji === e && { borderColor: color, backgroundColor: color + '22' }]}
                onPress={() => setEmoji(e)}>
                <Text style={styles.emojiText}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Color picker */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('profileScreen.favoriteColor')}</Text>
          <View style={styles.colorGrid}>
            {COLORS.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.colorDot, { backgroundColor: c },
                  color === c && styles.colorDotSelected]}
                onPress={() => setColor(c)}
              />
            ))}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('profileScreen.yourStats')}</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{stats.totalGames}</Text>
              <Text style={styles.statLabel}>{t('profileScreen.games')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{stats.bestScore}</Text>
              <Text style={styles.statLabel}>{t('profileScreen.bestScore')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{stats.correctAnswers}</Text>
              <Text style={styles.statLabel}>{t('profileScreen.correctAnswers')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('profileScreen.account')}</Text>
          <Text style={styles.accountTitle}>{userRecord?.displayName || t('profileScreen.notRegistered')}</Text>
          <Text style={styles.accountMeta}>{userRecord?.email || (userRecord?.isGuest ? t('profileScreen.guest') : t('profileScreen.signInToManage'))}</Text>
          <View style={styles.accountActions}>
            <TouchableOpacity style={styles.accountBtn} onPress={() => navigation.navigate('Auth')}>
              <Text style={styles.accountBtnText}>{userRecord ? t('profileScreen.manageLogin') : t('profileScreen.loginOrCreate')}</Text>
            </TouchableOpacity>
            {(userRecord?.isAdmin || userRecord?.isSuperAdmin) ? (
              <TouchableOpacity style={styles.adminBtn} onPress={() => navigation.navigate('AdminPanel')}>
                <Text style={styles.adminBtnText}>{t('profileScreen.adminPanel')}</Text>
              </TouchableOpacity>
            ) : null}
            {userRecord ? (
              <TouchableOpacity style={[styles.logoutBtn, authLoading && styles.logoutBtnDisabled]} disabled={authLoading} onPress={() => {
                void logout();
              }}>
                <Text style={styles.logoutBtnText}>{t('profileScreen.logout')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Preview */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('profileScreen.onlinePreview')}</Text>
          <View style={[styles.preview, { borderColor: color }]}>
            <View style={[styles.previewAvatar, { backgroundColor: color + '33', borderColor: color }]}>
              {avatarUri
                ? <Image source={{ uri: avatarUri }} style={styles.previewImg} />
                : <Text style={styles.previewEmoji}>{emoji}</Text>
              }
            </View>
            <View>
              <Text style={[styles.previewName, { color }]}>{name || t('profileScreen.namePreview')}</Text>
              <View style={styles.onlineRow}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>{t('profileScreen.online')}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Danger */}
        <TouchableOpacity style={styles.dangerBtn} onPress={confirmClear}>
          <Text style={styles.dangerText}>🗑️ {t('profileScreen.deleteProfile')}</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, paddingBottom: 40, gap: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: { padding: 4, minWidth: 40 },
  backText: { fontSize: 32, color: Colors.primaryLight, lineHeight: 36 },
  title: { fontSize: 20, fontWeight: '800', color: Colors.text },
  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: Colors.text, fontWeight: '800', fontSize: 14 },

  avatarSection: { alignItems: 'center', paddingVertical: 8 },
  avatarWrap: {
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 3, overflow: 'hidden',
    position: 'relative',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarFallback: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 52 },
  editBadge: {
    position: 'absolute', bottom: 4, right: 4,
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  editBadgeText: { fontSize: 12 },
  avatarHint: { fontSize: 12, color: Colors.textMuted, marginTop: 8 },

  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border, gap: 12,
  },
  cardLabel: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },

  nameInput: {
    backgroundColor: Colors.background, borderRadius: 12,
    borderWidth: 2, color: Colors.text,
    fontSize: 18, fontWeight: '700',
    paddingHorizontal: 14, paddingVertical: 12,
  },

  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiBtn: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  emojiText: { fontSize: 24 },

  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorDot: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 3, borderColor: 'transparent',
  },
  colorDotSelected: { borderColor: Colors.text, transform: [{ scale: 1.15 }] },

  statsGrid: { flexDirection: 'row', gap: 10 },
  statItem: {
    flex: 1, backgroundColor: Colors.background,
    borderRadius: 12, padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  statNum: { fontSize: 22, fontWeight: '800', color: Colors.accent },
  statLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 3 },

  preview: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.background, borderRadius: 14,
    padding: 14, borderWidth: 2,
  },
  previewAvatar: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, overflow: 'hidden',
  },
  previewImg: { width: '100%', height: '100%' },
  previewEmoji: { fontSize: 26 },
  previewName: { fontSize: 18, fontWeight: '800' },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.success },
  onlineText: { fontSize: 11, color: Colors.success, fontWeight: '600' },
  accountTitle: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  accountMeta: { color: Colors.textMuted, lineHeight: 20 },
  accountActions: { gap: 10 },
  accountBtn: {
    backgroundColor: Colors.secondary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  accountBtnText: { color: Colors.text, fontWeight: '800' },
  adminBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  adminBtnText: { color: Colors.text, fontWeight: '800' },
  logoutBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  logoutBtnDisabled: { opacity: 0.5 },
  logoutBtnText: { color: Colors.warning, fontWeight: '800' },

  dangerBtn: {
    backgroundColor: Colors.error + '22', borderRadius: 14,
    padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.error,
  },
  dangerText: { color: Colors.error, fontWeight: '700', fontSize: 15 },
});
