const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

const rootDir = path.resolve(__dirname, '..');
const typesPath = path.join(rootDir, 'src', 'types', 'index.ts');
const entryFile = path.join(rootDir, 'src', 'services', 'questions', 'questionsData.ts');

const MIN_QUESTIONS_PER_CATEGORY = 200;
const AGE_GROUPS = ['kids5', 'kids8', 'kids11', 'teens', 'adults', 'family'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

const read = filePath => fs.readFileSync(filePath, 'utf8');
const moduleCache = new Map();

const parseCategoryIds = () => {
  const typesText = read(typesPath);
  const match = typesText.match(/export type CategoryId =([\s\S]*?);\n\nexport type QuestionLanguage/);
  if (!match) {
    throw new Error('Failed to parse CategoryId union from src/types/index.ts');
  }

  return [...match[1].matchAll(/'([^']+)'/g)].map(item => item[1]);
};

const resolveTsImport = (request, fromFile) => {
  if (!request.startsWith('.')) {
    return null;
  }

  const basePath = path.resolve(path.dirname(fromFile), request);
  const candidates = [
    `${basePath}.ts`,
    `${basePath}.tsx`,
    path.join(basePath, 'index.ts'),
  ];

  return candidates.find(candidate => fs.existsSync(candidate)) ?? null;
};

const loadTsModule = filePath => {
  if (moduleCache.has(filePath)) {
    return moduleCache.get(filePath).exports;
  }

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
    if (resolved) {
      return loadTsModule(resolved);
    }

    return require(request);
  };

  const wrapper = `(function (exports, require, module, __filename, __dirname) { ${transpiled}\n})`;
  const script = new vm.Script(wrapper, { filename: filePath });
  const fn = script.runInThisContext();
  fn(module.exports, localRequire, module, filePath, path.dirname(filePath));

  return module.exports;
};

const parseQuestions = () => {
  const loaded = loadTsModule(entryFile);
  return Array.isArray(loaded.QUESTIONS) ? loaded.QUESTIONS : [];
};

const main = () => {
  const categories = parseCategoryIds();
  const questions = parseQuestions();

  const report = categories.map(categoryId => {
    const categoryQuestions = questions.filter(question => question.categoryId === categoryId);

    const byDifficulty = Object.fromEntries(
      DIFFICULTIES.map(level => [
        level,
        categoryQuestions.filter(question => question.difficulty === level).length,
      ]),
    );

    const byAgeGroup = Object.fromEntries(
      AGE_GROUPS.map(ageGroup => [
        ageGroup,
        categoryQuestions.filter(question => question.ageGroups.includes(ageGroup)).length,
      ]),
    );

    return {
      categoryId,
      total: categoryQuestions.length,
      missingToQuota: Math.max(0, MIN_QUESTIONS_PER_CATEGORY - categoryQuestions.length),
      byDifficulty,
      byAgeGroup,
    };
  });

  console.log(JSON.stringify({
    minimumPerCategory: MIN_QUESTIONS_PER_CATEGORY,
    categories: report,
  }, null, 2));

  if (report.some(item => item.total < MIN_QUESTIONS_PER_CATEGORY)) {
    process.exitCode = 1;
  }
};

main();
