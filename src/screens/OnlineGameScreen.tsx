import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from '../types';
import { Colors } from '../theme/colors';
import { useOnlineStore } from '../store/onlineStore';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'OnlineGame'> };

const WRONG_ANSWER_TITLE_KEYS = [
  'online.wrongHype1',
  'online.wrongHype2',
  'online.wrongHype3',
  'online.wrongHype4',
  'online.wrongHype5',
];

const getWrongAnswerTitle = (eventId: string) => {
  const charTotal = eventId.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
  return WRONG_ANSWER_TITLE_KEYS[charTotal % WRONG_ANSWER_TITLE_KEYS.length];
};

export default function OnlineGameScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const {
    room,
    players,
    currentPlayerId,
    loading,
    error,
    clearError,
    submitCurrentAnswer,
    revealCurrentAnswer,
    advanceCurrentQuestion,
    leaveCurrentRoom,
  } = useOnlineStore();
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [pendingAnswerIndex, setPendingAnswerIndex] = useState<number | null>(null);

  useEffect(() => {
    setPendingAnswerIndex(null);
  }, [room?.currentQuestionIndex]);

  useEffect(() => {
    if (!room) {
      navigation.replace('OnlinePlay');
      return;
    }

    if (room.status === 'results' || room.status === 'ended') {
      Alert.alert(t('online.roundFinished'));
      navigation.replace('OnlineLobby');
    }
  }, [navigation, room, t]);

  useEffect(() => {
    if (error) {
      Alert.alert(t('common.error'), error);
      clearError();
    }
  }, [clearError, error, t]);

  useEffect(() => {
    if (!room?.questionStartedAtMs || room.revealedAnswer) {
      return;
    }

    const sync = () => {
      const remaining = Math.max(0, Math.ceil((room.questionStartedAtMs! + room.questionDurationMs - Date.now()) / 1000));
      setTimeLeft(remaining);
    };

    sync();
    const timer = setInterval(sync, 250);
    return () => clearInterval(timer);
  }, [room?.questionStartedAtMs, room?.questionDurationMs, room?.currentQuestionIndex, room?.revealedAnswer]);

  useEffect(() => {
    if (!room || room.revealedAnswer || room.locked || !room.questionStartedAtMs) {
      return;
    }

    if (timeLeft !== 0) {
      return;
    }

    const remainingMs = room.questionStartedAtMs + room.questionDurationMs - Date.now();
    if (remainingMs <= 0) {
      void revealCurrentAnswer();
    }
  }, [revealCurrentAnswer, room, timeLeft]);

  const me = players.find(player => player.id === currentPlayerId) ?? null;
  const winner = players.find(player => player.id === room?.winnerPlayerId) ?? null;
  const alreadyAnswered = Boolean(room && currentPlayerId && room.answeredPlayerIds.includes(currentPlayerId));
  const hasSubmittedAnswer = alreadyAnswered || pendingAnswerIndex !== null;
  const isHost = room?.hostId === currentPlayerId;
  const wrongAnswer = room && room.lastWrongAnswer?.questionIndex === room.currentQuestionIndex ? room.lastWrongAnswer : null;

  const timerProgress = useMemo(() => {
    if (!room || room.questionDurationMs <= 0) {
      return 1;
    }
    return Math.max(0, Math.min(1, timeLeft / Math.max(1, room.questionDurationMs / 1000)));
  }, [room, timeLeft]);

  const timerColor = timeLeft <= 3 ? Colors.error : timeLeft <= 7 ? Colors.warning : Colors.success;

  if (!room?.currentQuestion) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            void leaveCurrentRoom();
            navigation.replace('OnlinePlay');
          }}
          style={styles.exitBtn}>
          <Text style={styles.exitText}>✕</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.questionIndex}>{room.currentQuestionIndex + 1}</Text>
          <Text style={styles.questionState}>{room.revealedAnswer ? t('online.questionLocked') : t('online.waitingAnswer')}</Text>
        </View>
        <View style={styles.pointsBadge}>
          <Text style={styles.pointsText}>{room.currentQuestion.points}⭐</Text>
        </View>
      </View>

      <View style={styles.timerSection}>
        <View style={styles.timerTrack}>
          <View style={[styles.timerFill, { width: `${timerProgress * 100}%`, backgroundColor: timerColor }]} />
        </View>
        <Text style={[styles.timerText, { color: timerColor }]}>{timeLeft}</Text>
      </View>

      <View style={styles.meCard}>
        <Text style={styles.meName}>{me?.name ?? '-'}</Text>
        <Text style={styles.meScore}>{me?.score ?? 0} {t('common.points')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.questionCard}>
          <Text style={styles.questionText}>{room.currentQuestion.prompt}</Text>
        </View>

        <View style={styles.answersWrap}>
          {room.currentQuestion.answers.map((answer, index) => {
            const isCorrect = index === room.currentQuestion!.correctAnswerIndex;
            const showCorrect = room.revealedAnswer && isCorrect;
            const isPending = pendingAnswerIndex === index && !alreadyAnswered;

            return (
              <TouchableOpacity
                key={`${room.currentQuestion!.id}-${index}`}
                style={[
                  styles.answerBtn,
                  showCorrect && styles.answerCorrect,
                  isPending && styles.answerPending,
                  hasSubmittedAnswer && styles.answerDisabled,
                ]}
                disabled={hasSubmittedAnswer || room.revealedAnswer || loading}
                onPress={() => {
                  setPendingAnswerIndex(index);
                  void submitCurrentAnswer(index);
                }}>
                <Text style={styles.answerText}>{answer}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {wrongAnswer ? (
          <View style={styles.wrongAnswerCard}>
            <Text style={styles.wrongAnswerTitle}>{wrongAnswer.playerName} {t(getWrongAnswerTitle(wrongAnswer.id))}</Text>
            <Text style={styles.wrongAnswerText}>{t('online.selectedAnswer', { answer: wrongAnswer.answerText })}</Text>
            <Text style={styles.wrongAnswerHint}>{t('online.firstCorrectStillOpen')}</Text>
          </View>
        ) : null}

        <View style={styles.statusCard}>
          {winner ? (
            <Text style={styles.statusText}>{t('online.winnerPrefix')}: {winner.name}</Text>
          ) : room.revealedAnswer ? (
            <Text style={styles.statusText}>{t('online.timeUp')}</Text>
          ) : hasSubmittedAnswer ? (
            <Text style={styles.statusText}>{t('online.submitAnswer')}</Text>
          ) : (
            <Text style={styles.statusText}>{t('online.waitingAnswer')}</Text>
          )}

          {room.revealedAnswer && room.currentQuestion.explanation ? (
            <Text style={styles.explanationText}>{room.currentQuestion.explanation}</Text>
          ) : null}
        </View>
      </ScrollView>

      {isHost && room.revealedAnswer && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.nextBtn} onPress={() => {
            void advanceCurrentQuestion();
          }}>
            <Text style={styles.nextBtnText}>{t('online.nextQuestion')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  exitBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.backgroundCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  exitText: { color: Colors.textMuted, fontWeight: '800' },
  headerCenter: { alignItems: 'center', gap: 2 },
  questionIndex: { color: Colors.text, fontSize: 24, fontWeight: '900' },
  questionState: { color: Colors.textMuted, fontSize: 12 },
  pointsBadge: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pointsText: { color: Colors.background, fontWeight: '800' },
  timerSection: { paddingHorizontal: 16, marginTop: 12, gap: 8 },
  timerTrack: { height: 10, borderRadius: 999, backgroundColor: Colors.border, overflow: 'hidden' },
  timerFill: { height: '100%', borderRadius: 999 },
  timerText: { alignSelf: 'center', fontSize: 28, fontWeight: '900' },
  meCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    alignItems: 'center',
  },
  meName: { color: Colors.text, fontSize: 22, fontWeight: '800' },
  meScore: { color: Colors.accent, marginTop: 6, fontWeight: '700' },
  scroll: { padding: 16, paddingBottom: 120, gap: 16 },
  questionCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
  },
  questionText: { color: Colors.text, fontSize: 24, lineHeight: 34, textAlign: 'center' },
  answersWrap: { gap: 12 },
  answerBtn: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  answerCorrect: { borderColor: Colors.success, backgroundColor: Colors.success + '22' },
  answerPending: { borderColor: Colors.warning, backgroundColor: Colors.warning + '22' },
  answerDisabled: { opacity: 0.7 },
  answerText: { color: Colors.text, fontSize: 16, textAlign: 'center' },
  wrongAnswerCard: {
    backgroundColor: Colors.error + '18',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.error,
    padding: 16,
    gap: 6,
  },
  wrongAnswerTitle: { color: Colors.text, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  wrongAnswerText: { color: Colors.error, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  wrongAnswerHint: { color: Colors.textMuted, fontSize: 13, textAlign: 'center' },
  statusCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 8,
  },
  statusText: { color: Colors.primaryLight, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  explanationText: { color: Colors.textMuted, lineHeight: 22, textAlign: 'center' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  nextBtn: { backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  nextBtnText: { color: Colors.text, fontSize: 18, fontWeight: '800' },
});