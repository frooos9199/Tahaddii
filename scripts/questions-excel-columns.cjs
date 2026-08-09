// Shared column definition between the Excel export/import scripts.
// Keep both scripts in sync by always going through this file when adding/removing a column.
'use strict';

/**
 * Each column has:
 *  - header: the column title shown in Excel
 *  - get(question): reads the value from a Question object (for export)
 *  - set(row, value): mutates a plain "draft" question object from a cell value (for import)
 */
const LIST_SEP = '|'; // separator used inside a single cell for list-like fields (answers, ageGroups...)

const toListCell = (arr) => (Array.isArray(arr) ? arr.join(LIST_SEP) : '');
const fromListCell = (cell) =>
  String(cell ?? '')
    .split(LIST_SEP)
    .map((s) => s.trim())
    .filter(Boolean);

const toBoolCell = (v) => (v === false ? 'FALSE' : 'TRUE');
const fromBoolCell = (cell, defaultValue = true) => {
  if (cell === undefined || cell === null || cell === '') return defaultValue;
  const s = String(cell).trim().toUpperCase();
  return s === 'TRUE' || s === '1' || s === 'YES' || s === 'نعم';
};

// Excel sheet-naming rules: max 31 chars, cannot contain : \ / ? * [ ], and a few names are
// reserved by Excel itself (e.g. "History" is used internally for change-tracking). Shared here
// so the export script (which creates sheet names from category ids) and the import script
// (which needs to recognize "this sheet name came from that category id" for its mismatch check)
// never drift apart.
const RESERVED_SHEET_NAMES = new Set(['history']);
const categoryIdToBaseSheetName = (categoryId) => {
  let name = String(categoryId).replace(/[:\\/?*[\]]/g, '_').slice(0, 31);
  if (RESERVED_SHEET_NAMES.has(name.toLowerCase())) name = `${name}_cat`;
  return name;
};

const COLUMNS = [
  { header: 'id', get: (q) => q.id, set: (row, v) => (row.id = String(v ?? '').trim()) },
  { header: 'categoryId', get: (q) => q.categoryId, set: (row, v) => (row.categoryId = String(v ?? '').trim()) },
  { header: 'linkedCategoryIds', get: (q) => toListCell(q.linkedCategoryIds), set: (row, v) => (row.linkedCategoryIds = fromListCell(v)) },
  { header: 'ageGroups', get: (q) => toListCell(q.ageGroups), set: (row, v) => (row.ageGroups = fromListCell(v)) },
  { header: 'difficulty', get: (q) => q.difficulty, set: (row, v) => (row.difficulty = String(v ?? '').trim()) },
  { header: 'type', get: (q) => q.type || 'multiple_choice', set: (row, v) => (row.type = String(v ?? '').trim() || 'multiple_choice') },
  { header: 'questionAr', get: (q) => q.questionAr, set: (row, v) => (row.questionAr = String(v ?? '')) },
  { header: 'questionEn', get: (q) => q.questionEn, set: (row, v) => (row.questionEn = String(v ?? '')) },
  { header: 'answer1Ar', get: (q) => q.answersAr?.[0] ?? '', set: (row, v) => ((row.answersAr ??= [])[0] = String(v ?? '')) },
  { header: 'answer2Ar', get: (q) => q.answersAr?.[1] ?? '', set: (row, v) => ((row.answersAr ??= [])[1] = String(v ?? '')) },
  { header: 'answer3Ar', get: (q) => q.answersAr?.[2] ?? '', set: (row, v) => ((row.answersAr ??= [])[2] = String(v ?? '')) },
  { header: 'answer4Ar', get: (q) => q.answersAr?.[3] ?? '', set: (row, v) => ((row.answersAr ??= [])[3] = String(v ?? '')) },
  { header: 'answer1En', get: (q) => q.answersEn?.[0] ?? '', set: (row, v) => ((row.answersEn ??= [])[0] = String(v ?? '')) },
  { header: 'answer2En', get: (q) => q.answersEn?.[1] ?? '', set: (row, v) => ((row.answersEn ??= [])[1] = String(v ?? '')) },
  { header: 'answer3En', get: (q) => q.answersEn?.[2] ?? '', set: (row, v) => ((row.answersEn ??= [])[2] = String(v ?? '')) },
  { header: 'answer4En', get: (q) => q.answersEn?.[3] ?? '', set: (row, v) => ((row.answersEn ??= [])[3] = String(v ?? '')) },
  { header: 'correctAnswerIndex', get: (q) => q.correctAnswerIndex ?? 0, set: (row, v) => (row.correctAnswerIndex = Number(v)) },
  { header: 'hintAr', get: (q) => q.hintAr || '', set: (row, v) => (row.hintAr = String(v ?? '') || undefined) },
  { header: 'hintEn', get: (q) => q.hintEn || '', set: (row, v) => (row.hintEn = String(v ?? '') || undefined) },
  { header: 'explanationAr', get: (q) => q.explanationAr || '', set: (row, v) => (row.explanationAr = String(v ?? '') || undefined) },
  { header: 'explanationEn', get: (q) => q.explanationEn || '', set: (row, v) => (row.explanationEn = String(v ?? '') || undefined) },
  { header: 'imageUrl', get: (q) => q.imageUrl || '', set: (row, v) => (row.imageUrl = String(v ?? '') || undefined) },
  { header: 'revealImageUrl', get: (q) => q.revealImageUrl || '', set: (row, v) => (row.revealImageUrl = String(v ?? '') || undefined) },
  { header: 'thumbnailUrl', get: (q) => q.thumbnailUrl || '', set: (row, v) => (row.thumbnailUrl = String(v ?? '') || undefined) },
  { header: 'videoUrl', get: (q) => q.videoUrl || '', set: (row, v) => (row.videoUrl = String(v ?? '') || undefined) },
  { header: 'mediaType', get: (q) => q.mediaType || '', set: (row, v) => (row.mediaType = String(v ?? '') || undefined) },
  { header: 'revealMode', get: (q) => q.revealMode || '', set: (row, v) => (row.revealMode = String(v ?? '') || undefined) },
  { header: 'blurAmount', get: (q) => q.blurAmount ?? '', set: (row, v) => (row.blurAmount = v === '' || v === undefined ? undefined : Number(v)) },
  { header: 'points', get: (q) => q.points ?? 0, set: (row, v) => (row.points = v === '' || v === undefined ? undefined : Number(v)) },
  { header: 'isKidsSafe', get: (q) => toBoolCell(q.isKidsSafe !== false), set: (row, v) => (row.isKidsSafe = fromBoolCell(v, true)) },
  { header: 'isActive', get: (q) => toBoolCell(q.isActive !== false), set: (row, v) => (row.isActive = fromBoolCell(v, true)) },
  { header: 'isPremium', get: (q) => toBoolCell(q.isPremium === true), set: (row, v) => (row.isPremium = fromBoolCell(v, false)) },
  { header: 'source', get: (q) => q.source || 'builtin', set: (row, v) => (row.source = String(v ?? '').trim() || 'builtin') },
];

module.exports = { COLUMNS, LIST_SEP, toListCell, fromListCell, toBoolCell, fromBoolCell, categoryIdToBaseSheetName };
