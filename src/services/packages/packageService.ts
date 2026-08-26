import { collection, doc, getDocs, orderBy, query, setDoc, deleteDoc } from 'firebase/firestore';
import { Package } from '../../types';
import { getFirebaseDb, isFirebaseConfigured } from '../firebase/firebaseClient';

const PACKAGES_COLLECTION = 'packages';

export interface PackageInput {
  id?: string;
  nameAr: string;
  nameEn?: string;
  categoryIds: string[];
  durationDays: number;
  priceKwd: number;
  priceLabel?: string;
  isActive?: boolean;
  sortOrder?: number;
}

const toPackage = (id: string, payload: any): Package => ({
  id,
  nameAr: String(payload.nameAr ?? id).trim(),
  nameEn: String(payload.nameEn ?? payload.nameAr ?? id).trim(),
  categoryIds: Array.isArray(payload.categoryIds) ? payload.categoryIds.map(String) : [],
  durationDays: Number(payload.durationDays ?? 30),
  priceKwd: Number(payload.priceKwd ?? 0),
  priceLabel: String(payload.priceLabel ?? '').trim(),
  isActive: payload.isActive !== false,
  sortOrder: Number(payload.sortOrder ?? 0),
  createdAtMs: Number(payload.createdAtMs ?? 0),
  updatedAtMs: Number(payload.updatedAtMs ?? 0),
});

export const listPackages = async ({ includeInactive = false }: { includeInactive?: boolean } = {}): Promise<Package[]> => {
  if (!isFirebaseConfigured()) return [];

  const db = getFirebaseDb();
  const snapshot = await getDocs(query(collection(db, PACKAGES_COLLECTION), orderBy('sortOrder', 'asc'))).catch(() => null);
  if (!snapshot) return [];

  const packages = snapshot.docs.map(pkgDoc => toPackage(pkgDoc.id, pkgDoc.data()));
  return includeInactive ? packages : packages.filter(pkg => pkg.isActive);
};

export const listPackagesForCategory = async (categoryId: string): Promise<Package[]> => {
  const packages = await listPackages();
  return packages.filter(pkg => pkg.categoryIds.includes('*') || pkg.categoryIds.includes(categoryId));
};

export const savePackage = async (input: PackageInput) => {
  const nameAr = input.nameAr.trim();
  if (!nameAr) throw new Error('اكتب اسم الباقة');
  if (!input.categoryIds.length) throw new Error('اختر فئة واحدة على الأقل');
  if (!Number.isFinite(input.durationDays) || input.durationDays <= 0) throw new Error('حدد مدة صحيحة بالأيام');

  const db = getFirebaseDb();
  const id = input.id?.trim() || doc(collection(db, PACKAGES_COLLECTION)).id;
  const payload = {
    nameAr,
    nameEn: input.nameEn?.trim() || nameAr,
    categoryIds: input.categoryIds,
    durationDays: Number(input.durationDays),
    priceKwd: Number(input.priceKwd ?? 0),
    priceLabel: input.priceLabel?.trim() || `${input.priceKwd} د.ك`,
    isActive: input.isActive ?? true,
    sortOrder: Number(input.sortOrder ?? 0),
    updatedAtMs: Date.now(),
    createdAtMs: Date.now(),
  };

  await setDoc(doc(db, PACKAGES_COLLECTION, id), payload, { merge: true });
  return id;
};

export const setPackageActive = async (id: string, isActive: boolean) => {
  await setDoc(doc(getFirebaseDb(), PACKAGES_COLLECTION, id), { isActive, updatedAtMs: Date.now() }, { merge: true });
};

export const deletePackage = async (id: string) => {
  await deleteDoc(doc(getFirebaseDb(), PACKAGES_COLLECTION, id));
};
