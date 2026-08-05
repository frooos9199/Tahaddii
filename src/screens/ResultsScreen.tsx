import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StatusBar, StyleSheet, Text, TouchableOpacity, View, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { RootStackParamList, Player } from '../types';
import { Colors } from '../theme/colors';
import { useGameStore } from '../store/gameStore';
import { useAppStore } from '../store/appStore';
import { AVATAR_EMOJIS } from '../constants';
import { updateTvDisplaySession } from '../services/tv/tvDisplayService';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Results'> };

const MEDALS = ['🥇', '🥈', '🥉'];
const FIREWORKS = Array.from({ length: 18 }, (_, index) => ({
  id: `spark-${index}`,
  leftPercent: 8 + ((index * 23) % 84),
  topPercent: 8 + ((index * 17) % 34),
  delay: index * 90,
  size: 6 + (index % 4) * 3,
  color: [Colors.accent, Colors.primaryLight, Colors.success, Colors.warning][index % 4],
}));

export default function ResultsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const language = useAppStore(s => s.language);
  const game = useGameStore(s => s.game);
  const resetGame = useGameStore(s => s.resetGame);
  const setPendingPlayers = useGameStore(s => s.setPendingPlayers);
  const setPendingTeams = useGameStore(s => s.setPendingTeams);
  const pendingTvDisplayCode = useGameStore(s => s.pendingTvDisplayCode);
  const clearSavedGame = useGameStore(s => s.clearSavedGame);
  const addGameResult = useAppStore(s => s.addGameResult);
  const saved = useRef(false);
  const celebration = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(celebration, {
          toValue: 1,
          duration: 1800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(celebration, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [celebration]);

  useEffect(() => {
    if (!game) { navigation.replace('Home'); return; }
    if (saved.current) return;
    const sorted = [...game.players].sort((a, b) => b.score - a.score);
    const winner = sorted[0];
    if (winner) {
      saved.current = true;
      void addGameResult({
        id: game.id, mode: game.settings.mode,
        players: sorted.map(p => ({ id: p.id, name: p.name, score: p.score, correctAnswers: p.correctAnswers, wrongAnswers: p.wrongAnswers })),
        winnerId: winner.id, totalQuestions: game.questions.length,
        categories: game.settings.categories, difficulty: game.settings.difficulty,
        playedAt: Date.now(), duration: Date.now() - game.startedAt,
      });
    }
  }, [addGameResult, game, navigation]);

  if (!game) return null;

  const sorted = [...game.players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const winnerAccuracy = useMemo(() => {
    if (!winner) return 0;
    const totalAnswers = winner.correctAnswers + winner.wrongAnswers;
    return totalAnswers > 0 ? Math.round((winner.correctAnswers / totalAnswers) * 100) : 0;
  }, [winner]);

  const renderPlayer = ({ item, index }: { item: Player; index: number }) => (
    <View style={[styles.playerRow, index === 0 && styles.playerRowFirst]}>
      <Text style={styles.medal}>{MEDALS[index] ?? `${index + 1}`}</Text>
      <View style={[styles.playerAvatar, { backgroundColor: item.color + '33' }]}>
        <Text style={styles.playerEmoji}>{AVATAR_EMOJIS[item.avatar]}</Text>
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>{item.name}</Text>
        <View style={styles.playerMetaColumn}>
          <Text style={styles.correctMeta}>✓ {item.correctAnswers}</Text>
          <Text style={styles.wrongMeta}>✗ {item.wrongAnswers}</Text>
        </View>
      </View>
      <Text style={[styles.playerScore, { color: index === 0 ? Colors.accent : Colors.text }]}>
        {item.score}
      </Text>
    </View>
  );

  const handlePlayAgain = async () => {
    const replayPlayers = game.players.map(player => ({
      ...player,
      score: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      totalAnswerTime: 0,
      fastAnswers: 0,
    }));
    const replayTeams = game.teams.map(team => ({
      ...team,
      score: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
    }));

    setPendingPlayers(replayPlayers);
    setPendingTeams(replayTeams);
    await clearSavedGame();

    if (pendingTvDisplayCode) {
      await updateTvDisplaySession(pendingTvDisplayCode, {
        gameId: '',
        status: 'pairing',
        syncSource: 'results-play-again',
        language: language === 'en' ? 'en' : 'ar',
        questionIndex: 0,
        totalQuestions: 0,
        timeLeft: null,
        question: null,
        answers: [],
        currentPlayer: null,
        players: replayPlayers.map(player => ({
          id: player.id,
          name: player.name,
          score: player.score,
          correctAnswers: player.correctAnswers,
          wrongAnswers: player.wrongAnswers,
          color: player.color,
        })),
        correctAnswer: '',
        explanation: '',
      }).catch(error => {
        console.warn('Failed to reset TV display for replay', error);
      });
    }

    navigation.replace('GameSetup');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <View pointerEvents="none" style={styles.fireworksLayer}>
        {FIREWORKS.map(spark => {
          const opacity = celebration.interpolate({
            inputRange: [0, 0.12, 0.65, 1],
            outputRange: [0, 1, 0.55, 0],
          });
          const scale = celebration.interpolate({
            inputRange: [0, 1],
            outputRange: [0.25, 1.9],
          });
          const translateY = celebration.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -28 - spark.size],
          });
          return (
            <Animated.View
              key={spark.id}
              style={[
                styles.spark,
                {
                  left: `${spark.leftPercent}%` as `${number}%`,
                  top: `${spark.topPercent}%` as `${number}%`,
                  width: spark.size,
                  height: spark.size,
                  borderRadius: spark.size / 2,
                  backgroundColor: spark.color,
                  opacity,
                  transform: [{ scale }, { translateY }],
                },
              ]}
            />
          );
        })}
      </View>

      {/* Winner Hero */}
      <View style={styles.hero}>
        <View style={styles.winnerGlow}>
          <Text style={styles.trophy}>🏆</Text>
        </View>
        <Text style={styles.winnerLabel}>{t('results.winner')}</Text>
        <Text style={styles.winnerName}>{winner?.name}</Text>
        <Text style={styles.winnerScore}>{winner?.score} {t('common.points')}</Text>
        <View style={styles.winnerStatsRow}>
          <View style={styles.winnerStatPill}><Text style={styles.winnerStatGood}>✓ {winner?.correctAnswers ?? 0}</Text></View>
          <View style={styles.winnerStatPill}><Text style={styles.winnerStatBad}>✗ {winner?.wrongAnswers ?? 0}</Text></View>
          <View style={styles.winnerStatPill}><Text style={styles.winnerStatText}>{winnerAccuracy}%</Text></View>
        </View>
      </View>

      {/* Scores List */}
      <View style={styles.listWrap}>
        <Text style={styles.listTitle}>{t('results.finalScores')}</Text>
        <FlatList
          data={sorted}
          keyExtractor={p => p.id}
          renderItem={renderPlayer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      </View>

      {/* Footer Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => { void handlePlayAgain(); }}>
          <Text style={styles.primaryBtnText}>🎮 {t('common.playAgain')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => { resetGame(); navigation.replace('Home'); }}>
          <Text style={styles.secondaryBtnText}>🏠 {t('common.home')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  fireworksLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    zIndex: 4,
  },
  spark: {
    position: 'absolute',
    shadowColor: Colors.accent,
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },

  hero: {
    alignItems: 'center', paddingVertical: 22,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.accent + '0F',
  },
  winnerGlow: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent + '22',
    borderWidth: 1,
    borderColor: Colors.accent + '88',
    shadowColor: Colors.accent,
    shadowOpacity: 0.45,
    shadowRadius: 22,
    elevation: 10,
  },
  trophy: { fontSize: 54 },
  winnerLabel: { fontSize: 13, color: Colors.textMuted, marginTop: 10, fontWeight: '800' },
  winnerName: { fontSize: 32, fontWeight: '900', color: Colors.primaryLight, marginTop: 4 },
  winnerScore: { fontSize: 22, fontWeight: '900', color: Colors.accent, marginTop: 4 },
  winnerStatsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  winnerStatPill: {
    minWidth: 58,
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  winnerStatGood: { color: Colors.success, fontSize: 13, fontWeight: '900' },
  winnerStatBad: { color: Colors.error, fontSize: 13, fontWeight: '900' },
  winnerStatText: { color: Colors.text, fontSize: 13, fontWeight: '900' },

  listWrap: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  listTitle: { fontSize: 16, fontWeight: '700', color: Colors.textSecondary, marginBottom: 10 },
  listContent: { gap: 8, paddingBottom: 8 },

  playerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  playerRowFirst: { borderColor: Colors.accent, backgroundColor: Colors.accent + '11' },
  medal: { fontSize: 22, width: 30, textAlign: 'center' },
  playerAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  playerEmoji: { fontSize: 22 },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  playerMetaColumn: { marginTop: 4, gap: 2, alignItems: 'flex-start' },
  correctMeta: { fontSize: 12, color: Colors.success, fontWeight: '800' },
  wrongMeta: { fontSize: 12, color: Colors.error, fontWeight: '800' },
  playerScore: { fontSize: 24, fontWeight: '800' },

  footer: { padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: 14, padding: 15, alignItems: 'center' },
  primaryBtnText: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    backgroundColor: Colors.backgroundCard, borderRadius: 14,
    padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  secondaryBtnText: { color: Colors.text, fontSize: 15, fontWeight: '600' },
});
