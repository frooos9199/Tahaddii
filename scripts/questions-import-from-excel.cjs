// Regenerates src/services/questions/questionsData.ts entirely from data/questions.xlsx.
//
// Usage: npm run questions:import
//
// data/questions.xlsx is now the SINGLE SOURCE OF TRUTH for all built-in questions.
// Edit the Excel file (add rows for new questions, edit cells to fix existing ones), then run
// this script. It validates every row and, only if everything is valid, overwrites
// questionsData.ts with a generated QUESTIONS array. Never edit questionsData.ts by hand —
// your changes will be lost the next time this script runs.
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const XLSX = require('xlsx');
const { COLUMNS } = require('./questions-excel-columns.cjs');

const rootDir = path.resolve(__dirname, '..');
const inputFile = path.join(rootDir, 'data', 'questions.xlsx');
const outputFile = path.join(rootDir, 'src', 'services', 'questions', 'questionsData.ts');

const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const AGE_GROUPS = new Set(['kids5', 'kids8', 'kids11', 'teens', 'adults', 'family']);

// CategoryId is a plain `string` type alias in this project (see src/types/index.ts), so there is
// no closed union to validate against here. We still sanity-check against the catalog's known
// list when possible, but fall back to "any non-empty string" otherwise.
let KNOWN_CATEGORY_IDS = null;
try {
  const catalogText = fs.readFileSync(path.join(rootDir, 'src', 'services', 'questions', 'questionCatalog.ts'), 'utf8');
  const match = catalogText.match(/export const CATEGORY_IDS: CategoryId\[\] = \[([\s\S]*?)\];/);
  if (match) KNOWN_CATEGORY_IDS = new Set([...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));
} catch {
  KNOWN_CATEGORY_IDS = null;
}

if (!fs.existsSync(inputFile)) {
  console.error(`Excel file not found: ${path.relative(rootDir, inputFile)}`);
  console.error('Run `npm run questions:export` first to create it from the current questions.');
  process.exit(1);
}

const workbook = XLSX.readFile(inputFile);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const raw = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

if (raw.length === 0) {
  console.error('The Excel file has no data rows — aborting import (refusing to wipe questionsData.ts).');
  process.exit(1);
}

const errors = [];
const seenIds = new Set();
const questions = [];

