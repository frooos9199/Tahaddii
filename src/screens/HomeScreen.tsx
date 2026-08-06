import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Dimensions, Image, ScrollView,
  StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { CategoryCard, RootStackParamList, CategoryId } from '../types';
import { Colors } from '../theme/colors';
import { useAppStore } from '../store/appStore';
import { useGameStore } from '../store/gameStore';
import { useOnlineStore } from '../store/onlineStore';
import { useProfileStore } from '../store/profileStore';
import { CATEGORY_EMOJIS } from '../constants';
import { getCategoryCardLabel, getCategoryFallbackEmoji, listCategoryCards } from '../services/categories/categoryCardService';
import {
  getCategoryQuestionCount,
  getCategoryQuestionCountFromBank,
  loadQuestionBank,
} from '../services/questions/questionCatalog';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Home'> };

const { width: W } = Dimensions.get('window');

export default function HomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const language = useAppStore(s => s.language);
  const stats = useAppStore(s => s.stats);
  const loadSavedGame = useGameStore(s => s.loadSavedGame);
  const updateSettings = useGameStore(s => s.updateSettings);
  const { publicRooms, subscribeDiscoverableRooms, clearDiscoverableRooms } = useOnlineStore();
  const profile = useProfileStore(s => s.profile);
  const [hasSaved, setHasSaved] = useState(false);
  const [categoryCards, setCategoryCards] = useState<CategoryCard[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<CategoryId[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<CategoryId, number>>({});

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

  useEffect(() => {
    let isMounted = true;

    Promise.all([listCategoryCards(), loadQuestionBank()]).then(([cards, questions]) => {
      if (!isMounted) return;

      const nextCounts = Object.fromEntries(
        cards.map(item => [item.id, getCategoryQuestionCountFromBank(questions, item.id)]),
      ) as Record<CategoryId, number>;
      setCategoryCounts(nextCounts);
      setCategoryCards(cards.filter(item => (nextCounts[item.id] ?? getCategoryQuestionCount(item.id)) > 0));
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const visibleCards = useMemo(() => categoryCards.filter(card => (categoryCounts[card.id] ?? getCategoryQuestionCount(card.id)) > 0), [categoryCards, categoryCounts]);

  const toggleCategory = (categoryId: CategoryId) => {
    setSelectedCategories(current => current.includes(categoryId)
      ? current.filter(item => item !== categoryId)
      : [...current, categoryId]);
  };

  const selectAllCategories = () => setSelectedCategories(visibleCards.map(card => card.id));
  const clearCategories = () => setSelectedCategories([]);

  const startChallenge = () => {
    const categories = selectedCategories.length ? selectedCategories : visibleCards.map(card => card.id);
    updateSettings({ categories, mode: 'group' });
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

        <View style={styles.categoryHeader}>
          <View>
            <Text style={styles.sectionTitle}>اختار التصنيفات</Text>
            <Text style={styles.sectionSub}>تقدر تختار الكل أو بطاقات معينة للتحدي</Text>
          </View>
          <View style={styles.categoryActions}>
            <TouchableOpacity style={styles.smallAction} onPress={selectAllCategories}>
              <Text style={styles.smallActionText}>الكل</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.smallAction} onPress={clearCategories}>
              <Text style={styles.smallActionText}>مسح</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.categoryGrid}>
          {visibleCards.map(card => {
            const selected = selectedCategories.includes(card.id);
            return (
              <View
                key={card.id}
                style={styles.categoryItem}>
                <TouchableOpacity
                  style={[styles.categoryCard, { borderColor: selected ? card.accentColor : Colors.border }, selected && styles.categoryCardSelected]}
                  onPress={() => toggleCategory(card.id)}>
                  {card.imageUrl ? (
                    <Image source={{ uri: card.imageUrl }} style={styles.categoryImage} />
                  ) : (
                    <View style={[styles.categoryImageFallback, { backgroundColor: card.accentColor + '33' }]}>
                      <Text style={styles.categoryEmoji}>{CATEGORY_EMOJIS[card.id] || getCategoryFallbackEmoji(card.id)}</Text>
                    </View>
                  )}
                  <View style={styles.categoryShade} />
                  {selected ? <View style={[styles.categoryCheck, { backgroundColor: card.accentColor }]}><Text style={styles.categoryCheckText}>✓</Text></View> : null}
                </TouchableOpacity>
                <Text style={styles.categoryTitle} numberOfLines={2}>{getCategoryCardLabel(card, language === 'en' ? 'en' : 'ar')}</Text>
              </View>
            );
          })}
        </View>

        <TouchableOpacity style={[styles.startChallengeBtn, !visibleCards.length && styles.startChallengeDisabled]} disabled={!visibleCards.length} onPress={startChallenge}>
          <Text style={styles.startChallengeText}>{selectedCategories.length ? `ابدأ التحدي (${selectedCategories.length})` : 'ابدأ بكل التصنيفات'}</Text>
        </TouchableOpacity>

        {/* ── BOTTOM MENU ── */}
        <View style={styles.bottomMenu}>
          <TouchableOpacity style={styles.bottomBtn} onPress={() => navigation.navigate('Auth')}>
            <Text style={styles.bottomIcon}>🔐</Text>
            <Text style={styles.bottomLabel}>{t('auth.login')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomBtn} onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.bottomIcon}>👤</Text>
            <Text style={styles.bottomLabel}>{t('common.profile')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomBtn} onPress={() => navigation.navigate('LanguageSelect')}>
            <Text style={styles.bottomIcon}>🌐</Text>
            <Text style={styles.bottomLabel}>{t('common.language')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomBtn} onPress={() => navigation.navigate('Statistics')}>
            <Text style={styles.bottomIcon}>📊</Text>
            <Text style={styles.bottomLabel}>{t('common.statistics')}</Text>
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
  sectionSub: { fontSize: 12, color: Colors.textMuted, paddingHorizontal: 20, marginTop: -8 },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  categoryActions: { flexDirection: 'row', gap: 6, paddingRight: 20, paddingTop: 2 },
  smallAction: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  smallActionText: { color: Colors.primaryLight, fontSize: 12, fontWeight: '800' },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  categoryItem: {
    width: (W - 60) / 3,
    alignItems: 'center',
    gap: 7,
  },
  categoryCard: {
    width: '100%',
    aspectRatio: 0.86,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1.5,
  },
  categoryCardSelected: { transform: [{ scale: 0.98 }] },
  categoryImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  categoryImageFallback: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  categoryEmoji: { fontSize: 34 },
  categoryShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.26)',
  },
  categoryTitle: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '900',
    minHeight: 34,
    paddingHorizontal: 2,
    textAlign: 'center',
  },
  categoryCheck: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.text,
  },
  categoryCheckText: { color: Colors.text, fontWeight: '900', fontSize: 13 },
  startChallengeBtn: {
    marginHorizontal: 20,
    marginBottom: 18,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  startChallengeDisabled: { opacity: 0.45 },
  startChallengeText: { color: Colors.text, fontSize: 17, fontWeight: '900' },

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
  bottomBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 2 },
  bottomIcon: { fontSize: 20 },
  bottomLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 4, fontWeight: '700', textAlign: 'center' },
});
