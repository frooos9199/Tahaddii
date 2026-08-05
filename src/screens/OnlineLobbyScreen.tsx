import React, { useEffect } from 'react';
import { Alert, Linking, ScrollView, Share, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import Clipboard from '@react-native-clipboard/clipboard';
import { RootStackParamList } from '../types';
import { Colors } from '../theme/colors';
import { useOnlineStore } from '../store/onlineStore';
import { getAvailableQuestionCount, getRecommendedFairQuestionCount } from '../services/questions/questionCatalog';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'OnlineLobby'> };

const STATUS_KEY_MAP = {
  lobby: 'online.statusLobby',
  playing: 'online.statusPlaying',
  results: 'online.statusResults',
  ended: 'online.statusEnded',
} as const;

const getRoomInviteLink = (roomCode: string) => `tahaddi://online/join/${encodeURIComponent(roomCode)}`;

export default function OnlineLobbyScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { room, players, currentPlayerId, loading, error, clearError, startCurrentRoom, leaveCurrentRoom, deleteCurrentRoom } = useOnlineStore();

  useEffect(() => {
    if (!room) {
      navigation.replace('OnlinePlay');
    }
  }, [navigation, room]);

  useEffect(() => {
    if (room?.status === 'playing') {
      navigation.replace('OnlineGame');
    }
  }, [navigation, room?.status]);

  useEffect(() => {
    if (error) {
      Alert.alert(t('common.error'), error);
      clearError();
    }
  }, [clearError, error, t]);

  if (!room) {
    return null;
  }

  const isHost = room.hostId === currentPlayerId;
  const availableQuestionCount = getAvailableQuestionCount({
    categories: room.settings.categories,
    ageGroup: room.settings.ageGroup,
    difficulty: room.settings.difficulty,
    questionLanguage: room.settings.questionLanguage,
  });
  const recommendedQuestionCount = getRecommendedFairQuestionCount({
    availableQuestionCount,
    playerCount: players.length,
  });

  const copyRoomCode = () => {
    Clipboard.setString(room.code);
    Alert.alert('', t('online.copiedRoomCode'));
  };

  const shareRoomCodeOnWhatsApp = async () => {
    const message = t('online.inviteMessage', { roomCode: room.code, link: getRoomInviteLink(room.code) });
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;

    try {
      const canOpenWhatsApp = await Linking.canOpenURL(whatsappUrl);
      if (canOpenWhatsApp) {
        await Linking.openURL(whatsappUrl);
        return;
      }

      await Share.share({ message });
    } catch {
      await Share.share({ message });
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
            <Text style={styles.backText}>{'‹'}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('online.lobbyTitle')}</Text>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroRole}>{isHost ? t('online.hostLabel') : t('online.playerLabel')}</Text>
          <Text style={styles.heroCodeLabel}>{t('online.roomCode')}</Text>
          <TouchableOpacity onPress={copyRoomCode} activeOpacity={0.75}>
            <Text style={styles.heroCode}>{room.code}</Text>
          </TouchableOpacity>
          <Text style={styles.heroHint}>{t('online.shareHint')}</Text>
          <View style={styles.shareActions}>
            <TouchableOpacity style={styles.copyBtn} onPress={copyRoomCode}>
              <Text style={styles.copyBtnText}>{t('online.copyCode')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.whatsappBtn} onPress={() => {
              void shareRoomCodeOnWhatsApp();
            }}>
              <Text style={styles.whatsappBtnText}>{t('online.sendWhatsApp')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.heroStatus}>{t(STATUS_KEY_MAP[room.status])}</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{t('online.players')}</Text>
          {players.map(player => (
            <View key={player.id} style={styles.playerRow}>
              <View>
                <Text style={styles.playerName}>{player.name}</Text>
                <Text style={styles.playerMeta}>{player.connected ? 'Online' : 'Offline'}</Text>
              </View>
              <Text style={styles.playerScore}>{player.score}</Text>
            </View>
          ))}
        </View>

        <View style={styles.noticeCard}>
          <Text style={styles.noticeText}>{t('online.roundReadyNote')}</Text>
          <Text style={styles.noticeMeta}>{t('online.fairRoomQuestionsHint', { players: players.length, questions: recommendedQuestionCount })}</Text>
        </View>

        {isHost && (
          <TouchableOpacity
            style={[styles.startBtn, loading && styles.disabledBtn]}
            disabled={loading}
            onPress={() => {
              void startCurrentRoom();
            }}>
            <Text style={styles.startBtnText}>{t('online.startOnline')}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.leaveBtn, loading && styles.disabledBtn]}
          disabled={loading}
          onPress={() => {
            if (isHost) {
              void deleteCurrentRoom();
            } else {
              void leaveCurrentRoom();
            }
            navigation.replace('OnlinePlay');
          }}>
          <Text style={styles.leaveBtnText}>{isHost ? t('online.deleteRoom') : t('online.leaveRoom')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { padding: 4 },
  backText: { fontSize: 32, color: Colors.primaryLight, lineHeight: 36 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text },
  heroCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  heroRole: { color: Colors.primaryLight, fontSize: 15, fontWeight: '700' },
  heroCodeLabel: { color: Colors.textMuted, fontSize: 13 },
  heroCode: { color: Colors.text, fontSize: 34, fontWeight: '900', letterSpacing: 4 },
  heroHint: { color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  shareActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  copyBtn: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  copyBtnText: { color: Colors.text, fontWeight: '800' },
  whatsappBtn: {
    backgroundColor: Colors.success,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  whatsappBtnText: { color: Colors.text, fontWeight: '800' },
  heroStatus: { color: Colors.success, fontWeight: '700', marginTop: 4 },
  panel: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 18,
    borderColor: Colors.border,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  panelTitle: { color: Colors.text, fontSize: 17, fontWeight: '800' },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  playerName: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  playerMeta: { color: Colors.textMuted, marginTop: 4 },
  playerScore: { color: Colors.accent, fontSize: 22, fontWeight: '800' },
  noticeCard: {
    backgroundColor: Colors.secondary + '22',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.secondary,
    padding: 16,
  },
  noticeText: { color: Colors.text, lineHeight: 22 },
  noticeMeta: { color: Colors.textMuted, lineHeight: 20, marginTop: 8 },
  startBtn: {
    backgroundColor: Colors.success,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startBtnText: { color: Colors.text, fontSize: 17, fontWeight: '800' },
  leaveBtn: {
    backgroundColor: Colors.error,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  leaveBtnText: { color: Colors.text, fontSize: 17, fontWeight: '800' },
  disabledBtn: { opacity: 0.55 },
});