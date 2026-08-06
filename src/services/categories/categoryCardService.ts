import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { CategoryCard, CategoryId } from '../../types';
import { CATEGORY_EMOJIS } from '../../constants';
import { getFirebaseDb, isFirebaseConfigured } from '../firebase/firebaseClient';

const CATEGORY_CARDS_COLLECTION = 'categoryCards';

export const DEFAULT_CATEGORY_CARDS: CategoryCard[] = [
  { id: 'generalKnowledge', nameAr: 'معلومات عامة', nameEn: 'General Knowledge', imageUrl: '', accentColor: '#7C3AED', sortOrder: 10, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'sports', nameAr: 'رياضة', nameEn: 'Sports', imageUrl: '', accentColor: '#10B981', sortOrder: 20, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'football', nameAr: 'كرة القدم', nameEn: 'Football', imageUrl: '', accentColor: '#84CC16', sortOrder: 30, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'cars', nameAr: 'سيارات', nameEn: 'Cars', imageUrl: '', accentColor: '#EF4444', sortOrder: 40, isActive: true, questionTypes: ['multiple_choice', 'image'] },
  { id: 'movies', nameAr: 'أفلام ومسلسلات', nameEn: 'Movies & TV', imageUrl: '', accentColor: '#8B5CF6', sortOrder: 50, isActive: true, questionTypes: ['multiple_choice', 'image'] },
  { id: 'cartoons', nameAr: 'كرتون', nameEn: 'Cartoons', imageUrl: '', accentColor: '#EC4899', sortOrder: 60, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'anime', nameAr: 'أنمي', nameEn: 'Anime', imageUrl: '', accentColor: '#F97316', sortOrder: 70, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'history', nameAr: 'تاريخ', nameEn: 'History', imageUrl: '', accentColor: '#A16207', sortOrder: 80, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'geography', nameAr: 'جغرافيا', nameEn: 'Geography', imageUrl: '', accentColor: '#22C55E', sortOrder: 90, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'science', nameAr: 'علوم', nameEn: 'Science', imageUrl: '', accentColor: '#3B82F6', sortOrder: 100, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'space', nameAr: 'فضاء', nameEn: 'Space', imageUrl: '', accentColor: '#06B6D4', sortOrder: 110, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'animals', nameAr: 'حيوانات', nameEn: 'Animals', imageUrl: '', accentColor: '#F59E0B', sortOrder: 120, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'capitals', nameAr: 'دول وعواصم', nameEn: 'Countries & Capitals', imageUrl: '', accentColor: '#14B8A6', sortOrder: 130, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'riddles', nameAr: 'ألغاز', nameEn: 'Riddles', imageUrl: '', accentColor: '#EC4899', sortOrder: 140, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'math', nameAr: 'حساب ورياضيات', nameEn: 'Math', imageUrl: '', accentColor: '#84CC16', sortOrder: 150, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'arabicLang', nameAr: 'لغة عربية', nameEn: 'Arabic Language', imageUrl: '', accentColor: '#F43F5E', sortOrder: 160, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'englishLang', nameAr: 'لغة إنجليزية', nameEn: 'English Language', imageUrl: '', accentColor: '#2563EB', sortOrder: 170, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'technology', nameAr: 'تكنولوجيا', nameEn: 'Technology', imageUrl: '', accentColor: '#6366F1', sortOrder: 180, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'inventions', nameAr: 'اختراعات', nameEn: 'Inventions', imageUrl: '', accentColor: '#EAB308', sortOrder: 190, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'celebrities', nameAr: 'مشاهير', nameEn: 'Celebrities', imageUrl: '', accentColor: '#F59E0B', sortOrder: 200, isActive: true, questionTypes: ['multiple_choice', 'image'] },
  { id: 'music', nameAr: 'موسيقى', nameEn: 'Music', imageUrl: '', accentColor: '#D946EF', sortOrder: 210, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'islamicCulture', nameAr: 'ثقافة إسلامية', nameEn: 'Islamic Culture', imageUrl: '', accentColor: '#059669', sortOrder: 220, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'kuwait', nameAr: 'معلومات عن الكويت', nameEn: 'Kuwait Facts', imageUrl: '', accentColor: '#10B981', sortOrder: 230, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'flags', nameAr: 'أعلام الدول', nameEn: 'Country Flags', imageUrl: '', accentColor: '#06B6D4', sortOrder: 240, isActive: true, questionTypes: ['multiple_choice', 'image'] },
  { id: 'guessImage', nameAr: 'تخمين الصورة', nameEn: 'Guess the Image', imageUrl: '', accentColor: '#0EA5E9', sortOrder: 250, isActive: true, questionTypes: ['image'] },
  { id: 'trueFalse', nameAr: 'صح أو خطأ', nameEn: 'True or False', imageUrl: '', accentColor: '#22C55E', sortOrder: 260, isActive: true, questionTypes: ['true_false'] },
  { id: 'completeSentence', nameAr: 'أكمل الجملة', nameEn: 'Complete the Sentence', imageUrl: '', accentColor: '#F97316', sortOrder: 270, isActive: true, questionTypes: ['complete'] },
  { id: 'whoAmI', nameAr: 'من أنا؟', nameEn: 'Who Am I?', imageUrl: '', accentColor: '#F97316', sortOrder: 280, isActive: true, questionTypes: ['who_am_i', 'image'] },
  { id: 'wouldYouRather', nameAr: 'ماذا تفضل؟', nameEn: 'Would You Rather?', imageUrl: '', accentColor: '#DB2777', sortOrder: 290, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'familyChallenges', nameAr: 'تحديات عائلية', nameEn: 'Family Challenges', imageUrl: '', accentColor: '#14B8A6', sortOrder: 300, isActive: true, questionTypes: ['multiple_choice'] },
];

const toCategoryCard = (id: string, payload: any): CategoryCard => ({
  id,
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

export const listCategoryCards = async (): Promise<CategoryCard[]> => {
  if (!isFirebaseConfigured()) return DEFAULT_CATEGORY_CARDS;

  const db = getFirebaseDb();
  const snapshot = await getDocs(query(collection(db, CATEGORY_CARDS_COLLECTION), orderBy('sortOrder', 'asc'))).catch(() => null);
  if (!snapshot || snapshot.empty) return DEFAULT_CATEGORY_CARDS;

  const firebaseCards = snapshot.docs.map(cardDoc => toCategoryCard(cardDoc.id, cardDoc.data()));
  const cardsById = new Map(DEFAULT_CATEGORY_CARDS.map(card => [card.id, card]));

  for (const card of firebaseCards) {
    cardsById.set(card.id, { ...(cardsById.get(card.id) || {}), ...card });
  }

  return [...cardsById.values()]
    .filter(card => card.isActive)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.nameAr.localeCompare(right.nameAr));
};

export const getCategoryCardLabel = (card: CategoryCard, language: 'ar' | 'en') =>
  language === 'en' ? card.nameEn || card.nameAr : card.nameAr || card.nameEn;

export const getCategoryFallbackEmoji = (categoryId: CategoryId) => CATEGORY_EMOJIS[categoryId] || '🎴';
