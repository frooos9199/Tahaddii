import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Alert, Animated, Dimensions, Image, Linking, Modal, Platform, StatusBar, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { GameState, Player, RootStackParamList } from '../types';
import { Colors } from '../theme/colors';
import { useGameStore } from '../store/gameStore';
import { useAppStore } from '../store/appStore';
import { CATEGORY_EMOJIS, FAST_ANSWER_BONUS } from '../constants';
import { createTvDisplaySession, getTvDisplayUrl, updateTvDisplaySession } from '../services/tv/tvDisplayService';
import { getQuestions } from '../services/questions/questionService';
import { getQuestionDisplayImageUrls, getQuestionPrimaryImageUrl, preloadQuestionMedia, preloadUpcomingQuestionMedia } from '../services/media/questionMediaService';
import { markQuestionsAsSeen, syncQuestionHistory } from '../services/questions/questionHistoryService';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Game'> };

const { height: SCREEN_H } = Dimensions.get('window');

const getLeadingTie = (game: GameState): Player[] => {
  const activePlayers = game.tieBreakerPlayerIds?.length
    ? game.players.filter(player => game.tieBreakerPlayerIds?.includes(player.id))
    : game.players;

  if (activePlayers.length < 2) return [];
  const topScore = Math.max(...activePlayers.map(player => player.score));
  return activePlayers.filter(player => player.score === topScore);
};

