// One-off merge script: reads all AI-generated batch JSON files under .qgen/output-*.json,
// normalizes them into the full Excel column schema, appends them as new rows to
// data/questions.xlsx (preserving all existing rows), and checks for id collisions.
//
// Usage: node scripts/questions-merge-generated.cjs
//
// After running this, run `npm run questions:import` to validate + regenerate questionsData.ts.
'use strict';
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { COLUMNS } = require('./questions-excel-columns.cjs');

const rootDir = path.resolve(__dirname, '..');
const qgenDir = path.join(rootDir, '.qgen');
const excelFile = path.join(rootDir, 'data', 'questions.xlsx');

const DEFAULT_AGE_GROUPS = ['kids5', 'kids8', 'kids11', 'teens', 'adults', 'family'];
const OLDER_AUDIENCE_AGE_GROUPS = ['teens', 'adults', 'family'];
const POINTS_BY_DIFFICULTY = { easy: 10, medium: 20, hard: 30 };

// Categories whose new content targets an older audience (per instructions given to agents).
const OLDER_AUDIENCE_CATEGORIES = new Set(['movies', 'anime', 'technology', 'celebrities']);

const batchFiles = fs.readdirSync(qgenDir).filter((f) => f.startsWith('output-') && f.endsWith('.json'));
console.log(`Found ${batchFiles.length} batch files.`);

// Map filename -> categoryId (filename without output- prefix and .json suffix).
const categoryFromFile = (filename) => filename.replace(/^output-/, '').replace(/\.json$/, '');

let allNew = [];
const perCategoryCounts = {};
for (const file of batchFiles) {
  const categoryId = categoryFromFile(file);
  const filePath = path.join(qgenDir, file);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`FAILED to parse ${file}: ${e.message}`);
    process.exit(1);
  }
  if (!Array.isArray(data)) {
    console.error(`${file}: expected a JSON array, got ${typeof data}`);
    process.exit(1);
  }
  perCategoryCounts[categoryId] = data.length;
  for (const q of data) {
    allNew.push({ ...q, categoryId });
  }
}

console.log('Per-category counts from batch files:');
for (const [cat, count] of Object.entries(perCategoryCounts)) {
  console.log(`  ${cat}: ${count}`);
}
console.log(`Total new questions: ${allNew.length}`);

// Load existing workbook to check for id collisions and to know existing header order.
const workbook = XLSX.readFile(excelFile);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const existingRows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
const existingIds = new Set(existingRows.map((r) => String(r.id || '').trim()));
console.log(`Existing rows in Excel: ${existingRows.length}`);

// Validate + normalize each new question into a full Question-shaped object.
const errors = [];
const seenNewIds = new Set();
const normalized = [];

for (const [i, q] of allNew.entries()) {
  const ctx = `[${q.categoryId || '?'}] id="${q.id || '(missing)'}" (batch index ${i})`;

  if (!q.id) {
    errors.push(`${ctx}: missing id`);
    continue;
  }
  if (existingIds.has(q.id)) {
    errors.push(`${ctx}: id collides with an EXISTING question in questions.xlsx`);
    continue;
  }
  if (seenNewIds.has(q.id)) {
    errors.push(`${ctx}: duplicate id within the new batch set`);
    continue;
  }
  seenNewIds.add(q.id);

  if (!['easy', 'medium', 'hard'].includes(q.difficulty)) {
    errors.push(`${ctx}: invalid difficulty "${q.difficulty}"`);
    continue;
  }
  if (!q.questionAr || !q.questionEn) {
    errors.push(`${ctx}: missing questionAr/questionEn`);
    continue;
  }
  const answersAr = Array.isArray(q.answersAr) ? q.answersAr.filter(Boolean) : [];
  const answersEn = Array.isArray(q.answersEn) ? q.answersEn.filter(Boolean) : [];
  if (answersAr.length < 2 || answersEn.length < 2) {
    errors.push(`${ctx}: needs at least 2 answers (has ${answersAr.length} ar / ${answersEn.length} en)`);
    continue;
  }
  if (answersAr.length !== answersEn.length) {
    errors.push(`${ctx}: answersAr (${answersAr.length}) and answersEn (${answersEn.length}) length mismatch`);
    continue;
  }
  if (
    !Number.isInteger(q.correctAnswerIndex) ||
    q.correctAnswerIndex < 0 ||
    q.correctAnswerIndex >= answersAr.length
  ) {
    errors.push(`${ctx}: correctAnswerIndex (${q.correctAnswerIndex}) out of range for ${answersAr.length} answers`);
    continue;
  }

  const ageGroups = OLDER_AUDIENCE_CATEGORIES.has(q.categoryId) ? OLDER_AUDIENCE_AGE_GROUPS : DEFAULT_AGE_GROUPS;

  normalized.push({
    id: q.id,
    categoryId: q.categoryId,
    linkedCategoryIds: undefined,
    ageGroups,
    difficulty: q.difficulty,
    type: q.type || 'multiple_choice',
    questionAr: q.questionAr,
    questionEn: q.questionEn,
    answersAr,
    answersEn,
    correctAnswerIndex: q.correctAnswerIndex,
    hintAr: undefined,
    hintEn: undefined,
    explanationAr: undefined,
    explanationEn: undefined,
    imageUrl: undefined,
    revealImageUrl: undefined,
    thumbnailUrl: undefined,
    videoUrl: undefined,
    mediaType: undefined,
    revealMode: undefined,
    blurAmount: undefined,
    points: POINTS_BY_DIFFICULTY[q.difficulty] ?? 10,
    isKidsSafe: !OLDER_AUDIENCE_CATEGORIES.has(q.categoryId),
    isActive: true,
    isPremium: false,
    source: 'builtin',
  });
}

if (errors.length > 0) {
  console.error(`\nFound ${errors.length} problem(s) in the generated batches — nothing was written:\n`);
  for (const e of errors.slice(0, 300)) console.error(`  - ${e}`);
  if (errors.length > 300) console.error(`  ... and ${errors.length - 300} more`);
  process.exit(1);
}

console.log(`\nAll ${normalized.length} new questions passed validation. Appending to Excel...`);

// Build new rows using the same COLUMNS schema as the exporter, and append after existing rows.
const headerRow = COLUMNS.map((c) => c.header);
const newRowObjects = normalized.map((q) => {
  const rowObj = {};
  for (const col of COLUMNS) {
    rowObj[col.header] = col.get(q);
  }
  return rowObj;
});

const combinedRows = [...existingRows, ...newRowObjects];
const newSheet = XLSX.utils.json_to_sheet(combinedRows, { header: headerRow });
workbook.Sheets[sheetName] = newSheet;
XLSX.writeFile(workbook, excelFile);

console.log(`Wrote ${combinedRows.length} total rows (${existingRows.length} existing + ${normalized.length} new) to ${path.relative(rootDir, excelFile)}`);
