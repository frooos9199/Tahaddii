// Exports the current merged QUESTIONS bank (questionsData.ts, plus any legacy packs still
// present) into an editable Excel workbook at data/questions.xlsx.
//
// Usage: npm run questions:export
//
// You normally only need this ONCE to bootstrap data/questions.xlsx from existing code, or if
// you ever want to re-generate a fresh Excel snapshot from what's currently in the code. Day to
// day, the Excel file is the source of truth: edit it, then run `npm run questions:import`.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const XLSX = require('xlsx');
const { COLUMNS } = require('./questions-excel-columns.cjs');

const rootDir = path.resolve(__dirname, '..');
const entryFile = path.join(rootDir, 'src', 'services', 'questions', 'questionsData.ts');
const outputFile = path.join(rootDir, 'data', 'questions.xlsx');
const moduleCache = new Map();

const read = (filePath) => fs.readFileSync(filePath, 'utf8');

const resolveTsImport = (request, fromFile) => {
  if (!request.startsWith('.')) return null;
  const basePath = path.resolve(path.dirname(fromFile), request);
  const candidates = [`${basePath}.ts`, `${basePath}.tsx`, path.join(basePath, 'index.ts')];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
};

const loadTsModule = (filePath) => {
  if (moduleCache.has(filePath)) return moduleCache.get(filePath).exports;

  const source = read(filePath);
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filePath,
  }).outputText;

  const moduleObj = { exports: {} };
  moduleCache.set(filePath, moduleObj);

  const localRequire = (request) => {
    const resolved = resolveTsImport(request, filePath);
    if (resolved) return loadTsModule(resolved);
    return require(request);
  };

  const wrapper = `(function (exports, require, module, __filename, __dirname) { ${transpiled}\n})`;
  const script = new vm.Script(wrapper, { filename: filePath });
  const fn = script.runInThisContext();
  fn(moduleObj.exports, localRequire, moduleObj, filePath, path.dirname(filePath));

  return moduleObj.exports;
};

const loaded = loadTsModule(entryFile);
const questions = Array.isArray(loaded.QUESTIONS) ? loaded.QUESTIONS : [];

if (questions.length === 0) {
  console.error('No questions found in questionsData.ts — aborting export.');
  process.exit(1);
}

const headers = COLUMNS.map((c) => c.header);
const rows = questions.map((q) => COLUMNS.map((c) => c.get(q)));

const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
// Reasonable default column widths so the file is usable as soon as it's opened.
worksheet['!cols'] = COLUMNS.map((c) => ({
  wch: ['questionAr', 'questionEn', 'explanationAr', 'explanationEn'].includes(c.header) ? 45 : 18,
}));
worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'Questions');

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
XLSX.writeFile(workbook, outputFile);

console.log(`Exported ${questions.length} questions to ${path.relative(rootDir, outputFile)}`);
