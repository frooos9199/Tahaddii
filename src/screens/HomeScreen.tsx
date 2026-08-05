import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, FlatList, Image, ScrollView,
  StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { RootStackParamList, CategoryId } from '../types';
import { Colors } from '../theme/colors';
import { useAppStore } from '../store/appStore';
import { useGameStore } from '../store/gameStore';
import { useOnlineStore } from '../store/onlineStore';
import { useProfileStore } from '../store/profileStore';
import { CATEGORY_EMOJIS } from '../constants';
import { getCategoryQuestionCount, isCategoryPlayable } from '../services/questions/questionCatalog';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Home'> };

const { width: W } = Dimensions.get('window');

const FEATURED_CATEGORIES: { id: CategoryId; color: string; bg: string }[] = [
  { id: 'football',        color: '#10B981', bg: '#10B98122' },
  { id: 'science',         color: '#3B82F6', bg: '#3B82F622' },
  { id: 'geography',       color: '#F59E0B', bg: '#F59E0B22' },
  { id: 'cars',            color: '#EF4444', bg: '#EF444422' },
  { id: 'movies',          color: '#8B5CF6', bg: '#8B5CF622' },
  { id: 'animals',         color: '#EC4899', bg: '#EC489922' },
  { id: 'history',         color: '#F97316', bg: '#F9731622' },
  { id: 'space',           color: '#06B6D4', bg: '#06B6D422' },
  { id: 'generalKnowledge',color: '#7C3AED', bg: '#7C3AED22' },
  { id: 'math',            color: '#84CC16', bg: '#84CC1622' },
];

const PLAYABLE_FEATURED_CATEGORIES = FEATURED_CATEGORIES
  .filter(item => isCategoryPlayable(item.id))
  .sort((left, right) => getCategoryQuestionCount(right.id) - getCategoryQuestionCount(left.id));

const GAME_MODES = [
  { icon: '👥', labelKey: 'gameModes.group',  color: '#7C3AED', screen: 'GameModeSelect' as const },
  { icon: '🧒', labelKey: 'gameModes.kids',   color: '#EC4899', screen: 'GameModeSelect' as const },
  { icon: '🏆', labelKey: 'gameModes.teams',  color: '#F59E0B', screen: 'GameModeSelect' as const },
  { icon: '⚡', labelKey: 'gameModes.speedChallenge', color: '#EF4444', screen: 'GameModeSelect' as const },
];

