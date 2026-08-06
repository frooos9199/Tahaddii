import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { CategoryCard, CategoryId } from '../../types';
import { CATEGORY_EMOJIS } from '../../constants';
import { getFirebaseDb, isFirebaseConfigured } from '../firebase/firebaseClient';

const CATEGORY_CARDS_COLLECTION = 'categoryCards';

export const DEFAULT_CATEGORY_CARDS: CategoryCard[] = [
  { id: 'celebrities', nameAr: 'مشاهير', nameEn: 'Celebrities', imageUrl: '', accentColor: '#F59E0B', sortOrder: 10, isActive: true, questionTypes: ['multiple_choice', 'image'] },
  { id: 'kuwait', nameAr: 'الكويت', nameEn: 'Kuwait', imageUrl: '', accentColor: '#10B981', sortOrder: 20, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'sports', nameAr: 'رياضة', nameEn: 'Sports', imageUrl: '', accentColor: '#3B82F6', sortOrder: 30, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'movies', nameAr: 'أفلام ومسرحيات', nameEn: 'Movies & Plays', imageUrl: '', accentColor: '#8B5CF6', sortOrder: 40, isActive: true, questionTypes: ['multiple_choice', 'image'] },
  { id: 'riddles', nameAr: 'ألغاز', nameEn: 'Riddles', imageUrl: '', accentColor: '#EC4899', sortOrder: 50, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'football', nameAr: 'كرة القدم', nameEn: 'Football', imageUrl: '', accentColor: '#84CC16', sortOrder: 60, isActive: true, questionTypes: ['multiple_choice'] },
  { id: 'cars', nameAr: 'سيارات', nameEn: 'Cars', imageUrl: '', accentColor: '#EF4444', sortOrder: 70, isActive: true, questionTypes: ['multiple_choice', 'image'] },
  { id: 'flags', nameAr: 'أعلام', nameEn: 'Flags', imageUrl: '', accentColor: '#06B6D4', sortOrder: 80, isActive: true, questionTypes: ['multiple_choice', 'image'] },
  { id: 'whoAmI', nameAr: 'من أنا؟', nameEn: 'Who Am I?', imageUrl: '', accentColor: '#F97316', sortOrder: 90, isActive: true, questionTypes: ['multiple_choice', 'image'] },
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

  return snapshot.docs
    .map(cardDoc => toCategoryCard(cardDoc.id, cardDoc.data()))
    .filter(card => card.isActive)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.nameAr.localeCompare(right.nameAr));
};

export const getCategoryCardLabel = (card: CategoryCard, language: 'ar' | 'en') =>
  language === 'en' ? card.nameEn || card.nameAr : card.nameAr || card.nameEn;

export const getCategoryFallbackEmoji = (categoryId: CategoryId) => CATEGORY_EMOJIS[categoryId] || '🎴';
