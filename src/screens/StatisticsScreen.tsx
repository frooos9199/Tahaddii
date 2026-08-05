import React from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Colors } from '../theme/colors';
import { useAppStore } from '../store/appStore';
import { RootStackParamList } from '../types';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Statistics'> };

export default function StatisticsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const stats = useAppStore(s => s.stats);

  const cards = [
    { label: t('home.gamesPlayed'), value: stats.totalGames },
    { label: t('home.bestScore'), value: stats.bestScore },
    { label: t('results.correctAnswers'), value: stats.correctAnswers },
    { label: t('common.question'), value: stats.totalQuestions },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
            <Text style={styles.backText}>{'‹'}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('common.statistics')}</Text>
        </View>
        <View style={styles.grid}>
          {cards.map(card => (
            <View key={card.label} style={styles.card}>
              <Text style={styles.cardValue}>{card.value}</Text>
              <Text style={styles.cardLabel}>{card.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{t('results.finalScores')}</Text>
          {stats.recentGames.length === 0 ? (
            <Text style={styles.emptyText}>{t('common.loading')}</Text>
          ) : (
            stats.recentGames.slice(0, 8).map(result => (
              <View key={result.id} style={styles.resultRow}>
                <View>
                  <Text style={styles.resultMode}>{result.mode}</Text>
                  <Text style={styles.resultMeta}>{result.totalQuestions} {t('common.question')}</Text>
                </View>
                <Text style={styles.resultScore}>{Math.max(...result.players.map(player => player.score), 0)}</Text>
              </View>
            ))
          )}
        </View>
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
  title: { color: Colors.text, fontSize: 30, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '47%',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
  },
  cardValue: { color: Colors.primaryLight, fontSize: 26, fontWeight: '800' },
  cardLabel: { color: Colors.textMuted, marginTop: 8 },
  panel: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 14,
  },
  panelTitle: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  emptyText: { color: Colors.textMuted },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  resultMode: { color: Colors.text, fontWeight: '700', textTransform: 'capitalize' },
  resultMeta: { color: Colors.textMuted, marginTop: 4 },
  resultScore: { color: Colors.accent, fontSize: 22, fontWeight: '800' },
});