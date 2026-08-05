import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList, GameMode } from '../types';
import { Colors } from '../theme/colors';
import { useGameStore } from '../store/gameStore';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'GameModeSelect'> };

const MODES: { mode: GameMode; icon: string; key: string; descKey: string; color: string }[] = [
  { mode: 'solo', icon: '👤', key: 'gameModes.solo', descKey: 'gameModes.soloDesc', color: Colors.secondary },
  { mode: 'group', icon: '👥', key: 'gameModes.group', descKey: 'gameModes.groupDesc', color: Colors.primary },
  { mode: 'teams', icon: '🏆', key: 'gameModes.teams', descKey: 'gameModes.teamsDesc', color: Colors.accent },
  { mode: 'kids', icon: '🧒', key: 'gameModes.kids', descKey: 'gameModes.kidsDesc', color: '#EC4899' },
  { mode: 'family', icon: '👨‍👩‍👧‍👦', key: 'gameModes.family', descKey: 'gameModes.familyDesc', color: Colors.success },
  { mode: 'speedChallenge', icon: '⚡', key: 'gameModes.speedChallenge', descKey: 'gameModes.speedChallengeDesc', color: Colors.warning },
];

export default function GameModeSelectScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const updateSettings = useGameStore(s => s.updateSettings);

  const select = (mode: GameMode) => {
    updateSettings({ mode });
    navigation.navigate('AddPlayers');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('gameModes.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {MODES.map(item => (
          <TouchableOpacity
            key={item.mode}
            style={[styles.card, { borderColor: item.color }]}
            onPress={() => select(item.mode)}>
            <Text style={styles.icon}>{item.icon}</Text>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{t(item.key)}</Text>
              <Text style={styles.cardDesc}>{t(item.descKey)}</Text>
            </View>
            <Text style={[styles.arrow, { color: item.color }]}>›</Text>
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
  icon: { fontSize: 36 },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  cardDesc: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  arrow: { fontSize: 28, fontWeight: 'bold' },
});