export default function HomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const stats = useAppStore(s => s.stats);
  const loadSavedGame = useGameStore(s => s.loadSavedGame);
  const updateSettings = useGameStore(s => s.updateSettings);
  const { publicRooms, subscribeDiscoverableRooms, clearDiscoverableRooms } = useOnlineStore();
  const profile = useProfileStore(s => s.profile);
  const [hasSaved, setHasSaved] = useState(false);

  // pulse animation for online dot
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  useEffect(() => {
    loadSavedGame().then(setHasSaved);
    void subscribeDiscoverableRooms();
    return () => clearDiscoverableRooms();
  }, [clearDiscoverableRooms, loadSavedGame, subscribeDiscoverableRooms]);

  const startCategoryGame = (categoryId: CategoryId) => {
    updateSettings({ categories: [categoryId], mode: 'group' });
    navigation.navigate('AddPlayers');
  };

  const onlineCount = publicRooms.length;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── TOP BAR ── */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.appName}>{t('app.name')} 🎮</Text>
            <Text style={styles.tagline}>{t('app.tagline')}</Text>
          </View>
          <View style={styles.topBarRight}>
            <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('Profile')}>
              {profile.avatarUri
                ? <Image source={{ uri: profile.avatarUri }} style={styles.profileImg} />
                : <Text style={styles.profileEmoji}>{profile.name ? profile.avatarEmoji : '👤'}</Text>
              }
              {!!profile.name && <View style={styles.profileOnlineDot} />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsBtn} onPress={() => navigation.navigate('Settings')}>
              <Text style={styles.settingsIcon}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── STATS ROW ── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{stats.totalGames}</Text>
            <Text style={styles.statLabel}>{t('home.gamesPlayed')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{stats.bestScore}</Text>
            <Text style={styles.statLabel}>{t('home.bestScore')}</Text>
          </View>
          <View style={[styles.statCard, styles.statCardOnline]}>
            <View style={styles.onlineDotRow}>
              <Animated.View style={[styles.onlineDot, { transform: [{ scale: pulse }] }]} />
              <Text style={styles.statNumOnline}>{onlineCount}</Text>
            </View>
            <Text style={styles.statLabel}>{t('home.onlineLabel')}</Text>
          </View>
        </View>

        {/* ── QUICK PLAY ── */}
        <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('GameModeSelect')}>
          <View style={styles.quickLeft}>
            <Text style={styles.quickIcon}>⚡</Text>
            <View>
              <Text style={styles.quickTitle}>{t('home.quickPlay')}</Text>
              <Text style={styles.quickSub}>{t('home.quickPlaySub')}</Text>
            </View>
          </View>
          <Text style={styles.quickArrow}>›</Text>
        </TouchableOpacity>

        {/* ── CONTINUE ── */}
        {hasSaved && (
          <TouchableOpacity style={styles.continueBtn} onPress={() => navigation.navigate('Game')}>
            <Text style={styles.continueIcon}>▶️</Text>
            <Text style={styles.continueText}>{t('home.continueGame')}</Text>
          </TouchableOpacity>
        )}

        {/* ── ONLINE BANNER ── */}
        <TouchableOpacity style={styles.onlineBanner} onPress={() => navigation.navigate('OnlinePlay')}>
          <View style={styles.onlineBannerLeft}>
            <Text style={styles.onlineBannerIcon}>🌐</Text>
            <View>
              <Text style={styles.onlineBannerTitle}>{t('home.onlineBannerTitle')}</Text>
              <Text style={styles.onlineBannerSub}>
                {onlineCount > 0 ? t('home.activeRoomsNow', { count: onlineCount }) : t('home.createRoomInvite')}
              </Text>
            </View>
          </View>
          <View style={styles.onlineBannerBadge}>
            <Text style={styles.onlineBannerBadgeText}>{t('home.newBadge')}</Text>
          </View>
        </TouchableOpacity>

        {/* ── GAME MODES ── */}
        <Text style={styles.sectionTitle}>{t('home.gameModesSection')}</Text>
        <View style={styles.modesRow}>
          {GAME_MODES.map((m, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.modeCard, { borderColor: m.color + '66' }]}
              onPress={() => navigation.navigate(m.screen)}>
              <Text style={styles.modeIcon}>{m.icon}</Text>
              <Text style={styles.modeLabel}>{t(m.labelKey)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── CATEGORIES ── */}
        <Text style={styles.sectionTitle}>{t('home.playByCategory')}</Text>
        <FlatList
          data={PLAYABLE_FEATURED_CATEGORIES}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.catList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.catCard, { borderColor: item.color, backgroundColor: item.bg }]}
              onPress={() => startCategoryGame(item.id)}>
              <Text style={styles.catEmoji}>{CATEGORY_EMOJIS[item.id]}</Text>
              <Text style={[styles.catLabel, { color: item.color }]}>{t(`categories.${item.id}`)}</Text>
              <Text style={styles.catCount}>{getCategoryQuestionCount(item.id)}</Text>
            </TouchableOpacity>
          )}
        />

        {/* ── BOTTOM MENU ── */}
        <View style={styles.bottomMenu}>
          <TouchableOpacity style={styles.bottomBtn} onPress={() => navigation.navigate('Statistics')}>
            <Text style={styles.bottomIcon}>📊</Text>
            <Text style={styles.bottomLabel}>{t('common.statistics')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomBtn} onPress={() => navigation.navigate('OnlinePlay')}>
            <Text style={styles.bottomIcon}>🌐</Text>
            <Text style={styles.bottomLabel}>{t('home.onlineLabel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomBtn} onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.bottomIcon}>⚙️</Text>
            <Text style={styles.bottomLabel}>{t('common.settings')}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingBottom: 32 },

  topBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16,
  },
  appName: { fontSize: 26, fontWeight: '900', color: Colors.primaryLight },
  tagline: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.backgroundCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.primary,
    overflow: 'hidden',
  },
  profileImg: { width: '100%', height: '100%' },
  profileEmoji: { fontSize: 20 },
  profileOnlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.success,
    borderWidth: 1.5, borderColor: Colors.background,
  },
  settingsBtn: { padding: 8 },
  settingsIcon: { fontSize: 22 },

  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: Colors.backgroundCard,
    borderRadius: 14, padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  statCardOnline: { borderColor: Colors.success + '55' },
  catCount: { fontSize: 11, color: Colors.textMuted, fontWeight: '700' },
  statNum: { fontSize: 20, fontWeight: '800', color: Colors.accent },
  statNumOnline: { fontSize: 20, fontWeight: '800', color: Colors.success },
  statLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 3, textAlign: 'center' },
  onlineDotRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },

  quickBtn: {
    marginHorizontal: 20, marginBottom: 10,
    backgroundColor: Colors.primary,
    borderRadius: 18, padding: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  quickLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  quickIcon: { fontSize: 28 },
  quickTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  quickSub: { fontSize: 12, color: Colors.primaryLight, marginTop: 2 },
  quickArrow: { fontSize: 32, color: Colors.primaryLight, fontWeight: '300' },

  continueBtn: {
    marginHorizontal: 20, marginBottom: 10,
    backgroundColor: Colors.success + '22',
    borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: Colors.success,
  },
  continueIcon: { fontSize: 20 },
  continueText: { fontSize: 15, fontWeight: '700', color: Colors.success },

  onlineBanner: {
    marginHorizontal: 20, marginBottom: 20,
    backgroundColor: '#1E3A5F',
    borderRadius: 18, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.secondary + '88',
  },
  onlineBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  onlineBannerIcon: { fontSize: 28 },
  onlineBannerTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },
  onlineBannerSub: { fontSize: 12, color: '#93C5FD', marginTop: 2 },
  onlineBannerBadge: {
    backgroundColor: Colors.success, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  onlineBannerBadgeText: { fontSize: 11, fontWeight: '800', color: Colors.text },

  sectionTitle: {
    fontSize: 17, fontWeight: '800', color: Colors.text,
    paddingHorizontal: 20, marginBottom: 12,
  },

  modesRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 20, gap: 10, marginBottom: 24,
  },
  modeCard: {
    width: (W - 50) / 2,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16, padding: 16,
    alignItems: 'center', borderWidth: 1.5,
  },
  modeIcon: { fontSize: 30, marginBottom: 8 },
  modeLabel: { fontSize: 13, fontWeight: '700', color: Colors.text, textAlign: 'center' },

  catList: { paddingHorizontal: 20, gap: 10, paddingBottom: 4, marginBottom: 24 },
  catCard: {
    width: 100, borderRadius: 16, padding: 14,
    alignItems: 'center', borderWidth: 1.5,
  },
  catEmoji: { fontSize: 28, marginBottom: 6 },
  catLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center' },

  bottomMenu: {
    flexDirection: 'row', marginHorizontal: 20,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 18, borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  bottomBtn: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  bottomIcon: { fontSize: 22 },
  bottomLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 4, fontWeight: '600' },
});
