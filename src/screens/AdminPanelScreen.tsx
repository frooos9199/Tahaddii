import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, RefreshControl, SafeAreaView, ScrollView, Share, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { launchImageLibrary } from 'react-native-image-picker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { adminDeleteRoom, listActiveRooms, listAppUsers } from '../services/admin/adminService';
import { deleteUserDirectly, setUserRoleDirectly } from '../services/admin/adminActionService';
import { SponsorAd, listSponsorAds, saveSponsorAd, setSponsorAdActive } from '../services/admin/sponsorAdService';
import { addCustomQuestion, listCustomQuestions } from '../services/questions/customQuestionService';
import { listCategoryCards, saveCategoryCard, setCategoryCardActive } from '../services/categories/categoryCardService';
import { uploadAdminImage, uploadQuestionMedia, QuestionMediaRole } from '../services/storage/questionMediaUploadService';
import { QUESTIONS } from '../services/questions/questionsData';
import { questionBelongsToCategory } from '../services/questions/questionCatalog';
import { deletePackage, listPackages, savePackage, setPackageActive } from '../services/packages/packageService';
import { createPromoCode, deactivatePromoCode, generateRandomCode, listPromoCodes } from '../services/promo/promoAdminService';
import { getContactConfig, saveContactConfig } from '../services/config/appConfigService';
import { useAuthStore } from '../store/authStore';
import { AppUserRecord, CategoryCard, CategoryId, Difficulty, OnlineRoom, Package, PromoCode, PromoCodeType, Question, RootStackParamList } from '../types';
import { Colors } from '../theme/colors';
import { CATEGORY_EMOJIS, FREE_CATEGORY_IDS } from '../constants';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'AdminPanel'> };

const CATEGORY_IDS = Object.keys(CATEGORY_EMOJIS) as CategoryId[];
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const QUESTION_EXPORT_HEADERS = [
  'id', 'source', 'categoryId', 'categoryNameAr', 'difficulty', 'type', 'ageGroups',
  'questionAr', 'questionEn', 'answer1Ar', 'answer2Ar', 'answer3Ar', 'answer4Ar',
  'answer1En', 'answer2En', 'answer3En', 'answer4En', 'correctAnswerNumber',
  'correctAnswerAr', 'correctAnswerEn', 'explanationAr', 'explanationEn', 'points',
  'imageUrl', 'revealImageUrl', 'isKidsSafe', 'isActive', 'isPremium',
];

const escapeCsvValue = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const createEmptyQuestionForm = () => ({
  id: undefined as string | undefined,
  categoryId: 'generalKnowledge' as CategoryId,
  linkedCategoryIds: [] as CategoryId[],
  difficulty: 'easy' as Difficulty,
  questionAr: '',
  questionEn: '',
  answersAr: ['', '', '', ''],
  answersEn: ['', '', '', ''],
  correctAnswerIndex: 0,
  explanationAr: '',
  imageUrl: '',
  revealImageUrl: '',
});

const createEmptyAdForm = () => ({
  id: undefined as string | undefined,
  companyName: '',
  headlineAr: '',
  headlineEn: '',
  imageUrl: '',
  accentColor: '#f59e0b',
  priority: '0',
});

const createEmptyCategoryForm = () => ({
  id: '',
  nameAr: '',
  nameEn: '',
  imageUrl: '',
  accentColor: '#8b5cf6',
  sortOrder: '0',
  isActive: true,
});

const createEmptyPackageForm = () => ({
  id: undefined as string | undefined,
  nameAr: '',
  nameEn: '',
  categoryIds: [] as CategoryId[],
  allCategories: false,
  durationDays: '30',
  priceKwd: '0',
  isActive: true,
});

const createEmptyPromoForm = () => ({
  code: '',
  type: 'free' as PromoCodeType,
  discountValue: '',
  packageId: '',
  maxRedemptions: '1',
  expiresInDays: '',
});

