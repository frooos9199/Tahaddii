import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Animated, FlatList, Image, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { CategoryId, RootStackParamList, OnlineRoom } from '../types';
import { Colors } from '../theme/colors';
import { useOnlineStore } from '../store/onlineStore';
import { useProfileStore } from '../store/profileStore';
import { useAuthStore } from '../store/authStore';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'OnlinePlay'>;
  route: RouteProp<RootStackParamList, 'OnlinePlay'>;
};

const FAKE_ONLINE_PLAYERS = [
  { id: 'fake-ahmed', name: 'Ahmed', avatarEmoji: '👦', color: '#4ECDC4' },
  { id: 'fake-sara', name: 'Sara', avatarEmoji: '👧', color: '#FF6B9D' },
  { id: 'fake-ali', name: 'Ali', avatarEmoji: '🦁', color: '#FFB703' },
  { id: 'fake-nora', name: 'Nora', avatarEmoji: '⭐', color: '#7C5CFF' },
  { id: 'fake-omar', name: 'Omar', avatarEmoji: '🤖', color: '#00A8E8' },
  { id: 'fake-lina', name: 'Lina', avatarEmoji: '🐯', color: '#F77F00' },
  { id: 'fake-faisal', name: 'Faisal', avatarEmoji: '🚗', color: '#2A9D8F' },
  { id: 'fake-hessa', name: 'Hessa', avatarEmoji: '👩', color: '#E76F51' },
];

type StripPlayer = {
  id: string;
  name: string;
  avatarEmoji: string;
  avatarUri?: string | null;
  color: string;
  isReal?: boolean;
};

const CATEGORY_ICONS: Partial<Record<CategoryId, string>> = {
  football: '⚽',
  science: '🔬',
  geography: '🌍',
  generalKnowledge: '🧠',
  animals: '🦁',
  history: '📜',
};

