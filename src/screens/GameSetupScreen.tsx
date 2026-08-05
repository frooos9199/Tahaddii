import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Switch, Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../types';
import { Colors } from '../theme/colors';
import { useGameStore } from '../store/gameStore';
import { useAppStore } from '../store/appStore';
import { TIME_OPTIONS } from '../constants';
import { getQuestions } from '../services/questions/questionService';
import { getAvailableQuestionCount, getAvailableQuestionCountFromBank, loadQuestionBank } from '../services/questions/questionCatalog';
import { updateTvDisplaySession } from '../services/tv/tvDisplayService';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'GameSetup'> };

export default function GameSetupScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const language = useAppStore(s => s.language);
  const { settings, updateSettings, initGame, pendingPlayers, pendingTvDisplayCode, setPendingTvDisplayCode } = useGameStore();
  const [isStarting, setIsStarting] = useState(false);
  const playerTurnUnit = Math.max(1, pendingPlayers.length || 1);
  const [availableQuestionCount, setAvailableQuestionCount] = useState(() => getAvailableQuestionCount(settings));

  useEffect(() => {
    let isMounted = true;

    loadQuestionBank().then(questions => {
      if (isMounted) {
        setAvailableQuestionCount(getAvailableQuestionCountFromBank(questions, settings));
      }
    });

    return () => {
      isMounted = false;
    };
  }, [settings]);
  const availableQuestionOptions = useMemo(() => {
    if (availableQuestionCount <= 0) {
      return [];
    }

    if (playerTurnUnit <= 1) {
      return [5, 10, 15, 20, 30, 40, 50]
        .filter(option => option <= availableQuestionCount);
    }

    const multipliers = [1, 2, 3, 4, 5, 6, 8, 10];
    const options = multipliers
      .map(multiplier => multiplier * playerTurnUnit)
      .filter(option => option <= availableQuestionCount);

    return [...new Set(options)].sort((left, right) => left - right);
  }, [availableQuestionCount, playerTurnUnit]);
  const canStart = availableQuestionCount > 0;

  useEffect(() => {
    if (availableQuestionOptions.length > 0 && !availableQuestionOptions.includes(settings.questionCount)) {
      updateSettings({ questionCount: availableQuestionOptions[availableQuestionOptions.length - 1] });
      return;
    }

    if (availableQuestionOptions.length === 0 && settings.questionCount !== playerTurnUnit) {
      updateSettings({ questionCount: playerTurnUnit });
    }
  }, [availableQuestionOptions, playerTurnUnit, settings.questionCount, updateSettings]);

  const startGame = async () => {
    if (isStarting) {
      return;
    }

    setIsStarting(true);
    const questions = await getQuestions(settings);
    if (questions.length < 1) {
      setIsStarting(false);
      Alert.alert('', t('errors.notEnoughQuestions'));
      return;
    }
    initGame(questions);
    const createdGame = useGameStore.getState().game;
    const firstQuestion = createdGame?.questions[createdGame.currentQuestionIndex];
    const firstPlayer = createdGame?.players[createdGame.currentPlayerIndex];

    if (pendingTvDisplayCode && createdGame && firstQuestion && firstPlayer) {
      const questionLanguage = createdGame.settings.questionLanguage;
      const questionText = questionLanguage === 'en'
        ? firstQuestion.questionEn || firstQuestion.questionAr
        : questionLanguage === 'both'
          ? `${firstQuestion.questionAr}\n\n${firstQuestion.questionEn}`
          : questionLanguage === 'mixed'
            ? firstQuestion.questionAr || firstQuestion.questionEn
            : firstQuestion.questionAr || firstQuestion.questionEn;
      const answers = questionLanguage === 'en'
        ? firstQuestion.answersEn?.length ? firstQuestion.answersEn : firstQuestion.answersAr
        : firstQuestion.answersAr?.length ? firstQuestion.answersAr : firstQuestion.answersEn;

      await updateTvDisplaySession(pendingTvDisplayCode, {
        gameId: createdGame.id,
        status: 'playing',
        syncSource: 'game-setup-start-button',
        language: language === 'en' ? 'en' : 'ar',
        questionIndex: createdGame.currentQuestionIndex,
        totalQuestions: createdGame.questions.length,
        timeLeft: createdGame.settings.timePerQuestion > 0 ? createdGame.settings.timePerQuestion : null,
        question: {
          id: firstQuestion.id,
          text: questionText,
          points: firstQuestion.points,
        },
        answers: answers.map(answer => ({
          text: answer,
          isCorrect: false,
          isSelected: false,
        })),
        currentPlayer: {
          id: firstPlayer.id,
          name: firstPlayer.name,
          score: firstPlayer.score,
          color: firstPlayer.color,
        },
        players: createdGame.players.map(player => ({
          id: player.id,
          name: player.name,
          score: player.score,
          correctAnswers: player.correctAnswers,
          wrongAnswers: player.wrongAnswers,
          color: player.color,
        })),
        correctAnswer: '',
        explanation: '',
      });
    }

    setIsStarting(false);
    navigation.navigate('Game');
  };

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>{children}</View>
    </View>
  );

  const Chips = ({ options, value, onSelect, format }: {
    options: number[]; value: number;
    onSelect: (v: number) => void; format?: (v: number) => string;
  }) => (
    <View style={styles.chips}>
      {options.map(o => (
        <TouchableOpacity
          key={o}
          style={[styles.chip, value === o && styles.chipActive]}
          onPress={() => onSelect(o)}>
          <Text style={[styles.chipText, value === o && styles.chipTextActive]}>
            {format ? format(o) : String(o)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('gameSetup.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Summary */}
        <View style={styles.summary}>
          <Text style={styles.summaryItem}>👥 {pendingPlayers.length} {t('common.player')}</Text>
          <Text style={styles.summaryItem}>📂 {settings.categories.length} {t('common.categories')}</Text>
          <Text style={styles.summaryItem}>⚡ {t(`difficulty.${settings.difficulty}`)}</Text>
          <Text style={styles.summaryItem}>❓ {availableQuestionCount} {t('gameSetup.availableQuestions')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('gameSetup.questionCount')}</Text>
          {availableQuestionOptions.length > 0 ? (
            <>
              <Chips
                options={availableQuestionOptions}
                value={settings.questionCount}
                onSelect={v => updateSettings({ questionCount: v })}
              />
              {pendingPlayers.length > 1 ? (
                <Text style={styles.helperText}>
                  {t('gameSetup.fairTurnsHint', {
                    players: pendingPlayers.length,
                    turns: Math.floor((settings.questionCount || 0) / playerTurnUnit),
                  })}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.helperText}>{t('gameSetup.notEnoughQuestionsForSettings')}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('gameSetup.timePerQuestion')}</Text>
          <Chips
            options={TIME_OPTIONS}
            value={settings.timePerQuestion}
            onSelect={v => updateSettings({ timePerQuestion: v })}
            format={v => v === 0 ? t('common.noLimit') : `${v}s`}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('gameSetup.questionLanguage')}</Text>
          <View style={styles.chips}>
            {(['ar', 'en', 'both', 'mixed'] as const).map(lang => (
              <TouchableOpacity
                key={lang}
                style={[styles.chip, settings.questionLanguage === lang && styles.chipActive]}
                onPress={() => updateSettings({ questionLanguage: lang })}>
                <Text style={[styles.chipText, settings.questionLanguage === lang && styles.chipTextActive]}>
                  {t(`gameSetup.${lang === 'ar' ? 'arabicOnly' : lang === 'en' ? 'englishOnly' : lang === 'both' ? 'both' : 'mixed'}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Row label={t('gameSetup.randomOrder')}>
            <Switch
              value={settings.randomOrder}
              onValueChange={v => updateSettings({ randomOrder: v })}
              trackColor={{ true: Colors.primary }}
              thumbColor={Colors.text}
            />
          </Row>
          <Row label={t('gameSetup.soundEnabled')}>
            <Switch
              value={settings.soundEnabled}
              onValueChange={v => updateSettings({ soundEnabled: v })}
              trackColor={{ true: Colors.primary }}
              thumbColor={Colors.text}
            />
          </Row>
          <Row label={t('gameSetup.allowRepeat')}>
            <Switch
              value={settings.allowRepeat}
              onValueChange={v => updateSettings({ allowRepeat: v })}
              trackColor={{ true: Colors.primary }}
              thumbColor={Colors.text}
            />
          </Row>
        </View>

      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.tvBtn, pendingTvDisplayCode && styles.tvBtnActive]}
          onPress={() => navigation.navigate('TvPairingScanner')}>
          <Text style={styles.tvBtnText}>{pendingTvDisplayCode ? t('tvDisplay.connectedBeforeStart', { code: pendingTvDisplayCode }) : t('tvDisplay.connectBeforeStart')}</Text>
        </TouchableOpacity>
        {pendingTvDisplayCode ? (
          <TouchableOpacity style={styles.clearTvBtn} onPress={() => setPendingTvDisplayCode(null)}>
            <Text style={styles.clearTvBtnText}>{t('tvDisplay.disconnect')}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.startBtn, (!canStart || isStarting) && styles.startBtnDisabled]}
          onPress={() => {
            void startGame();
          }}
          disabled={!canStart || isStarting}>
          <Text style={styles.startBtnText}>🎮  {isStarting ? t('common.loading') : t('gameSetup.startGame')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  back: { padding: 4 },
  backText: { fontSize: 32, color: Colors.primaryLight, lineHeight: 36 },
  title: { fontSize: 22, fontWeight: 'bold', color: Colors.text },
  scroll: { padding: 16, paddingBottom: 100, gap: 16 },
  summary: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14, padding: 14,
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  summaryItem: { fontSize: 13, color: Colors.textMuted },
  section: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border, gap: 12,
  },
  helperText: { fontSize: 13, color: Colors.warning, lineHeight: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  chipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '22' },
  chipText: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  chipTextActive: { color: Colors.primaryLight, fontWeight: '700' },
  row: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 4,
  },
  rowLabel: { fontSize: 15, color: Colors.text },
  rowRight: {},
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, backgroundColor: Colors.background, gap: 8,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  tvBtn: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  tvBtnActive: { backgroundColor: Colors.primary + '22', borderColor: Colors.primaryLight },
  tvBtnText: { color: Colors.primaryLight, fontSize: 15, fontWeight: '900' },
  clearTvBtn: { alignItems: 'center', paddingVertical: 4 },
  clearTvBtnText: { color: Colors.textMuted, fontSize: 12, fontWeight: '800' },
  startBtn: { backgroundColor: Colors.primary, borderRadius: 14, padding: 18, alignItems: 'center' },
  startBtnDisabled: { opacity: 0.6 },
  startBtnText: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
});
