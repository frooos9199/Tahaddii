import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
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

export const DEFAULT_CATEGORY_CARDS: CategoryCard[] = [];

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

export const deleteCategoryCard = async (id: CategoryId) => {
  await deleteDoc(doc(getFirebaseDb(), CATEGORY_CARDS_COLLECTION, id));
  await AsyncStorage.removeItem(CATEGORY_CARDS_CACHE_KEY).catch(() => {});
};

export const getCategoryCardLabel = (card: CategoryCard, language: 'ar' | 'en') =>
  language === 'en' ? card.nameEn || card.nameAr : card.nameAr || card.nameEn;

export const getCategoryFallbackEmoji = (categoryId: CategoryId) => CATEGORY_EMOJIS[categoryId] || '🎴';
