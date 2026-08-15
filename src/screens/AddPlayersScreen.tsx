import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { RootStackParamList, AvatarType } from '../types';
import { Colors } from '../theme/colors';
import { useGameStore } from '../store/gameStore';
import {
  AVATAR_EMOJIS,
  PLAYER_COLORS,
  MAX_PLAYERS,
  MIN_PLAYERS_GROUP,
} from '../constants';


type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AddPlayers'>;
};


const AVATARS: AvatarType[] = [
  'boy',
  'girl',
  'man',
  'woman',
  'lion',
  'tiger',
  'robot',
  'car',
  'ball',
  'star',
];


export default function AddPlayersScreen({ navigation }: Props) {
  const { t } = useTranslation();

  // Safe area for Android navigation bar / gesture bar
  const insets = useSafeAreaInsets();

  const {
    pendingPlayers,
    addPlayer,
    removePlayer,
    settings,
  } = useGameStore();

  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<AvatarType>('boy');
  const [colorIdx, setColorIdx] = useState(0);


  const isSolo = settings.mode === 'solo';
  const isTeams = settings.mode === 'teams';
  const isKids = settings.mode === 'kids';

  const minPlayers = isSolo ? 1 : MIN_PLAYERS_GROUP;
  const maxEntries = isSolo ? 1 : MAX_PLAYERS;

  const screenTitle = isTeams
    ? t('players.teamsTitle')
    : isKids
      ? t('players.kidsTitle')
      : t('players.title');

  const namePlaceholder = isTeams
    ? t('players.teamName')
    : isKids
      ? t('players.childName')
      : t('players.enterName');

  const addLabel = isTeams
    ? t('players.addTeam')
    : isKids
      ? t('players.addChild')
      : t('players.addPlayer');

  const hintText = isTeams
    ? t('players.minTeams')
    : isSolo
      ? t('players.minSoloPlayers')
      : t('players.minPlayers');


  const handleAdd = () => {
    const trimmed = name.trim();

    if (!trimmed) {
      return;
    }

    if (pendingPlayers.find(p => p.name === trimmed)) {
      Alert.alert('', t('players.duplicateName'));
      return;
    }

    if (pendingPlayers.length >= maxEntries) {
      Alert.alert(
        '',
        isSolo
          ? t('players.maxSoloPlayers')
          : t('players.maxPlayers'),
      );
      return;
    }

    addPlayer(
      trimmed,
      avatar,
      PLAYER_COLORS[colorIdx % PLAYER_COLORS.length],
    );

    setName('');
    setColorIdx(c => c + 1);
  };


  const canNext = pendingPlayers.length >= minPlayers;


  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.back}
        >
          <Text style={styles.backText}>{'‹'}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>
          {screenTitle}
        </Text>
      </View>


      {/* Main Content */}
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingBottom: 110 + insets.bottom,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* Add form */}
        <View style={styles.form}>

          <TextInput
            style={styles.input}
            placeholder={namePlaceholder}
            placeholderTextColor={Colors.textMuted}
            value={name}
            onChangeText={setName}
            onSubmitEditing={handleAdd}
            maxLength={20}
          />


          {/* Avatar picker */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.avatarRow}
          >
            {AVATARS.map(a => (
              <TouchableOpacity
                key={a}
                style={[
                  styles.avatarBtn,
                  avatar === a && styles.avatarSelected,
                ]}
                onPress={() => setAvatar(a)}
              >
                <Text style={styles.avatarEmoji}>
                  {AVATAR_EMOJIS[a]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>


          {/* Color picker */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.colorRow}
          >
            {PLAYER_COLORS.map((c, i) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.colorDot,
                  {
                    backgroundColor: c,
                  },
                  colorIdx % PLAYER_COLORS.length === i &&
                    styles.colorSelected,
                ]}
                onPress={() => setColorIdx(i)}
              />
            ))}
          </ScrollView>


          {/* Add Button */}
          <TouchableOpacity
            style={styles.addBtn}
            onPress={handleAdd}
          >
            <Text style={styles.addBtnText}>
              + {addLabel}
            </Text>
          </TouchableOpacity>

        </View>


        {/* Players List */}
        {pendingPlayers.map(p => (
          <View
            key={p.id}
            style={[
              styles.playerCard,
              {
                borderColor: p.color,
              },
            ]}
          >

            <View
              style={[
                styles.playerAvatar,
                {
                  backgroundColor: p.color + '33',
                },
              ]}
            >
              <Text style={styles.playerEmoji}>
                {AVATAR_EMOJIS[p.avatar]}
              </Text>
            </View>


            <Text style={styles.playerName}>
              {p.name}
            </Text>


            <TouchableOpacity
              onPress={() => removePlayer(p.id)}
              style={styles.removeBtn}
            >
              <Text style={styles.removeText}>
                ✕
              </Text>
            </TouchableOpacity>

          </View>
        ))}


        {/* Minimum players hint */}
        {pendingPlayers.length < minPlayers && (
          <Text style={styles.hint}>
            👆 {hintText}
          </Text>
        )}

      </ScrollView>


      {/* Bottom Footer */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.nextBtn,
            !canNext && styles.nextBtnDisabled,
          ]}
          onPress={() =>
            canNext && navigation.navigate('AgeGroupSelect')
          }
          disabled={!canNext}
        >
          <Text style={styles.nextBtnText}>
            {t('common.next')} ›
          </Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}


const styles = StyleSheet.create({

  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },


  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },


  back: {
    padding: 4,
  },


  backText: {
    fontSize: 32,
    color: Colors.primaryLight,
    lineHeight: 36,
  },


  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text,
  },


  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
  },


  form: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },


  input: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlign: 'right',
  },


  avatarRow: {
    marginVertical: 4,
  },


  avatarBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },


  avatarSelected: {
    borderColor: Colors.primary,
  },


  avatarEmoji: {
    fontSize: 24,
  },


  colorRow: {
    marginVertical: 4,
  },


  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 3,
    borderColor: 'transparent',
  },


  colorSelected: {
    borderColor: Colors.text,
  },


  addBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },


  addBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },


  playerCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    gap: 12,
  },


  playerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },


  playerEmoji: {
    fontSize: 24,
  },


  playerName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
  },


  removeBtn: {
    padding: 6,
  },


  removeText: {
    fontSize: 18,
    color: Colors.error,
  },


  hint: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 14,
    marginTop: 8,
  },


  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,

    paddingHorizontal: 16,
    paddingTop: 16,

    backgroundColor: Colors.background,

    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },


  nextBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },


  nextBtnDisabled: {
    backgroundColor: Colors.border,
  },


  nextBtnText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },

});
