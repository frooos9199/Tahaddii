import { collection, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CategoryCard, CategoryId } from '../../types';
import { CATEGORY_EMOJIS } from '../../constants';
import { getFirebaseDb, isFirebaseConfigured } from '../firebase/firebaseClient';

const CATEGORY_CARDS_COLLECTION = 'categoryCards';
const CATEGORY_CARDS_CACHE_KEY = 'categoryCards.cache.v1';

export interface CategoryCardInput {
  id: CategoryId;
  iconKey?: string;
  nameAr: string;
  nameEn?: string;
  imageUrl?: string;
  accentColor?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export const DEFAULT_CATEGORY_CARDS: CategoryCard[] = [
  { id: 'generalKnowledge', iconKey: 'generalKnowledge', nameAr: 'معلومات عامة', nameEn: 'General Knowledge', imageUrl: '', accentColor: '#7C3AED', sortOrder: 10, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'sports', iconKey: 'sports', nameAr: 'رياضة', nameEn: 'Sports', imageUrl: '', accentColor: '#10B981', sortOrder: 20, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'football', iconKey: 'football', nameAr: 'كرة القدم', nameEn: 'Football', imageUrl: '', accentColor: '#84CC16', sortOrder: 30, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'cars', iconKey: 'cars', nameAr: 'سيارات', nameEn: 'Cars', imageUrl: '', accentColor: '#EF4444', sortOrder: 40, isActive: true, questionTypes: ['multiple_choice', 'image'] },
  { id: 'movies', iconKey: 'movies', nameAr: 'أفلام ومسلسلات', nameEn: 'Movies & TV', imageUrl: '', accentColor: '#8B5CF6', sortOrder: 50, isActive: true, questionTypes: ['multiple_choice', 'image'] },
  { id: 'cartoons', iconKey: 'cartoons', nameAr: 'كرتون', nameEn: 'Cartoons', imageUrl: '', accentColor: '#EC4899', sortOrder: 60, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'anime', iconKey: 'anime', nameAr: 'أنمي', nameEn: 'Anime', imageUrl: '', accentColor: '#F97316', sortOrder: 70, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'history', iconKey: 'history', nameAr: 'تاريخ', nameEn: 'History', imageUrl: '', accentColor: '#A16207', sortOrder: 80, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'geography', iconKey: 'geography', nameAr: 'جغرافيا', nameEn: 'Geography', imageUrl: '', accentColor: '#22C55E', sortOrder: 90, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'science', iconKey: 'science', nameAr: 'علوم', nameEn: 'Science', imageUrl: '', accentColor: '#3B82F6', sortOrder: 100, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'space', iconKey: 'space', nameAr: 'فضاء', nameEn: 'Space', imageUrl: '', accentColor: '#06B6D4', sortOrder: 110, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'animals', iconKey: 'animals', nameAr: 'حيوانات', nameEn: 'Animals', imageUrl: '', accentColor: '#F59E0B', sortOrder: 120, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'capitals', iconKey: 'capitals', nameAr: 'دول وعواصم', nameEn: 'Countries & Capitals', imageUrl: '', accentColor: '#14B8A6', sortOrder: 130, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'riddles', iconKey: 'riddles', nameAr: 'ألغاز', nameEn: 'Riddles', imageUrl: '', accentColor: '#EC4899', sortOrder: 140, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'math', iconKey: 'math', nameAr: 'حساب ورياضيات', nameEn: 'Math', imageUrl: '', accentColor: '#84CC16', sortOrder: 150, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'arabicLang', iconKey: 'arabicLang', nameAr: 'لغة عربية', nameEn: 'Arabic Language', imageUrl: '', accentColor: '#F43F5E', sortOrder: 160, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'englishLang', iconKey: 'englishLang', nameAr: 'لغة إنجليزية', nameEn: 'English Language', imageUrl: '', accentColor: '#2563EB', sortOrder: 170, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'technology', iconKey: 'technology', nameAr: 'تكنولوجيا', nameEn: 'Technology', imageUrl: '', accentColor: '#6366F1', sortOrder: 180, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'inventions', iconKey: 'inventions', nameAr: 'اختراعات', nameEn: 'Inventions', imageUrl: '', accentColor: '#EAB308', sortOrder: 190, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'celebrities', iconKey: 'celebrities', nameAr: 'مشاهير', nameEn: 'Celebrities', imageUrl: '', accentColor: '#F59E0B', sortOrder: 200, isActive: true, questionTypes: ['multiple_choice', 'image'] },
  { id: 'music', iconKey: 'music', nameAr: 'موسيقى', nameEn: 'Music', imageUrl: '', accentColor: '#D946EF', sortOrder: 210, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'islamicCulture', iconKey: 'islamicCulture', nameAr: 'ثقافة إسلامية', nameEn: 'Islamic Culture', imageUrl: '', accentColor: '#059669', sortOrder: 220, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'kuwait', iconKey: 'kuwait', nameAr: 'معلومات عن الكويت', nameEn: 'Kuwait Facts', imageUrl: '', accentColor: '#10B981', sortOrder: 230, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'flags', iconKey: 'flags', nameAr: 'أعلام الدول', nameEn: 'Country Flags', imageUrl: '', accentColor: '#06B6D4', sortOrder: 240, isActive: true, questionTypes: ['multiple_choice', 'image'] },
  { id: 'guessImage', iconKey: 'guessImage', nameAr: 'تخمين الصورة', nameEn: 'Guess the Image', imageUrl: '', accentColor: '#0EA5E9', sortOrder: 250, isActive: true, questionTypes: ['image'] },
  { id: 'trueFalse', iconKey: 'trueFalse', nameAr: 'صح أو خطأ', nameEn: 'True or False', imageUrl: '', accentColor: '#22C55E', sortOrder: 260, isActive: true, questionTypes: ['true_false'] },
  { id: 'completeSentence', iconKey: 'completeSentence', nameAr: 'أكمل الجملة', nameEn: 'Complete the Sentence', imageUrl: '', accentColor: '#F97316', sortOrder: 270, isActive: true, questionTypes: ['complete'] },
  { id: 'whoAmI', iconKey: 'whoAmI', nameAr: 'من أنا؟', nameEn: 'Who Am I?', imageUrl: '', accentColor: '#F97316', sortOrder: 280, isActive: true, questionTypes: ['who_am_i', 'image'] },
  { id: 'wouldYouRather', iconKey: 'wouldYouRather', nameAr: 'ماذا تفضل؟', nameEn: 'Would You Rather?', imageUrl: '', accentColor: '#DB2777', sortOrder: 290, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'familyChallenges', iconKey: 'familyChallenges', nameAr: 'تحديات عائلية', nameEn: 'Family Challenges', imageUrl: '', accentColor: '#14B8A6', sortOrder: 300, isActive: true, questionTypes: ['multiple_choice'] },
];

const toCategoryCard = (id: string, payload: any): CategoryCard => ({
  id,
  iconKey: String(payload.iconKey ?? '').trim() || undefined,
  nameAr: String(payload.nameAr ?? payload.titleAr ?? id).trim(),
  nameEn: String(payload.nameEn ?? payload.titleEn ?? payload.nameAr ?? id).trim(),
  imageUrl: String(payload.imageUrl ?? '').trim(),
  accentColor: String(payload.accentColor ?? '#8B5CF6').trim() || '#8B5CF6',
  sortOrder: Number(payload.sortOrder ?? 0),
  isActive: payload.isActive !== false,
  questionTypes: Array.isArray(payload.questionTypes) && payload.questionTypes.length ? payload.questionTypes : ['multiple_choice'],
  createdAtMs: Number(payload.createdAtMs ?? 0),
  updatedAtMs: Number(payload.updatedAtMs ?? 0),
});

const sortActiveCards = (cards: CategoryCard[]) => cards
  .filter(card => card.isActive)
  .sort((left, right) => left.sortOrder - right.sortOrder || left.nameAr.localeCompare(right.nameAr));

const sortCards = (cards: CategoryCard[]) => cards
  .sort((left, right) => left.sortOrder - right.sortOrder || left.nameAr.localeCompare(right.nameAr));

export const getCachedCategoryCards = async (): Promise<CategoryCard[]> => {
  try {
    const raw = await AsyncStorage.getItem(CATEGORY_CARDS_CACHE_KEY);
    if (!raw) return DEFAULT_CATEGORY_CARDS;

    const cached = JSON.parse(raw);
    if (!Array.isArray(cached)) return DEFAULT_CATEGORY_CARDS;

    return sortActiveCards(cached.map(card => toCategoryCard(String(card.id), card)));
  } catch {
    return DEFAULT_CATEGORY_CARDS;
  }
};

export const listCategoryCards = async ({ includeInactive = false }: { includeInactive?: boolean } = {}): Promise<CategoryCard[]> => {
  if (!isFirebaseConfigured()) return DEFAULT_CATEGORY_CARDS;

  const db = getFirebaseDb();
  const snapshot = await getDocs(query(collection(db, CATEGORY_CARDS_COLLECTION), orderBy('sortOrder', 'asc'))).catch(() => null);
  if (!snapshot || snapshot.empty) return getCachedCategoryCards();

  const firebaseCards = snapshot.docs.map(cardDoc => toCategoryCard(cardDoc.id, cardDoc.data()));
  const cardsById = new Map(DEFAULT_CATEGORY_CARDS.map(card => [card.id, card]));

  for (const card of firebaseCards) {
    cardsById.set(card.id, { ...(cardsById.get(card.id) || {}), ...card });
  }

  const mergedCards = [...cardsById.values()];
  const cards = includeInactive ? sortCards(mergedCards) : sortActiveCards(mergedCards);
  if (!includeInactive) {
    void AsyncStorage.setItem(CATEGORY_CARDS_CACHE_KEY, JSON.stringify(cards)).catch(() => {});
  }

  return cards;
};

export const saveCategoryCard = async (input: CategoryCardInput) => {
  const id = input.id.trim();
  const nameAr = input.nameAr.trim();
  const nameEn = input.nameEn?.trim() || nameAr;

  if (!id) throw new Error('اكتب ID التصنيف');
  if (!nameAr) throw new Error('اكتب اسم التصنيف');

  const payload = {
    iconKey: input.iconKey?.trim() || '',
    nameAr,
    nameEn,
    imageUrl: input.imageUrl?.trim() || '',
    accentColor: input.accentColor?.trim() || '#8B5CF6',
    sortOrder: Number(input.sortOrder ?? 0),
    isActive: input.isActive ?? true,
    questionTypes: ['multiple_choice', 'image'],
    updatedAtMs: Date.now(),
    createdAtMs: Date.now(),
  };

  await setDoc(doc(getFirebaseDb(), CATEGORY_CARDS_COLLECTION, id), payload, { merge: true });
  await AsyncStorage.removeItem(CATEGORY_CARDS_CACHE_KEY).catch(() => {});
  return id;
};

export const setCategoryCardActive = async (id: CategoryId, isActive: boolean) => {
  await setDoc(doc(getFirebaseDb(), CATEGORY_CARDS_COLLECTION, id), { isActive, updatedAtMs: Date.now() }, { merge: true });
  await AsyncStorage.removeItem(CATEGORY_CARDS_CACHE_KEY).catch(() => {});
};

export const getCategoryCardLabel = (card: CategoryCard, language: 'ar' | 'en') =>
  language === 'en' ? card.nameEn || card.nameAr : card.nameAr || card.nameEn;

export const getCategoryFallbackEmoji = (categoryId: CategoryId) => CATEGORY_EMOJIS[categoryId] || '🎴';