raw.forEach((cellRow, index) => {
  const rowNum = index + 2; // +1 for header row, +1 for 1-based row numbers
  const draft = {};
  for (const column of COLUMNS) {
    column.set(draft, cellRow[column.header]);
  }

  const prefix = `Row ${rowNum} (id="${draft.id || ''}")`;

  if (!draft.id) {
    errors.push(`${prefix}: missing id`);
    return;
  }
  if (seenIds.has(draft.id)) {
    errors.push(`${prefix}: duplicate id "${draft.id}"`);
    return;
  }
  seenIds.add(draft.id);

  if (!draft.categoryId) {
    errors.push(`${prefix}: missing categoryId`);
  } else if (KNOWN_CATEGORY_IDS && !KNOWN_CATEGORY_IDS.has(draft.categoryId)) {
    errors.push(`${prefix}: unknown categoryId "${draft.categoryId}" (not in questionCatalog.ts CATEGORY_IDS)`);
  }

  if (!DIFFICULTIES.has(draft.difficulty)) {
    errors.push(`${prefix}: invalid difficulty "${draft.difficulty}" (must be easy/medium/hard)`);
  }

  if (!draft.questionAr) errors.push(`${prefix}: missing questionAr`);
  if (!draft.questionEn) errors.push(`${prefix}: missing questionEn`);

  const answersAr = (draft.answersAr || []).filter((a) => a !== undefined);
  const answersEn = (draft.answersEn || []).filter((a) => a !== undefined);
  if (answersAr.filter(Boolean).length < 2) errors.push(`${prefix}: needs at least 2 non-empty Arabic answers`);
  if (answersEn.filter(Boolean).length < 2) errors.push(`${prefix}: needs at least 2 non-empty English answers`);

  if (!Number.isInteger(draft.correctAnswerIndex) || draft.correctAnswerIndex < 0 || draft.correctAnswerIndex >= answersAr.length) {
    errors.push(`${prefix}: correctAnswerIndex (${draft.correctAnswerIndex}) is out of range for ${answersAr.length} answers`);
  }

  if (draft.ageGroups && draft.ageGroups.length > 0) {
    const bad = draft.ageGroups.filter((g) => !AGE_GROUPS.has(g));
    if (bad.length > 0) errors.push(`${prefix}: invalid ageGroups ${JSON.stringify(bad)}`);
  } else {
    draft.ageGroups = ['kids5', 'kids8', 'kids11', 'teens', 'adults', 'family'];
  }

  const correctIndex = Number.isInteger(draft.correctAnswerIndex) ? draft.correctAnswerIndex : 0;

  questions.push({
    id: draft.id,
    type: draft.type || 'multiple_choice',
    categoryId: draft.categoryId,
    linkedCategoryIds: draft.linkedCategoryIds && draft.linkedCategoryIds.length > 0 ? draft.linkedCategoryIds : undefined,
    ageGroups: draft.ageGroups,
    difficulty: draft.difficulty,
    questionAr: draft.questionAr,
    questionEn: draft.questionEn,
    answersAr,
    answersEn,
    correctAnswerIndex: correctIndex,
    correctAnswerAr: answersAr[correctIndex] ?? '',
    correctAnswerEn: answersEn[correctIndex] ?? '',
    explanationAr: draft.explanationAr,
    explanationEn: draft.explanationEn,
    hintAr: draft.hintAr,
    hintEn: draft.hintEn,
    imageUrl: draft.imageUrl,
    revealImageUrl: draft.revealImageUrl,
    thumbnailUrl: draft.thumbnailUrl,
    videoUrl: draft.videoUrl,
    mediaType: draft.mediaType,
    revealMode: draft.revealMode,
    blurAmount: draft.blurAmount,
    points: draft.points ?? { easy: 10, medium: 20, hard: 30 }[draft.difficulty] ?? 10,
    isKidsSafe: draft.isKidsSafe !== false,
    isActive: draft.isActive !== false,
    isPremium: draft.isPremium === true,
    source: draft.source || 'builtin',
  });
});

if (errors.length > 0) {
  console.error(`Found ${errors.length} problem(s) in ${path.relative(rootDir, inputFile)} — nothing was changed:\n`);
  for (const error of errors.slice(0, 200)) console.error(`  - ${error}`);
  if (errors.length > 200) console.error(`  ... and ${errors.length - 200} more`);
  process.exit(1);
}

const stringifyField = (value) => (value === undefined ? undefined : JSON.stringify(value));

const questionToLiteral = (q) => {
  const parts = [];
  for (const [key, value] of Object.entries(q)) {
    if (value === undefined) continue;
    parts.push(`${key}: ${stringifyField(value)}`);
  }
  return `  { ${parts.join(', ')} },`;
};

const header = `// AUTO-GENERATED FILE — DO NOT EDIT BY HAND.
//
// This file is generated from data/questions.xlsx by scripts/questions-import-from-excel.cjs.
// To add or edit a question: open data/questions.xlsx, change the rows, then run:
//   npm run questions:import
// Any manual edits made here will be overwritten the next time that script runs.

import { Question } from '../../types';

export const QUESTIONS: Question[] = [
`;

const footer = `];
`;

const body = questions.map(questionToLiteral).join('\n');
const outputSource = `${header}${body}\n${footer}`;

// Sanity check: make sure the generated TypeScript is at least syntactically well-formed before
// we overwrite the real file.
const checkResult = ts.transpileModule(outputSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  reportDiagnostics: true,
  fileName: 'questionsData.generated.ts',
});
const fatalDiagnostics = (checkResult.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
if (fatalDiagnostics.length > 0) {
  console.error('Generated TypeScript failed a basic syntax check — aborting, nothing was changed:');
  for (const d of fatalDiagnostics) console.error(`  - ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
  process.exit(1);
}

fs.writeFileSync(outputFile, outputSource);
console.log(`Imported ${questions.length} questions from ${path.relative(rootDir, inputFile)} into ${path.relative(rootDir, outputFile)}`);
