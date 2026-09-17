import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Switch, Alert, Linking, Modal, Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import { RootStackParamList } from '../types';
import { Colors } from '../theme/colors';
import { useGameStore } from '../store/gameStore';
import { useAppStore } from '../store/appStore';
import { CATEGORY_EMOJIS, TIME_OPTIONS } from '../constants';
import { getQuestions } from '../services/questions/questionService';
import { getAvailableQuestionCount, getAvailableQuestionCountFromBank, getFairQuestionCountOptions, getRecommendedFairQuestionCount, loadQuestionBank } from '../services/questions/questionCatalog';
import { createTvDisplaySession, getTvDisplayUrl, pairTvDisplaySession, updateTvDisplaySession } from '../services/tv/tvDisplayService';
import { getQuestionPrimaryImageUrl, preloadUpcomingQuestionMedia } from '../services/media/questionMediaService';
import { areAnswerOptionsEnabled, getQuestionAnswers } from '../utils/questionAnswerOptions';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'GameSetup'> };

export default function GameSetupScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const language = useAppStore(s => s.language);
  const { settings, updateSettings, initGame, pendingPlayers, pendingTvDisplayCode, setPendingTvDisplayCode } = useGameStore();
  const [isStarting, setIsStarting] = useState(false);
  const [tvModalVisible, setTvModalVisible] = useState(false);
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

    return [...new Set(getFairQuestionCountOptions({ availableQuestionCount, playerCount: playerTurnUnit })
      .map(totalQuestions => Math.max(1, Math.floor(totalQuestions / playerTurnUnit))))];
  }, [availableQuestionCount, playerTurnUnit]);
  const canStart = availableQuestionCount > 0;
  const participantUnit = settings.mode === 'teams'
    ? t('players.teamUnit')
    : settings.mode === 'kids'
      ? t('players.childUnit')
      : t('players.personUnit');

  useEffect(() => {
    const currentPerUnit = Math.max(1, Math.floor((settings.questionCount || 0) / playerTurnUnit));
    const normalizedQuestionCount = currentPerUnit * playerTurnUnit;

    if (availableQuestionOptions.length > 0 && (!availableQuestionOptions.includes(currentPerUnit) || settings.questionCount !== normalizedQuestionCount)) {
      updateSettings({ questionCount: getRecommendedFairQuestionCount({ availableQuestionCount, playerCount: playerTurnUnit }) });
      return;
    }

    if (availableQuestionOptions.length === 0 && settings.questionCount !== playerTurnUnit) {
      updateSettings({ questionCount: playerTurnUnit });
    }
  }, [availableQuestionCount, availableQuestionOptions, playerTurnUnit, settings.questionCount, updateSettings]);

  const selectedQuestionsPerUnit = Math.max(1, Math.floor((settings.questionCount || 0) / playerTurnUnit));
  const formatTime = (seconds: number) => {
    if (seconds === 0) return t('common.noLimit');
    if (seconds === 30) return t('gameSetup.time30');
    if (seconds === 60) return t('gameSetup.time60');
    if (seconds === 90) return t('gameSetup.time90');
    if (seconds === 120) return t('gameSetup.time120');
    if (seconds === 150) return t('gameSetup.time150');
    return `${seconds}s`;
  };

  const openTvModal = async () => {
    try {
      if (!pendingTvDisplayCode) {
        const code = await createTvDisplaySession();
        await pairTvDisplaySession(code, language === 'en' ? 'en' : 'ar');
        setPendingTvDisplayCode(code);
      }
      setTvModalVisible(true);
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('tvDisplay.startFailed'));
    }
  };

  const openMirrorSettings = () => {
    if (Platform.OS === 'ios') {
      Alert.alert('📺 ' + t('tvDisplay.mirrorTitle'), t('tvDisplay.mirrorInstructionsIos'), [{ text: t('common.close') }]);
    } else {
      Linking.sendIntent('android.settings.CAST_SETTINGS').catch(() => Linking.openSettings());
    }
  };

  const startGame = async () => {
    if (isStarting) {
      return;
    }

    setIsStarting(true);
    let questions;
    try {
      questions = await getQuestions(settings);
    } catch (error) {
      console.warn('Failed to load questions when starting game', error);
      setIsStarting(false);
      Alert.alert(t('common.error'), t('errors.loadError'));
      return;
    }
    if (questions.length < 1) {
      setIsStarting(false);
      Alert.alert('', t('errors.notEnoughQuestions'));
      return;
    }
    initGame(questions);
    preloadUpcomingQuestionMedia(questions, 0, 5);
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
      const answers = getQuestionAnswers(firstQuestion, questionLanguage);
      const displayCategoryId = firstQuestion.queueCategoryId || firstQuestion.categoryId;
      const displayCategoryName = t(`categories.${displayCategoryId}`, { defaultValue: displayCategoryId });

      void updateTvDisplaySession(pendingTvDisplayCode, {
        gameId: createdGame.id,
        status: 'playing',
        syncSource: 'game-setup-start-button',
        language: language === 'en' ? 'en' : 'ar',
        questionIndex: createdGame.currentQuestionIndex,
        totalQuestions: createdGame.questions.length,
        timeLeft: createdGame.settings.timePerQuestion > 0 ? createdGame.settings.timePerQuestion : null,
        question: {
          id: firstQuestion.id,
          type: firstQuestion.type,
          categoryId: displayCategoryId,
          categoryName: displayCategoryName,
          categoryEmoji: CATEGORY_EMOJIS[displayCategoryId] || '🎯',
          text: questionText,
          points: firstQuestion.points,
          imageUrl: getQuestionPrimaryImageUrl(firstQuestion, false),
          revealImageUrl: firstQuestion.revealImageUrl || firstQuestion.imageUrl || '',
          thumbnailUrl: firstQuestion.thumbnailUrl || '',
          videoUrl: firstQuestion.videoUrl || '',
          mediaType: firstQuestion.mediaType || (firstQuestion.videoUrl ? 'video' : firstQuestion.imageUrl ? 'image' : undefined),
          revealMode: (firstQuestion.revealMode === 'blur' ? 'blur' : 'none') as 'blur' | 'none',
          blurAmount: Number(firstQuestion.blurAmount ?? 18),
        },
        answers: (firstQuestion.type === 'true_false' || areAnswerOptionsEnabled(firstQuestion, createdGame.settings)) ? answers.map(answer => ({
          text: answer,
          isCorrect: false,
          isSelected: false,
        })) : [],
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
      }).catch(error => {
        console.warn('Failed to sync TV display while starting game', error);
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
    <SafeAreaView
  style={styles.safe}
  edges={['top', 'left', 'right']}
>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('gameSetup.title')}</Text>
      </View>

<ScrollView
  contentContainerStyle={[
    styles.scroll,
    { paddingBottom: 190 + insets.bottom },
  ]}
  showsVerticalScrollIndicator={false}
>
        {/* Summary */}
        <View style={styles.summary}>
          <Text style={styles.summaryItem}>👥 {pendingPlayers.length} {participantUnit}</Text>
          <Text style={styles.summaryItem}>📂 {settings.categories.length} {t('common.categories')}</Text>
          <Text style={styles.summaryItem}>❓ {availableQuestionCount} {t('gameSetup.availableQuestions')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('gameSetup.questionCount')}</Text>
          {availableQuestionOptions.length > 0 ? (
            <>
              <Chips
                options={availableQuestionOptions}
                value={selectedQuestionsPerUnit}
                onSelect={v => updateSettings({ questionCount: v * playerTurnUnit })}
              />
              <Text style={styles.helperText}>{t('gameSetup.perPlayerQuestionHint', { total: settings.questionCount, unit: participantUnit })}</Text>
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
            format={formatTime}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('gameSetup.questionLanguage')}</Text>
          <View style={styles.chips}>
            {(['ar', 'en', 'both'] as const).map(lang => (
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
          <Text style={styles.sectionTitle}>{t('gameSetup.answerOptions')}</Text>
          <Text style={styles.sectionDescription}>{t('gameSetup.answerOptionsHint')}</Text>
          <Row label={t('gameSetup.textQuestions')}>
            <Switch
              value={settings.showTextAnswerOptions}
              onValueChange={v => updateSettings({ showTextAnswerOptions: v })}
              trackColor={{ true: Colors.primary }}
              thumbColor={Colors.text}
            />
          </Row>
          <Row label={t('gameSetup.imageQuestions')}>
            <Switch
              value={settings.showImageAnswerOptions}
              onValueChange={v => updateSettings({ showImageAnswerOptions: v })}
              trackColor={{ true: Colors.primary }}
              thumbColor={Colors.text}
            />
          </Row>
          <Row label={t('gameSetup.videoQuestions')}>
            <Switch
              value={settings.showVideoAnswerOptions}
              onValueChange={v => updateSettings({ showVideoAnswerOptions: v })}
              trackColor={{ true: Colors.primary }}
              thumbColor={Colors.text}
            />
          </Row>
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

      <View
  style={[
    styles.footer,
    {
      paddingBottom: Math.max(insets.bottom, 16),
    },
  ]}
>
        <TouchableOpacity
          style={[styles.tvBtn, pendingTvDisplayCode && styles.tvBtnActive]}
          onPress={() => { void openTvModal(); }}>
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

      <Modal visible={tvModalVisible} transparent animationType="slide" onRequestClose={() => setTvModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setTvModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.modalSheet, { paddingBottom: 28 + insets.bottom }]}>
            <View style={[styles.modalHeader, language !== 'en' && styles.modalHeaderRtl]}>
              <View style={styles.modalHeading}>
                <Text style={[styles.modalTitle, language !== 'en' && styles.textRtl]}>{t('tvDisplay.title')}</Text>
                <Text style={[styles.modalSubtitle, language !== 'en' && styles.textRtl]}>{t('tvDisplay.chooseMethod')}</Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                style={styles.modalCloseBtn}
                onPress={() => setTvModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.displayCodeCard}>
              <Text style={styles.modalCodeLabel}>{t('tvDisplay.displayCode')}</Text>
              <Text style={styles.modalCode}>{pendingTvDisplayCode}</Text>
            </View>

            <View style={styles.tvMethods}>
              <TouchableOpacity
                style={[styles.tvMethodBtn, styles.tvMethodPrimary, language !== 'en' && styles.tvMethodRtl]}
                onPress={() => { setTvModalVisible(false); openMirrorSettings(); }}>
                <View style={[styles.tvMethodIcon, styles.tvMethodPrimaryIcon]}>
                  <Text style={styles.tvMethodIconText}>▣</Text>
                </View>
                <View style={styles.tvMethodContent}>
                  <Text style={[styles.tvMethodTitle, language !== 'en' && styles.textRtl]}>{t('tvDisplay.directTitle')}</Text>
                  <Text style={[styles.tvMethodHint, language !== 'en' && styles.textRtl]}>{t('tvDisplay.directHint')}</Text>
                </View>
                <Text style={styles.tvMethodArrow}>{language === 'en' ? '›' : '‹'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tvMethodBtn, styles.tvMethodRecommended, language !== 'en' && styles.tvMethodRtl]}
                onPress={() => { setTvModalVisible(false); navigation.navigate('TvPairingScanner'); }}>
                <View style={[styles.tvMethodIcon, styles.tvMethodRecommendedIcon]}>
                  <Text style={styles.tvMethodIconText}>⌗</Text>
                </View>
                <View style={styles.tvMethodContent}>
                  <View style={[styles.tvMethodTitleRow, language !== 'en' && styles.tvMethodTitleRowRtl]}>
                    <Text style={[styles.tvMethodTitle, language !== 'en' && styles.textRtl]}>{t('tvDisplay.scanActionTitle')}</Text>
                    <Text style={styles.recommendedBadge}>{t('tvDisplay.recommended')}</Text>
                  </View>
                  <Text style={[styles.tvMethodHint, language !== 'en' && styles.textRtl]}>{t('tvDisplay.scanActionHint')}</Text>
                </View>
                <Text style={styles.tvMethodArrow}>{language === 'en' ? '›' : '‹'}</Text>
              </TouchableOpacity>

            <TouchableOpacity
                style={[styles.tvMethodBtn, language !== 'en' && styles.tvMethodRtl]}
              onPress={() => {
                if (pendingTvDisplayCode) {
                  Clipboard.setString(getTvDisplayUrl(pendingTvDisplayCode));
                    Alert.alert('✓', t('tvDisplay.linkCopied'));
                }
              }}>
                <View style={styles.tvMethodIcon}>
                  <Text style={styles.tvMethodIconText}>□</Text>
                </View>
                <View style={styles.tvMethodContent}>
                  <Text style={[styles.tvMethodTitle, language !== 'en' && styles.textRtl]}>{t('tvDisplay.copyLinkTitle')}</Text>
                  <Text style={[styles.tvMethodHint, language !== 'en' && styles.textRtl]}>{t('tvDisplay.copyLinkHint')}</Text>
                </View>
                <Text style={styles.tvMethodArrow}>{language === 'en' ? '›' : '‹'}</Text>
            </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  back: { padding: 4 },
  backText: { fontSize: 32, color: Colors.primaryLight, lineHeight: 36 },
  title: { fontSize: 22, fontWeight: 'bold', color: Colors.text },
  scroll: {
  paddingHorizontal: 16,
  paddingTop: 16,
  gap: 16,
},
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
  sectionDescription: { fontSize: 13, color: Colors.textMuted, lineHeight: 20 },
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
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  paddingHorizontal: 16,
  paddingTop: 16,
  backgroundColor: Colors.background,
  gap: 8,
  borderTopWidth: 1,
  borderTopColor: Colors.border,
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

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.backgroundCard,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 20, gap: 18,
    borderWidth: 1, borderColor: Colors.border,
  },
  modalHeader: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  modalHeaderRtl: { flexDirection: 'row-reverse' },
  modalHeading: { flex: 1, gap: 4 },
  modalTitle: { color: Colors.text, fontSize: 21, fontWeight: '900' },
  modalSubtitle: { color: Colors.textMuted, fontSize: 14, lineHeight: 20 },
  textRtl: { textAlign: 'right', writingDirection: 'rtl' },
  modalCloseBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
  },
  modalCloseText: { color: Colors.textMuted, fontSize: 16, fontWeight: '800' },
  displayCodeCard: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
  },
  modalCodeLabel: { color: Colors.textMuted, fontSize: 13, fontWeight: '700' },
  modalCode: { color: Colors.accent, fontSize: 28, fontWeight: '900', letterSpacing: 4 },
  tvMethods: { width: '100%', gap: 10 },
  tvMethodBtn: {
    width: '100%', minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 14, backgroundColor: Colors.background,
    borderWidth: 1, borderColor: Colors.border,
  },
  tvMethodRtl: { flexDirection: 'row-reverse' },
  tvMethodPrimary: { borderColor: Colors.primary },
  tvMethodRecommended: { borderColor: Colors.success, backgroundColor: Colors.success + '12' },
  tvMethodIcon: {
    width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary + '22',
  },
  tvMethodPrimaryIcon: { backgroundColor: Colors.primary + '35' },
  tvMethodRecommendedIcon: { backgroundColor: Colors.success + '35' },
  tvMethodIconText: { color: Colors.text, fontSize: 23, fontWeight: '900' },
  tvMethodContent: { flex: 1, gap: 3 },
  tvMethodTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  tvMethodTitleRowRtl: { flexDirection: 'row-reverse', justifyContent: 'flex-start' },
  tvMethodTitle: { color: Colors.text, fontSize: 15, fontWeight: '900' },
  tvMethodHint: { color: Colors.textMuted, fontSize: 12, lineHeight: 17 },
  tvMethodArrow: { color: Colors.textMuted, fontSize: 27, fontWeight: '500' },
  recommendedBadge: {
    color: Colors.success, fontSize: 10, fontWeight: '900',
    backgroundColor: Colors.success + '22', paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 8, overflow: 'hidden',
  },
});
