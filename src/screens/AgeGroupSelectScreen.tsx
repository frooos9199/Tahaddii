import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList, AgeGroup } from '../types';
import { Colors } from '../theme/colors';
import { useGameStore } from '../store/gameStore';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'AgeGroupSelect'> };

const AGE_GROUPS: { id: AgeGroup; icon: string; key: string; color: string }[] = [
  { id: 'family', icon: '👨‍👩‍👧‍👦', key: 'ageGroups.family', color: Colors.primaryLight },
  { id: 'kids8', icon: '🧒', key: 'ageGroups.kids8', color: Colors.success },
  { id: 'kids11', icon: '🧒', key: 'ageGroups.kids11', color: Colors.accent },
  { id: 'teens', icon: '👨', key: 'ageGroups.teens', color: Colors.secondary },
  { id: 'adults', icon: '🧔', key: 'ageGroups.adults', color: Colors.primary },
];

export default function AgeGroupSelectScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { settings, updateSettings } = useGameStore();

  const select = (id: AgeGroup) => {
    updateSettings({ ageGroup: id });
    navigation.navigate('DifficultySelect');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('ageGroups.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {AGE_GROUPS.map(item => (
          <TouchableOpacity
            key={item.id}
            style={[styles.card,
              { borderColor: settings.ageGroup === item.id ? item.color : Colors.border }]}
            onPress={() => select(item.id)}>
            <Text style={styles.icon}>{item.icon}</Text>
            <Text style={styles.label}>{t(item.key)}</Text>
            {settings.ageGroup === item.id && (
              <Text style={[styles.check, { color: item.color }]}>✓</Text>
            )}
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
  scroll: { padding: 16, gap: 12 },
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    gap: 14,
  },
  icon: { fontSize: 32 },
  label: { flex: 1, fontSize: 17, fontWeight: '600', color: Colors.text },
  check: { fontSize: 22, fontWeight: 'bold' },
});