function RoomCard({ room, onJoin, disabled }: { room: OnlineRoom; onJoin: () => void; disabled: boolean }) {
  const { t } = useTranslation();
  const isFull = room.playerCount >= room.maxPlayers;
  const categoryId = room.settings?.categories?.[0];
  const catLabel = room.settings?.categories?.[0]
    ? `${CATEGORY_ICONS[categoryId!] ?? '🎮'} ${t(`categories.${categoryId}`)}`
    : `🎮 ${t('online.mixedCategory')}`;
  const distanceLabel = typeof room.distanceKm === 'number'
    ? `${room.distanceKm < 1 ? Math.max(100, Math.round(room.distanceKm * 1000)) + ' ' + t('online.meterUnit') : room.distanceKm.toFixed(1) + ' ' + t('online.kilometerUnit')}`
    : null;

  return (
    <View style={roomStyles.card}>
      <View style={roomStyles.cardTop}>
        <View style={roomStyles.hostRow}>
          <View style={roomStyles.hostAvatar}>
            <Text style={roomStyles.hostAvatarText}>{room.hostName?.charAt(0)?.toUpperCase() ?? '?'}</Text>
          </View>
          <View>
            <Text style={roomStyles.hostName}>{room.hostName}</Text>
            <Text style={roomStyles.catLabel}>{catLabel}</Text>
          </View>
        </View>
        <View style={[roomStyles.statusBadge, isFull && roomStyles.statusFull]}>
          <Text style={roomStyles.statusText}>{isFull ? t('online.roomFull') : t('online.roomOpen')}</Text>
        </View>
      </View>
      <View style={roomStyles.cardBottom}>
        <View style={roomStyles.playersCount}>
          <Text style={roomStyles.playersIcon}>👥</Text>
          <Text style={roomStyles.playersText}>{room.playerCount}/{room.maxPlayers} {t('online.playersCount')}</Text>
        </View>
        <View style={roomStyles.playersCount}>
          <Text style={roomStyles.playersIcon}>
            {room.visibility === 'nearby' ? '📍' : '🌐'}
          </Text>
          <Text style={roomStyles.playersText}>
            {room.visibility === 'nearby' ? (distanceLabel ?? t('online.nearby')) : t('online.public')}
          </Text>
        </View>
        <TouchableOpacity
          style={[roomStyles.joinBtn, (isFull || disabled) && roomStyles.joinBtnDisabled]}
          disabled={isFull || disabled}
          onPress={onJoin}>
          <Text style={roomStyles.joinBtnText}>{isFull ? t('online.roomFull') : t('online.joinShort')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const normalizeRoomCodeInput = (value: string) => value.replace(/\s+/g, '').toUpperCase();

export default function OnlinePlayScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [customRoomCode, setCustomRoomCode] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showJoinCode, setShowJoinCode] = useState(false);
  const lastAutoJoinCode = useRef<string | null>(null);

  const {
    room, publicRooms, onlinePlayers, loading, error, firebaseReady,
    clearError, createOnlineRoom, joinOnlineRoom,
    joinPublicOnlineRoom, subscribeDiscoverableRooms, clearDiscoverableRooms,
  } = useOnlineStore();
  const profile = useProfileStore(s => s.profile);
  const user = useAuthStore(s => s.user);
  const userRecord = useAuthStore(s => s.userRecord);
  const savedPlayerName = profile.name || userRecord?.displayName || '';

  const stripPlayers = useMemo<StripPlayer[]>(() => {
    const realPlayers = onlinePlayers.map(player => ({
      id: player.id,
      name: player.name,
      avatarEmoji: player.avatarEmoji,
      avatarUri: player.avatarUri ?? (player.id === user?.uid ? profile.avatarUri : null),
      color: player.color,
      isReal: true,
    }));

    const fakePlayers = FAKE_ONLINE_PLAYERS.filter(fakePlayer => !realPlayers.some(player => player.name.trim().toLowerCase() === fakePlayer.name.toLowerCase()));
    return [...realPlayers, ...fakePlayers];
  }, [onlinePlayers, profile.avatarUri, user?.uid]);

  useEffect(() => {
    if (savedPlayerName && !playerName) setPlayerName(savedPlayerName);
  }, [playerName, savedPlayerName]);

  useEffect(() => {
    const linkedRoomCode = route.params?.roomCode;
    if (!linkedRoomCode) return;

    setRoomCode(normalizeRoomCodeInput(linkedRoomCode));
    setShowJoinCode(true);
  }, [route.params?.roomCode]);

  // scroll animation for players strip
  const scrollX = useRef(new Animated.Value(0)).current;
  const stripAnim = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const stripWidth = Math.max(1, stripPlayers.length) * 72;
    scrollX.setValue(0);
    stripAnim.current = Animated.loop(
      Animated.timing(scrollX, {
        toValue: -stripWidth,
        duration: Math.max(8, stripPlayers.length) * 1200,
        useNativeDriver: true,
      })
    );
    stripAnim.current.start();
    return () => stripAnim.current?.stop();
  }, [scrollX, stripPlayers.length]);

  useEffect(() => {
    if (room) navigation.replace('OnlineLobby');
  }, [navigation, room]);

  useEffect(() => {
    void subscribeDiscoverableRooms(profile, savedPlayerName);
    return () => clearDiscoverableRooms();
  }, [clearDiscoverableRooms, profile, savedPlayerName, subscribeDiscoverableRooms]);

  useEffect(() => {
    if (error) { Alert.alert(t('common.error'), error); clearError(); }
  }, [clearError, error, t]);

  useEffect(() => {
    const linkedRoomCode = normalizeRoomCodeInput(route.params?.roomCode ?? '');
    if (!linkedRoomCode || !playerName.trim() || loading || !firebaseReady || lastAutoJoinCode.current === linkedRoomCode) {
      return;
    }

    lastAutoJoinCode.current = linkedRoomCode;
    void joinOnlineRoom(linkedRoomCode, playerName);
  }, [firebaseReady, joinOnlineRoom, loading, playerName, route.params?.roomCode]);

  const handleCreate = (visibility: 'public' | 'private' | 'nearby') => {
    if (!playerName.trim()) { Alert.alert('', t('online.enterNameFirst')); return; }
    void createOnlineRoom(playerName, visibility, customRoomCode);
  };

  const handleJoinCode = () => {
    if (!playerName.trim()) { Alert.alert('', t('online.enterNameFirst')); return; }
    if (!roomCode.trim()) { Alert.alert('', t('online.enterRoomCode')); return; }
    void joinOnlineRoom(roomCode, playerName);
  };

  const totalOnline = stripPlayers.length;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>🌐 {t('home.onlineBannerTitle')}</Text>
          <View style={styles.onlineRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineCount}>{t('online.totalOnlineNow', { count: totalOnline })}</Text>
          </View>
        </View>
      </View>

      {/* ── PLAYERS STRIP ── */}
      <View style={styles.stripWrap}>
        <Animated.View style={[styles.strip, { transform: [{ translateX: scrollX }] }]}>
          {[...stripPlayers, ...stripPlayers].map((player, index) => (
            <View key={`${player.id}-${index}`} style={styles.stripPlayer}>
              <View style={[styles.stripAvatar, { borderColor: player.isReal ? Colors.success : player.color + '88' }]}> 
                {player.avatarUri ? (
                  <Image source={{ uri: player.avatarUri }} style={styles.stripAvatarImg} />
                ) : (
                  <Text style={styles.stripEmoji}>{player.avatarEmoji}</Text>
                )}
                {player.isReal ? <View style={styles.stripOnlineDot} /> : null}
              </View>
              <Text style={[styles.stripName, player.isReal && styles.stripRealName]} numberOfLines={1}>{player.name}</Text>
            </View>
          ))}
        </Animated.View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── NAME INPUT ── */}
        <View style={styles.nameCard}>
          <Text style={styles.nameLabel}>{t('online.yourGameName')}</Text>
          <TextInput
            style={styles.nameInput}
            value={playerName}
            onChangeText={setPlayerName}
            placeholder={t('online.enterNamePlaceholder')}
            placeholderTextColor={Colors.textMuted}
            maxLength={20}
          />
        </View>

        {!firebaseReady && (
          <View style={styles.warningCard}>
            <Text style={styles.warningText}>⚠️ {t('online.firebaseUnavailable')}</Text>
          </View>
        )}

        {/* ── ACTION BUTTONS ── */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.createBtn, (!firebaseReady || loading) && styles.disabled]}
            disabled={!firebaseReady || loading}
            onPress={() => setShowCreate(v => !v)}>
            <Text style={styles.actionIcon}>➕</Text>
            <Text style={styles.actionText}>{t('online.createRoom')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.joinBtn, (!firebaseReady || loading) && styles.disabled]}
            disabled={!firebaseReady || loading}
            onPress={() => setShowJoinCode(v => !v)}>
            <Text style={styles.actionIcon}>🔑</Text>
            <Text style={styles.actionText}>{t('online.joinWithCodeShort')}</Text>
          </TouchableOpacity>
        </View>

        {/* ── CREATE OPTIONS ── */}
        {showCreate && (
          <View style={styles.expandCard}>
            <Text style={styles.expandTitle}>{t('online.roomType')}</Text>
            <TextInput
              style={styles.customCodeInput}
              value={customRoomCode}
              onChangeText={value => setCustomRoomCode(normalizeRoomCodeInput(value))}
              placeholder={t('online.customCodePlaceholder')}
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="characters"
              maxLength={10}
            />
            <Text style={styles.customCodeHint}>{t('online.customCodeHint')}</Text>
            <TouchableOpacity style={styles.expandOption} onPress={() => handleCreate('public')}>
              <Text style={styles.expandOptionIcon}>🌐</Text>
              <View>
                <Text style={styles.expandOptionTitle}>{t('online.publicRoom')}</Text>
                <Text style={styles.expandOptionSub}>{t('online.publicRoomSub')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.expandOption} onPress={() => handleCreate('private')}>
              <Text style={styles.expandOptionIcon}>🔒</Text>
              <View>
                <Text style={styles.expandOptionTitle}>{t('online.privateRoom')}</Text>
                <Text style={styles.expandOptionSub}>{t('online.privateRoomSub')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.expandOption} onPress={() => handleCreate('nearby')}>
              <Text style={styles.expandOptionIcon}>📍</Text>
              <View>
                <Text style={styles.expandOptionTitle}>{t('online.nearbyRoom')}</Text>
                <Text style={styles.expandOptionSub}>{t('online.nearbyRoomSub')}</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* ── JOIN BY CODE ── */}
        {showJoinCode && (
          <View style={styles.expandCard}>
            <Text style={styles.expandTitle}>{t('online.roomCode')}</Text>
            <TextInput
              style={styles.codeInput}
              value={roomCode}
              onChangeText={value => setRoomCode(normalizeRoomCodeInput(value))}
              placeholder={t('online.roomCodeExample')}
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="characters"
              maxLength={10}
            />
            <TouchableOpacity
              style={[styles.joinCodeBtn, loading && styles.disabled]}
              disabled={loading}
              onPress={handleJoinCode}>
              <Text style={styles.joinCodeBtnText}>{t('online.joinRoom')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── ACTIVE ROOMS ── */}
        <Text style={styles.sectionTitle}>
          🔥 {t('online.activeRooms')} {publicRooms.length > 0 ? `(${publicRooms.length})` : ''}
        </Text>

        {publicRooms.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🎮</Text>
            <Text style={styles.emptyTitle}>{t('online.noRoomsNow')}</Text>
            <Text style={styles.emptySub}>{t('online.noRoomsInvite')}</Text>
          </View>
        ) : (
          <FlatList
            data={publicRooms}
            keyExtractor={r => r.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <RoomCard
                room={item}
                disabled={!firebaseReady || loading || !playerName.trim()}
                onJoin={() => {
                  if (!playerName.trim()) { Alert.alert('', t('online.enterNameFirst')); return; }
                  void joinPublicOnlineRoom(item.id, playerName);
                }}
              />
            )}
            contentContainerStyle={{ gap: 12 }}
          />
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const roomStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 18, borderWidth: 1, borderColor: Colors.border,
    padding: 16, gap: 12,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hostAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary + '44',
    alignItems: 'center', justifyContent: 'center',
  },
  hostAvatarText: { fontSize: 18, fontWeight: '800', color: Colors.primaryLight },
  hostName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  catLabel: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  statusBadge: {
    backgroundColor: Colors.success + '33', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.success,
  },
  statusFull: { backgroundColor: Colors.error + '33', borderColor: Colors.error },
  statusText: { fontSize: 12, fontWeight: '700', color: Colors.text },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  playersCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  playersIcon: { fontSize: 14 },
  playersText: { fontSize: 13, color: Colors.textMuted },
  joinBtn: {
    marginLeft: 'auto', backgroundColor: Colors.primary,
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8,
  },
  joinBtnDisabled: { backgroundColor: Colors.border },
  joinBtnText: { color: Colors.text, fontWeight: '800', fontSize: 13 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, paddingBottom: 40, gap: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 32, color: Colors.primaryLight, lineHeight: 36 },
  headerCenter: { flex: 1 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  onlineCount: { fontSize: 12, color: Colors.success, fontWeight: '600' },
  profileHeaderBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.backgroundCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.primary,
    overflow: 'hidden',
  },
  profileHeaderImg: { width: '100%', height: '100%' },
  profileHeaderEmoji: { fontSize: 20 },

  stripWrap: { height: 80, overflow: 'hidden', marginBottom: 4 },
  strip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  stripPlayer: { alignItems: 'center', width: 64, marginRight: 8 },
  stripAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.backgroundCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.primary + '55',
    overflow: 'hidden',
  },
  stripAvatarImg: { width: '100%', height: '100%' },
  stripEmoji: { fontSize: 22 },
  stripOnlineDot: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.success,
    borderWidth: 2,
    borderColor: Colors.backgroundCard,
  },
  stripName: { fontSize: 10, color: Colors.textMuted, marginTop: 3 },
  stripRealName: { color: Colors.text, fontWeight: '800' },

  nameCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: Colors.border, gap: 8,
  },
  nameLabel: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  nameInput: {
    backgroundColor: Colors.background, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.text, fontSize: 16,
    paddingHorizontal: 14, paddingVertical: 12,
    textAlign: 'right',
  },

  warningCard: {
    backgroundColor: Colors.warning + '22', borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: Colors.warning,
  },
  warningText: { color: Colors.warning, fontWeight: '600', textAlign: 'center' },

  actionsRow: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex: 1, borderRadius: 16, padding: 16,
    alignItems: 'center', gap: 6,
  },
  createBtn: { backgroundColor: Colors.primary },
  joinBtn: { backgroundColor: Colors.secondary },
  disabled: { opacity: 0.5 },
  actionIcon: { fontSize: 24 },
  actionText: { fontSize: 14, fontWeight: '800', color: Colors.text },

  expandCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border, gap: 12,
  },
  expandTitle: { fontSize: 15, fontWeight: '700', color: Colors.textSecondary },
  expandOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.background, borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: Colors.border,
  },
  expandOptionIcon: { fontSize: 24 },
  expandOptionTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  expandOptionSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  customCodeInput: {
    backgroundColor: Colors.background, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.text, fontSize: 18, fontWeight: '800',
    paddingHorizontal: 14, paddingVertical: 12,
    textAlign: 'center', letterSpacing: 3,
  },
  customCodeHint: { color: Colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center' },

  codeInput: {
    backgroundColor: Colors.background, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.text, fontSize: 24, fontWeight: '800',
    paddingHorizontal: 14, paddingVertical: 12,
    textAlign: 'center', letterSpacing: 6,
  },
  joinCodeBtn: {
    backgroundColor: Colors.success, borderRadius: 12,
    padding: 14, alignItems: 'center',
  },
  joinCodeBtnText: { color: Colors.text, fontSize: 16, fontWeight: '800' },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },

  emptyCard: {
    backgroundColor: Colors.backgroundCard, borderRadius: 18,
    padding: 32, alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  emptySub: { fontSize: 13, color: Colors.textMuted },
});