export default function AdminPanelScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { userRecord, refreshUserRecord } = useAuthStore();
  const [users, setUsers] = useState<AppUserRecord[]>([]);
  const [rooms, setRooms] = useState<OnlineRoom[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categoryCards, setCategoryCards] = useState<CategoryCard[]>([]);
  const [sponsorAds, setSponsorAds] = useState<SponsorAd[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('generalKnowledge');
  const [questionForm, setQuestionForm] = useState(createEmptyQuestionForm);
  const [categoryForm, setCategoryForm] = useState(createEmptyCategoryForm);
  const [adForm, setAdForm] = useState(createEmptyAdForm);
  const [packageForm, setPackageForm] = useState(createEmptyPackageForm);
  const [promoForm, setPromoForm] = useState(createEmptyPromoForm);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingAdId, setEditingAdId] = useState<string | null>(null);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const canManageAdmins = Boolean(userRecord?.isSuperAdmin);
  const canOpen = Boolean(userRecord?.isAdmin || userRecord?.isSuperAdmin);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshUserRecord();
      const [nextUsers, nextRooms, customQuestions, nextSponsorAds, nextCategoryCards, nextPackages, nextPromoCodes, contactConfig] = await Promise.all([
        listAppUsers(), listActiveRooms(), listCustomQuestions(), listSponsorAds(), listCategoryCards({ includeInactive: true }),
        listPackages({ includeInactive: true }), listPromoCodes(), getContactConfig(),
      ]);
      setUsers(nextUsers);
      setRooms(nextRooms);
      setSponsorAds(nextSponsorAds);
      setCategoryCards(nextCategoryCards);
      setPackages(nextPackages);
      setPromoCodes(nextPromoCodes);
      setWhatsappNumber(contactConfig.whatsappNumber);
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

  const toggleLinkedCategory = (categoryId: CategoryId) => {
    setQuestionForm(current => {
      const linkedCategoryIds = current.linkedCategoryIds.includes(categoryId)
        ? current.linkedCategoryIds.filter(item => item !== categoryId)
        : [...current.linkedCategoryIds, categoryId];

      return { ...current, linkedCategoryIds: linkedCategoryIds.filter(item => item !== current.categoryId) };
    });
  };

  const pickQuestionImage = (role: QuestionMediaRole) => {
    const label = role === 'imageUrl' ? t('admin.questionImage') : t('admin.answerImage');
    launchImageLibrary({ mediaType: 'photo', quality: 0.8, includeBase64: false }, async response => {
      const uri = response.assets?.[0]?.uri;
      if (!uri) return;

      const questionId = editingQuestionId || questionForm.id || `app-${Date.now()}`;
      setBusyKey(`upload-${role}`);
      try {
        const url = await uploadQuestionMedia({ questionId, mediaUri: uri, role });
        setQuestionForm(current => ({ ...current, id: questionId, [role]: url }));
        Alert.alert('', t('admin.questionImageUploaded', { label }));
      } catch (error) {
        Alert.alert(t('common.error'), error instanceof Error ? error.message : t('admin.questionImageUploadFailed'));
      } finally {
        setBusyKey(null);
      }
    });
  };

  const pickCategoryImage = () => {
    launchImageLibrary({ mediaType: 'photo', quality: 0.7, maxWidth: 900, maxHeight: 1100, includeBase64: false }, async response => {
      try {
        if (response.didCancel) return;
        const uri = response.assets?.[0]?.uri;
        if (!uri) return;
        const categoryId = editingCategoryId || categoryForm.id.trim() || `category-${Date.now()}`;
        const url = await uploadAdminImage({ folder: 'categoryMedia', itemId: categoryId, mediaUri: uri, role: 'imageUrl' });
        setCategoryForm(previous => ({ ...previous, id: previous.id || categoryId, imageUrl: url }));
        Alert.alert(t('common.success'), t('admin.categoryImageUploaded'));
      } catch (error) {
        console.warn('Category image upload failed', error);
        Alert.alert(t('common.error'), t('admin.adminImageUploadFailed'));
      }
    });
  };

  const pickAdImage = () => {
    launchImageLibrary({ mediaType: 'photo', quality: 0.8, includeBase64: false }, async response => {
      try {
        if (response.didCancel) return;
        const uri = response.assets?.[0]?.uri;
        if (!uri) return;
        const adId = editingAdId || adForm.id?.trim() || `ad-${Date.now()}`;
        const url = await uploadAdminImage({ folder: 'sponsorMedia', itemId: adId, mediaUri: uri, role: 'imageUrl' });
        setAdForm(previous => ({ ...previous, id: previous.id || adId, imageUrl: url }));
        Alert.alert(t('common.success'), t('admin.adImageUploaded'));
      } catch (error) {
        console.warn('Sponsor image upload failed', error);
        Alert.alert(t('common.error'), t('admin.adminImageUploadFailed'));
      }
    });
  };

  const createQuestion = async () => {
    setBusyKey('create-question');
    try {
      await addCustomQuestion({
        ...questionForm,
        id: editingQuestionId ?? undefined,
        linkedCategoryIds: questionForm.linkedCategoryIds.filter(categoryId => categoryId !== questionForm.categoryId),
        questionEn: questionForm.questionEn,
        answersEn: questionForm.answersEn,
        imageUrl: questionForm.imageUrl,
        revealImageUrl: questionForm.revealImageUrl,
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

  const submitCategory = async () => {
    try {
      const categoryId = (editingCategoryId || categoryForm.id.trim()) as CategoryId;
      await saveCategoryCard({
        id: categoryId,
        nameAr: categoryForm.nameAr,
        nameEn: categoryForm.nameEn,
        imageUrl: categoryForm.imageUrl,
        accentColor: categoryForm.accentColor,
        sortOrder: Number(categoryForm.sortOrder || 0),
        isActive: categoryForm.isActive,
      });
      setCategoryForm(createEmptyCategoryForm());
      setEditingCategoryId(null);
      Alert.alert(t('common.success'), t('admin.categorySavedSuccess'));
      await loadData();
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('admin.categorySaveFailed'));
    }
  };

  const editCategory = (category: CategoryCard) => {
    setEditingCategoryId(category.id);
    setCategoryForm({
      id: category.id,
      nameAr: category.nameAr,
      nameEn: category.nameEn,
      imageUrl: category.imageUrl || '',
      accentColor: category.accentColor || '#8b5cf6',
      sortOrder: String(category.sortOrder ?? 0),
      isActive: category.isActive,
    });
  };

  const cancelEditCategory = () => {
    setEditingCategoryId(null);
    setCategoryForm(createEmptyCategoryForm());
  };

  const toggleCategory = async (category: CategoryCard) => {
    try {
      await setCategoryCardActive(category.id, !category.isActive);
      await loadData();
    } catch (error) {
      Alert.alert(t('common.error'), t('admin.categorySaveFailed'));
    }
  };

  const editQuestion = (question: Question) => {
    setEditingQuestionId(question.id);
    setSelectedCategory(question.categoryId);
    setQuestionForm({
      id: question.id,
      categoryId: question.categoryId,
      linkedCategoryIds: question.linkedCategoryIds ?? [],
      difficulty: question.difficulty,
      questionAr: question.questionAr,
      questionEn: question.questionEn,
      answersAr: [...question.answersAr, '', '', '', ''].slice(0, 4),
      answersEn: [...question.answersEn, '', '', '', ''].slice(0, 4),
      correctAnswerIndex: question.correctAnswerIndex ?? 0,
      explanationAr: question.explanationAr ?? '',
      imageUrl: question.imageUrl ?? '',
      revealImageUrl: question.revealImageUrl ?? '',
    });
  };

  const cancelEditQuestion = () => {
    setEditingQuestionId(null);
    setQuestionForm(createEmptyQuestionForm());
  };

  const saveAd = async () => {
    setBusyKey('save-ad');
    try {
      await saveSponsorAd({
        id: editingAdId ?? undefined,
        companyName: adForm.companyName,
        headlineAr: adForm.headlineAr,
        headlineEn: adForm.headlineEn,
        imageUrl: adForm.imageUrl,
        accentColor: adForm.accentColor,
        priority: Number(adForm.priority || 0),
        isActive: true,
      });
      setAdForm(createEmptyAdForm());
      setEditingAdId(null);
      await loadData();
      Alert.alert('', editingAdId ? t('admin.adEditedSuccess') : t('admin.adAddedSuccess'));
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('admin.adSaveFailed'));
    } finally {
      setBusyKey(null);
    }
  };

  const editAd = (ad: SponsorAd) => {
    setEditingAdId(ad.id);
    setAdForm({
      id: ad.id,
      companyName: ad.companyName,
      headlineAr: ad.headlineAr,
      headlineEn: ad.headlineEn,
      imageUrl: ad.imageUrl,
      accentColor: ad.accentColor,
      priority: String(ad.priority),
    });
  };

  const toggleAd = async (ad: SponsorAd) => {
    setBusyKey(`ad-${ad.id}`);
    try {
      await setSponsorAdActive(ad.id, !ad.isActive);
      await loadData();
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('admin.adSaveFailed'));
    } finally {
      setBusyKey(null);
    }
  };

  const toggleAllCategoriesForPackage = () => {
    setPackageForm(current => ({ ...current, allCategories: !current.allCategories, categoryIds: [] }));
  };

  const togglePackageCategory = (categoryId: CategoryId) => {
    setPackageForm(current => ({
      ...current,
      categoryIds: current.categoryIds.includes(categoryId)
        ? current.categoryIds.filter(item => item !== categoryId)
        : [...current.categoryIds, categoryId],
    }));
  };

  const submitPackage = async () => {
    setBusyKey('save-package');
    try {
      await savePackage({
        id: editingPackageId ?? undefined,
        nameAr: packageForm.nameAr,
        nameEn: packageForm.nameEn,
        categoryIds: packageForm.allCategories ? ['*'] : packageForm.categoryIds,
        durationDays: Number(packageForm.durationDays || 0),
        priceKwd: Number(packageForm.priceKwd || 0),
        isActive: packageForm.isActive,
      });
      setPackageForm(createEmptyPackageForm());
      setEditingPackageId(null);
      await loadData();
      Alert.alert('', t('admin.packageSavedSuccess'));
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('admin.packageSaveFailed'));
    } finally {
      setBusyKey(null);
    }
  };

  const editPackage = (pkg: Package) => {
    setEditingPackageId(pkg.id);
    setPackageForm({
      id: pkg.id,
      nameAr: pkg.nameAr,
      nameEn: pkg.nameEn,
      categoryIds: pkg.categoryIds.includes('*') ? [] : pkg.categoryIds,
      allCategories: pkg.categoryIds.includes('*'),
      durationDays: String(pkg.durationDays),
      priceKwd: String(pkg.priceKwd),
      isActive: pkg.isActive,
    });
  };

  const cancelEditPackage = () => {
    setEditingPackageId(null);
    setPackageForm(createEmptyPackageForm());
  };

  const togglePackageActive = async (pkg: Package) => {
    setBusyKey(`package-${pkg.id}`);
    try {
      await setPackageActive(pkg.id, !pkg.isActive);
      await loadData();
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('admin.packageSaveFailed'));
    } finally {
      setBusyKey(null);
    }
  };

  const removePackage = async (pkg: Package) => {
    setBusyKey(`package-delete-${pkg.id}`);
    try {
      await deletePackage(pkg.id);
      await loadData();
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('admin.packageSaveFailed'));
    } finally {
      setBusyKey(null);
    }
  };

  const submitPromoCode = async () => {
    setBusyKey('save-promo');
    try {
      const expiresAtMs = promoForm.expiresInDays.trim()
        ? Date.now() + Number(promoForm.expiresInDays) * 86400000
        : null;
      await createPromoCode({
        code: promoForm.code.trim() || generateRandomCode(),
        type: promoForm.type,
        discountValue: promoForm.discountValue ? Number(promoForm.discountValue) : undefined,
        packageId: promoForm.packageId || undefined,
        maxRedemptions: Number(promoForm.maxRedemptions || 1),
        expiresAtMs,
      });
      setPromoForm(createEmptyPromoForm());
      await loadData();
      Alert.alert('', t('admin.promoCodeCreatedSuccess'));
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('admin.promoCodeSaveFailed'));
    } finally {
      setBusyKey(null);
    }
  };

  const removePromoCode = async (code: PromoCode) => {
    setBusyKey(`promo-${code.code}`);
    try {
      await deactivatePromoCode(code.code);
      await loadData();
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('admin.promoCodeSaveFailed'));
    } finally {
      setBusyKey(null);
    }
  };

  const saveWhatsappNumber = async () => {
    setBusyKey('save-contact');
    try {
      await saveContactConfig(whatsappNumber);
      Alert.alert('', t('admin.contactSavedSuccess'));
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('admin.contactSaveFailed'));
    } finally {
      setBusyKey(null);
    }
  };

  const exportQuestionsToCsv = async () => {
    if (!questions.length) {
      Alert.alert('', t('admin.noQuestionsToExport'));
      return;
    }

    const rows = questions.map(question => [
      question.id,
      question.source === 'admin' ? 'admin' : 'app',
      question.categoryId,
      t(`categories.${question.categoryId}`),
      question.difficulty,
      question.type,
      question.ageGroups.join('|'),
      question.questionAr,
      question.questionEn,
      question.answersAr[0] ?? '',
      question.answersAr[1] ?? '',
      question.answersAr[2] ?? '',
      question.answersAr[3] ?? '',
      question.answersEn[0] ?? '',
      question.answersEn[1] ?? '',
      question.answersEn[2] ?? '',
      question.answersEn[3] ?? '',
      question.correctAnswerIndex == null ? '' : question.correctAnswerIndex + 1,
      question.correctAnswerAr,
      question.correctAnswerEn,
      question.explanationAr ?? '',
      question.explanationEn ?? '',
      question.points,
      question.imageUrl ?? '',
      question.revealImageUrl ?? '',
      question.isKidsSafe ? 'TRUE' : 'FALSE',
      question.isActive ? 'TRUE' : 'FALSE',
      question.isPremium ? 'TRUE' : 'FALSE',
    ]);
    const csv = `\uFEFF${[QUESTION_EXPORT_HEADERS, ...rows].map(row => row.map(escapeCsvValue).join(',')).join('\n')}`;

    Clipboard.setString(csv);
    await Share.share({
      title: 'Tahaddii-questions.csv',
      message: csv,
    });
    Alert.alert('', t('admin.questionsExported', { count: questions.length }));
  };

  const adminCategoryIds = categoryCards.length ? categoryCards.map(category => category.id) : CATEGORY_IDS;
  const getAdminCategoryName = (categoryId: CategoryId) => {
    const category = categoryCards.find(item => item.id === categoryId);
    return category?.nameAr || t(`categories.${categoryId}`, { defaultValue: categoryId });
  };
  const categoryRows = adminCategoryIds.map(categoryId => ({
    id: categoryId,
    count: questions.filter(question => questionBelongsToCategory(question, categoryId)).length,
  }));
  const visibleQuestions = questions.filter(question => questionBelongsToCategory(question, selectedCategory));

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
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNum}>{sponsorAds.filter(ad => ad.isActive).length}</Text>
            <Text style={styles.summaryLabel}>{t('admin.adsCount')}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{t('admin.categoriesAndQuestions')}</Text>
            <TouchableOpacity style={styles.exportBtn} onPress={() => { void exportQuestionsToCsv(); }}>
              <Text style={styles.exportBtnText}>{t('admin.exportQuestions')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.exportHint}>{t('admin.exportQuestionsHint')}</Text>
          <Text style={styles.noteBox}>{t('admin.excelUploadNote')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryStrip}>
            {categoryRows.map(category => {
              const isSelected = category.id === selectedCategory;
              return (
                <TouchableOpacity key={category.id} style={[styles.categoryChip, isSelected && styles.categoryChipActive]} onPress={() => setSelectedCategory(category.id)}>
                  <Text style={styles.categoryEmoji}>{CATEGORY_EMOJIS[category.id]}</Text>
                  <Text style={styles.categoryChipText}>{getAdminCategoryName(category.id)}</Text>
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
              {adminCategoryIds.map(categoryId => (
                <TouchableOpacity key={categoryId} style={[styles.smallChip, questionForm.categoryId === categoryId && styles.smallChipActive]} onPress={() => setQuestionForm(current => ({ ...current, categoryId, linkedCategoryIds: current.linkedCategoryIds.filter(item => item !== categoryId) }))}>
                  <Text style={styles.smallChipText}>{CATEGORY_EMOJIS[categoryId]} {getAdminCategoryName(categoryId)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>{t('admin.linkedCategories')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryStrip}>
              {adminCategoryIds.filter(categoryId => categoryId !== questionForm.categoryId).map(categoryId => (
                <TouchableOpacity key={categoryId} style={[styles.smallChip, questionForm.linkedCategoryIds.includes(categoryId) && styles.linkedChipActive]} onPress={() => toggleLinkedCategory(categoryId)}>
                  <Text style={styles.smallChipText}>{CATEGORY_EMOJIS[categoryId]} {getAdminCategoryName(categoryId)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.exportHint}>{t('admin.linkedCategoriesHint')}</Text>

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

            <Text style={styles.inputLabel}>{t('admin.questionMedia')}</Text>
            <View style={styles.mediaActionsRow}>
              <TouchableOpacity style={[styles.mediaPickBtn, busyKey === 'upload-imageUrl' && styles.roleBtnDisabled]} disabled={busyKey === 'upload-imageUrl'} onPress={() => pickQuestionImage('imageUrl')}>
                <Text style={styles.mediaPickBtnText}>{busyKey === 'upload-imageUrl' ? '...' : t('admin.uploadQuestionImage')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.mediaPickBtn, busyKey === 'upload-revealImageUrl' && styles.roleBtnDisabled]} disabled={busyKey === 'upload-revealImageUrl'} onPress={() => pickQuestionImage('revealImageUrl')}>
                <Text style={styles.mediaPickBtnText}>{busyKey === 'upload-revealImageUrl' ? '...' : t('admin.uploadAnswerImage')}</Text>
              </TouchableOpacity>
            </View>
            <TextInput style={[styles.textInput, styles.englishInput]} value={questionForm.imageUrl} onChangeText={imageUrl => setQuestionForm(current => ({ ...current, imageUrl }))} placeholder={t('admin.questionImageUrl')} placeholderTextColor={Colors.textMuted} autoCapitalize="none" />
            <TextInput style={[styles.textInput, styles.englishInput]} value={questionForm.revealImageUrl} onChangeText={revealImageUrl => setQuestionForm(current => ({ ...current, revealImageUrl }))} placeholder={t('admin.answerImageUrl')} placeholderTextColor={Colors.textMuted} autoCapitalize="none" />
            {questionForm.imageUrl || questionForm.revealImageUrl ? (
              <View style={styles.mediaPreviewRow}>
                {questionForm.imageUrl ? <Image source={{ uri: questionForm.imageUrl }} style={styles.questionMediaPreview} /> : null}
                {questionForm.revealImageUrl ? <Image source={{ uri: questionForm.revealImageUrl }} style={styles.questionMediaPreview} /> : null}
              </View>
            ) : null}
            <Text style={styles.noteBox}>{t('admin.questionMediaUploadNote')}</Text>
            <Text style={styles.noteBox}>{t('admin.questionImageSizeGuide')}</Text>

            <TouchableOpacity style={[styles.createQuestionBtn, busyKey === 'create-question' && styles.roleBtnDisabled]} disabled={busyKey === 'create-question'} onPress={() => { void createQuestion(); }}>
              <Text style={styles.createQuestionBtnText}>{editingQuestionId ? t('admin.saveEdit') : t('admin.saveQuestion')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>{t('admin.questionsForCategory', { category: getAdminCategoryName(selectedCategory), count: visibleQuestions.length })}</Text>
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
              {question.linkedCategoryIds?.length ? <Text style={styles.questionLinkedText}>{t('admin.linkedCategories')}: {question.linkedCategoryIds.map(getAdminCategoryName).join('، ')}</Text> : null}
              {question.imageUrl || question.revealImageUrl ? (
                <View style={styles.mediaPreviewRow}>
                  {question.imageUrl ? <Image source={{ uri: question.imageUrl }} style={styles.questionMediaPreview} /> : null}
                  {question.revealImageUrl ? <Image source={{ uri: question.revealImageUrl }} style={styles.questionMediaPreview} /> : null}
                </View>
              ) : null}
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
          <Text style={styles.sectionTitle}>{t('admin.categoryCardsSection')}</Text>
          <View style={styles.questionFormCard}>
            <View style={styles.questionHeaderRow}>
              <Text style={styles.formTitle}>{editingCategoryId ? t('admin.editCategoryCard') : t('admin.addCategoryCard')}</Text>
              {editingCategoryId ? (
                <TouchableOpacity style={styles.cancelEditBtn} onPress={cancelEditCategory}>
                  <Text style={styles.cancelEditBtnText}>{t('admin.cancelEdit')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <Text style={styles.inputLabel}>{t('admin.categoryId')}</Text>
            <TextInput style={[styles.textInput, styles.englishInput]} value={categoryForm.id} onChangeText={id => setCategoryForm(current => ({ ...current, id }))} placeholder="food" placeholderTextColor={Colors.textMuted} autoCapitalize="none" editable={!editingCategoryId} />
            <Text style={styles.inputLabel}>{t('admin.categoryNameAr')}</Text>
            <TextInput style={styles.textInput} value={categoryForm.nameAr} onChangeText={nameAr => setCategoryForm(current => ({ ...current, nameAr }))} placeholder={t('admin.categoryNameAr')} placeholderTextColor={Colors.textMuted} />
            <Text style={styles.inputLabel}>{t('admin.categoryNameEn')}</Text>
            <TextInput style={[styles.textInput, styles.englishInput]} value={categoryForm.nameEn} onChangeText={nameEn => setCategoryForm(current => ({ ...current, nameEn }))} placeholder="Food" placeholderTextColor={Colors.textMuted} />
            <Text style={styles.inputLabel}>{t('admin.categoryImageUrl')}</Text>
            <TouchableOpacity style={styles.mediaPickBtn} onPress={pickCategoryImage}>
              <Text style={styles.mediaPickBtnText}>{t('admin.uploadCategoryImage')}</Text>
            </TouchableOpacity>
            <TextInput style={[styles.textInput, styles.englishInput]} value={categoryForm.imageUrl} onChangeText={imageUrl => setCategoryForm(current => ({ ...current, imageUrl }))} placeholder="https://..." placeholderTextColor={Colors.textMuted} autoCapitalize="none" />
            {categoryForm.imageUrl ? <Image source={{ uri: categoryForm.imageUrl }} style={styles.singleMediaPreview} /> : null}
            <Text style={styles.noteBox}>{t('admin.categoryImageUploadNote')}</Text>
            <View style={styles.adMetaRow}>
              <View style={styles.adMetaInputWrap}>
                <Text style={styles.inputLabel}>{t('admin.categoryAccentColor')}</Text>
                <TextInput style={[styles.textInput, styles.englishInput]} value={categoryForm.accentColor} onChangeText={accentColor => setCategoryForm(current => ({ ...current, accentColor }))} placeholder="#8b5cf6" placeholderTextColor={Colors.textMuted} autoCapitalize="none" />
              </View>
              <View style={styles.adMetaInputWrap}>
                <Text style={styles.inputLabel}>{t('admin.categorySortOrder')}</Text>
                <TextInput style={[styles.textInput, styles.englishInput]} value={categoryForm.sortOrder} onChangeText={sortOrder => setCategoryForm(current => ({ ...current, sortOrder }))} placeholder="0" placeholderTextColor={Colors.textMuted} keyboardType="number-pad" />
              </View>
            </View>
            <TouchableOpacity style={[styles.roleBtn, categoryForm.isActive && styles.roleBtnActive]} onPress={() => setCategoryForm(current => ({ ...current, isActive: !current.isActive }))}>
              <Text style={styles.roleBtnText}>{categoryForm.isActive ? t('admin.categoryActive') : t('admin.categoryPaused')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.createQuestionBtn} onPress={() => { void submitCategory(); }}>
              <Text style={styles.createQuestionBtnText}>{t('admin.saveCategoryCard')}</Text>
            </TouchableOpacity>
          </View>

          {categoryCards.map(category => (
            <View key={category.id} style={styles.adCard}>
              {category.imageUrl ? <Image source={{ uri: category.imageUrl }} style={styles.singleMediaPreview} /> : null}
              <View style={styles.userTop}>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{category.nameAr}</Text>
                  <Text style={styles.userMeta}>{category.nameEn} · {category.id}</Text>
                  <Text style={styles.userMeta}>{category.isActive ? t('admin.categoryActive') : t('admin.categoryPaused')} · {t('admin.categorySortOrder')}: {category.sortOrder}</Text>
                </View>
                <View style={[styles.adColorDot, { backgroundColor: category.accentColor }]} />
              </View>
              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.roleBtn} onPress={() => editCategory(category)}>
                  <Text style={styles.roleBtnText}>{t('common.edit')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.roleBtn} onPress={() => { void toggleCategory(category); }}>
                  <Text style={styles.roleBtnText}>{category.isActive ? t('admin.pauseCategory') : t('admin.activateCategory')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.adsSection')}</Text>
          <View style={styles.questionFormCard}>
            <View style={styles.questionHeaderRow}>
              <Text style={styles.formTitle}>{editingAdId ? t('admin.editAd') : t('admin.addAd')}</Text>
              {editingAdId ? (
                <TouchableOpacity style={styles.cancelEditBtn} onPress={() => { setEditingAdId(null); setAdForm(createEmptyAdForm()); }}>
                  <Text style={styles.cancelEditBtnText}>{t('admin.cancelEdit')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <Text style={styles.inputLabel}>{t('admin.companyName')}</Text>
            <TextInput style={styles.textInput} value={adForm.companyName} onChangeText={companyName => setAdForm(current => ({ ...current, companyName }))} placeholder={t('admin.companyNamePlaceholder')} placeholderTextColor={Colors.textMuted} />
            <Text style={styles.inputLabel}>{t('admin.adHeadlineAr')}</Text>
            <TextInput style={styles.textInput} value={adForm.headlineAr} onChangeText={headlineAr => setAdForm(current => ({ ...current, headlineAr }))} placeholder={t('admin.adHeadlineArPlaceholder')} placeholderTextColor={Colors.textMuted} />
            <Text style={styles.inputLabel}>{t('admin.adHeadlineEn')}</Text>
            <TextInput style={[styles.textInput, styles.englishInput]} value={adForm.headlineEn} onChangeText={headlineEn => setAdForm(current => ({ ...current, headlineEn }))} placeholder="Ad headline in English" placeholderTextColor={Colors.textMuted} />
            <Text style={styles.inputLabel}>{t('admin.adImageUrl')}</Text>
            <TouchableOpacity style={styles.mediaPickBtn} onPress={pickAdImage}>
              <Text style={styles.mediaPickBtnText}>{t('admin.uploadAdImage')}</Text>
            </TouchableOpacity>
            <TextInput style={[styles.textInput, styles.englishInput]} value={adForm.imageUrl} onChangeText={imageUrl => setAdForm(current => ({ ...current, imageUrl }))} placeholder="https://..." placeholderTextColor={Colors.textMuted} autoCapitalize="none" />
            {adForm.imageUrl ? <Image source={{ uri: adForm.imageUrl }} style={styles.singleMediaPreview} /> : null}
            <Text style={styles.noteBox}>{t('admin.adImageUploadNote')}</Text>
            <View style={styles.adMetaRow}>
              <View style={styles.adMetaInputWrap}>
                <Text style={styles.inputLabel}>{t('admin.adAccentColor')}</Text>
                <TextInput style={[styles.textInput, styles.englishInput]} value={adForm.accentColor} onChangeText={accentColor => setAdForm(current => ({ ...current, accentColor }))} placeholder="#f59e0b" placeholderTextColor={Colors.textMuted} autoCapitalize="none" />
              </View>
              <View style={styles.adMetaInputWrap}>
                <Text style={styles.inputLabel}>{t('admin.adPriority')}</Text>
                <TextInput style={[styles.textInput, styles.englishInput]} value={adForm.priority} onChangeText={priority => setAdForm(current => ({ ...current, priority }))} placeholder="0" placeholderTextColor={Colors.textMuted} keyboardType="number-pad" />
              </View>
            </View>
            <TouchableOpacity style={[styles.createQuestionBtn, busyKey === 'save-ad' && styles.roleBtnDisabled]} disabled={busyKey === 'save-ad'} onPress={() => { void saveAd(); }}>
              <Text style={styles.createQuestionBtnText}>{editingAdId ? t('admin.saveEdit') : t('admin.saveAd')}</Text>
            </TouchableOpacity>
          </View>

          {sponsorAds.map(ad => (
            <View key={ad.id} style={styles.adCard}>
              {ad.imageUrl ? <Image source={{ uri: ad.imageUrl }} style={styles.singleMediaPreview} /> : null}
              <View style={styles.userTop}>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{ad.companyName}</Text>
                  <Text style={styles.userMeta}>{ad.headlineAr}</Text>
                  <Text style={styles.userMeta}>{ad.isActive ? t('admin.adActive') : t('admin.adPaused')} · {t('admin.adPriority')}: {ad.priority}</Text>
                </View>
                <View style={[styles.adColorDot, { backgroundColor: ad.accentColor }]} />
              </View>
              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.roleBtn} onPress={() => editAd(ad)}>
                  <Text style={styles.roleBtnText}>{t('common.edit')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.roleBtn, busyKey === `ad-${ad.id}` && styles.roleBtnDisabled]} disabled={busyKey === `ad-${ad.id}`} onPress={() => { void toggleAd(ad); }}>
                  <Text style={styles.roleBtnText}>{ad.isActive ? t('admin.pauseAd') : t('admin.activateAd')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {!sponsorAds.length ? <Text style={styles.emptyText}>{t('admin.noAds')}</Text> : null}
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.createQuestionBtn} onPress={() => navigation.navigate('AdminEntitlements')}>
            <Text style={styles.createQuestionBtnText}>{t('admin.manageSubscriptionsBtn')}</Text>
          </TouchableOpacity>
          <Text style={styles.exportHint}>{t('admin.manageSubscriptionsHint')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.contactSection')}</Text>
          <Text style={styles.exportHint}>{t('admin.contactSectionHint')}</Text>
          <TextInput
            style={[styles.textInput, styles.englishInput]}
            value={whatsappNumber}
            onChangeText={setWhatsappNumber}
            placeholder="96550000000"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            keyboardType="phone-pad"
          />
          <TouchableOpacity style={[styles.createQuestionBtn, busyKey === 'save-contact' && styles.roleBtnDisabled]} disabled={busyKey === 'save-contact'} onPress={() => { void saveWhatsappNumber(); }}>
            <Text style={styles.createQuestionBtnText}>{t('admin.saveContact')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.packagesSection')}</Text>
          <View style={styles.questionFormCard}>
            <View style={styles.questionHeaderRow}>
              <Text style={styles.formTitle}>{editingPackageId ? t('admin.editPackage') : t('admin.addPackage')}</Text>
              {editingPackageId ? (
                <TouchableOpacity style={styles.cancelEditBtn} onPress={cancelEditPackage}>
                  <Text style={styles.cancelEditBtnText}>{t('admin.cancelEdit')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <Text style={styles.inputLabel}>{t('admin.packageNameAr')}</Text>
            <TextInput style={styles.textInput} value={packageForm.nameAr} onChangeText={nameAr => setPackageForm(current => ({ ...current, nameAr }))} placeholder={t('admin.packageNameAr')} placeholderTextColor={Colors.textMuted} />
            <Text style={styles.inputLabel}>{t('admin.packageNameEn')}</Text>
            <TextInput style={[styles.textInput, styles.englishInput]} value={packageForm.nameEn} onChangeText={nameEn => setPackageForm(current => ({ ...current, nameEn }))} placeholder="Package name" placeholderTextColor={Colors.textMuted} />

            <Text style={styles.inputLabel}>{t('admin.packageCategories')}</Text>
            <TouchableOpacity style={[styles.roleBtn, packageForm.allCategories && styles.roleBtnActive]} onPress={toggleAllCategoriesForPackage}>
              <Text style={styles.roleBtnText}>{t('admin.packageAllCategories')}</Text>
            </TouchableOpacity>
            {!packageForm.allCategories ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryStrip}>
                {adminCategoryIds.filter(categoryId => !FREE_CATEGORY_IDS.includes(categoryId)).map(categoryId => (
                  <TouchableOpacity key={categoryId} style={[styles.smallChip, packageForm.categoryIds.includes(categoryId) && styles.linkedChipActive]} onPress={() => togglePackageCategory(categoryId)}>
                    <Text style={styles.smallChipText}>{CATEGORY_EMOJIS[categoryId]} {getAdminCategoryName(categoryId)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : null}

            <View style={styles.adMetaRow}>
              <View style={styles.adMetaInputWrap}>
                <Text style={styles.inputLabel}>{t('admin.packageDurationDays')}</Text>
                <TextInput style={[styles.textInput, styles.englishInput]} value={packageForm.durationDays} onChangeText={durationDays => setPackageForm(current => ({ ...current, durationDays }))} placeholder="30" placeholderTextColor={Colors.textMuted} keyboardType="number-pad" />
              </View>
              <View style={styles.adMetaInputWrap}>
                <Text style={styles.inputLabel}>{t('admin.packagePriceKwd')}</Text>
                <TextInput style={[styles.textInput, styles.englishInput]} value={packageForm.priceKwd} onChangeText={priceKwd => setPackageForm(current => ({ ...current, priceKwd }))} placeholder="3.5" placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" />
              </View>
            </View>

            <TouchableOpacity style={[styles.roleBtn, packageForm.isActive && styles.roleBtnActive]} onPress={() => setPackageForm(current => ({ ...current, isActive: !current.isActive }))}>
              <Text style={styles.roleBtnText}>{packageForm.isActive ? t('admin.categoryActive') : t('admin.categoryPaused')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.createQuestionBtn, busyKey === 'save-package' && styles.roleBtnDisabled]} disabled={busyKey === 'save-package'} onPress={() => { void submitPackage(); }}>
              <Text style={styles.createQuestionBtnText}>{editingPackageId ? t('admin.saveEdit') : t('admin.savePackage')}</Text>
            </TouchableOpacity>
          </View>

          {packages.map(pkg => (
            <View key={pkg.id} style={styles.adCard}>
              <View style={styles.userTop}>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{pkg.nameAr}</Text>
                  <Text style={styles.userMeta}>{pkg.priceKwd} د.ك · {pkg.durationDays} {t('admin.days')}</Text>
                  <Text style={styles.userMeta}>{pkg.categoryIds.includes('*') ? t('admin.packageAllCategories') : pkg.categoryIds.map(getAdminCategoryName).join('، ')}</Text>
                </View>
              </View>
              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.roleBtn} onPress={() => editPackage(pkg)}>
                  <Text style={styles.roleBtnText}>{t('common.edit')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.roleBtn, busyKey === `package-${pkg.id}` && styles.roleBtnDisabled]} disabled={busyKey === `package-${pkg.id}`} onPress={() => { void togglePackageActive(pkg); }}>
                  <Text style={styles.roleBtnText}>{pkg.isActive ? t('admin.pauseAd') : t('admin.activateAd')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.roleBtn, busyKey === `package-delete-${pkg.id}` && styles.roleBtnDisabled]} disabled={busyKey === `package-delete-${pkg.id}`} onPress={() => { void removePackage(pkg); }}>
                  <Text style={styles.roleBtnText}>{t('common.delete')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.promoCodesSection')}</Text>
          <View style={styles.questionFormCard}>
            <Text style={styles.inputLabel}>{t('admin.promoCode')}</Text>
            <View style={styles.answerPairRow}>
              <TextInput style={[styles.textInput, styles.englishInput, { flex: 1 }]} value={promoForm.code} onChangeText={code => setPromoForm(current => ({ ...current, code: code.toUpperCase() }))} placeholder={t('admin.promoCodeAutoGenerate')} placeholderTextColor={Colors.textMuted} autoCapitalize="characters" />
              <TouchableOpacity style={styles.mediaPickBtn} onPress={() => setPromoForm(current => ({ ...current, code: generateRandomCode() }))}>
                <Text style={styles.mediaPickBtnText}>{t('admin.generateCode')}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>{t('admin.promoType')}</Text>
            <View style={styles.actionsRow}>
              {(['free', 'discountPercent', 'discountFixedKwd'] as PromoCodeType[]).map(type => (
                <TouchableOpacity key={type} style={[styles.roleBtn, promoForm.type === type && styles.roleBtnActive]} onPress={() => setPromoForm(current => ({ ...current, type }))}>
                  <Text style={styles.roleBtnText}>{t(`admin.promoType_${type}`)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {promoForm.type === 'free' ? (
              <>
                <Text style={styles.inputLabel}>{t('admin.promoLinkedPackage')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryStrip}>
                  {packages.filter(pkg => pkg.isActive).map(pkg => (
                    <TouchableOpacity key={pkg.id} style={[styles.smallChip, promoForm.packageId === pkg.id && styles.smallChipActive]} onPress={() => setPromoForm(current => ({ ...current, packageId: pkg.id }))}>
                      <Text style={styles.smallChipText}>{pkg.nameAr}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            ) : (
              <>
                <Text style={styles.inputLabel}>{t('admin.promoDiscountValue')}</Text>
                <TextInput style={[styles.textInput, styles.englishInput]} value={promoForm.discountValue} onChangeText={discountValue => setPromoForm(current => ({ ...current, discountValue }))} placeholder={promoForm.type === 'discountPercent' ? '20' : '1.5'} placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" />
              </>
            )}

            <View style={styles.adMetaRow}>
              <View style={styles.adMetaInputWrap}>
                <Text style={styles.inputLabel}>{t('admin.promoMaxRedemptions')}</Text>
                <TextInput style={[styles.textInput, styles.englishInput]} value={promoForm.maxRedemptions} onChangeText={maxRedemptions => setPromoForm(current => ({ ...current, maxRedemptions }))} placeholder="1" placeholderTextColor={Colors.textMuted} keyboardType="number-pad" />
              </View>
              <View style={styles.adMetaInputWrap}>
                <Text style={styles.inputLabel}>{t('admin.promoExpiresInDays')}</Text>
                <TextInput style={[styles.textInput, styles.englishInput]} value={promoForm.expiresInDays} onChangeText={expiresInDays => setPromoForm(current => ({ ...current, expiresInDays }))} placeholder={t('admin.promoNeverExpires')} placeholderTextColor={Colors.textMuted} keyboardType="number-pad" />
              </View>
            </View>

            <TouchableOpacity style={[styles.createQuestionBtn, busyKey === 'save-promo' && styles.roleBtnDisabled]} disabled={busyKey === 'save-promo'} onPress={() => { void submitPromoCode(); }}>
              <Text style={styles.createQuestionBtnText}>{t('admin.createPromoCode')}</Text>
            </TouchableOpacity>
          </View>

          {promoCodes.map(code => (
            <View key={code.code} style={styles.adCard}>
              <View style={styles.userTop}>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{code.code}</Text>
                  <Text style={styles.userMeta}>{t(`admin.promoType_${code.type}`)} · {code.redemptionCount}/{code.maxRedemptions} {t('admin.used')}</Text>
                  <Text style={styles.userMeta}>{code.isActive ? t('admin.categoryActive') : t('admin.categoryPaused')}</Text>
                </View>
              </View>
              <TouchableOpacity style={[styles.roleBtn, busyKey === `promo-${code.code}` && styles.roleBtnDisabled]} disabled={busyKey === `promo-${code.code}` || !code.isActive} onPress={() => { void removePromoCode(code); }}>
                <Text style={styles.roleBtnText}>{t('admin.deactivatePromoCode')}</Text>
              </TouchableOpacity>
            </View>
          ))}
          {!promoCodes.length ? <Text style={styles.emptyText}>{t('admin.noPromoCodes')}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.usersSection')}</Text>
          {users.map(item => (
            <View key={item.uid} style={styles.userCard}>
              <View style={styles.userTop}>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.displayName || 'User'}{item.customerNumber ? ` · #${item.customerNumber}` : ''}</Text>
                  <Text style={styles.userMeta}>{item.email || t('admin.guestUser')}</Text>
                  <Text style={styles.userMeta}>{item.role}</Text>
                  {item.entitlementExpiresAtMs && item.entitlementExpiresAtMs > Date.now() ? (
                    <Text style={styles.userMeta}>{t('admin.subscriptionUntil', { date: new Date(item.entitlementExpiresAtMs).toLocaleDateString() })}</Text>
                  ) : null}
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
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sectionTitle: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  exportBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  exportBtnText: { color: Colors.background, fontSize: 12, fontWeight: '900' },
  exportHint: { color: Colors.textMuted, fontSize: 12, lineHeight: 18 },
  noteBox: {
    color: Colors.primaryLight,
    backgroundColor: Colors.primary + '18',
    borderWidth: 1,
    borderColor: Colors.primary + '44',
    borderRadius: 12,
    padding: 12,
    fontSize: 12,
    lineHeight: 20,
  },
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
  linkedChipActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '22' },
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
  adMetaRow: { flexDirection: 'row', gap: 10 },
  adMetaInputWrap: { flex: 1, gap: 6 },
  mediaActionsRow: { flexDirection: 'row', gap: 8 },
  mediaPickBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  mediaPickBtnText: { color: Colors.text, fontSize: 12, fontWeight: '900' },
  mediaPreviewRow: { flexDirection: 'row', gap: 8 },
  questionMediaPreview: {
    flex: 1,
    height: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundCard,
  },
  singleMediaPreview: {
    width: '100%',
    height: 150,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundCard,
  },
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
  questionLinkedText: { color: Colors.accent, fontSize: 11, fontWeight: '800', textAlign: 'right' },
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
  adCard: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 12,
  },
  adColorDot: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: Colors.border },
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