export default function GameScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const language = useAppStore(s => s.language);
  const { game, startGame, submitAnswer, nextQuestion, startTieBreaker, finishGame, clearSavedGame, pendingTvDisplayCode } = useGameStore();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [answeredCorrectly, setAnsweredCorrectly] = useState<boolean | null>(null);
  const [lastPointsEarned, setLastPointsEarned] = useState(0);
  const [lastFastBonus, setLastFastBonus] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [tvDisplayCode, setTvDisplayCode] = useState<string | null>(pendingTvDisplayCode);
  const [tvModalVisible, setTvModalVisible] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [imageFallbackIndex, setImageFallbackIndex] = useState(0);
  const [transitionCategoryId, setTransitionCategoryId] = useState<string | null>(null);
  const categoryTransitionOpacity = useRef(new Animated.Value(0)).current;
  const categoryTransitionScale = useRef(new Animated.Value(0.96)).current;
  const previousCategoryIdRef = useRef<string | null>(null);
  const markedQuestionKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (pendingTvDisplayCode && !tvDisplayCode) {
      setTvDisplayCode(pendingTvDisplayCode);
    }
  }, [pendingTvDisplayCode, tvDisplayCode]);

  const question = game?.questions[game.currentQuestionIndex];
  const gameQuestions = game?.questions;
  const gameId = game?.id;
  const gameCurrentQuestionIndex = game?.currentQuestionIndex;
  const player = game?.players[game.currentPlayerIndex];
  const total = game?.questions.length ?? 0;
  const timeLimit = game?.settings.timePerQuestion ?? 0;
  const isTimed = timeLimit > 0;
  const displayCategoryId = question?.queueCategoryId || question?.categoryId || '';
  const previousQuestion = game && game.currentQuestionIndex > 0
    ? game.questions[game.currentQuestionIndex - 1]
    : undefined;
  const previousDisplayCategoryId = previousQuestion?.queueCategoryId || previousQuestion?.categoryId || '';
  const displayCategoryTransitionKey = game && displayCategoryId
    ? `${game.id}:${game.currentQuestionIndex}:${displayCategoryId}`
    : '';
  const displayCategoryEmoji = CATEGORY_EMOJIS[displayCategoryId] || '🎯';
  const displayCategoryName = displayCategoryId
    ? t(`categories.${displayCategoryId}`, { defaultValue: displayCategoryId })
    : t('categories.generalKnowledge');

  const displayQuestion = useMemo(() => {
    if (!question) return '';
    const lang = game?.settings.questionLanguage;
    if (lang === 'en') return question.questionEn || question.questionAr;
    if (lang === 'both') return `${question.questionAr}\n\n${question.questionEn}`;
    if (lang === 'mixed') return game!.currentQuestionIndex % 2 === 0
      ? question.questionAr : question.questionEn;
    return question.questionAr || question.questionEn;
  }, [game, question]);

  const answers = useMemo(() => {
    if (!question) return [];
    const lang = game?.settings.questionLanguage;
    if (lang === 'en') return question.answersEn?.length ? question.answersEn : question.answersAr;
    return question.answersAr?.length ? question.answersAr : question.answersEn;
  }, [game?.settings.questionLanguage, question]);

  const correctAnswer = useMemo(() => {
    if (!question) return '';
    return language === 'en'
      ? question.correctAnswerEn || question.correctAnswerAr
      : question.correctAnswerAr || question.correctAnswerEn;
  }, [language, question]);
  const questionImageUrls = useMemo(() => getQuestionDisplayImageUrls(question, revealed), [question, revealed]);
  const questionImageUrl = questionImageUrls[imageFallbackIndex] || '';
  const questionBlurRadius = question && questionImageUrl && !revealed && question.revealMode === 'blur'
    ? Number(question.blurAmount ?? 18)
    : 0;

  const timerProgress = isTimed && timeLeft != null ? Math.max(0, timeLeft / timeLimit) : 1;
  const timerColor = !isTimed ? Colors.secondary
    : (timeLeft ?? 99) <= 3 ? Colors.error
    : (timeLeft ?? 99) <= 7 ? Colors.warning
    : Colors.success;

  const elapsed = isTimed ? Math.max(0, timeLimit - (timeLeft ?? timeLimit)) : 0;
  const fastAnswerLimit = isTimed ? Math.max(5, Math.ceil(timeLimit * 0.25)) : 0;

  const buildTvDisplayState = useCallback(() => {
    if (!game || !question || !player) return null;

    return {
      gameId: game.id,
      status: game.status === 'finished' ? 'finished' as const : revealed ? 'revealed' as const : 'playing' as const,
      syncSource: game.status === 'setup' ? 'game-screen-setup-start' : 'game-screen-live',
      language: language === 'en' ? 'en' as const : 'ar' as const,
      questionIndex: game.currentQuestionIndex,
      totalQuestions: game.questions.length,
      timeLeft: isTimed ? (timeLeft ?? timeLimit) : null,
      question: {
        id: question.id,
        type: question.type,
        categoryId: displayCategoryId,
        previousCategoryId: previousDisplayCategoryId,
        categoryTransitionKey: displayCategoryTransitionKey,
        categoryName: displayCategoryName,
        categoryEmoji: displayCategoryEmoji,
        text: displayQuestion,
        points: question.points,
        imageUrl: getQuestionPrimaryImageUrl(question, revealed),
        revealImageUrl: question.revealImageUrl || question.imageUrl || '',
        thumbnailUrl: question.thumbnailUrl || '',
        videoUrl: question.videoUrl || '',
        mediaType: question.mediaType || (question.videoUrl ? 'video' : questionImageUrl ? 'image' : undefined),
        revealMode: (question.revealMode === 'blur' ? 'blur' : 'none') as 'blur' | 'none',
        blurAmount: Number(question.blurAmount ?? 18),
      },
      answers: answers.map((answer, index) => ({
        text: answer,
        isCorrect: revealed && index === question.correctAnswerIndex,
        isSelected: selectedIndex === index,
      })),
      currentPlayer: {
        id: player.id,
        name: player.name,
        score: player.score,
        color: player.color,
      },
      players: game.players.map(nextPlayer => ({
        id: nextPlayer.id,
        name: nextPlayer.name,
        score: nextPlayer.score,
        correctAnswers: nextPlayer.correctAnswers,
        wrongAnswers: nextPlayer.wrongAnswers,
        color: nextPlayer.color,
      })),
      correctAnswer: revealed ? correctAnswer : '',
      explanation: revealed ? (language === 'en' ? question.explanationEn || question.explanationAr || '' : question.explanationAr || question.explanationEn || '') : '',
    };
  }, [answers, correctAnswer, displayCategoryEmoji, displayCategoryId, displayCategoryName, displayCategoryTransitionKey, displayQuestion, game, isTimed, language, player, previousDisplayCategoryId, question, questionImageUrl, revealed, selectedIndex, timeLeft, timeLimit]);

  const syncTvDisplay = useCallback(() => {
    if (!tvDisplayCode || !game || !question || !player) return;
    const tvState = buildTvDisplayState();
    if (!tvState) return;

    void updateTvDisplaySession(tvDisplayCode, tvState).catch(error => {
      console.warn('Failed to sync TV display session', error);
    });
  }, [buildTvDisplayState, game, player, question, tvDisplayCode]);

  const syncFinalTvDisplay = useCallback(async () => {
    if (!tvDisplayCode || !game) return;
    await updateTvDisplaySession(tvDisplayCode, {
      gameId: game.id,
      status: 'finished',
      syncSource: 'game-screen-final-results',
      language: language === 'en' ? 'en' : 'ar',
      questionIndex: game.questions.length - 1,
      totalQuestions: game.questions.length,
      timeLeft: null,
      question: null,
      answers: [],
      currentPlayer: null,
      players: game.players.map(nextPlayer => ({
        id: nextPlayer.id,
        name: nextPlayer.name,
        score: nextPlayer.score,
        correctAnswers: nextPlayer.correctAnswers,
        wrongAnswers: nextPlayer.wrongAnswers,
        color: nextPlayer.color,
      })),
      correctAnswer: '',
      explanation: '',
    });
  }, [game, language, tvDisplayCode]);

  useEffect(() => {
    if (!game) { navigation.replace('Home'); return; }
    if (game.status === 'setup') {
      startGame();
      syncTvDisplay();
    }
  }, [game, navigation, startGame, syncTvDisplay]);

  useEffect(() => {
    syncTvDisplay();
  }, [syncTvDisplay]);

  useEffect(() => {
    if (!tvDisplayCode || !game) return;
    const intervalId = setInterval(syncTvDisplay, 1200);
    return () => clearInterval(intervalId);
  }, [game, syncTvDisplay, tvDisplayCode]);

  const resetLocal = useCallback(() => {
    setSelectedIndex(null);
    setAnsweredCorrectly(null);
    setLastPointsEarned(0);
    setLastFastBonus(0);
    setRevealed(false);
    setTimeLeft(null);
  }, []);

  // reset timer on new question
  useEffect(() => {
    if (!question) return;
    setTimeLeft(isTimed ? timeLimit : null);
    setSelectedIndex(null);
    setAnsweredCorrectly(null);
    setLastPointsEarned(0);
    setLastFastBonus(0);
    setRevealed(false);
    setImageFallbackIndex(0);
    const questionHistoryKey = `${gameId ?? 'game'}:${gameCurrentQuestionIndex ?? 0}:${question.id}`;
    if (!markedQuestionKeysRef.current.has(questionHistoryKey)) {
      markedQuestionKeysRef.current.add(questionHistoryKey);
      markQuestionsAsSeen([question]).catch(error => {
        console.warn('Failed to mark question as seen', error);
      });
    }
    void preloadQuestionMedia(question);
    if (gameQuestions?.length && gameCurrentQuestionIndex != null) {
      preloadUpcomingQuestionMedia(gameQuestions, gameCurrentQuestionIndex + 1, 4);
    }
  }, [gameCurrentQuestionIndex, gameId, gameQuestions, isTimed, question, timeLimit]);

  useEffect(() => {
    setImageFallbackIndex(0);
  }, [question?.id, revealed]);

  useEffect(() => {
    if (!question || !displayCategoryId) return;

    const categoryChanged = previousCategoryIdRef.current !== displayCategoryId;
    previousCategoryIdRef.current = displayCategoryId;
    if (!categoryChanged) return;

    setTransitionCategoryId(displayCategoryId);
    categoryTransitionOpacity.setValue(0);
    categoryTransitionScale.setValue(0.96);

    Animated.parallel([
      Animated.timing(categoryTransitionOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(categoryTransitionScale, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    const hideTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(categoryTransitionOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(categoryTransitionScale, {
          toValue: 1.02,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => setTransitionCategoryId(null));
    }, 950);

    return () => clearTimeout(hideTimer);
  }, [categoryTransitionOpacity, categoryTransitionScale, displayCategoryId, question]);

  // countdown
  useEffect(() => {
    if (!isTimed || revealed || timeLeft == null || timeLeft <= 0) return;
    const intervalId = setInterval(() => setTimeLeft(v => Math.max(0, (v ?? 0) - 1)), 1000);
    return () => clearInterval(intervalId);
  }, [isTimed, revealed, timeLeft]);

  // time up
  useEffect(() => {
    if (!isTimed || !question || !player || revealed || timeLeft !== 0) return;
    submitAnswer({ questionId: question.id, playerId: player.id, isCorrect: false, timeSpent: timeLimit, pointsEarned: 0 });
    setAnsweredCorrectly(false);
    setLastPointsEarned(0);
    setLastFastBonus(0);
    setRevealed(true);
  }, [isTimed, player, question, revealed, submitAnswer, timeLeft, timeLimit]);

  const registerAnswer = (isCorrect: boolean) => {
    if (!game || !question || !player || revealed) return;
    const fastBonus = isCorrect && isTimed && elapsed <= fastAnswerLimit ? FAST_ANSWER_BONUS : 0;
    const pointsEarned = isCorrect ? question.points + fastBonus : 0;
    submitAnswer({ questionId: question.id, playerId: player.id, isCorrect, timeSpent: elapsed, pointsEarned });
    setAnsweredCorrectly(isCorrect);
    setLastPointsEarned(pointsEarned);
    setLastFastBonus(fastBonus);
    setRevealed(true);
  };

  const goNext = async () => {
    if (!game) return;
    const isLast = game.currentQuestionIndex >= game.questions.length - 1;
    if (isLast) {
      const latestGame = useGameStore.getState().game ?? game;
      const leadingTie = getLeadingTie(latestGame);
      if (leadingTie.length > 1) {
        const tieBreakerQuestions = await getQuestions({
          ...latestGame.settings,
          difficulty: 'hard',
          questionCount: leadingTie.length,
          allowRepeat: false,
        });
        const unusedQuestions = tieBreakerQuestions.filter(nextQuestionItem => !latestGame.usedQuestionIds.includes(nextQuestionItem.id));
        const nextQuestions = (unusedQuestions.length >= leadingTie.length ? unusedQuestions : tieBreakerQuestions).slice(0, leadingTie.length);

        if (nextQuestions.length > 0) {
          startTieBreaker(leadingTie.map(nextPlayer => nextPlayer.id), nextQuestions);
          resetLocal();
          return;
        }
      }

      await syncFinalTvDisplay().catch(error => {
        console.warn('Failed to sync final TV display results', error);
      });
      await syncQuestionHistory().catch(error => {
        console.warn('Failed to sync question history', error);
      });
      finishGame();
      await clearSavedGame();
      navigation.replace('Results');
      return;
    }
    nextQuestion();
    resetLocal();
  };

  const confirmExit = () => {
    Alert.alert(t('game.exitGame'), t('game.exitConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('game.exitGame'),
        style: 'destructive',
        onPress: async () => {
          await syncQuestionHistory().catch(error => {
            console.warn('Failed to sync question history on exit', error);
          });
          await clearSavedGame();
          navigation.replace('Home');
        },
      },
    ]);
  };

  const startTvDisplay = async () => {
    if (!game || !question || !player) return;
    try {
      const code = tvDisplayCode ?? await createTvDisplaySession();
      const tvState = buildTvDisplayState();
      if (!tvState) return;
      await updateTvDisplaySession(code, tvState);
      setTvDisplayCode(code);
      setTvModalVisible(true);
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('tvDisplay.startFailed'));
    }
  };

  const openMirrorSettings = () => {
    if (Platform.OS === 'ios') {
      // على iOS يفتح Control Center تلقائياً
      Alert.alert(
        '📺 ' + t('tvDisplay.mirrorTitle'),
        t('tvDisplay.mirrorInstructionsIos'),
        [{ text: t('common.close') }]
      );
    } else {
      // على Android يفتح Cast settings
      Linking.sendIntent('android.settings.CAST_SETTINGS').catch(() => {
        Linking.openSettings();
      });
    }
  };

  if (!game || !question || !player) return null;

  const isLast = game.currentQuestionIndex >= game.questions.length - 1;
  const answerLetters = language === 'en' ? ['A', 'B', 'C', 'D'] : ['أ', 'ب', 'ج', 'د'];
  const isTrueFalseQuestion = question.type === 'true_false' && answers.length >= 2;
  const transitionCategoryEmoji = transitionCategoryId ? CATEGORY_EMOJIS[transitionCategoryId] || '🎯' : displayCategoryEmoji;
  const transitionCategoryName = transitionCategoryId
    ? t(`categories.${transitionCategoryId}`, { defaultValue: transitionCategoryId })
    : displayCategoryName;

  if (presentationMode) {
    return (
      <SafeAreaView style={pStyles.root}>
        <StatusBar hidden />
        <View style={pStyles.topRow}>
          <Text style={pStyles.category} numberOfLines={1}>{displayCategoryEmoji}  {displayCategoryName}</Text>
          <Text style={pStyles.progress}>{game.currentQuestionIndex + 1} / {total}</Text>
        </View>
        <View style={pStyles.progressTrack}>
          <View style={[pStyles.progressFill, { width: `${((game.currentQuestionIndex + 1) / total) * 100}%` }]} />
        </View>

        <Text style={pStyles.playerLine} numberOfLines={1}>
          {t('game.currentPlayer')}: {player.name} · {player.score} {t('common.points')}
        </Text>

        <View style={pStyles.questionCard}>
          {!!questionImageUrl && (
            <Image
              key={`${question.id}-${revealed ? 'revealed' : 'hidden'}-${questionImageUrl}`}
              source={{ uri: questionImageUrl }}
              style={pStyles.questionImage}
              blurRadius={questionBlurRadius}
              resizeMode="cover"
              onError={() => setImageFallbackIndex(currentIndex => (
                currentIndex + 1 < questionImageUrls.length ? currentIndex + 1 : currentIndex
              ))}
            />
          )}
          <Text style={pStyles.questionText} adjustsFontSizeToFit numberOfLines={4}>{displayQuestion}</Text>
        </View>

        <View style={pStyles.timerRow}>
          <View style={pStyles.timerTrack}>
            <View style={[pStyles.timerFill, { width: `${timerProgress * 100}%`, backgroundColor: timerColor }]} />
          </View>
          <View style={[pStyles.timerBadge, { borderColor: timerColor }]}>
            <Text style={[pStyles.timerNum, { color: timerColor }]}>{isTimed ? (timeLeft ?? timeLimit) : '∞'}</Text>
          </View>
        </View>

        <View style={pStyles.answersBlock}>
          {isTrueFalseQuestion ? (
            <View style={pStyles.trueFalseRow}>
              {answers.slice(0, 2).map((ans, i) => {
                const isSelected = selectedIndex === i;
                const isCorrect = i === question.correctAnswerIndex;
                const showGreen = revealed && isCorrect;
                const showRed = revealed && isSelected && !isCorrect;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[pStyles.trueFalseBtn,
                      i === 0 ? pStyles.trueBtn : pStyles.falseBtn,
                      isSelected && !revealed && pStyles.answerSelected,
                      showGreen && pStyles.answerCorrect,
                      showRed && pStyles.answerWrong,
                    ]}
                    disabled={revealed}
                    onPress={() => { setSelectedIndex(i); registerAnswer(i === question.correctAnswerIndex); }}>
                    <Text style={pStyles.trueFalseMark}>{i === 0 ? '✓' : '✕'}</Text>
                    <Text style={pStyles.trueFalseText} adjustsFontSizeToFit numberOfLines={1}>{ans}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : answers.length > 0 ? (
            <View style={pStyles.answersGrid}>
              {answers.map((ans, i) => {
                const isSelected = selectedIndex === i;
                const isCorrect = i === question.correctAnswerIndex;
                const showGreen = revealed && isCorrect;
                const showRed = revealed && isSelected && !isCorrect;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[pStyles.answerBtn,
                      isSelected && !revealed && pStyles.answerSelected,
                      showGreen && pStyles.answerCorrect,
                      showRed && pStyles.answerWrong,
                    ]}
                    disabled={revealed}
                    onPress={() => { setSelectedIndex(i); registerAnswer(i === question.correctAnswerIndex); }}>
                    <Text style={pStyles.answerLetter}>{answerLetters[i]}</Text>
                    <Text style={[pStyles.answerText, language !== 'en' && pStyles.answerTextRtl]} adjustsFontSizeToFit numberOfLines={2}>{ans}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={pStyles.manualRow}>
              <TouchableOpacity style={[pStyles.manualBtn, pStyles.correctBtn]} onPress={() => registerAnswer(true)}>
                <Text style={pStyles.manualText}>✓ {t('common.correct')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[pStyles.manualBtn, pStyles.wrongBtn]} onPress={() => registerAnswer(false)}>
                <Text style={pStyles.manualText}>✕ {t('common.wrong')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {revealed && (
          <View style={[pStyles.feedbackBar, answeredCorrectly ? pStyles.feedbackCorrect : pStyles.feedbackWrong]}>
            <Text style={pStyles.feedbackLabel}>
              {answeredCorrectly ? `✓ ${t('common.correct')} · ${t('game.pointsEarned', { points: lastPointsEarned })}` : `✕ ${t('game.correctAnswer')}: ${correctAnswer}`}
            </Text>
            {lastFastBonus > 0 && <Text style={pStyles.feedbackExpl}>{t('game.fastAnswer')}</Text>}
          </View>
        )}

        {/* ── FLOATING HOST CONTROLS ── */}
        <View style={pStyles.controlBar}>
          <TouchableOpacity style={pStyles.controlExitBtn} onPress={() => setPresentationMode(false)}>
            <Text style={pStyles.controlExitText}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[pStyles.controlNextBtn, !revealed && pStyles.controlNextDisabled]}
            disabled={!revealed}
            onPress={goNext}>
            <Text style={pStyles.controlNextText}>
              {isLast ? `🏆 ${t('results.title')}` : `${t('common.next')} ›`}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* ── TOP BAR ── */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={confirmExit} style={styles.exitBtn}>
          <Text style={styles.exitText}>✕</Text>
        </TouchableOpacity>
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${((game.currentQuestionIndex + 1) / total) * 100}%` }]} />
          </View>
          <Text style={styles.progressLabel}>{game.currentQuestionIndex + 1} / {total}</Text>
        </View>
        <View style={styles.pointsBadge}>
          <Text style={styles.pointsText}>{question.points}⭐</Text>
        </View>
        <TouchableOpacity style={[styles.tvBtn, tvDisplayCode && styles.tvBtnActive]} onPress={() => { void startTvDisplay(); }}>
          <Text style={styles.tvBtnText}>{tvDisplayCode ?? 'TV'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── TIMER ── */}
      <View style={styles.timerRow}>
        <View style={styles.timerTrack}>
          <View style={[styles.timerFill, { width: `${timerProgress * 100}%`, backgroundColor: timerColor }]} />
        </View>
        <View style={[styles.timerBadge, { borderColor: timerColor }]}>
          <Text style={[styles.timerNum, { color: timerColor }]}>
            {isTimed ? (timeLeft ?? timeLimit) : '∞'}
          </Text>
        </View>
      </View>

      {/* ── CATEGORY ── */}
      <View style={styles.categoryHeader}>
        <Text style={styles.categoryIcon}>{displayCategoryEmoji}</Text>
        <Text style={styles.categoryName} numberOfLines={1}>{displayCategoryName}</Text>
        <Text style={styles.categoryCount}>{game.currentQuestionIndex + 1} / {total}</Text>
      </View>

      {/* ── PLAYER ── */}
      <View style={[styles.playerRow, { borderColor: player.color }]}>
        <Text style={styles.playerEmoji}>{player.name.charAt(0).toUpperCase()}</Text>
        <View>
          <Text style={styles.playerName}>{player.name}</Text>
          <Text style={styles.playerScore}>{player.score} {t('common.points')}</Text>
        </View>
      </View>

      {/* ── QUESTION ── */}
      <View style={styles.questionCard}>
        {!!questionImageUrl && (
          <Image
            key={`${question.id}-${revealed ? 'revealed' : 'hidden'}-${questionImageUrl}`}
            source={{ uri: questionImageUrl }}
            style={styles.questionImage}
            blurRadius={questionBlurRadius}
            resizeMode="cover"
            onError={() => setImageFallbackIndex(currentIndex => (
              currentIndex + 1 < questionImageUrls.length ? currentIndex + 1 : currentIndex
            ))}
          />
        )}
        <Text
          style={[styles.questionText, !!questionImageUrl && styles.questionTextWithImage]}
          adjustsFontSizeToFit
          numberOfLines={4}>
          {displayQuestion}
        </Text>
      </View>

      {/* ── ANSWERS or MANUAL ── */}
      <View style={styles.answersBlock}>
        {isTrueFalseQuestion ? (
          <View style={styles.trueFalseRow}>
            {answers.slice(0, 2).map((ans, i) => {
              const isSelected = selectedIndex === i;
              const isCorrect = i === question.correctAnswerIndex;
              const showGreen = revealed && isCorrect;
              const showRed = revealed && isSelected && !isCorrect;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.trueFalseBtn,
                    i === 0 ? styles.trueBtn : styles.falseBtn,
                    isSelected && !revealed && styles.answerSelected,
                    showGreen && styles.answerCorrect,
                    showRed && styles.answerWrong,
                  ]}
                  disabled={revealed}
                  onPress={() => { setSelectedIndex(i); registerAnswer(i === question.correctAnswerIndex); }}>
                  <Text style={styles.trueFalseMark}>{i === 0 ? '✓' : '✕'}</Text>
                  <Text style={styles.trueFalseText} adjustsFontSizeToFit numberOfLines={1}>{ans}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : answers.length > 0 ? (
          <View style={styles.answersGrid}>
            {answers.map((ans, i) => {
              const isSelected = selectedIndex === i;
              const isCorrect = i === question.correctAnswerIndex;
              const showGreen = revealed && isCorrect;
              const showRed = revealed && isSelected && !isCorrect;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.answerBtn,
                    language !== 'en' && styles.answerBtnRtl,
                    isSelected && !revealed && styles.answerSelected,
                    showGreen && styles.answerCorrect,
                    showRed && styles.answerWrong,
                  ]}
                  disabled={revealed}
                  onPress={() => { setSelectedIndex(i); registerAnswer(i === question.correctAnswerIndex); }}>
                  <Text style={styles.answerLetter}>{answerLetters[i]}</Text>
                  <Text style={[styles.answerText, language !== 'en' && styles.answerTextRtl]} adjustsFontSizeToFit numberOfLines={2}>{ans}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.manualRow}>
            <TouchableOpacity style={[styles.manualBtn, styles.correctBtn]} onPress={() => registerAnswer(true)}>
              <Text style={styles.manualText}>✓ {t('common.correct')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.manualBtn, styles.wrongBtn]} onPress={() => registerAnswer(false)}>
              <Text style={styles.manualText}>✕ {t('common.wrong')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── FEEDBACK ── */}
      {revealed && (
        <View style={[styles.feedbackBar, answeredCorrectly ? styles.feedbackCorrect : styles.feedbackWrong]}>
          <Text style={styles.feedbackLabel}>
            {answeredCorrectly ? `✓ ${t('common.correct')} · ${t('game.pointsEarned', { points: lastPointsEarned })}` : `✕ ${t('game.correctAnswer')}: ${correctAnswer}`}
          </Text>
          {lastFastBonus > 0 && <Text style={styles.feedbackExpl}>{t('game.fastAnswer')}</Text>}
          {!!question.explanationAr && language !== 'en' && (
            <Text style={styles.feedbackExpl}>{question.explanationAr}</Text>
          )}
        </View>
      )}

      {/* ── NEXT BTN ── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextBtn, !revealed && styles.nextDisabled]}
          disabled={!revealed}
          onPress={goNext}>
          <Text style={styles.nextText}>
            {isLast ? `🏆 ${t('results.title')}` : `${t('common.next')} ›`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── TV CONNECT MODAL ── */}
      <Modal visible={tvModalVisible} transparent animationType="slide" onRequestClose={() => setTvModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setTvModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <Text style={styles.modalTitle}>📺 {t('tvDisplay.title')}</Text>

            <TouchableOpacity
              style={styles.modalMirrorBtn}
              onPress={() => { setTvModalVisible(false); setPresentationMode(true); openMirrorSettings(); }}>
              <Text style={styles.modalMirrorText}>📡 {t('tvDisplay.mirrorTitle')}</Text>
              <Text style={styles.modalMirrorHint}>{t('tvDisplay.mirrorHint')}</Text>
            </TouchableOpacity>

            <Text style={styles.modalDivider}>{t('tvDisplay.orUseCode')}</Text>

            <Text style={styles.modalSubtitle}>{t('tvDisplay.openSite')}</Text>
            <Text style={styles.modalSite}>tahaddii.com/tv</Text>
            <Text style={styles.modalCodeLabel}>{t('tvDisplay.enterCode')}</Text>
            <Text style={styles.modalCode}>{tvDisplayCode}</Text>
            <TouchableOpacity
              style={styles.modalCopyBtn}
              onPress={() => {
                if (tvDisplayCode) {
                  Clipboard.setString(getTvDisplayUrl(tvDisplayCode));
                  Alert.alert('✓', t('common.copied') ?? 'Copied!');
                }
              }}>
              <Text style={styles.modalCopyText}>📋 {t('common.copyLink')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalScanBtn}
              onPress={() => { setTvModalVisible(false); navigation.navigate('TvPairingScanner'); }}>
              <Text style={styles.modalScanText}>📷 {t('tvDisplay.scanQr')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setTvModalVisible(false)}>
              <Text style={styles.modalCloseText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {!!transitionCategoryId && (
        <Animated.View
          pointerEvents="auto"
          style={[
            styles.categoryTransition,
            {
              opacity: categoryTransitionOpacity,
              transform: [{ scale: categoryTransitionScale }],
            },
          ]}>
          <View style={styles.categoryTransitionPanel}>
            <Text style={styles.categoryTransitionKicker}>{t('game.nextRound')}</Text>
            <Text style={styles.categoryTransitionIcon}>{transitionCategoryEmoji}</Text>
            <Text style={styles.categoryTransitionName}>{transitionCategoryName}</Text>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const { width: W } = Dimensions.get('window');

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, gap: 10,
  },
  exitBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.backgroundCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  exitText: { color: Colors.textMuted, fontSize: 16, fontWeight: '700' },
  progressWrap: { flex: 1, gap: 4 },
  progressTrack: { height: 6, backgroundColor: Colors.border, borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 99 },
  progressLabel: { fontSize: 11, color: Colors.textMuted, textAlign: 'center' },
  pointsBadge: {
    backgroundColor: Colors.accent + '33', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: Colors.accent,
  },
  pointsText: { color: Colors.accent, fontWeight: '800', fontSize: 13 },
  tvBtn: {
    minWidth: 42,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.backgroundCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: 8,
  },
  tvBtnActive: { backgroundColor: Colors.primary + '33', borderColor: Colors.primaryLight },
  tvBtnText: { color: Colors.primaryLight, fontSize: 11, fontWeight: '900' },

  timerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, gap: 10, marginTop: 6,
  },
  timerTrack: { flex: 1, height: 8, backgroundColor: Colors.border, borderRadius: 99, overflow: 'hidden' },
  timerFill: { height: '100%', borderRadius: 99 },
  timerBadge: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, backgroundColor: Colors.backgroundCard,
  },
  timerNum: { fontSize: 18, fontWeight: '800' },

  categoryHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 10,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1, borderColor: Colors.border,
  },
  categoryIcon: { fontSize: 22 },
  categoryName: { flex: 1, color: Colors.text, fontSize: 14, fontWeight: '900' },
  categoryCount: { color: Colors.accent, fontSize: 12, fontWeight: '900' },

  playerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginTop: 10,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14, padding: 12,
    borderWidth: 2,
  },
  playerEmoji: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary,
    textAlign: 'center', lineHeight: 40,
    fontSize: 18, fontWeight: '800', color: Colors.text,
    overflow: 'hidden',
  },
  playerName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  playerScore: { fontSize: 12, color: Colors.accent, marginTop: 2 },

  questionCard: {
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border,
    minHeight: SCREEN_H * 0.14,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  questionText: {
    fontSize: 20, color: Colors.text,
    textAlign: 'center', lineHeight: 30, fontWeight: '600',
    padding: 20,
  },
  questionTextWithImage: {
    backgroundColor: 'rgba(0,0,0,0.62)',
    margin: 10,
    borderRadius: 12,
    padding: 12,
    overflow: 'hidden',
  },
  questionImage: {
    width: '100%',
    height: SCREEN_H * 0.22,
    backgroundColor: Colors.border,
  },

  answersBlock: { flex: 1, paddingHorizontal: 16, marginTop: 12 },
  answersGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 10, direction: 'ltr' },
  answerBtn: {
    width: (W - 42) / 2,
    flex: 0,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16, padding: 14,
    borderWidth: 1.5, borderColor: Colors.border,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    minHeight: 64,
  },
  answerBtnRtl: { direction: 'rtl' },
  answerSelected: { borderColor: Colors.primaryLight, backgroundColor: Colors.primary + '22' },
  answerCorrect: { borderColor: Colors.success, backgroundColor: Colors.success + '22' },
  answerWrong: { borderColor: Colors.error, backgroundColor: Colors.error + '22' },
  answerLetter: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.border,
    textAlign: 'center', lineHeight: 28,
    fontSize: 13, fontWeight: '800', color: Colors.text,
    overflow: 'hidden',
  },
  answerText: { flex: 1, fontSize: 14, color: Colors.text, fontWeight: '500' },
  answerTextRtl: { textAlign: 'right', writingDirection: 'rtl' },

  manualRow: { flex: 1, flexDirection: 'row', gap: 12 },
  manualBtn: { flex: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  correctBtn: { backgroundColor: Colors.success },
  wrongBtn: { backgroundColor: Colors.error },
  manualText: { color: Colors.text, fontSize: 20, fontWeight: '800' },

  trueFalseRow: { flex: 1, flexDirection: 'row', gap: 12 },
  trueFalseBtn: {
    flex: 1,
    minHeight: 128,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    paddingHorizontal: 14,
  },
  trueBtn: { backgroundColor: Colors.success + '22', borderColor: Colors.success },
  falseBtn: { backgroundColor: Colors.error + '22', borderColor: Colors.error },
  trueFalseMark: { color: Colors.text, fontSize: 38, fontWeight: '900', marginBottom: 8 },
  trueFalseText: { color: Colors.text, fontSize: 22, fontWeight: '900', textAlign: 'center' },

  feedbackBar: {
    marginHorizontal: 16, marginTop: 10,
    borderRadius: 14, padding: 12,
    borderWidth: 1,
  },
  feedbackCorrect: { backgroundColor: Colors.success + '22', borderColor: Colors.success },
  feedbackWrong: { backgroundColor: Colors.error + '22', borderColor: Colors.error },
  feedbackLabel: { color: Colors.text, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  feedbackExpl: { color: Colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 4 },

  footer: { padding: 16, paddingBottom: 20 },
  nextBtn: { backgroundColor: Colors.primary, borderRadius: 16, padding: 16, alignItems: 'center' },
  nextDisabled: { opacity: 0.4 },
  nextText: { color: Colors.text, fontSize: 18, fontWeight: '800' },

  categoryTransition: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background + 'D9',
    paddingHorizontal: 24,
  },
  categoryTransitionPanel: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 22,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  categoryTransitionKicker: { color: Colors.accent, fontSize: 13, fontWeight: '900', marginBottom: 8 },
  categoryTransitionIcon: { fontSize: 52, marginBottom: 8 },
  categoryTransitionName: { color: Colors.text, fontSize: 24, fontWeight: '900', textAlign: 'center' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.backgroundCard,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 28, gap: 12,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  modalTitle: { color: Colors.text, fontSize: 20, fontWeight: '900' },
  modalMirrorBtn: {
    width: '100%', backgroundColor: Colors.success,
    borderRadius: 16, paddingVertical: 16, paddingHorizontal: 14,
    alignItems: 'center', gap: 2,
  },
  modalMirrorText: { color: Colors.text, fontSize: 17, fontWeight: '900' },
  modalMirrorHint: { color: Colors.text, opacity: 0.85, fontSize: 12, fontWeight: '600' },
  modalDivider: { color: Colors.textMuted, fontSize: 12, fontWeight: '700', marginTop: 4 },
  modalSubtitle: { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },
  modalSite: {
    color: Colors.primaryLight, fontSize: 18, fontWeight: '800',
    backgroundColor: Colors.primary + '22',
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 12, overflow: 'hidden',
  },
  modalCodeLabel: { color: Colors.textMuted, fontSize: 13, fontWeight: '700', marginTop: 4 },
  modalCode: {
    color: Colors.accent, fontSize: 52, fontWeight: '900',
    letterSpacing: 10, textAlign: 'center',
  },
  modalCopyBtn: {
    width: '100%', backgroundColor: Colors.primary,
    borderRadius: 14, padding: 14, alignItems: 'center',
  },
  modalCopyText: { color: Colors.text, fontSize: 15, fontWeight: '800' },
  modalScanBtn: {
    width: '100%', backgroundColor: Colors.backgroundCard,
    borderRadius: 14, padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  modalScanText: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  modalCloseBtn: { paddingVertical: 8 },
  modalCloseText: { color: Colors.textMuted, fontSize: 14 },
});

// Presentation-mode palette — mirrors the tahaddii.com/tv web display so a
// mirrored/cast phone screen looks like the dedicated TV page, not the
// phone's normal controller UI.
const P = {
  bg: '#06030f',
  panel: '#150c2e',
  panelBorder: 'rgba(199,184,255,0.16)',
  primary: '#8b5cf6',
  gold: '#f2b93d',
  text: '#f7f5ff',
  muted: '#a79fc4',
  success: '#22c55e',
  error: '#f87171',
};

const pStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.bg, padding: 20 },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  category: { flex: 1, color: P.gold, fontSize: 20, fontWeight: '900' },
  progress: { color: P.muted, fontSize: 16, fontWeight: '800' },
  progressTrack: { height: 6, backgroundColor: P.panel, borderRadius: 99, overflow: 'hidden', marginTop: 10 },
  progressFill: { height: '100%', backgroundColor: P.primary, borderRadius: 99 },

  playerLine: { color: P.muted, fontSize: 16, fontWeight: '700', textAlign: 'center', marginTop: 14 },

  questionCard: {
    marginTop: 14,
    backgroundColor: P.panel,
    borderRadius: 24,
    borderWidth: 1, borderColor: P.panelBorder,
    minHeight: SCREEN_H * 0.24,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  questionImage: { width: '100%', height: SCREEN_H * 0.26, backgroundColor: P.panel },
  questionText: {
    fontSize: 30, color: P.text, textAlign: 'center',
    lineHeight: 42, fontWeight: '800', padding: 26,
  },

  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16 },
  timerTrack: { flex: 1, height: 10, backgroundColor: P.panel, borderRadius: 99, overflow: 'hidden' },
  timerFill: { height: '100%', borderRadius: 99 },
  timerBadge: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, backgroundColor: P.panel,
  },
  timerNum: { fontSize: 22, fontWeight: '900' },

  answersBlock: { flex: 1, marginTop: 18 },
  answersGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 14, direction: 'ltr' },
  answerBtn: {
    width: (W - 54) / 2,
    backgroundColor: P.panel,
    borderRadius: 20, padding: 18,
    borderWidth: 2, borderColor: P.panelBorder,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    minHeight: 84,
  },
  answerSelected: { borderColor: P.primary, backgroundColor: P.primary + '22' },
  answerCorrect: { borderColor: P.success, backgroundColor: P.success + '22' },
  answerWrong: { borderColor: P.error, backgroundColor: P.error + '22' },
  answerLetter: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: P.bg,
    textAlign: 'center', lineHeight: 34,
    fontSize: 15, fontWeight: '900', color: P.gold,
    overflow: 'hidden',
  },
  answerText: { flex: 1, fontSize: 18, color: P.text, fontWeight: '700' },
  answerTextRtl: { textAlign: 'right', writingDirection: 'rtl' },

  manualRow: { flex: 1, flexDirection: 'row', gap: 14 },
  manualBtn: { flex: 1, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  correctBtn: { backgroundColor: P.success },
  wrongBtn: { backgroundColor: P.error },
  manualText: { color: P.text, fontSize: 24, fontWeight: '900' },

  trueFalseRow: { flex: 1, flexDirection: 'row', gap: 14 },
  trueFalseBtn: {
    flex: 1, minHeight: 140, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, paddingHorizontal: 16,
  },
  trueBtn: { backgroundColor: P.success + '22', borderColor: P.success },
  falseBtn: { backgroundColor: P.error + '22', borderColor: P.error },
  trueFalseMark: { color: P.text, fontSize: 44, fontWeight: '900', marginBottom: 10 },
  trueFalseText: { color: P.text, fontSize: 26, fontWeight: '900', textAlign: 'center' },

  feedbackBar: { marginTop: 14, borderRadius: 18, padding: 16, borderWidth: 1 },
  feedbackCorrect: { backgroundColor: P.success + '22', borderColor: P.success },
  feedbackWrong: { backgroundColor: P.error + '22', borderColor: P.error },
  feedbackLabel: { color: P.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  feedbackExpl: { color: P.muted, fontSize: 14, textAlign: 'center', marginTop: 4 },

  controlBar: {
    position: 'absolute', bottom: 18, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(6,3,15,0.92)',
    borderRadius: 99, padding: 6,
    borderWidth: 1, borderColor: P.panelBorder,
  },
  controlExitBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: P.panel,
  },
  controlExitText: { color: P.muted, fontSize: 16, fontWeight: '800' },
  controlNextBtn: {
    backgroundColor: P.primary, borderRadius: 99,
    paddingVertical: 10, paddingHorizontal: 22,
  },
  controlNextDisabled: { opacity: 0.4 },
  controlNextText: { color: P.text, fontSize: 15, fontWeight: '800' },
});
