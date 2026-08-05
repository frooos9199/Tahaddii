const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

const rootDir = path.resolve(__dirname, '..');
const entryFile = path.join(rootDir, 'src', 'services', 'questions', 'questionsData.ts');
const outputFile = path.join(rootDir, 'public', 'admin', 'question-bank.json');
const moduleCache = new Map();

const read = filePath => fs.readFileSync(filePath, 'utf8');

const resolveTsImport = (request, fromFile) => {
  if (!request.startsWith('.')) return null;

  const basePath = path.resolve(path.dirname(fromFile), request);
  const candidates = [
    `${basePath}.ts`,
    `${basePath}.tsx`,
    path.join(basePath, 'index.ts'),
  ];

  return candidates.find(candidate => fs.existsSync(candidate)) ?? null;
};

const loadTsModule = filePath => {
  if (moduleCache.has(filePath)) return moduleCache.get(filePath).exports;

  const source = read(filePath);
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filePath,
  }).outputText;

  const module = { exports: {} };
  moduleCache.set(filePath, module);

  const localRequire = request => {
    const resolved = resolveTsImport(request, filePath);
    if (resolved) return loadTsModule(resolved);
    return require(request);
  };

  const wrapper = `(function (exports, require, module, __filename, __dirname) { ${transpiled}\n})`;
  const script = new vm.Script(wrapper, { filename: filePath });
  const fn = script.runInThisContext();
  fn(module.exports, localRequire, module, filePath, path.dirname(filePath));

  return module.exports;
};

const normalizeQuestion = question => ({
  id: question.id,
  source: 'app',
  categoryId: question.categoryId,
  difficulty: question.difficulty,
  type: question.type || 'multiple_choice',
  ageGroups: Array.isArray(question.ageGroups) ? question.ageGroups : [],
  questionAr: question.questionAr || '',
  questionEn: question.questionEn || '',
  answersAr: Array.isArray(question.answersAr) ? question.answersAr : [],
  answersEn: Array.isArray(question.answersEn) ? question.answersEn : [],
  correctAnswerIndex: question.correctAnswerIndex ?? 0,
  correctAnswerAr: question.correctAnswerAr || question.answersAr?.[question.correctAnswerIndex ?? 0] || '',
  correctAnswerEn: question.correctAnswerEn || question.answersEn?.[question.correctAnswerIndex ?? 0] || '',
  explanationAr: question.explanationAr || '',
  explanationEn: question.explanationEn || '',
  points: question.points ?? 0,
  isKidsSafe: question.isKidsSafe !== false,
  isActive: question.isActive !== false,
  isPremium: question.isPremium === true,
});

const loaded = loadTsModule(entryFile);
const questions = Array.isArray(loaded.QUESTIONS) ? loaded.QUESTIONS.map(normalizeQuestion) : [];

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify({ generatedAt: new Date().toISOString(), count: questions.length, questions }, null, 2)}\n`);

console.log(`Exported ${questions.length} questions to ${path.relative(rootDir, outputFile)}`);
