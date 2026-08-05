import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList, CategoryId } from '../types';
import { Colors } from '../theme/colors';
import { useGameStore } from '../store/gameStore';
import { CATEGORY_EMOJIS } from '../constants';
import {
  CATEGORY_IDS,
  getCategoriesWithQuestionsForAgeFromBank,
  getCategoriesWithQuestionsForAge,
  getCategoryQuestionCountForAge,
  getCategoryQuestionCountForAgeFromBank,
  loadQuestionBank,
} from '../services/questions/questionCatalog';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'CategorySelect'> };

export default function CategorySelectScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { settings, updateSettings } = useGameStore();
  const [categoryData, setCategoryData] = useState(() => ({
    availableCategories: getCategoriesWithQuestionsForAge(settings.ageGroup),
    counts: Object.fromEntries(
      CATEGORY_IDS.map(categoryId => [categoryId, getCategoryQuestionCountForAge(categoryId, settings.ageGroup)]),
    ) as Record<CategoryId, number>,
  }));
  const availableCategories = categoryData.availableCategories;
  const [selected, setSelected] = useState<CategoryId[]>(
    settings.categories.filter(categoryId => availableCategories.includes(categoryId)).length
      ? settings.categories.filter(categoryId => availableCategories.includes(categoryId))
      : availableCategories,
  );

  useEffect(() => {
    let isMounted = true;

    loadQuestionBank().then(questions => {
      if (!isMounted) return;

      const nextAvailableCategories = getCategoriesWithQuestionsForAgeFromBank(questions, settings.ageGroup);
      setCategoryData({
        availableCategories: nextAvailableCategories,
        counts: Object.fromEntries(
          CATEGORY_IDS.map(categoryId => [categoryId, getCategoryQuestionCountForAgeFromBank(questions, categoryId, settings.ageGroup)]),
        ) as Record<CategoryId, number>,
      });
      setSelected(previous => {
        const nextSelected = previous.filter(categoryId => nextAvailableCategories.includes(categoryId));
        return nextSelected.length ? nextSelected : nextAvailableCategories;
      });
    });

    return () => {
      isMounted = false;
    };
  }, [settings.ageGroup]);

  const toggle = (id: CategoryId) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id],
    );
  };

  const selectAll = () => setSelected(availableCategories);
  const clearAll = () => setSelected([]);

  const canNext = selected.length > 0;

  const handleNext = () => {
    updateSettings({ categories: selected });
    navigation.navigate('DifficultySelect');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('categories.title')}</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={selectAll}>
          <Text style={styles.actionText}>{t('categories.selectAll')}</Text>
        </TouchableOpacity>
        <Text style={styles.selectedCount}>{selected.length} / {availableCategories.length}</Text>
        <TouchableOpacity style={styles.actionBtn} onPress={clearAll}>
          <Text style={[styles.actionText, { color: Colors.error }]}>✕ {t('common.clear')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {availableCategories.map(id => {
          const isSelected = selected.includes(id);
          const count = categoryData.counts[id] ?? getCategoryQuestionCountForAge(id, settings.ageGroup);
          return (
            <TouchableOpacity
              key={id}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => toggle(id)}>
              <Text style={styles.chipIcon}>{CATEGORY_EMOJIS[id]}</Text>
              <View style={styles.chipContent}>
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {t(`categories.${id}`)}
                </Text>
                <Text style={styles.chipMeta}>{count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextBtn, !canNext && styles.nextBtnDisabled]}
          onPress={handleNext}
          disabled={!canNext}>
          <Text style={styles.nextBtnText}>{t('common.next')} ›</Text>
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
  actions: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  actionBtn: { padding: 8 },
  actionText: { fontSize: 14, color: Colors.primaryLight, fontWeight: '600' },
  selectedCount: { fontSize: 14, color: Colors.textMuted },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    padding: 12, gap: 10, paddingBottom: 100,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 24, paddingVertical: 10, paddingHorizontal: 14,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  chipContent: { gap: 2 },
  chipSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '22' },
  chipIcon: { fontSize: 18 },
  chipText: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  chipTextSelected: { color: Colors.primaryLight, fontWeight: '700' },
  chipMeta: { fontSize: 11, color: Colors.textMuted },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, backgroundColor: Colors.background,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  nextBtn: { backgroundColor: Colors.primary, borderRadius: 14, padding: 16, alignItems: 'center' },
  nextBtnDisabled: { backgroundColor: Colors.border },
  nextBtnText: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
});
