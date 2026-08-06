import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList, Difficulty } from '../types';
import { Colors } from '../theme/colors';
import { useGameStore } from '../store/gameStore';
import {
  getCategoriesWithQuestionsForAge,
  getCategoriesWithQuestionsForAgeFromBank,
  getDifficultyQuestionCountForAge,
  getDifficultyQuestionCountForAgeFromBank,
  loadQuestionBank,
} from '../services/questions/questionCatalog';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'DifficultySelect'> };

const LEVELS: { id: Difficulty | 'progressive'; icon: string; color: string; pts: string }[] = [
  { id: 'easy', icon: '😊', color: Colors.success, pts: '10' },
  { id: 'medium', icon: '🤔', color: Colors.accent, pts: '20' },
  { id: 'hard', icon: '🔥', color: Colors.error, pts: '30' },
  { id: 'progressive', icon: '📈', color: Colors.primary, pts: '10→30' },
];

export default function DifficultySelectScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { settings, updateSettings } = useGameStore();
  const activeCategories = settings.categories.length
    ? settings.categories
    : getCategoriesWithQuestionsForAge(settings.ageGroup);
  const [difficultyCounts, setDifficultyCounts] = useState(() => getDifficultyQuestionCountForAge(settings.ageGroup, activeCategories));

  useEffect(() => {
    let isMounted = true;

    loadQuestionBank().then(questions => {
      if (!isMounted) return;

      const nextActiveCategories = settings.categories.length
        ? settings.categories
        : getCategoriesWithQuestionsForAgeFromBank(questions, settings.ageGroup);
      setDifficultyCounts(getDifficultyQuestionCountForAgeFromBank(questions, settings.ageGroup, nextActiveCategories));
    });

    return () => {
      isMounted = false;
    };
  }, [settings.ageGroup, settings.categories]);

  const select = (id: Difficulty | 'progressive') => {
    updateSettings({ difficulty: id });
    navigation.navigate('GameSetup');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('difficulty.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {LEVELS.map(item => (
          <TouchableOpacity
            key={item.id}
            style={[styles.card,
              { borderColor: settings.difficulty === item.id ? item.color : Colors.border },
              item.id !== 'progressive' && difficultyCounts[item.id] === 0 && styles.cardDisabled]}
            onPress={() => select(item.id)}
            disabled={item.id !== 'progressive' && difficultyCounts[item.id] === 0}>
            <Text style={styles.icon}>{item.icon}</Text>
            <View style={styles.info}>
              <Text style={styles.label}>{t(`difficulty.${item.id}`)}</Text>
              <Text style={styles.desc}>{t(`difficulty.${item.id}Desc`)}</Text>
            </View>
            <View style={styles.badgeWrap}>
              <View style={[styles.badge, { backgroundColor: item.color + '33' }]}>
                <Text style={[styles.badgeText, { color: item.color }]}>{t('difficulty.pointsBadge', { points: item.pts })}</Text>
              </View>
              {item.id !== 'progressive' ? <Text style={styles.countText}>{difficultyCounts[item.id]}</Text> : null}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  back: { padding: 4 },
  backText: { fontSize: 32, color: Colors.primaryLight, lineHeight: 36 },
  title: { fontSize: 22, fontWeight: 'bold', color: Colors.text },
  scroll: { padding: 16, gap: 14 },
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16, padding: 18,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, gap: 14,
  },
  cardDisabled: { opacity: 0.45 },
  icon: { fontSize: 36 },
  info: { flex: 1 },
  label: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  desc: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  badgeWrap: { alignItems: 'flex-end', gap: 6 },
  badge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { fontSize: 13, fontWeight: 'bold' },
  countText: { fontSize: 12, color: Colors.textMuted, fontWeight: '700' },
});
