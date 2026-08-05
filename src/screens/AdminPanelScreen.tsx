import React, { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { adminDeleteRoom, listActiveRooms, listAppUsers } from '../services/admin/adminService';
import { deleteUserDirectly, setUserRoleDirectly } from '../services/admin/adminActionService';
import { addCustomQuestion, listCustomQuestions } from '../services/questions/customQuestionService';
import { QUESTIONS } from '../services/questions/questionsData';
import { useAuthStore } from '../store/authStore';
import { AppUserRecord, CategoryId, Difficulty, OnlineRoom, Question, RootStackParamList } from '../types';
import { Colors } from '../theme/colors';
import { CATEGORY_EMOJIS } from '../constants';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'AdminPanel'> };

const CATEGORY_IDS = Object.keys(CATEGORY_EMOJIS) as CategoryId[];
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

const createEmptyQuestionForm = () => ({
  id: undefined as string | undefined,
  categoryId: 'generalKnowledge' as CategoryId,
  difficulty: 'easy' as Difficulty,
  questionAr: '',
  questionEn: '',
  answersAr: ['', '', '', ''],
  answersEn: ['', '', '', ''],
  correctAnswerIndex: 0,
  explanationAr: '',
});

export default function AdminPanelScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { userRecord, refreshUserRecord } = useAuthStore();
  const [users, setUsers] = useState<AppUserRecord[]>([]);
  const [rooms, setRooms] = useState<OnlineRoom[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('generalKnowledge');
  const [questionForm, setQuestionForm] = useState(createEmptyQuestionForm);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const canManageAdmins = Boolean(userRecord?.isSuperAdmin);
  const canOpen = Boolean(userRecord?.isAdmin || userRecord?.isSuperAdmin);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshUserRecord();
      const [nextUsers, nextRooms, customQuestions] = await Promise.all([listAppUsers(), listActiveRooms(), listCustomQuestions()]);
      setUsers(nextUsers);
      setRooms(nextRooms);
      const customQuestionsById = new Map(customQuestions.map(question => [question.id, question]));
      const builtinQuestionIds = new Set(QUESTIONS.map(question => question.id));
      const mergedBuiltinQuestions = QUESTIONS.map(question => customQuestionsById.get(question.id) ?? question);
      const newCustomQuestions = customQuestions.filter(question => !builtinQuestionIds.has(question.id));
      setQuestions([...newCustomQuestions, ...mergedBuiltinQuestions]);
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('admin.loadFailed'));
    } finally {
      setRefreshing(false);
    }
  }, [refreshUserRecord, t]);

  useEffect(() => {
    if (!canOpen) {
      Alert.alert('', t('admin.accessDenied'));
      navigation.goBack();
      return;
    }

    void loadData();
  }, [canOpen, loadData, navigation, t]);

  const showRoleFallback = (targetUser: AppUserRecord, role: 'user' | 'admin' | 'super_admin') => {
    if (!targetUser.email) {
      Alert.alert('', t('admin.guestPromotionBlocked'));
      return;
    }

    const command = `npm run admin:set-role -- --email ${targetUser.email} --role ${role}`;
    Alert.alert(t('admin.roleCommandTitle'), `${t('admin.roleCommandNotice')}\n\n${command}`, [{ text: t('common.ok') }]);
  };

  const showDeleteFallback = (targetUser: AppUserRecord) => {
    const command = targetUser.email
      ? `npm run admin:delete-user -- --email ${targetUser.email}`
      : `npm run admin:delete-user -- --uid ${targetUser.uid}`;

    Alert.alert(t('admin.deleteUserCommandTitle'), `${t('admin.deleteUserCommandNotice')}\n\n${command}`, [{ text: t('common.ok') }]);
  };

  const applyRole = async (targetUser: AppUserRecord, role: 'user' | 'admin' | 'super_admin') => {
    if (!canManageAdmins) {
      Alert.alert('', t('admin.superAdminOnly'));
      return;
    }

    if (!targetUser.email) {
      Alert.alert('', t('admin.guestPromotionBlocked'));
      return;
    }

    setBusyKey(`user-${targetUser.uid}`);
    try {
      await setUserRoleDirectly({ email: targetUser.email, uid: targetUser.uid, role });
      await loadData();
      Alert.alert('', t('admin.roleUpdatedSuccess'));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('admin.roleUpdateFailed');
      Alert.alert(t('common.error'), message);
      showRoleFallback(targetUser, role);
    } finally {
      setBusyKey(null);
    }
  };

  const removeRoom = async (roomId: string) => {
    setBusyKey(`room-${roomId}`);
    try {
      await adminDeleteRoom(roomId);
      await loadData();
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('admin.roomDeleteFailed'));
    } finally {
      setBusyKey(null);
    }
  };

  const removeUserDocument = async (targetUser: AppUserRecord) => {
    if (targetUser.uid === userRecord?.uid) {
      Alert.alert('', t('admin.selfDeleteBlocked'));
      return;
    }

    setBusyKey(`delete-user-${targetUser.uid}`);
    try {
      await deleteUserDirectly({ email: targetUser.email, uid: targetUser.uid });
      await loadData();
      Alert.alert('', t('admin.userDeletedSuccess'));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('admin.userDeleteFailed');
      Alert.alert(t('common.error'), message);
      showDeleteFallback(targetUser);
    } finally {
      setBusyKey(null);
    }
  };

  const updateAnswer = (index: number, value: string) => {
    setQuestionForm(current => ({
      ...current,
      answersAr: current.answersAr.map((answer, answerIndex) => answerIndex === index ? value : answer),
    }));
  };

  const updateEnglishAnswer = (index: number, value: string) => {
    setQuestionForm(current => ({
      ...current,
      answersEn: current.answersEn.map((answer, answerIndex) => answerIndex === index ? value : answer),
    }));
  };

  const createQuestion = async () => {
    setBusyKey('create-question');
    try {
      await addCustomQuestion({
        ...questionForm,
        id: editingQuestionId ?? undefined,
        questionEn: questionForm.questionEn,
        answersEn: questionForm.answersEn,
      });
      setQuestionForm(createEmptyQuestionForm());
      setEditingQuestionId(null);
      await loadData();
      Alert.alert('', editingQuestionId ? t('admin.questionEditedSuccess') : t('admin.questionAddedSuccess'));
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('admin.questionSaveFailed'));
    } finally {
      setBusyKey(null);
    }
  };

  const editQuestion = (question: Question) => {
    setEditingQuestionId(question.id);
    setSelectedCategory(question.categoryId);
    setQuestionForm({
      id: question.id,
      categoryId: question.categoryId,
      difficulty: question.difficulty,
      questionAr: question.questionAr,
      questionEn: question.questionEn,
      answersAr: [...question.answersAr, '', '', '', ''].slice(0, 4),
      answersEn: [...question.answersEn, '', '', '', ''].slice(0, 4),
      correctAnswerIndex: question.correctAnswerIndex ?? 0,
      explanationAr: question.explanationAr ?? '',
    });
  };

  const cancelEditQuestion = () => {
    setEditingQuestionId(null);
    setQuestionForm(createEmptyQuestionForm());
  };

  const categoryRows = CATEGORY_IDS.map(categoryId => ({
    id: categoryId,
    count: questions.filter(question => question.categoryId === categoryId).length,
  }));
  const visibleQuestions = questions.filter(question => question.categoryId === selectedCategory);

  if (!canOpen) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void loadData(); }} tintColor={Colors.primaryLight} />}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>{t('admin.title')}</Text>
            <Text style={styles.subtitle}>{t('admin.subtitle')}</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNum}>{users.length}</Text>
            <Text style={styles.summaryLabel}>{t('admin.usersCount')}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNum}>{rooms.length}</Text>
            <Text style={styles.summaryLabel}>{t('admin.roomsCount')}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNum}>{questions.length}</Text>
            <Text style={styles.summaryLabel}>{t('admin.questionsCount')}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.categoriesAndQuestions')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryStrip}>
            {categoryRows.map(category => {
              const isSelected = category.id === selectedCategory;
              return (
                <TouchableOpacity key={category.id} style={[styles.categoryChip, isSelected && styles.categoryChipActive]} onPress={() => setSelectedCategory(category.id)}>
                  <Text style={styles.categoryEmoji}>{CATEGORY_EMOJIS[category.id]}</Text>
                  <Text style={styles.categoryChipText}>{t(`categories.${category.id}`)}</Text>
                  <Text style={styles.categoryCount}>{category.count}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.questionFormCard}>
            <View style={styles.questionHeaderRow}>
              <Text style={styles.formTitle}>{editingQuestionId ? t('admin.editQuestion') : t('admin.addQuestion')}</Text>
              {editingQuestionId ? (
                <TouchableOpacity style={styles.cancelEditBtn} onPress={cancelEditQuestion}>
                  <Text style={styles.cancelEditBtnText}>{t('admin.cancelEdit')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <Text style={styles.inputLabel}>{t('admin.category')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryStrip}>
              {CATEGORY_IDS.map(categoryId => (
                <TouchableOpacity key={categoryId} style={[styles.smallChip, questionForm.categoryId === categoryId && styles.smallChipActive]} onPress={() => setQuestionForm(current => ({ ...current, categoryId }))}>
                  <Text style={styles.smallChipText}>{CATEGORY_EMOJIS[categoryId]} {t(`categories.${categoryId}`)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>{t('common.difficulty')}</Text>
            <View style={styles.actionsRow}>
              {DIFFICULTIES.map(difficulty => (
                <TouchableOpacity key={difficulty} style={[styles.roleBtn, questionForm.difficulty === difficulty && styles.roleBtnActive]} onPress={() => setQuestionForm(current => ({ ...current, difficulty }))}>
                  <Text style={styles.roleBtnText}>{difficulty}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>{t('admin.questionText')}</Text>
            <TextInput style={styles.textInput} value={questionForm.questionAr} onChangeText={questionAr => setQuestionForm(current => ({ ...current, questionAr }))} placeholder={t('admin.writeQuestionHere')} placeholderTextColor={Colors.textMuted} multiline />
            <Text style={styles.inputLabel}>Question in English</Text>
            <TextInput style={[styles.textInput, styles.englishInput]} value={questionForm.questionEn} onChangeText={questionEn => setQuestionForm(current => ({ ...current, questionEn }))} placeholder="Write the question in English" placeholderTextColor={Colors.textMuted} multiline />

            <Text style={styles.inputLabel}>{t('admin.choices')}</Text>
            {questionForm.answersAr.map((answer, index) => (
              <View key={index} style={styles.answerPairRow}>
                <TouchableOpacity style={[styles.correctPick, questionForm.correctAnswerIndex === index && styles.correctPickActive]} onPress={() => setQuestionForm(current => ({ ...current, correctAnswerIndex: index }))}>
                  <Text style={styles.correctPickText}>{questionForm.correctAnswerIndex === index ? t('admin.correctShort') : `${index + 1}`}</Text>
                </TouchableOpacity>
                <View style={styles.answerInputsStack}>
                  <TextInput style={styles.answerInput} value={answer} onChangeText={value => updateAnswer(index, value)} placeholder={t('admin.arabicChoicePlaceholder', { index: index + 1 })} placeholderTextColor={Colors.textMuted} />
                  <TextInput style={[styles.answerInput, styles.englishInput]} value={questionForm.answersEn[index]} onChangeText={value => updateEnglishAnswer(index, value)} placeholder={`Choice ${index + 1} in English`} placeholderTextColor={Colors.textMuted} />
                </View>
              </View>
            ))}

            <Text style={styles.inputLabel}>{t('admin.optionalExplanation')}</Text>
            <TextInput style={styles.textInput} value={questionForm.explanationAr} onChangeText={explanationAr => setQuestionForm(current => ({ ...current, explanationAr }))} placeholder={t('admin.explanationPlaceholder')} placeholderTextColor={Colors.textMuted} multiline />

            <TouchableOpacity style={[styles.createQuestionBtn, busyKey === 'create-question' && styles.roleBtnDisabled]} disabled={busyKey === 'create-question'} onPress={() => { void createQuestion(); }}>
              <Text style={styles.createQuestionBtnText}>{editingQuestionId ? t('admin.saveEdit') : t('admin.saveQuestion')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>{t('admin.questionsForCategory', { category: t(`categories.${selectedCategory}`), count: visibleQuestions.length })}</Text>
          {visibleQuestions.slice(0, 80).map(question => (
            <View key={question.id} style={styles.questionCard}>
              <View style={styles.questionHeaderRow}>
                <Text style={styles.questionDifficulty}>{question.difficulty}</Text>
                <View style={styles.questionActionsInline}>
                  <Text style={styles.questionSource}>{question.source === 'admin' ? t('admin.adminSource') : t('admin.appSource')}</Text>
                  <TouchableOpacity style={styles.editQuestionBtn} onPress={() => editQuestion(question)}>
                    <Text style={styles.editQuestionBtnText}>{t('common.edit')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.questionText}>{question.questionAr}</Text>
              <Text style={styles.questionEnglishText}>{question.questionEn}</Text>
              {question.answersAr.map((answer, index) => (
                <View key={`${question.id}-${index}`} style={[styles.answerPreview, index === question.correctAnswerIndex && styles.answerPreviewCorrect]}>
                  <Text style={styles.answerPreviewText}>{index + 1}. {answer}</Text>
                  <Text style={styles.answerPreviewEnglishText}>{question.answersEn[index] || answer}</Text>
                  {index === question.correctAnswerIndex ? <Text style={styles.correctText}>{t('admin.correctAnswer')}</Text> : null}
                </View>
              ))}
            </View>
          ))}
          {visibleQuestions.length > 80 ? <Text style={styles.emptyText}>{t('admin.firstQuestionsOnly', { count: 80 })}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.usersSection')}</Text>
          {users.map(item => (
            <View key={item.uid} style={styles.userCard}>
              <View style={styles.userTop}>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.displayName || 'User'}</Text>
                  <Text style={styles.userMeta}>{item.email || t('admin.guestUser')}</Text>
                  <Text style={styles.userMeta}>{item.role}</Text>
                </View>
                <View style={[styles.roleBadge, item.isSuperAdmin ? styles.roleSuper : item.isAdmin ? styles.roleAdmin : styles.roleUser]}>
                  <Text style={styles.roleBadgeText}>{item.role}</Text>
                </View>
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity style={[styles.roleBtn, item.role === 'user' && styles.roleBtnActive, (!canManageAdmins || busyKey === `user-${item.uid}`) && styles.roleBtnDisabled]} disabled={!canManageAdmins || busyKey === `user-${item.uid}`} onPress={() => { void applyRole(item, 'user'); }}>
                  <Text style={styles.roleBtnText}>{t('admin.roleUser')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.roleBtn, item.role === 'admin' && styles.roleBtnActive, (!canManageAdmins || busyKey === `user-${item.uid}`) && styles.roleBtnDisabled]} disabled={!canManageAdmins || busyKey === `user-${item.uid}`} onPress={() => { void applyRole(item, 'admin'); }}>
                  <Text style={styles.roleBtnText}>{t('admin.roleAdmin')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.roleBtn, item.role === 'super_admin' && styles.roleBtnActive, (!canManageAdmins || busyKey === `user-${item.uid}`) && styles.roleBtnDisabled]} disabled={!canManageAdmins || busyKey === `user-${item.uid}`} onPress={() => { void applyRole(item, 'super_admin'); }}>
                  <Text style={styles.roleBtnText}>{t('admin.roleSuperAdmin')}</Text>
                </TouchableOpacity>
              </View>

              {canManageAdmins ? (
                <TouchableOpacity style={[styles.deleteLineBtn, (item.uid === userRecord?.uid || busyKey === `delete-user-${item.uid}`) && styles.roleBtnDisabled]} disabled={item.uid === userRecord?.uid || busyKey === `delete-user-${item.uid}`} onPress={() => { void removeUserDocument(item); }}>
                  <Text style={styles.deleteLineBtnText}>{t('admin.deleteUserDocument')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.roomsSection')}</Text>
          {rooms.map(room => (
            <View key={room.id} style={styles.roomCard}>
              <View style={styles.userTop}>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{room.hostName}</Text>
                  <Text style={styles.userMeta}>{room.code} • {room.visibility}</Text>
                  <Text style={styles.userMeta}>{room.playerCount}/{room.maxPlayers} • {room.status}</Text>
                </View>
                <TouchableOpacity style={[styles.killRoomBtn, busyKey === `room-${room.id}` && styles.roleBtnDisabled]} disabled={busyKey === `room-${room.id}`} onPress={() => { void removeRoom(room.id); }}>
                  <Text style={styles.killRoomBtnText}>{t('admin.deleteRoom')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {!rooms.length ? <Text style={styles.emptyText}>{t('admin.noRooms')}</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, gap: 16, paddingBottom: 36 },
  header: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  backBtn: { padding: 4 },
  backText: { fontSize: 32, color: Colors.primaryLight, lineHeight: 36 },
  headerTextWrap: { flex: 1, gap: 4 },
  title: { color: Colors.text, fontSize: 28, fontWeight: '900' },
  subtitle: { color: Colors.textMuted, lineHeight: 22 },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    alignItems: 'center',
  },
  summaryNum: { color: Colors.accent, fontSize: 24, fontWeight: '900' },
  summaryLabel: { color: Colors.textMuted, marginTop: 4 },
  section: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 12,
  },
  sectionTitle: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  categoryStrip: { gap: 8, paddingVertical: 2 },
  categoryChip: {
    minWidth: 116,
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    gap: 4,
  },
  categoryChipActive: { borderColor: Colors.primaryLight, backgroundColor: Colors.primary + '22' },
  categoryEmoji: { fontSize: 22 },
  categoryChipText: { color: Colors.text, fontSize: 12, fontWeight: '800' },
  categoryCount: { color: Colors.accent, fontSize: 18, fontWeight: '900' },
  questionFormCard: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 10,
  },
  formTitle: { color: Colors.text, fontSize: 16, fontWeight: '900' },
  cancelEditBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.warning,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  cancelEditBtnText: { color: Colors.warning, fontSize: 12, fontWeight: '900' },
  inputLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '800' },
  smallChip: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  smallChipActive: { borderColor: Colors.primaryLight, backgroundColor: Colors.primary + '22' },
  smallChipText: { color: Colors.text, fontSize: 12, fontWeight: '800' },
  textInput: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: 'right',
  },
  englishInput: { textAlign: 'left' },
  answerInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  answerPairRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  answerInputsStack: { flex: 1, gap: 6 },
  correctPick: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  correctPickActive: { borderColor: Colors.success, backgroundColor: Colors.success + '33' },
  correctPickText: { color: Colors.text, fontSize: 12, fontWeight: '900' },
  answerInput: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    paddingHorizontal: 12,
    paddingVertical: 12,
    textAlign: 'right',
  },
  createQuestionBtn: {
    backgroundColor: Colors.success,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  createQuestionBtnText: { color: Colors.text, fontSize: 16, fontWeight: '900' },
  questionCard: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 8,
  },
  questionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  questionActionsInline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  questionDifficulty: { color: Colors.accent, fontSize: 12, fontWeight: '900' },
  questionSource: { color: Colors.textMuted, fontSize: 12, fontWeight: '800' },
  editQuestionBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  editQuestionBtnText: { color: Colors.text, fontSize: 12, fontWeight: '900' },
  questionText: { color: Colors.text, fontSize: 15, fontWeight: '800', lineHeight: 22, textAlign: 'right' },
  questionEnglishText: { color: Colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'left' },
  answerPreview: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundCard,
    padding: 10,
    gap: 4,
  },
  answerPreviewCorrect: { borderColor: Colors.success, backgroundColor: Colors.success + '22' },
  answerPreviewText: { color: Colors.text, textAlign: 'right' },
  answerPreviewEnglishText: { color: Colors.textMuted, textAlign: 'left', marginTop: 2 },
  correctText: { color: Colors.success, fontSize: 12, fontWeight: '900', textAlign: 'right' },
  userCard: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 12,
  },
  roomCard: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  userTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  userInfo: { flex: 1, gap: 4 },
  userName: { color: Colors.text, fontSize: 16, fontWeight: '800' },
  userMeta: { color: Colors.textMuted, fontSize: 13 },
  roleBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  roleUser: { backgroundColor: Colors.secondary + '22' },
  roleAdmin: { backgroundColor: Colors.warning + '22' },
  roleSuper: { backgroundColor: Colors.primary + '22' },
  roleBadgeText: { color: Colors.text, fontWeight: '700', fontSize: 12 },
  actionsRow: { flexDirection: 'row', gap: 8 },
  roleBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
  },
  roleBtnActive: { borderColor: Colors.primaryLight, backgroundColor: Colors.primary + '22' },
  roleBtnDisabled: { opacity: 0.45 },
  roleBtnText: { color: Colors.text, fontWeight: '700', fontSize: 12 },
  killRoomBtn: {
    backgroundColor: Colors.error,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  killRoomBtnText: { color: Colors.text, fontWeight: '800' },
  deleteLineBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.error,
  },
  deleteLineBtnText: { color: Colors.error, fontWeight: '700' },
  emptyText: { color: Colors.textMuted, textAlign: 'center', paddingVertical: 10 },
});