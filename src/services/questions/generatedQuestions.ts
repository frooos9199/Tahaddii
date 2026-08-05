import { CategoryId, Difficulty, Question, QuestionType } from '../../types';

type AgeBucket = 'all' | 'older';

interface QuestionInput {
  id: string;
  categoryId: CategoryId;
  difficulty: Difficulty;
  questionAr: string;
  questionEn: string;
  answersAr: string[];
  answersEn: string[];
  correctAnswerIndex: number;
  ageBucket?: AgeBucket;
  type?: QuestionType;
  isKidsSafe?: boolean;
}

interface PromptAnswerSeed {
  id: string;
  categoryId: CategoryId;
  difficulty: Difficulty;
  questionAr: string;
  questionEn: string;
  answerAr: string;
  answerEn: string;
  ageBucket?: AgeBucket;
  type?: QuestionType;
  isKidsSafe?: boolean;
}

interface TrueFalseSeed {
  id: string;
  difficulty: Difficulty;
  questionAr: string;
  questionEn: string;
  isTrue: boolean;
}

const ageGroupsByBucket = {
  all: ['kids5', 'kids8', 'kids11', 'teens', 'adults', 'family'],
  older: ['kids11', 'teens', 'adults'],
} as const;

const difficultyPoints: Record<Difficulty, number> = {
  easy: 10,
  medium: 20,
  hard: 30,
};

const buildQuestion = ({
  id,
  categoryId,
  difficulty,
  questionAr,
  questionEn,
  answersAr,
  answersEn,
  correctAnswerIndex,
  ageBucket = 'all',
  type = 'multiple_choice',
  isKidsSafe = true,
}: QuestionInput): Question => ({
  id,
  type,
  categoryId,
  ageGroups: [...ageGroupsByBucket[ageBucket]],
  difficulty,
  questionAr,
  questionEn,
  answersAr,
  answersEn,
  correctAnswerIndex,
  correctAnswerAr: answersAr[correctAnswerIndex],
  correctAnswerEn: answersEn[correctAnswerIndex],
  points: difficultyPoints[difficulty],
  isKidsSafe,
  isActive: true,
  isPremium: false,
});

const buildRotatingAnswers = <T,>(
  items: T[],
  index: number,
  getAr: (item: T) => string,
  getEn: (item: T) => string,
) => {
  const correctSlot = index % 4;
  const wrongIndexes: number[] = [];

  for (let step = 1; wrongIndexes.length < 3; step += 1) {
    wrongIndexes.push((index + step) % items.length);
  }

  const answersAr = new Array(4).fill('');
  const answersEn = new Array(4).fill('');

  answersAr[correctSlot] = getAr(items[index]);
  answersEn[correctSlot] = getEn(items[index]);

  let wrongCursor = 0;
  for (let optionIndex = 0; optionIndex < 4; optionIndex += 1) {
    if (optionIndex === correctSlot) {
      continue;
    }

    const wrongItem = items[wrongIndexes[wrongCursor]];
    answersAr[optionIndex] = getAr(wrongItem);
    answersEn[optionIndex] = getEn(wrongItem);
    wrongCursor += 1;
  }

  return { answersAr, answersEn, correctAnswerIndex: correctSlot };
};

const buildPromptDataset = (items: PromptAnswerSeed[]) =>
  items.map((item, index) => {
    const { answersAr, answersEn, correctAnswerIndex } = buildRotatingAnswers(
      items,
      index,
      seed => seed.answerAr,
      seed => seed.answerEn,
    );

    return buildQuestion({
      id: item.id,
      categoryId: item.categoryId,
      difficulty: item.difficulty,
      questionAr: item.questionAr,
      questionEn: item.questionEn,
      answersAr,
      answersEn,
      correctAnswerIndex,
      ageBucket: item.ageBucket,
      type: item.type,
      isKidsSafe: item.isKidsSafe,
    });
  });

const buildTrueFalseDataset = (items: TrueFalseSeed[]) =>
  items.map(item =>
    buildQuestion({
      id: item.id,
      categoryId: 'trueFalse',
      difficulty: item.difficulty,
      questionAr: item.questionAr,
      questionEn: item.questionEn,
      answersAr: ['صح', 'خطأ'],
      answersEn: ['True', 'False'],
      correctAnswerIndex: item.isTrue ? 0 : 1,
      type: 'true_false',
    }),
  );

const capitalSeeds: PromptAnswerSeed[] = [
  { id: 'capitals-g01', categoryId: 'capitals', difficulty: 'easy', questionAr: 'ما عاصمة فرنسا؟', questionEn: 'What is the capital of France?', answerAr: 'باريس', answerEn: 'Paris' },
  { id: 'capitals-g02', categoryId: 'capitals', difficulty: 'easy', questionAr: 'ما عاصمة إيطاليا؟', questionEn: 'What is the capital of Italy?', answerAr: 'روما', answerEn: 'Rome' },
  { id: 'capitals-g03', categoryId: 'capitals', difficulty: 'easy', questionAr: 'ما عاصمة ألمانيا؟', questionEn: 'What is the capital of Germany?', answerAr: 'برلين', answerEn: 'Berlin' },
  { id: 'capitals-g04', categoryId: 'capitals', difficulty: 'easy', questionAr: 'ما عاصمة إسبانيا؟', questionEn: 'What is the capital of Spain?', answerAr: 'مدريد', answerEn: 'Madrid' },
  { id: 'capitals-g05', categoryId: 'capitals', difficulty: 'easy', questionAr: 'ما عاصمة البرتغال؟', questionEn: 'What is the capital of Portugal?', answerAr: 'لشبونة', answerEn: 'Lisbon' },
  { id: 'capitals-g06', categoryId: 'capitals', difficulty: 'medium', questionAr: 'ما عاصمة النرويج؟', questionEn: 'What is the capital of Norway?', answerAr: 'أوسلو', answerEn: 'Oslo' },
  { id: 'capitals-g07', categoryId: 'capitals', difficulty: 'medium', questionAr: 'ما عاصمة السويد؟', questionEn: 'What is the capital of Sweden?', answerAr: 'ستوكهولم', answerEn: 'Stockholm' },
  { id: 'capitals-g08', categoryId: 'capitals', difficulty: 'medium', questionAr: 'ما عاصمة فنلندا؟', questionEn: 'What is the capital of Finland?', answerAr: 'هلسنكي', answerEn: 'Helsinki' },
  { id: 'capitals-g09', categoryId: 'capitals', difficulty: 'medium', questionAr: 'ما عاصمة الدنمارك؟', questionEn: 'What is the capital of Denmark?', answerAr: 'كوبنهاغن', answerEn: 'Copenhagen' },
  { id: 'capitals-g10', categoryId: 'capitals', difficulty: 'medium', questionAr: 'ما عاصمة هولندا؟', questionEn: 'What is the capital of the Netherlands?', answerAr: 'أمستردام', answerEn: 'Amsterdam' },
  { id: 'capitals-g11', categoryId: 'capitals', difficulty: 'medium', questionAr: 'ما عاصمة بلجيكا؟', questionEn: 'What is the capital of Belgium?', answerAr: 'بروكسل', answerEn: 'Brussels' },
  { id: 'capitals-g12', categoryId: 'capitals', difficulty: 'medium', questionAr: 'ما عاصمة سويسرا؟', questionEn: 'What is the capital of Switzerland?', answerAr: 'برن', answerEn: 'Bern' },
  { id: 'capitals-g13', categoryId: 'capitals', difficulty: 'hard', questionAr: 'ما عاصمة النمسا؟', questionEn: 'What is the capital of Austria?', answerAr: 'فيينا', answerEn: 'Vienna' },
  { id: 'capitals-g14', categoryId: 'capitals', difficulty: 'hard', questionAr: 'ما عاصمة اليونان؟', questionEn: 'What is the capital of Greece?', answerAr: 'أثينا', answerEn: 'Athens' },
  { id: 'capitals-g15', categoryId: 'capitals', difficulty: 'medium', questionAr: 'ما عاصمة بولندا؟', questionEn: 'What is the capital of Poland?', answerAr: 'وارسو', answerEn: 'Warsaw' },
  { id: 'capitals-g16', categoryId: 'capitals', difficulty: 'medium', questionAr: 'ما عاصمة التشيك؟', questionEn: 'What is the capital of the Czech Republic?', answerAr: 'براغ', answerEn: 'Prague' },
  { id: 'capitals-g17', categoryId: 'capitals', difficulty: 'hard', questionAr: 'ما عاصمة المجر؟', questionEn: 'What is the capital of Hungary?', answerAr: 'بودابست', answerEn: 'Budapest' },
  { id: 'capitals-g18', categoryId: 'capitals', difficulty: 'hard', questionAr: 'ما عاصمة رومانيا؟', questionEn: 'What is the capital of Romania?', answerAr: 'بوخارست', answerEn: 'Bucharest' },
  { id: 'capitals-g19', categoryId: 'capitals', difficulty: 'medium', questionAr: 'ما عاصمة تركيا؟', questionEn: 'What is the capital of Turkey?', answerAr: 'أنقرة', answerEn: 'Ankara' },
  { id: 'capitals-g20', categoryId: 'capitals', difficulty: 'medium', questionAr: 'ما عاصمة اليابان؟', questionEn: 'What is the capital of Japan?', answerAr: 'طوكيو', answerEn: 'Tokyo' },
  { id: 'capitals-g21', categoryId: 'capitals', difficulty: 'medium', questionAr: 'ما عاصمة الصين؟', questionEn: 'What is the capital of China?', answerAr: 'بكين', answerEn: 'Beijing' },
  { id: 'capitals-g22', categoryId: 'capitals', difficulty: 'medium', questionAr: 'ما عاصمة كوريا الجنوبية؟', questionEn: 'What is the capital of South Korea?', answerAr: 'سيول', answerEn: 'Seoul' },
  { id: 'capitals-g23', categoryId: 'capitals', difficulty: 'hard', questionAr: 'ما عاصمة الهند؟', questionEn: 'What is the capital of India?', answerAr: 'نيودلهي', answerEn: 'New Delhi' },
  { id: 'capitals-g24', categoryId: 'capitals', difficulty: 'hard', questionAr: 'ما عاصمة باكستان؟', questionEn: 'What is the capital of Pakistan?', answerAr: 'إسلام آباد', answerEn: 'Islamabad' },
  { id: 'capitals-g25', categoryId: 'capitals', difficulty: 'medium', questionAr: 'ما عاصمة أستراليا؟', questionEn: 'What is the capital of Australia?', answerAr: 'كانبيرا', answerEn: 'Canberra' },
  { id: 'capitals-g26', categoryId: 'capitals', difficulty: 'easy', questionAr: 'ما عاصمة مصر؟', questionEn: 'What is the capital of Egypt?', answerAr: 'القاهرة', answerEn: 'Cairo' },
  { id: 'capitals-g27', categoryId: 'capitals', difficulty: 'easy', questionAr: 'ما عاصمة السعودية؟', questionEn: 'What is the capital of Saudi Arabia?', answerAr: 'الرياض', answerEn: 'Riyadh' },
  { id: 'capitals-g28', categoryId: 'capitals', difficulty: 'easy', questionAr: 'ما عاصمة الإمارات؟', questionEn: 'What is the capital of the UAE?', answerAr: 'أبوظبي', answerEn: 'Abu Dhabi' },
  { id: 'capitals-g29', categoryId: 'capitals', difficulty: 'easy', questionAr: 'ما عاصمة الأردن؟', questionEn: 'What is the capital of Jordan?', answerAr: 'عمّان', answerEn: 'Amman' },
  { id: 'capitals-g30', categoryId: 'capitals', difficulty: 'medium', questionAr: 'ما عاصمة المغرب؟', questionEn: 'What is the capital of Morocco?', answerAr: 'الرباط', answerEn: 'Rabat' },
];

const geographySeeds: PromptAnswerSeed[] = [
  { id: 'geo-g01', categoryId: 'geography', difficulty: 'easy', questionAr: 'في أي قارة تقع البرازيل؟', questionEn: 'On which continent is Brazil located?', answerAr: 'أمريكا الجنوبية', answerEn: 'South America' },
  { id: 'geo-g02', categoryId: 'geography', difficulty: 'easy', questionAr: 'في أي قارة تقع كينيا؟', questionEn: 'On which continent is Kenya located?', answerAr: 'إفريقيا', answerEn: 'Africa' },
  { id: 'geo-g03', categoryId: 'geography', difficulty: 'easy', questionAr: 'في أي قارة تقع اليابان؟', questionEn: 'On which continent is Japan located?', answerAr: 'آسيا', answerEn: 'Asia' },
  { id: 'geo-g04', categoryId: 'geography', difficulty: 'easy', questionAr: 'في أي قارة تقع فرنسا؟', questionEn: 'On which continent is France located?', answerAr: 'أوروبا', answerEn: 'Europe' },
  { id: 'geo-g05', categoryId: 'geography', difficulty: 'easy', questionAr: 'في أي قارة تقع كندا؟', questionEn: 'On which continent is Canada located?', answerAr: 'أمريكا الشمالية', answerEn: 'North America' },
  { id: 'geo-g06', categoryId: 'geography', difficulty: 'medium', questionAr: 'في أي قارة تقع أستراليا؟', questionEn: 'On which continent is Australia located?', answerAr: 'أستراليا', answerEn: 'Australia' },
  { id: 'geo-g07', categoryId: 'geography', difficulty: 'medium', questionAr: 'أي بحر يفصل بين إفريقيا وأوروبا؟', questionEn: 'Which sea separates Africa and Europe?', answerAr: 'البحر المتوسط', answerEn: 'Mediterranean Sea' },
  { id: 'geo-g08', categoryId: 'geography', difficulty: 'medium', questionAr: 'ما النهر الذي يمر في مصر والسودان؟', questionEn: 'Which river flows through Egypt and Sudan?', answerAr: 'النيل', answerEn: 'Nile' },
  { id: 'geo-g09', categoryId: 'geography', difficulty: 'medium', questionAr: 'ما السلسلة الجبلية الأعلى في العالم؟', questionEn: 'What is the highest mountain range in the world?', answerAr: 'الهيمالايا', answerEn: 'Himalayas' },
  { id: 'geo-g10', categoryId: 'geography', difficulty: 'medium', questionAr: 'ما الصحراء الحارة الأكبر في العالم؟', questionEn: 'What is the largest hot desert in the world?', answerAr: 'الصحراء الكبرى', answerEn: 'Sahara Desert' },
  { id: 'geo-g11', categoryId: 'geography', difficulty: 'medium', questionAr: 'ما المحيط الواقع بين إفريقيا وأستراليا؟', questionEn: 'Which ocean lies between Africa and Australia?', answerAr: 'المحيط الهندي', answerEn: 'Indian Ocean' },
  { id: 'geo-g12', categoryId: 'geography', difficulty: 'hard', questionAr: 'ما المضيق الذي يفصل بين آسيا وأمريكا الشمالية؟', questionEn: 'Which strait separates Asia and North America?', answerAr: 'مضيق بيرنغ', answerEn: 'Bering Strait' },
  { id: 'geo-g13', categoryId: 'geography', difficulty: 'hard', questionAr: 'ما الدولة المعروفة بشكل الحذاء؟', questionEn: 'Which country is famous for its boot shape?', answerAr: 'إيطاليا', answerEn: 'Italy' },
  { id: 'geo-g14', categoryId: 'geography', difficulty: 'hard', questionAr: 'ما البحيرة الأكبر مساحةً في العالم؟', questionEn: 'What is the largest lake by area in the world?', answerAr: 'بحر قزوين', answerEn: 'Caspian Sea' },
  { id: 'geo-g15', categoryId: 'geography', difficulty: 'hard', questionAr: 'ما أطول نهر في أمريكا الجنوبية؟', questionEn: 'What is the longest river in South America?', answerAr: 'الأمازون', answerEn: 'Amazon' },
  { id: 'geo-g16', categoryId: 'geography', difficulty: 'easy', questionAr: 'في أي قارة تقع الأرجنتين؟', questionEn: 'On which continent is Argentina located?', answerAr: 'أمريكا الجنوبية', answerEn: 'South America' },
  { id: 'geo-g17', categoryId: 'geography', difficulty: 'easy', questionAr: 'في أي قارة تقع نيجيريا؟', questionEn: 'On which continent is Nigeria located?', answerAr: 'إفريقيا', answerEn: 'Africa' },
  { id: 'geo-g18', categoryId: 'geography', difficulty: 'easy', questionAr: 'في أي قارة تقع تايلند؟', questionEn: 'On which continent is Thailand located?', answerAr: 'آسيا', answerEn: 'Asia' },
  { id: 'geo-g19', categoryId: 'geography', difficulty: 'easy', questionAr: 'في أي قارة تقع ألمانيا؟', questionEn: 'On which continent is Germany located?', answerAr: 'أوروبا', answerEn: 'Europe' },
  { id: 'geo-g20', categoryId: 'geography', difficulty: 'easy', questionAr: 'في أي قارة تقع المكسيك؟', questionEn: 'On which continent is Mexico located?', answerAr: 'أمريكا الشمالية', answerEn: 'North America' },
  { id: 'geo-g21', categoryId: 'geography', difficulty: 'medium', questionAr: 'ما البحر الذي تقع عليه مدينة جدة؟', questionEn: 'Which sea is Jeddah located on?', answerAr: 'البحر الأحمر', answerEn: 'Red Sea' },
  { id: 'geo-g22', categoryId: 'geography', difficulty: 'medium', questionAr: 'ما الدولة التي تمر بقناة السويس؟', questionEn: 'Which country is home to the Suez Canal?', answerAr: 'مصر', answerEn: 'Egypt' },
  { id: 'geo-g23', categoryId: 'geography', difficulty: 'medium', questionAr: 'ما الجبل الأعلى في العالم؟', questionEn: 'What is the highest mountain in the world?', answerAr: 'إيفرست', answerEn: 'Everest' },
  { id: 'geo-g24', categoryId: 'geography', difficulty: 'medium', questionAr: 'ما الدولة الأكبر مساحةً في العالم؟', questionEn: 'What is the largest country in the world by area?', answerAr: 'روسيا', answerEn: 'Russia' },
  { id: 'geo-g25', categoryId: 'geography', difficulty: 'medium', questionAr: 'ما الجزيرة الأكبر في العالم؟', questionEn: 'What is the largest island in the world?', answerAr: 'غرينلاند', answerEn: 'Greenland' },
  { id: 'geo-g26', categoryId: 'geography', difficulty: 'hard', questionAr: 'ما العاصمة الأعلى ارتفاعًا في العالم من العواصم الكبرى؟', questionEn: 'Which major capital city is among the highest above sea level?', answerAr: 'لاباز', answerEn: 'La Paz' },
  { id: 'geo-g27', categoryId: 'geography', difficulty: 'hard', questionAr: 'ما البحر الميت: بحر أم بحيرة؟', questionEn: 'The Dead Sea is technically a sea or a lake?', answerAr: 'بحيرة', answerEn: 'Lake' },
  { id: 'geo-g28', categoryId: 'geography', difficulty: 'hard', questionAr: 'ما المضيق الذي يربط الخليج العربي بخليج عمان؟', questionEn: 'Which strait connects the Arabian Gulf to the Gulf of Oman?', answerAr: 'مضيق هرمز', answerEn: 'Strait of Hormuz' },
  { id: 'geo-g29', categoryId: 'geography', difficulty: 'hard', questionAr: 'ما المدينة التي تُعرف بمدينة الضباب؟', questionEn: 'Which city is known as the city of fog?', answerAr: 'لندن', answerEn: 'London' },
  { id: 'geo-g30', categoryId: 'geography', difficulty: 'hard', questionAr: 'ما النهر الذي يمر في بغداد؟', questionEn: 'Which river flows through Baghdad?', answerAr: 'دجلة', answerEn: 'Tigris' },
];

const animalsSeeds: PromptAnswerSeed[] = [
  { id: 'animals-g01', categoryId: 'animals', difficulty: 'easy', questionAr: 'كم عدد أرجل العنكبوت؟', questionEn: 'How many legs does a spider have?', answerAr: 'ثمانية', answerEn: 'Eight' },
  { id: 'animals-g02', categoryId: 'animals', difficulty: 'easy', questionAr: 'ما أطول حيوان بري في العالم؟', questionEn: 'What is the tallest land animal in the world?', answerAr: 'الزرافة', answerEn: 'Giraffe' },
  { id: 'animals-g03', categoryId: 'animals', difficulty: 'easy', questionAr: 'أي حيوان معروف بخراطيمه الطويلة؟', questionEn: 'Which animal is known for its long trunk?', answerAr: 'الفيل', answerEn: 'Elephant' },
  { id: 'animals-g04', categoryId: 'animals', difficulty: 'easy', questionAr: 'أي طائر لا يستطيع الطيران ويعيش في القطب الجنوبي؟', questionEn: 'Which bird cannot fly and lives in Antarctica?', answerAr: 'البطريق', answerEn: 'Penguin' },
  { id: 'animals-g05', categoryId: 'animals', difficulty: 'easy', questionAr: 'أي حيوان يُنتج الصوف؟', questionEn: 'Which animal produces wool?', answerAr: 'الخروف', answerEn: 'Sheep' },
  { id: 'animals-g06', categoryId: 'animals', difficulty: 'medium', questionAr: 'كم قلبًا يملك الأخطبوط؟', questionEn: 'How many hearts does an octopus have?', answerAr: 'ثلاثة', answerEn: 'Three' },
  { id: 'animals-g07', categoryId: 'animals', difficulty: 'medium', questionAr: 'أي حيوان ثديي يضع البيض؟', questionEn: 'Which mammal lays eggs?', answerAr: 'منقار البط', answerEn: 'Platypus' },
  { id: 'animals-g08', categoryId: 'animals', difficulty: 'medium', questionAr: 'أي حيوان يُعرف بأنه الأسرع على اليابسة؟', questionEn: 'Which animal is known as the fastest on land?', answerAr: 'الفهد', answerEn: 'Cheetah' },
  { id: 'animals-g09', categoryId: 'animals', difficulty: 'medium', questionAr: 'ما اسم صغير الضفدع قبل اكتمال نموه؟', questionEn: 'What is a baby frog called before it fully develops?', answerAr: 'شرغوف', answerEn: 'Tadpole' },
  { id: 'animals-g10', categoryId: 'animals', difficulty: 'medium', questionAr: 'أي حيوان له بصمات تشبه بصمات الإنسان؟', questionEn: 'Which animal has fingerprints similar to humans?', answerAr: 'الكوالا', answerEn: 'Koala' },
  { id: 'animals-g11', categoryId: 'animals', difficulty: 'hard', questionAr: 'ما اسم أضخم حيوان معروف في العالم؟', questionEn: 'What is the largest known animal in the world?', answerAr: 'الحوت الأزرق', answerEn: 'Blue whale' },
  { id: 'animals-g12', categoryId: 'animals', difficulty: 'hard', questionAr: 'أي حيوان يستطيع تغيير لون جلده للتمويه؟', questionEn: 'Which animal can change its skin color for camouflage?', answerAr: 'الحرباء', answerEn: 'Chameleon' },
  { id: 'animals-g13', categoryId: 'animals', difficulty: 'hard', questionAr: 'ما اسم المجموعة التي تنتمي إليها الحيتان والدلافين؟', questionEn: 'What group do whales and dolphins belong to?', answerAr: 'الثدييات', answerEn: 'Mammals' },
  { id: 'animals-g14', categoryId: 'animals', difficulty: 'hard', questionAr: 'أي حيوان يعيش في الصحراء ويمكنه تحمل العطش طويلًا؟', questionEn: 'Which animal lives in the desert and can endure thirst for a long time?', answerAr: 'الجمل', answerEn: 'Camel' },
  { id: 'animals-g15', categoryId: 'animals', difficulty: 'easy', questionAr: 'أي حيوان مشهور ببنائه للسدود في الأنهار؟', questionEn: 'Which animal is famous for building dams in rivers?', answerAr: 'القندس', answerEn: 'Beaver' },
  { id: 'animals-g16', categoryId: 'animals', difficulty: 'medium', questionAr: 'أي حيوان يُعرف ببطئه الشديد ويعيش على الأشجار في أمريكا الجنوبية؟', questionEn: 'Which animal is known for its extreme slowness and lives in trees in South America?', answerAr: 'الكسلان', answerEn: 'Sloth' },
  { id: 'animals-g17', categoryId: 'animals', difficulty: 'hard', questionAr: 'ما اسم الطبقة التي تغطي جسم الطيور وتساعدها على الطيران؟', questionEn: 'What is the layer that covers birds’ bodies and helps them fly?', answerAr: 'الريش', answerEn: 'Feathers' },
];

const spaceSeeds: PromptAnswerSeed[] = [
  { id: 'space-g01', categoryId: 'space', difficulty: 'easy', questionAr: 'كم عدد كواكب المجموعة الشمسية؟', questionEn: 'How many planets are in the solar system?', answerAr: 'ثمانية', answerEn: 'Eight' },
  { id: 'space-g02', categoryId: 'space', difficulty: 'easy', questionAr: 'ما اسم القمر الطبيعي للأرض؟', questionEn: 'What is Earth’s natural moon called?', answerAr: 'القمر', answerEn: 'Moon' },
  { id: 'space-g03', categoryId: 'space', difficulty: 'easy', questionAr: 'أي كوكب يُعرف بالكوكب الأحمر؟', questionEn: 'Which planet is known as the Red Planet?', answerAr: 'المريخ', answerEn: 'Mars' },
  { id: 'space-g04', categoryId: 'space', difficulty: 'easy', questionAr: 'ما النجم الذي يدور حوله كوكب الأرض؟', questionEn: 'Which star does Earth orbit?', answerAr: 'الشمس', answerEn: 'Sun' },
  { id: 'space-g05', categoryId: 'space', difficulty: 'easy', questionAr: 'أي كوكب مشهور بحلقاته؟', questionEn: 'Which planet is famous for its rings?', answerAr: 'زحل', answerEn: 'Saturn' },
  { id: 'space-g06', categoryId: 'space', difficulty: 'medium', questionAr: 'كم قمرًا يملك كوكب المريخ؟', questionEn: 'How many moons does Mars have?', answerAr: 'اثنان', answerEn: 'Two' },
  { id: 'space-g07', categoryId: 'space', difficulty: 'medium', questionAr: 'ما أقرب كوكب إلى الشمس؟', questionEn: 'Which planet is closest to the Sun?', answerAr: 'عطارد', answerEn: 'Mercury' },
  { id: 'space-g08', categoryId: 'space', difficulty: 'medium', questionAr: 'أي كوكب هو الأكبر في المجموعة الشمسية؟', questionEn: 'Which planet is the largest in the solar system?', answerAr: 'المشتري', answerEn: 'Jupiter' },
  { id: 'space-g09', categoryId: 'space', difficulty: 'medium', questionAr: 'ما اسم أول إنسان سار على سطح القمر؟', questionEn: 'Who was the first human to walk on the Moon?', answerAr: 'نيل آرمسترونغ', answerEn: 'Neil Armstrong' },
  { id: 'space-g10', categoryId: 'space', difficulty: 'medium', questionAr: 'ما الوحدة التي تُستخدم لقياس المسافات بين النجوم غالبًا؟', questionEn: 'Which unit is commonly used to measure distances between stars?', answerAr: 'السنة الضوئية', answerEn: 'Light-year' },
  { id: 'space-g11', categoryId: 'space', difficulty: 'hard', questionAr: 'أي كوكب يُعد الأكثر سخونة في المجموعة الشمسية؟', questionEn: 'Which planet is the hottest in the solar system?', answerAr: 'الزهرة', answerEn: 'Venus' },
  { id: 'space-g12', categoryId: 'space', difficulty: 'hard', questionAr: 'ما اسم المجرة التي ينتمي إليها نظامنا الشمسي؟', questionEn: 'What is the name of the galaxy that contains our solar system?', answerAr: 'درب التبانة', answerEn: 'Milky Way' },
  { id: 'space-g13', categoryId: 'space', difficulty: 'hard', questionAr: 'ما اسم القوة التي تُبقي الكواكب في مداراتها؟', questionEn: 'What force keeps planets in their orbits?', answerAr: 'الجاذبية', answerEn: 'Gravity' },
  { id: 'space-g14', categoryId: 'space', difficulty: 'hard', questionAr: 'كم كوكبًا قزمًا معترفًا به رسميًا في المجموعة الشمسية؟', questionEn: 'How many officially recognized dwarf planets are in the solar system?', answerAr: 'خمسة', answerEn: 'Five' },
  { id: 'space-g15', categoryId: 'space', difficulty: 'easy', questionAr: 'ما الجسم الذي يدور حول الأرض ويسبب المد والجزر؟', questionEn: 'What body orbits Earth and influences the tides?', answerAr: 'القمر', answerEn: 'Moon' },
  { id: 'space-g16', categoryId: 'space', difficulty: 'medium', questionAr: 'ما اسم الجهاز الذي يستخدمه العلماء لرصد النجوم والكواكب من الأرض؟', questionEn: 'What is the device scientists use from Earth to observe stars and planets?', answerAr: 'التلسكوب', answerEn: 'Telescope' },
  { id: 'space-g17', categoryId: 'space', difficulty: 'hard', questionAr: 'ما اسم الظاهرة التي يحدث فيها اختفاء ضوء الشمس كليًا أو جزئيًا بسبب القمر؟', questionEn: 'What is the phenomenon called when the Sun’s light is totally or partially blocked by the Moon?', answerAr: 'كسوف الشمس', answerEn: 'Solar eclipse' },
];

const historySeeds: PromptAnswerSeed[] = [
  { id: 'history-g01', categoryId: 'history', difficulty: 'easy', questionAr: 'من بنى الأهرامات الشهيرة في مصر؟', questionEn: 'Who built the famous pyramids in Egypt?', answerAr: 'الفراعنة', answerEn: 'Pharaohs' },
  { id: 'history-g02', categoryId: 'history', difficulty: 'easy', questionAr: 'في أي دولة يقع سور الصين العظيم؟', questionEn: 'In which country is the Great Wall located?', answerAr: 'الصين', answerEn: 'China' },
  { id: 'history-g03', categoryId: 'history', difficulty: 'easy', questionAr: 'من الرحالة الذي يُنسب إليه الوصول إلى أمريكا عام 1492؟', questionEn: 'Which explorer is credited with reaching the Americas in 1492?', answerAr: 'كريستوفر كولومبوس', answerEn: 'Christopher Columbus' },
  { id: 'history-g04', categoryId: 'history', difficulty: 'easy', questionAr: 'أي حضارة قديمة اشتهرت بالكتابة الهيروغليفية؟', questionEn: 'Which ancient civilization was famous for hieroglyphic writing?', answerAr: 'المصرية القديمة', answerEn: 'Ancient Egypt' },
  { id: 'history-g05', categoryId: 'history', difficulty: 'easy', questionAr: 'في أي مدينة توجد الكولوسيوم الشهير؟', questionEn: 'In which city is the famous Colosseum located?', answerAr: 'روما', answerEn: 'Rome' },
  { id: 'history-g06', categoryId: 'history', difficulty: 'medium', questionAr: 'في أي سنة بدأت الحرب العالمية الثانية؟', questionEn: 'In what year did World War II begin?', answerAr: '1939', answerEn: '1939' },
  { id: 'history-g07', categoryId: 'history', difficulty: 'medium', questionAr: 'في أي سنة سقطت القسطنطينية؟', questionEn: 'In what year did Constantinople fall?', answerAr: '1453', answerEn: '1453' },
  { id: 'history-g08', categoryId: 'history', difficulty: 'medium', questionAr: 'من أول إمبراطور روماني؟', questionEn: 'Who was the first Roman emperor?', answerAr: 'أوغسطس', answerEn: 'Augustus' },
  { id: 'history-g09', categoryId: 'history', difficulty: 'medium', questionAr: 'ما اسم السفينة التي اشتهرت بغرقها عام 1912؟', questionEn: 'What is the name of the ship famous for sinking in 1912?', answerAr: 'تيتانيك', answerEn: 'Titanic' },
  { id: 'history-g10', categoryId: 'history', difficulty: 'medium', questionAr: 'أي حضارة ارتبطت بالكتابة المسمارية؟', questionEn: 'Which civilization is associated with cuneiform writing?', answerAr: 'السومرية', answerEn: 'Sumerian' },
  { id: 'history-g11', categoryId: 'history', difficulty: 'hard', questionAr: 'في أي سنة سقط جدار برلين؟', questionEn: 'In what year did the Berlin Wall fall?', answerAr: '1989', answerEn: '1989' },
  { id: 'history-g12', categoryId: 'history', difficulty: 'hard', questionAr: 'كم استمرت حرب المئة عام تقريبًا؟', questionEn: 'How long did the Hundred Years’ War last approximately?', answerAr: '116 سنة', answerEn: '116 years' },
  { id: 'history-g13', categoryId: 'history', difficulty: 'hard', questionAr: 'في أي سنة انهارت الإمبراطورية الرومانية الغربية؟', questionEn: 'In what year did the Western Roman Empire collapse?', answerAr: '476', answerEn: '476' },
  { id: 'history-g14', categoryId: 'history', difficulty: 'hard', questionAr: 'ما اسم العصر الأوروبي الذي ازدهرت فيه الفنون والعلوم بعد العصور الوسطى؟', questionEn: 'What is the European era called in which arts and sciences flourished after the Middle Ages?', answerAr: 'عصر النهضة', answerEn: 'Renaissance' },
];

const inventionsSeeds: PromptAnswerSeed[] = [
  { id: 'invent-g01', categoryId: 'inventions', difficulty: 'easy', questionAr: 'من اخترع الهاتف؟', questionEn: 'Who invented the telephone?', answerAr: 'غراهام بيل', answerEn: 'Graham Bell' },
  { id: 'invent-g02', categoryId: 'inventions', difficulty: 'easy', questionAr: 'من اخترع المصباح الكهربائي العملي؟', questionEn: 'Who invented the practical electric light bulb?', answerAr: 'توماس إديسون', answerEn: 'Thomas Edison' },
  { id: 'invent-g03', categoryId: 'inventions', difficulty: 'easy', questionAr: 'من اخترع الطائرة؟', questionEn: 'Who invented the airplane?', answerAr: 'الأخوان رايت', answerEn: 'Wright brothers' },
  { id: 'invent-g04', categoryId: 'inventions', difficulty: 'easy', questionAr: 'من اخترع الراديو؟', questionEn: 'Who invented the radio?', answerAr: 'ماركوني', answerEn: 'Marconi' },
  { id: 'invent-g05', categoryId: 'inventions', difficulty: 'easy', questionAr: 'من اخترع السيارة العملية الأولى؟', questionEn: 'Who invented the first practical car?', answerAr: 'كارل بنز', answerEn: 'Karl Benz' },
  { id: 'invent-g06', categoryId: 'inventions', difficulty: 'medium', questionAr: 'من اخترع الطباعة بالحروف المتحركة؟', questionEn: 'Who invented movable-type printing?', answerAr: 'غوتنبرغ', answerEn: 'Gutenberg' },
  { id: 'invent-g07', categoryId: 'inventions', difficulty: 'medium', questionAr: 'من اخترع البطارية الكهربائية الأولى؟', questionEn: 'Who invented the first electric battery?', answerAr: 'أليساندرو فولتا', answerEn: 'Alessandro Volta' },
  { id: 'invent-g08', categoryId: 'inventions', difficulty: 'medium', questionAr: 'من صمّم أول حاسوب ميكانيكي مشهور؟', questionEn: 'Who designed the famous first mechanical computer?', answerAr: 'تشارلز بابيج', answerEn: 'Charles Babbage' },
  { id: 'invent-g09', categoryId: 'inventions', difficulty: 'medium', questionAr: 'من اخترع الميكروسكوب الشهير بصورته المبكرة؟', questionEn: 'Who is commonly credited in the early development of the microscope?', answerAr: 'ليفينهوك', answerEn: 'Leeuwenhoek' },
  { id: 'invent-g10', categoryId: 'inventions', difficulty: 'medium', questionAr: 'من اخترع الديناميت؟', questionEn: 'Who invented dynamite?', answerAr: 'ألفريد نوبل', answerEn: 'Alfred Nobel' },
  { id: 'invent-g11', categoryId: 'inventions', difficulty: 'hard', questionAr: 'من اخترع إشارة المرور الكهربائية؟', questionEn: 'Who invented the electric traffic signal?', answerAr: 'جيمس هوج', answerEn: 'James Hoge' },
  { id: 'invent-g12', categoryId: 'inventions', difficulty: 'hard', questionAr: 'من اخترع التلغراف العملي؟', questionEn: 'Who invented the practical telegraph?', answerAr: 'صمويل مورس', answerEn: 'Samuel Morse' },
  { id: 'invent-g13', categoryId: 'inventions', difficulty: 'hard', questionAr: 'من اخترع الترمومتر بصورته المبكرة؟', questionEn: 'Who is associated with the early invention of the thermometer?', answerAr: 'غاليليو', answerEn: 'Galileo' },
  { id: 'invent-g14', categoryId: 'inventions', difficulty: 'hard', questionAr: 'ما الاختراع الذي يرتبط باسم يوهانس غوتنبرغ أكثر من غيره؟', questionEn: 'Which invention is most associated with Johannes Gutenberg?', answerAr: 'المطبعة', answerEn: 'Printing press' },
  { id: 'invent-g15', categoryId: 'inventions', difficulty: 'easy', questionAr: 'من اخترع الإنترنت بصورته الحديثة التشاركية؟', questionEn: 'Who invented the World Wide Web?', answerAr: 'تيم برنرز لي', answerEn: 'Tim Berners-Lee' },
  { id: 'invent-g16', categoryId: 'inventions', difficulty: 'medium', questionAr: 'من اخترع آلة الخياطة العملية المبكرة المشهورة؟', questionEn: 'Who invented the famous early practical sewing machine?', answerAr: 'إلياس هاو', answerEn: 'Elias Howe' },
  { id: 'invent-g17', categoryId: 'inventions', difficulty: 'hard', questionAr: 'من اخترع الورق في الحضارة الصينية القديمة؟', questionEn: 'Who is traditionally credited with inventing paper in ancient China?', answerAr: 'تساي لون', answerEn: 'Cai Lun' },
];

const riddlesSeeds: PromptAnswerSeed[] = [
  { id: 'riddles-g01', categoryId: 'riddles', difficulty: 'easy', questionAr: 'ما الشيء الذي إذا أخذت منه زاد وكبر؟', questionEn: 'What becomes bigger the more you take away from it?', answerAr: 'الحفرة', answerEn: 'Hole' },
  { id: 'riddles-g02', categoryId: 'riddles', difficulty: 'easy', questionAr: 'ما الشيء الذي له أسنان ولا يعض؟', questionEn: 'What has teeth but does not bite?', answerAr: 'المشط', answerEn: 'Comb' },
  { id: 'riddles-g03', categoryId: 'riddles', difficulty: 'easy', questionAr: 'ما الشيء الذي يكتب ولا يقرأ؟', questionEn: 'What writes but cannot read?', answerAr: 'القلم', answerEn: 'Pen' },
  { id: 'riddles-g04', categoryId: 'riddles', difficulty: 'easy', questionAr: 'ما الشيء الذي كلما سار فقد جزءًا من ذيله؟', questionEn: 'What loses part of its tail the more it moves?', answerAr: 'الإبرة والخيط', answerEn: 'Needle and thread' },
  { id: 'riddles-g05', categoryId: 'riddles', difficulty: 'easy', questionAr: 'ما الشيء الذي يحملك وتحمله في الوقت نفسه؟', questionEn: 'What carries you while you carry it at the same time?', answerAr: 'الحذاء', answerEn: 'Shoe' },
  { id: 'riddles-g06', categoryId: 'riddles', difficulty: 'medium', questionAr: 'ما الشيء الذي إذا لمسته صاح؟', questionEn: 'What screams when you touch it?', answerAr: 'الجرس', answerEn: 'Bell' },
  { id: 'riddles-g07', categoryId: 'riddles', difficulty: 'medium', questionAr: 'ما الشيء الذي يدخل الماء ولا يبتل؟', questionEn: 'What goes into water and never gets wet?', answerAr: 'الضوء', answerEn: 'Light' },
  { id: 'riddles-g08', categoryId: 'riddles', difficulty: 'medium', questionAr: 'ما الشيء الذي له أوراق وليس شجرة؟', questionEn: 'What has leaves but is not a tree?', answerAr: 'الكتاب', answerEn: 'Book' },
  { id: 'riddles-g09', categoryId: 'riddles', difficulty: 'medium', questionAr: 'ما الشيء الذي يمكن كسره دون أن يُلمس؟', questionEn: 'What can be broken without being touched?', answerAr: 'الوعد', answerEn: 'Promise' },
  { id: 'riddles-g10', categoryId: 'riddles', difficulty: 'medium', questionAr: 'ما الشيء الذي له مفتاح لكن لا يفتح بابًا؟', questionEn: 'What has a key but opens no door?', answerAr: 'الخريطة', answerEn: 'Map key' },
  { id: 'riddles-g11', categoryId: 'riddles', difficulty: 'hard', questionAr: 'ما الشيء الذي تراه في الليل ثلاث مرات وفي النهار مرة واحدة؟', questionEn: 'What do you see three times in the night and once in the day?', answerAr: 'حرف اللام', answerEn: 'The letter L' },
  { id: 'riddles-g12', categoryId: 'riddles', difficulty: 'hard', questionAr: 'ما الشيء الذي يجري بلا أرجل ويبكي بلا عيون؟', questionEn: 'What runs without legs and cries without eyes?', answerAr: 'السحاب', answerEn: 'Cloud' },
  { id: 'riddles-g13', categoryId: 'riddles', difficulty: 'hard', questionAr: 'ما الشيء الذي إذا ذكرته مات؟', questionEn: 'What dies if you mention it?', answerAr: 'الصمت', answerEn: 'Silence' },
  { id: 'riddles-g14', categoryId: 'riddles', difficulty: 'hard', questionAr: 'ما الشيء الذي يكون أخضر في الأرض وأسود في السوق وأحمر في البيت؟', questionEn: 'What is green in the field, black in the market, and red at home?', answerAr: 'الشاي', answerEn: 'Tea' },
  { id: 'riddles-g15', categoryId: 'riddles', difficulty: 'easy', questionAr: 'ما الشيء الذي نأكل منه ولا يؤكل؟', questionEn: 'What do we eat from but do not eat itself?', answerAr: 'الطبق', answerEn: 'Plate' },
  { id: 'riddles-g16', categoryId: 'riddles', difficulty: 'medium', questionAr: 'ما الشيء الذي له باب واحد وأربع نوافذ؟', questionEn: 'What has one door and four windows?', answerAr: 'السيارة', answerEn: 'Car' },
  { id: 'riddles-g17', categoryId: 'riddles', difficulty: 'hard', questionAr: 'ما الشيء الذي كلما زاد نقص؟', questionEn: 'What decreases the more it increases?', answerAr: 'العمر', answerEn: 'Age' },
];

const musicSeeds: PromptAnswerSeed[] = [
  { id: 'music-g01', categoryId: 'music', difficulty: 'easy', questionAr: 'كم عدد أوتار الجيتار الكلاسيكي؟', questionEn: 'How many strings does a classical guitar have?', answerAr: 'ستة', answerEn: 'Six' },
  { id: 'music-g02', categoryId: 'music', difficulty: 'easy', questionAr: 'أي آلة موسيقية لها مفاتيح سوداء وبيضاء؟', questionEn: 'Which instrument has black and white keys?', answerAr: 'البيانو', answerEn: 'Piano' },
  { id: 'music-g03', categoryId: 'music', difficulty: 'easy', questionAr: 'كم وترًا في آلة الكمان التقليدية؟', questionEn: 'How many strings does a traditional violin have?', answerAr: 'أربعة', answerEn: 'Four' },
  { id: 'music-g04', categoryId: 'music', difficulty: 'easy', questionAr: 'أي آلة موسيقية تُنفخ فيها لإخراج الصوت؟', questionEn: 'Which instrument is played by blowing air into it?', answerAr: 'الناي', answerEn: 'Flute' },
  { id: 'music-g05', categoryId: 'music', difficulty: 'easy', questionAr: 'أي آلة إيقاعية تُستخدم بالضرب عليها باليد؟', questionEn: 'Which percussion instrument is played by striking it with the hands?', answerAr: 'الطبلة', answerEn: 'Drum' },
  { id: 'music-g06', categoryId: 'music', difficulty: 'medium', questionAr: 'من ألّف السيمفونية التاسعة الشهيرة؟', questionEn: 'Who composed the famous Symphony No. 9?', answerAr: 'بيتهوفن', answerEn: 'Beethoven' },
  { id: 'music-g07', categoryId: 'music', difficulty: 'medium', questionAr: 'ما المفتاح الموسيقي الأكثر شيوعًا للنغمات العالية؟', questionEn: 'Which clef is most commonly used for higher notes?', answerAr: 'مفتاح صول', answerEn: 'Treble clef' },
  { id: 'music-g08', categoryId: 'music', difficulty: 'medium', questionAr: 'كم حركة في “الفصول الأربعة” لفيفالدي؟', questionEn: 'How many concertos are in Vivaldi’s The Four Seasons?', answerAr: 'أربعة', answerEn: 'Four' },
  { id: 'music-g09', categoryId: 'music', difficulty: 'medium', questionAr: 'ما اسم الإيقاع الموسيقي السريع جدًا؟', questionEn: 'What is the name of a very fast musical tempo?', answerAr: 'بريستيسيمو', answerEn: 'Prestissimo' },
  { id: 'music-g10', categoryId: 'music', difficulty: 'medium', questionAr: 'أي آلة عربية وترية مشهورة تُعزف بالريشة؟', questionEn: 'Which famous Arabic string instrument is played with a plectrum?', answerAr: 'العود', answerEn: 'Oud' },
  { id: 'music-g11', categoryId: 'music', difficulty: 'hard', questionAr: 'كم سمفونية أكملها بيتهوفن؟', questionEn: 'How many symphonies did Beethoven complete?', answerAr: 'تسع', answerEn: 'Nine' },
  { id: 'music-g12', categoryId: 'music', difficulty: 'hard', questionAr: 'ما اسم العائلة الموسيقية التي تنتمي إليها الكلارينيت؟', questionEn: 'Which instrument family does the clarinet belong to?', answerAr: 'النفخ الخشبي', answerEn: 'Woodwind' },
  { id: 'music-g13', categoryId: 'music', difficulty: 'hard', questionAr: 'أي مؤلف ارتبط اسمه بقطعة “بحيرة البجع”؟', questionEn: 'Which composer is associated with Swan Lake?', answerAr: 'تشايكوفسكي', answerEn: 'Tchaikovsky' },
  { id: 'music-g14', categoryId: 'music', difficulty: 'hard', questionAr: 'ما اسم المدى الصوتي النسائي الأعلى عادة؟', questionEn: 'What is the highest common female vocal range called?', answerAr: 'سوبرانو', answerEn: 'Soprano' },
  { id: 'music-g15', categoryId: 'music', difficulty: 'easy', questionAr: 'أي آلة موسيقية يُنفخ فيها ولها ثقوب للأصابع؟', questionEn: 'Which instrument is blown into and has finger holes?', answerAr: 'المزمار', answerEn: 'Recorder' },
  { id: 'music-g16', categoryId: 'music', difficulty: 'medium', questionAr: 'أي آلة تصدر الصوت من اهتزاز أوتار داخل صندوق خشبي عند الضغط على المفاتيح؟', questionEn: 'Which instrument produces sound from vibrating strings inside a wooden case when keys are pressed?', answerAr: 'البيانو', answerEn: 'Piano' },
  { id: 'music-g17', categoryId: 'music', difficulty: 'hard', questionAr: 'ما اسم العلامة الموسيقية التي تدل على الصمت؟', questionEn: 'What is the musical symbol that indicates silence called?', answerAr: 'السكتة', answerEn: 'Rest' },
];

const generalSeeds: PromptAnswerSeed[] = [
  { id: 'gk-g01', categoryId: 'generalKnowledge', difficulty: 'easy', questionAr: 'كم يومًا في الأسبوع؟', questionEn: 'How many days are there in a week?', answerAr: '7', answerEn: '7' },
  { id: 'gk-g02', categoryId: 'generalKnowledge', difficulty: 'easy', questionAr: 'كم شهرًا في السنة؟', questionEn: 'How many months are there in a year?', answerAr: '12', answerEn: '12' },
  { id: 'gk-g03', categoryId: 'generalKnowledge', difficulty: 'easy', questionAr: 'ما الكوكب الذي نعيش عليه؟', questionEn: 'Which planet do we live on?', answerAr: 'الأرض', answerEn: 'Earth' },
  { id: 'gk-g04', categoryId: 'generalKnowledge', difficulty: 'easy', questionAr: 'ما لون السماء غالبًا في النهار؟', questionEn: 'What color is the sky usually during the day?', answerAr: 'أزرق', answerEn: 'Blue' },
  { id: 'gk-g05', categoryId: 'generalKnowledge', difficulty: 'easy', questionAr: 'ما الحيوان المعروف بملك الغابة؟', questionEn: 'Which animal is known as the king of the jungle?', answerAr: 'الأسد', answerEn: 'Lion' },
  { id: 'gk-g06', categoryId: 'generalKnowledge', difficulty: 'medium', questionAr: 'ما المعدن المستخدم غالبًا في الأسلاك الكهربائية؟', questionEn: 'Which metal is commonly used in electrical wires?', answerAr: 'النحاس', answerEn: 'Copper' },
  { id: 'gk-g07', categoryId: 'generalKnowledge', difficulty: 'medium', questionAr: 'ما الكوكب الأكبر في المجموعة الشمسية؟', questionEn: 'What is the largest planet in the solar system?', answerAr: 'المشتري', answerEn: 'Jupiter' },
  { id: 'gk-g08', categoryId: 'generalKnowledge', difficulty: 'medium', questionAr: 'ما الدولة المشهورة بأهرامات الجيزة؟', questionEn: 'Which country is famous for the Pyramids of Giza?', answerAr: 'مصر', answerEn: 'Egypt' },
  { id: 'gk-g09', categoryId: 'generalKnowledge', difficulty: 'medium', questionAr: 'ما الحيوان الذي يُسمى سفينة الصحراء؟', questionEn: 'Which animal is called the ship of the desert?', answerAr: 'الجمل', answerEn: 'Camel' },
  { id: 'gk-g10', categoryId: 'generalKnowledge', difficulty: 'medium', questionAr: 'ما المادة التي يكتب بها القلم الرصاص؟', questionEn: 'What material is inside a pencil?', answerAr: 'الغرافيت', answerEn: 'Graphite' },
  { id: 'gk-g11', categoryId: 'generalKnowledge', difficulty: 'medium', questionAr: 'ما الغاز الذي نتنفسه للبقاء؟', questionEn: 'Which gas do we breathe to stay alive?', answerAr: 'الأكسجين', answerEn: 'Oxygen' },
  { id: 'gk-g12', categoryId: 'generalKnowledge', difficulty: 'medium', questionAr: 'ما أداة القياس المستخدمة لمعرفة الوقت؟', questionEn: 'Which instrument is used to tell time?', answerAr: 'الساعة', answerEn: 'Clock' },
  { id: 'gk-g13', categoryId: 'generalKnowledge', difficulty: 'hard', questionAr: 'ما الرمز الكيميائي للذهب؟', questionEn: 'What is the chemical symbol for gold?', answerAr: 'Au', answerEn: 'Au' },
  { id: 'gk-g14', categoryId: 'generalKnowledge', difficulty: 'hard', questionAr: 'ما اللغة الأكثر انتشارًا من حيث الناطقين الأصليين؟', questionEn: 'Which language has the most native speakers?', answerAr: 'الصينية', answerEn: 'Chinese' },
  { id: 'gk-g15', categoryId: 'generalKnowledge', difficulty: 'hard', questionAr: 'ما اسم العلم الذي يدرس النجوم والكواكب؟', questionEn: 'What is the science that studies stars and planets?', answerAr: 'علم الفلك', answerEn: 'Astronomy' },
  { id: 'gk-g16', categoryId: 'generalKnowledge', difficulty: 'hard', questionAr: 'ما المادة التي يتكون منها الماس؟', questionEn: 'What substance is diamond made of?', answerAr: 'الكربون', answerEn: 'Carbon' },
  { id: 'gk-g17', categoryId: 'generalKnowledge', difficulty: 'hard', questionAr: 'ما البحر الذي لا توجد فيه أسماك كثيرة بسبب ملوحته العالية؟', questionEn: 'Which sea has very few fish because of its extreme salinity?', answerAr: 'البحر الميت', answerEn: 'Dead Sea' },
  { id: 'gk-g18', categoryId: 'generalKnowledge', difficulty: 'hard', questionAr: 'ما الجزء الذي يربط الرأس بالجسم؟', questionEn: 'What body part connects the head to the body?', answerAr: 'العنق', answerEn: 'Neck' },
  { id: 'gk-g19', categoryId: 'generalKnowledge', difficulty: 'easy', questionAr: 'ما اللون الناتج عن خلط الأزرق والأصفر؟', questionEn: 'What color do blue and yellow make?', answerAr: 'أخضر', answerEn: 'Green' },
  { id: 'gk-g20', categoryId: 'generalKnowledge', difficulty: 'easy', questionAr: 'كم ساعة في اليوم؟', questionEn: 'How many hours are there in a day?', answerAr: '24', answerEn: '24' },
  { id: 'gk-g21', categoryId: 'generalKnowledge', difficulty: 'medium', questionAr: 'ما اسم الغاز المستخدم في نفخ البالونات الطائرة غالبًا؟', questionEn: 'Which gas is commonly used to fill floating balloons?', answerAr: 'الهيليوم', answerEn: 'Helium' },
  { id: 'gk-g22', categoryId: 'generalKnowledge', difficulty: 'medium', questionAr: 'ما العملة المستخدمة في اليابان؟', questionEn: 'What currency is used in Japan?', answerAr: 'الين', answerEn: 'Yen' },
  { id: 'gk-g23', categoryId: 'generalKnowledge', difficulty: 'medium', questionAr: 'ما الشيء الذي يحيط بالأرض ويحميها من بعض الأشعة؟', questionEn: 'What surrounds Earth and helps protect it from some radiation?', answerAr: 'الغلاف الجوي', answerEn: 'Atmosphere' },
  { id: 'gk-g24', categoryId: 'generalKnowledge', difficulty: 'medium', questionAr: 'ما أداة الإضاءة المحمولة الشائعة؟', questionEn: 'What is a common portable lighting tool?', answerAr: 'المصباح اليدوي', answerEn: 'Flashlight' },
  { id: 'gk-g25', categoryId: 'generalKnowledge', difficulty: 'hard', questionAr: 'ما اسم العملية التي تتحول بها المادة الصلبة إلى سائلة؟', questionEn: 'What is the process called when a solid becomes a liquid?', answerAr: 'الانصهار', answerEn: 'Melting' },
  { id: 'gk-g26', categoryId: 'generalKnowledge', difficulty: 'hard', questionAr: 'ما الحيوان الذي يُعرف بامتلاكه ذاكرة قوية جدًا في الأمثال؟', questionEn: 'Which animal is proverbially known for a very strong memory?', answerAr: 'الفيل', answerEn: 'Elephant' },
  { id: 'gk-g27', categoryId: 'generalKnowledge', difficulty: 'hard', questionAr: 'ما اسم أصغر عظمة في جسم الإنسان؟', questionEn: 'What is the smallest bone in the human body?', answerAr: 'عظمة الركاب', answerEn: 'Stapes' },
  { id: 'gk-g28', categoryId: 'generalKnowledge', difficulty: 'easy', questionAr: 'ما الحيوان الذي يعطي الحليب غالبًا في المزارع؟', questionEn: 'Which animal commonly provides milk on farms?', answerAr: 'البقرة', answerEn: 'Cow' },
  { id: 'gk-g29', categoryId: 'generalKnowledge', difficulty: 'easy', questionAr: 'ما لون إشارات التوقف المرورية عادة؟', questionEn: 'What color are stop signs usually?', answerAr: 'أحمر', answerEn: 'Red' },
  { id: 'gk-g30', categoryId: 'generalKnowledge', difficulty: 'easy', questionAr: 'أي حاسة نستخدمها لسماع الأصوات؟', questionEn: 'Which sense do we use to hear sounds?', answerAr: 'السمع', answerEn: 'Hearing' },
];

const scienceSeeds: PromptAnswerSeed[] = [
  { id: 'sci-g01', categoryId: 'science', difficulty: 'easy', questionAr: 'أي عضو يضخ الدم في الجسم؟', questionEn: 'Which organ pumps blood in the body?', answerAr: 'القلب', answerEn: 'Heart' },
  { id: 'sci-g02', categoryId: 'science', difficulty: 'easy', questionAr: 'أي كوكب يُعرف بالكوكب الأحمر؟', questionEn: 'Which planet is known as the Red Planet?', answerAr: 'المريخ', answerEn: 'Mars' },
  { id: 'sci-g03', categoryId: 'science', difficulty: 'easy', questionAr: 'كم لونًا في قوس قزح؟', questionEn: 'How many colors are in a rainbow?', answerAr: '7', answerEn: '7' },
  { id: 'sci-g04', categoryId: 'science', difficulty: 'easy', questionAr: 'أي جزء من النبات يمتص الماء من التربة؟', questionEn: 'Which part of the plant absorbs water from the soil?', answerAr: 'الجذور', answerEn: 'Roots' },
  { id: 'sci-g05', categoryId: 'science', difficulty: 'easy', questionAr: 'في أي حالة يكون الجليد؟', questionEn: 'In what state is ice?', answerAr: 'صلبة', answerEn: 'Solid' },
  { id: 'sci-g06', categoryId: 'science', difficulty: 'medium', questionAr: 'أي غاز تتنفسه النباتات؟', questionEn: 'Which gas do plants take in?', answerAr: 'ثاني أكسيد الكربون', answerEn: 'Carbon dioxide' },
  { id: 'sci-g07', categoryId: 'science', difficulty: 'medium', questionAr: 'عند أي درجة مئوية يغلي الماء؟', questionEn: 'At what temperature does water boil in Celsius?', answerAr: '100', answerEn: '100' },
  { id: 'sci-g08', categoryId: 'science', difficulty: 'medium', questionAr: 'ما العضو المسؤول عن التفكير؟', questionEn: 'Which organ is responsible for thinking?', answerAr: 'الدماغ', answerEn: 'Brain' },
  { id: 'sci-g09', categoryId: 'science', difficulty: 'medium', questionAr: 'ما الغلاف الذي يحيط بالأرض؟', questionEn: 'What layer surrounds the Earth?', answerAr: 'الغلاف الجوي', answerEn: 'Atmosphere' },
  { id: 'sci-g10', categoryId: 'science', difficulty: 'medium', questionAr: 'أي معدن يجذب الحديد؟', questionEn: 'Which object attracts iron?', answerAr: 'المغناطيس', answerEn: 'Magnet' },
  { id: 'sci-g11', categoryId: 'science', difficulty: 'medium', questionAr: 'ما أقرب كوكب إلى الشمس؟', questionEn: 'Which planet is closest to the Sun?', answerAr: 'عطارد', answerEn: 'Mercury' },
  { id: 'sci-g12', categoryId: 'science', difficulty: 'medium', questionAr: 'ما المادة التي تحتاجها النباتات لصنع غذائها مع الماء والضوء؟', questionEn: 'What gas do plants need with water and light to make food?', answerAr: 'ثاني أكسيد الكربون', answerEn: 'Carbon dioxide' },
  { id: 'sci-g13', categoryId: 'science', difficulty: 'hard', questionAr: 'ما وحدة قياس المقاومة الكهربائية؟', questionEn: 'What is the unit of electrical resistance?', answerAr: 'أوم', answerEn: 'Ohm' },
  { id: 'sci-g14', categoryId: 'science', difficulty: 'hard', questionAr: 'ما وحدة قياس شدة التيار الكهربائي؟', questionEn: 'What is the unit of electric current?', answerAr: 'أمبير', answerEn: 'Ampere' },
  { id: 'sci-g15', categoryId: 'science', difficulty: 'hard', questionAr: 'ما الكوكب ذو الحلقات الأشهر؟', questionEn: 'Which planet is famous for its rings?', answerAr: 'زحل', answerEn: 'Saturn' },
  { id: 'sci-g16', categoryId: 'science', difficulty: 'hard', questionAr: 'ما الغاز الأكثر وجودًا في الغلاف الجوي؟', questionEn: 'Which gas is most abundant in the atmosphere?', answerAr: 'النيتروجين', answerEn: 'Nitrogen' },
  { id: 'sci-g17', categoryId: 'science', difficulty: 'hard', questionAr: 'ما أقسى مادة طبيعية معروفة؟', questionEn: 'What is the hardest natural material known?', answerAr: 'الماس', answerEn: 'Diamond' },
  { id: 'sci-g18', categoryId: 'science', difficulty: 'hard', questionAr: 'ما العملية التي تتحول فيها المياه إلى بخار؟', questionEn: 'What process turns water into vapor?', answerAr: 'التبخر', answerEn: 'Evaporation' },
  { id: 'sci-g19', categoryId: 'science', difficulty: 'easy', questionAr: 'أي حاسة نستخدمها لتذوق الطعام؟', questionEn: 'Which sense do we use to taste food?', answerAr: 'التذوق', answerEn: 'Taste' },
  { id: 'sci-g20', categoryId: 'science', difficulty: 'easy', questionAr: 'ما مصدر الضوء الطبيعي في النهار؟', questionEn: 'What is the natural source of light during the day?', answerAr: 'الشمس', answerEn: 'Sun' },
  { id: 'sci-g21', categoryId: 'science', difficulty: 'medium', questionAr: 'ما الاسم الذي يطلق على الحيوانات التي تأكل النباتات فقط؟', questionEn: 'What are animals that eat only plants called?', answerAr: 'عاشبة', answerEn: 'Herbivores' },
  { id: 'sci-g22', categoryId: 'science', difficulty: 'medium', questionAr: 'كم عدد الأسنان الدائمة عادة عند الإنسان البالغ؟', questionEn: 'How many permanent teeth does an adult usually have?', answerAr: '32', answerEn: '32' },
  { id: 'sci-g23', categoryId: 'science', difficulty: 'medium', questionAr: 'ما القوة التي تجعل الأشياء تسقط نحو الأرض؟', questionEn: 'What force makes objects fall toward Earth?', answerAr: 'الجاذبية', answerEn: 'Gravity' },
  { id: 'sci-g24', categoryId: 'science', difficulty: 'medium', questionAr: 'ما اسم الدورة التي يتحرك فيها الماء بين البحر والسماء والأرض؟', questionEn: 'What is the cycle of water moving between sea, sky, and land?', answerAr: 'دورة الماء', answerEn: 'Water cycle' },
  { id: 'sci-g25', categoryId: 'science', difficulty: 'hard', questionAr: 'ما اسم أصغر جزء من العنصر يحتفظ بخصائصه؟', questionEn: 'What is the smallest part of an element that keeps its properties?', answerAr: 'الذرة', answerEn: 'Atom' },
  { id: 'sci-g26', categoryId: 'science', difficulty: 'hard', questionAr: 'ما الحالة التي تكون فيها المادة على شكل بلازما غالبًا؟', questionEn: 'In which state is matter often found in stars?', answerAr: 'البلازما', answerEn: 'Plasma' },
  { id: 'sci-g27', categoryId: 'science', difficulty: 'hard', questionAr: 'ما اسم الكوكب الأقرب حجمًا إلى الأرض؟', questionEn: 'Which planet is closest in size to Earth?', answerAr: 'الزهرة', answerEn: 'Venus' },
  { id: 'sci-g28', categoryId: 'science', difficulty: 'easy', questionAr: 'أي عضو نستخدمه للتنفس؟', questionEn: 'Which organ do we use for breathing?', answerAr: 'الرئتان', answerEn: 'Lungs' },
  { id: 'sci-g29', categoryId: 'science', difficulty: 'easy', questionAr: 'ما لون ورقة النبات غالبًا بسبب الكلوروفيل؟', questionEn: 'What color are plant leaves usually because of chlorophyll?', answerAr: 'أخضر', answerEn: 'Green' },
  { id: 'sci-g30', categoryId: 'science', difficulty: 'easy', questionAr: 'أي حيوان من الثدييات يعيش في الماء؟', questionEn: 'Which mammal lives in water?', answerAr: 'الدلفين', answerEn: 'Dolphin' },
];

const sportsSeeds: PromptAnswerSeed[] = [
  { id: 'sports-x01', categoryId: 'sports', difficulty: 'easy', questionAr: 'في أي رياضة تُستخدم الريشة؟', questionEn: 'In which sport is a shuttlecock used?', answerAr: 'الريشة الطائرة', answerEn: 'Badminton' },
  { id: 'sports-x02', categoryId: 'sports', difficulty: 'easy', questionAr: 'في أي رياضة يُستخدم المضرب والكرة الصفراء؟', questionEn: 'In which sport are a racket and a yellow ball used?', answerAr: 'التنس', answerEn: 'Tennis' },
  { id: 'sports-x03', categoryId: 'sports', difficulty: 'easy', questionAr: 'في أي رياضة تُرمى الكرة في سلة؟', questionEn: 'In which sport is the ball thrown into a hoop?', answerAr: 'كرة السلة', answerEn: 'Basketball' },
  { id: 'sports-x04', categoryId: 'sports', difficulty: 'easy', questionAr: 'في أي رياضة يُستخدم حمام السباحة؟', questionEn: 'Which sport is played in a swimming pool?', answerAr: 'السباحة', answerEn: 'Swimming' },
  { id: 'sports-x05', categoryId: 'sports', difficulty: 'easy', questionAr: 'في أي رياضة يُستخدم القوس والسهم؟', questionEn: 'Which sport uses a bow and arrow?', answerAr: 'الرماية', answerEn: 'Archery' },
  { id: 'sports-x06', categoryId: 'sports', difficulty: 'medium', questionAr: 'في أي رياضة تُستخدم الحلبة والقفازات؟', questionEn: 'Which sport uses a ring and gloves?', answerAr: 'الملاكمة', answerEn: 'Boxing' },
  { id: 'sports-x07', categoryId: 'sports', difficulty: 'medium', questionAr: 'في أي رياضة يوجد إرسال وشبكة وملعب رملي أحيانًا؟', questionEn: 'Which sport features serves, a net, and sometimes a sand court?', answerAr: 'الكرة الطائرة', answerEn: 'Volleyball' },
  { id: 'sports-x08', categoryId: 'sports', difficulty: 'medium', questionAr: 'في أي رياضة يُستخدم المضرب والكرة الصغيرة على طاولة؟', questionEn: 'Which sport uses paddles and a small ball on a table?', answerAr: 'كرة الطاولة', answerEn: 'Table Tennis' },
  { id: 'sports-x09', categoryId: 'sports', difficulty: 'medium', questionAr: 'في أي رياضة تُستخدم الخوذة والدراجة؟', questionEn: 'Which sport commonly uses a helmet and bicycle?', answerAr: 'ركوب الدراجات', answerEn: 'Cycling' },
  { id: 'sports-x10', categoryId: 'sports', difficulty: 'medium', questionAr: 'في أي رياضة يُستخدم مضمار للجري؟', questionEn: 'Which sport uses a running track?', answerAr: 'ألعاب القوى', answerEn: 'Athletics' },
  { id: 'sports-x11', categoryId: 'sports', difficulty: 'hard', questionAr: 'في أي رياضة يسمى تسجيل جميع المحاولات الكاملة Strike؟', questionEn: 'In which sport is a perfect attempt called a strike?', answerAr: 'البولينغ', answerEn: 'Bowling' },
  { id: 'sports-x12', categoryId: 'sports', difficulty: 'hard', questionAr: 'في أي رياضة تُستخدم الأمواج واللوح؟', questionEn: 'Which sport uses waves and a board?', answerAr: 'ركوب الأمواج', answerEn: 'Surfing' },
  { id: 'sports-x13', categoryId: 'sports', difficulty: 'hard', questionAr: 'في أي رياضة تُستخدم المضامير الثلجية والعصي القصيرة؟', questionEn: 'Which sport uses ice tracks and short sticks?', answerAr: 'هوكي الجليد', answerEn: 'Ice Hockey' },
  { id: 'sports-x14', categoryId: 'sports', difficulty: 'hard', questionAr: 'في أي رياضة تُستخدم السروج والخيول؟', questionEn: 'Which sport uses saddles and horses?', answerAr: 'الفروسية', answerEn: 'Equestrian' },
  { id: 'sports-x15', categoryId: 'sports', difficulty: 'hard', questionAr: 'في أي رياضة تُستخدم العصا والحفرة والكرة البيضاء الصغيرة؟', questionEn: 'Which sport uses a club, a hole, and a small white ball?', answerAr: 'الغولف', answerEn: 'Golf' },
];

const footballSeeds: PromptAnswerSeed[] = [
  { id: 'football-x01', categoryId: 'football', difficulty: 'easy', questionAr: 'كم لاعبًا داخل الملعب من كل فريق؟', questionEn: 'How many players from each team are on the field?', answerAr: '11', answerEn: '11' },
  { id: 'football-x02', categoryId: 'football', difficulty: 'easy', questionAr: 'ما لون بطاقة الطرد المباشر؟', questionEn: 'What color is the direct sending-off card?', answerAr: 'الأحمر', answerEn: 'Red' },
  { id: 'football-x03', categoryId: 'football', difficulty: 'easy', questionAr: 'ما اسم اللاعب الوحيد المسموح له بمسك الكرة بيديه؟', questionEn: 'What is the only player allowed to handle the ball with his hands?', answerAr: 'حارس المرمى', answerEn: 'Goalkeeper' },
  { id: 'football-x04', categoryId: 'football', difficulty: 'easy', questionAr: 'ما اسم المنطقة التي تُنفذ منها ركلة الجزاء؟', questionEn: 'What is the area from which a penalty is taken?', answerAr: 'منطقة الجزاء', answerEn: 'Penalty area' },
  { id: 'football-x05', categoryId: 'football', difficulty: 'easy', questionAr: 'كم شوطًا في المباراة الرسمية؟', questionEn: 'How many halves are there in an official match?', answerAr: '2', answerEn: '2' },
  { id: 'football-x06', categoryId: 'football', difficulty: 'medium', questionAr: 'كم دقيقة مدة الشوط الواحد؟', questionEn: 'How many minutes is one half?', answerAr: '45', answerEn: '45' },
  { id: 'football-x07', categoryId: 'football', difficulty: 'medium', questionAr: 'ما القرار عند خروج الكرة من خط المرمى بلمسة مهاجم؟', questionEn: 'What is awarded when the ball crosses the goal line off an attacker?', answerAr: 'ركلة مرمى', answerEn: 'Goal kick' },
  { id: 'football-x08', categoryId: 'football', difficulty: 'medium', questionAr: 'ما القرار عند خروج الكرة من خط المرمى بلمسة مدافع؟', questionEn: 'What is awarded when the ball crosses the goal line off a defender?', answerAr: 'ركلة ركنية', answerEn: 'Corner kick' },
  { id: 'football-x09', categoryId: 'football', difficulty: 'medium', questionAr: 'ما اسم المخالفة عندما يكون المهاجم متقدمًا بشكل غير قانوني؟', questionEn: 'What is the offense called when an attacker is illegally ahead?', answerAr: 'تسلل', answerEn: 'Offside' },
  { id: 'football-x10', categoryId: 'football', difficulty: 'medium', questionAr: 'ما اسم الحكم الموجود في وسط الملعب؟', questionEn: 'What is the official in the middle of the field called?', answerAr: 'حكم الساحة', answerEn: 'Referee' },
  { id: 'football-x11', categoryId: 'football', difficulty: 'hard', questionAr: 'ما اسم البطولة العالمية للمنتخبات التي تقام كل أربع سنوات؟', questionEn: 'What is the world tournament for national teams held every four years?', answerAr: 'كأس العالم', answerEn: 'World Cup' },
  { id: 'football-x12', categoryId: 'football', difficulty: 'hard', questionAr: 'ما اسم البطولة الأوروبية للأندية الأشهر؟', questionEn: 'What is the most famous European club competition?', answerAr: 'دوري أبطال أوروبا', answerEn: 'UEFA Champions League' },
  { id: 'football-x13', categoryId: 'football', difficulty: 'hard', questionAr: 'ما اسم ركلة البداية من منتصف الملعب؟', questionEn: 'What is the starting kick from the center called?', answerAr: 'ضربة البداية', answerEn: 'Kick-off' },
  { id: 'football-x14', categoryId: 'football', difficulty: 'hard', questionAr: 'عندما يتعادل الفريقان بعد الوقت الأصلي في بعض المباريات الإقصائية، ما الوقت الإضافي الكلي؟', questionEn: 'In knockout matches, what is the total extra time played after a draw?', answerAr: '30 دقيقة', answerEn: '30 minutes' },
  { id: 'football-x15', categoryId: 'football', difficulty: 'hard', questionAr: 'ما اسم الركلات التي تحسم التعادل بعد الوقت الإضافي؟', questionEn: 'What are the kicks called that decide a draw after extra time?', answerAr: 'ركلات الترجيح', answerEn: 'Penalty shootout' },
];

const technologySeeds: PromptAnswerSeed[] = [
  { id: 'tech-g01', categoryId: 'technology', difficulty: 'easy', ageBucket: 'older', questionAr: 'ما الجهاز الذي يربط المنزل بالإنترنت اللاسلكي؟', questionEn: 'What device connects a home to wireless internet?', answerAr: 'الراوتر', answerEn: 'Router' },
  { id: 'tech-g02', categoryId: 'technology', difficulty: 'easy', ageBucket: 'older', questionAr: 'ما الجهاز المستخدم لطباعة الأوراق؟', questionEn: 'What device is used to print papers?', answerAr: 'الطابعة', answerEn: 'Printer' },
  { id: 'tech-g03', categoryId: 'technology', difficulty: 'easy', ageBucket: 'older', questionAr: 'ما اسم الجهاز الذي نتحكم به بالمؤشر على الشاشة؟', questionEn: 'What device do we use to control the pointer on the screen?', answerAr: 'الفأرة', answerEn: 'Mouse' },
  { id: 'tech-g04', categoryId: 'technology', difficulty: 'easy', ageBucket: 'older', questionAr: 'ما اسم الشبكة العالمية للمواقع؟', questionEn: 'What is the worldwide network of websites called?', answerAr: 'الويب', answerEn: 'Web' },
  { id: 'tech-g05', categoryId: 'technology', difficulty: 'easy', ageBucket: 'older', questionAr: 'ما الجهاز الذي نستخدمه لإجراء المكالمات الذكية؟', questionEn: 'What device do we use for smart calls?', answerAr: 'الهاتف الذكي', answerEn: 'Smartphone' },
  { id: 'tech-g06', categoryId: 'technology', difficulty: 'medium', ageBucket: 'older', questionAr: 'ماذا تعني الأحرف URL؟', questionEn: 'What does URL stand for?', answerAr: 'رابط موارد موحد', answerEn: 'Uniform Resource Locator' },
  { id: 'tech-g07', categoryId: 'technology', difficulty: 'medium', ageBucket: 'older', questionAr: 'ماذا تعني الأحرف RAM؟', questionEn: 'What does RAM stand for?', answerAr: 'ذاكرة وصول عشوائي', answerEn: 'Random Access Memory' },
  { id: 'tech-g08', categoryId: 'technology', difficulty: 'medium', ageBucket: 'older', questionAr: 'ما المتصفح الشهير من جوجل؟', questionEn: 'What is the famous browser from Google?', answerAr: 'كروم', answerEn: 'Chrome' },
  { id: 'tech-g09', categoryId: 'technology', difficulty: 'medium', ageBucket: 'older', questionAr: 'أي وحدة تخزن الملفات لفترة طويلة داخل الحاسوب؟', questionEn: 'Which component stores files long term inside a computer?', answerAr: 'القرص الصلب', answerEn: 'Hard drive' },
  { id: 'tech-g10', categoryId: 'technology', difficulty: 'medium', ageBucket: 'older', questionAr: 'أي لغة تُستخدم كثيرًا في صفحات الويب التفاعلية؟', questionEn: 'Which language is widely used in interactive web pages?', answerAr: 'JavaScript', answerEn: 'JavaScript' },
  { id: 'tech-g11', categoryId: 'technology', difficulty: 'hard', ageBucket: 'older', questionAr: 'ما التمثيل الثنائي للعدد 10؟', questionEn: 'What is the binary representation of 10?', answerAr: '1010', answerEn: '1010' },
  { id: 'tech-g12', categoryId: 'technology', difficulty: 'hard', ageBucket: 'older', questionAr: 'أي قاعدة بيانات تعتمد الجداول غالبًا؟', questionEn: 'Which kind of database commonly relies on tables?', answerAr: 'العلاقية', answerEn: 'Relational' },
  { id: 'tech-g13', categoryId: 'technology', difficulty: 'hard', ageBucket: 'older', questionAr: 'ما الاسم الشائع للبرمجيات الخبيثة التي تطلب فدية؟', questionEn: 'What is the common name for malicious software that demands payment?', answerAr: 'برمجيات الفدية', answerEn: 'Ransomware' },
  { id: 'tech-g14', categoryId: 'technology', difficulty: 'hard', ageBucket: 'older', questionAr: 'ما البروتوكول الآمن لتصفح المواقع؟', questionEn: 'What is the secure protocol for browsing websites?', answerAr: 'HTTPS', answerEn: 'HTTPS' },
  { id: 'tech-g15', categoryId: 'technology', difficulty: 'hard', ageBucket: 'older', questionAr: 'ما اسم النسخة المستضافة من الكود التي تسجل التعديلات؟', questionEn: 'What is the hosted code system that tracks revisions called?', answerAr: 'إدارة الإصدارات', answerEn: 'Version control' },
  { id: 'tech-g16', categoryId: 'technology', difficulty: 'easy', ageBucket: 'older', questionAr: 'ما اسم البرنامج الذي يعرض الصور والملفات المكتبية غالبًا على سطح المكتب؟', questionEn: 'What is the main program layer shown on a computer desktop?', answerAr: 'نظام التشغيل', answerEn: 'Operating system' },
  { id: 'tech-g17', categoryId: 'technology', difficulty: 'medium', ageBucket: 'older', questionAr: 'ما الأداة التي تحول الورق إلى نسخة رقمية؟', questionEn: 'What tool turns paper into a digital copy?', answerAr: 'الماسح الضوئي', answerEn: 'Scanner' },
  { id: 'tech-g18', categoryId: 'technology', difficulty: 'medium', ageBucket: 'older', questionAr: 'ما الاسم الذي يطلق على البرامج الصغيرة في الهاتف؟', questionEn: 'What is the name for small programs on a phone?', answerAr: 'التطبيقات', answerEn: 'Apps' },
  { id: 'tech-g19', categoryId: 'technology', difficulty: 'hard', ageBucket: 'older', questionAr: 'ما الاسم الذي يطلق على نسخة احتياطية محفوظة عبر الإنترنت؟', questionEn: 'What do we call a backup stored online?', answerAr: 'نسخة سحابية', answerEn: 'Cloud backup' },
  { id: 'tech-g20', categoryId: 'technology', difficulty: 'hard', ageBucket: 'older', questionAr: 'ما نوع الشبكة المختصر بـ LAN؟', questionEn: 'What type of network is abbreviated LAN?', answerAr: 'شبكة محلية', answerEn: 'Local Area Network' },
];

const islamSeeds: PromptAnswerSeed[] = [
  { id: 'islam-g01', categoryId: 'islamicCulture', difficulty: 'easy', questionAr: 'كم عدد أركان الإسلام؟', questionEn: 'How many pillars of Islam are there?', answerAr: '5', answerEn: '5' },
  { id: 'islam-g02', categoryId: 'islamicCulture', difficulty: 'easy', questionAr: 'ما أول شهر هجري؟', questionEn: 'What is the first Hijri month?', answerAr: 'محرم', answerEn: 'Muharram' },
  { id: 'islam-g03', categoryId: 'islamicCulture', difficulty: 'easy', questionAr: 'إلى أي مدينة هاجر النبي صلى الله عليه وسلم؟', questionEn: 'To which city did the Prophet migrate?', answerAr: 'المدينة المنورة', answerEn: 'Madinah' },
  { id: 'islam-g04', categoryId: 'islamicCulture', difficulty: 'easy', questionAr: 'ما القبلة التي يتجه إليها المسلمون في الصلاة؟', questionEn: 'What direction do Muslims face in prayer?', answerAr: 'الكعبة', answerEn: 'Kaaba' },
  { id: 'islam-g05', categoryId: 'islamicCulture', difficulty: 'easy', questionAr: 'كم صلاة مفروضة في اليوم؟', questionEn: 'How many obligatory prayers are there in a day?', answerAr: '5', answerEn: '5' },
  { id: 'islam-g06', categoryId: 'islamicCulture', difficulty: 'medium', questionAr: 'ما اسم الليلة التي نزل فيها القرآن؟', questionEn: 'What is the night called in which the Qur’an was revealed?', answerAr: 'ليلة القدر', answerEn: 'Laylat al-Qadr' },
  { id: 'islam-g07', categoryId: 'islamicCulture', difficulty: 'medium', questionAr: 'ما الزكاة: عبادة مالية أم بدنية؟', questionEn: 'Is zakat a financial or physical act of worship?', answerAr: 'مالية', answerEn: 'Financial' },
  { id: 'islam-g08', categoryId: 'islamicCulture', difficulty: 'medium', questionAr: 'في أي شهر يصوم المسلمون؟', questionEn: 'In which month do Muslims fast?', answerAr: 'رمضان', answerEn: 'Ramadan' },
  { id: 'islam-g09', categoryId: 'islamicCulture', difficulty: 'medium', questionAr: 'ما اسم كتاب المسلمين المقدس؟', questionEn: 'What is the holy book of Muslims?', answerAr: 'القرآن الكريم', answerEn: 'Qur’an' },
  { id: 'islam-g10', categoryId: 'islamicCulture', difficulty: 'medium', questionAr: 'ما السورة التي تُعرف بقلب القرآن؟', questionEn: 'Which surah is known as the heart of the Qur’an?', answerAr: 'يس', answerEn: 'Ya-Sin' },
  { id: 'islam-g11', categoryId: 'islamicCulture', difficulty: 'hard', questionAr: 'ما اسم الغار الذي كان فيه النبي صلى الله عليه وسلم عند الهجرة؟', questionEn: 'What was the name of the cave during the migration?', answerAr: 'غار ثور', answerEn: 'Cave of Thawr' },
  { id: 'islam-g12', categoryId: 'islamicCulture', difficulty: 'hard', questionAr: 'ما السورة التي لا تبدأ بالبسملة؟', questionEn: 'Which surah does not begin with Bismillah?', answerAr: 'التوبة', answerEn: 'At-Tawbah' },
  { id: 'islam-g13', categoryId: 'islamicCulture', difficulty: 'hard', questionAr: 'ما اسم والد النبي صلى الله عليه وسلم؟', questionEn: 'What was the name of the Prophet’s father?', answerAr: 'عبد الله', answerEn: 'Abdullah' },
  { id: 'islam-g14', categoryId: 'islamicCulture', difficulty: 'hard', questionAr: 'ما أول مسجد بُني في الإسلام؟', questionEn: 'What was the first mosque built in Islam?', answerAr: 'مسجد قباء', answerEn: 'Quba Mosque' },
  { id: 'islam-g15', categoryId: 'islamicCulture', difficulty: 'hard', questionAr: 'ما اسم أم المؤمنين الأولى زوجة النبي صلى الله عليه وسلم؟', questionEn: 'Who was the Prophet’s first wife?', answerAr: 'خديجة', answerEn: 'Khadijah' },
  { id: 'islam-g16', categoryId: 'islamicCulture', difficulty: 'easy', questionAr: 'ما اسم عيد يأتي بعد رمضان؟', questionEn: 'What is the Eid after Ramadan called?', answerAr: 'عيد الفطر', answerEn: 'Eid al-Fitr' },
  { id: 'islam-g17', categoryId: 'islamicCulture', difficulty: 'medium', questionAr: 'ما المدينة التي يوجد فيها المسجد النبوي؟', questionEn: 'In which city is the Prophet’s Mosque located?', answerAr: 'المدينة المنورة', answerEn: 'Madinah' },
  { id: 'islam-g18', categoryId: 'islamicCulture', difficulty: 'medium', questionAr: 'كم عدد أيام الحج الأساسية تقريبًا؟', questionEn: 'Roughly how many core days does Hajj take?', answerAr: '5', answerEn: '5' },
  { id: 'islam-g19', categoryId: 'islamicCulture', difficulty: 'hard', questionAr: 'في أي سنة هجرية تقريبًا كانت الهجرة النبوية؟', questionEn: 'Around which Hijri year did the migration mark begin?', answerAr: '1 هـ', answerEn: '1 AH' },
  { id: 'islam-g20', categoryId: 'islamicCulture', difficulty: 'hard', questionAr: 'ما اللغة التي نزل بها القرآن؟', questionEn: 'In which language was the Qur’an revealed?', answerAr: 'العربية', answerEn: 'Arabic' },
];

const kuwaitSeeds: PromptAnswerSeed[] = [
  { id: 'kw-g01', categoryId: 'kuwait', difficulty: 'easy', questionAr: 'ما العملة الرسمية في الكويت؟', questionEn: 'What is the official currency of Kuwait?', answerAr: 'الدينار الكويتي', answerEn: 'Kuwaiti Dinar' },
  { id: 'kw-g02', categoryId: 'kuwait', difficulty: 'easy', questionAr: 'ما اللغة الرسمية في الكويت؟', questionEn: 'What is the official language of Kuwait?', answerAr: 'العربية', answerEn: 'Arabic' },
  { id: 'kw-g03', categoryId: 'kuwait', difficulty: 'easy', questionAr: 'على أي مسطح مائي تطل الكويت؟', questionEn: 'Which body of water does Kuwait overlook?', answerAr: 'الخليج العربي', answerEn: 'Arabian Gulf' },
  { id: 'kw-g04', categoryId: 'kuwait', difficulty: 'easy', questionAr: 'ما عاصمة الكويت؟', questionEn: 'What is the capital of Kuwait?', answerAr: 'مدينة الكويت', answerEn: 'Kuwait City' },
  { id: 'kw-g05', categoryId: 'kuwait', difficulty: 'easy', questionAr: 'ما اسم البرجين المشهورين في الكويت؟', questionEn: 'What are the famous twin towers in Kuwait called?', answerAr: 'أبراج الكويت', answerEn: 'Kuwait Towers' },
  { id: 'kw-g06', categoryId: 'kuwait', difficulty: 'medium', questionAr: 'في أي شهر يكون العيد الوطني الكويتي؟', questionEn: 'In which month is Kuwait National Day?', answerAr: 'فبراير', answerEn: 'February' },
  { id: 'kw-g07', categoryId: 'kuwait', difficulty: 'medium', questionAr: 'ما لون الشريط المائل في علم الكويت؟', questionEn: 'What is the color of the trapezoid on Kuwait’s flag?', answerAr: 'أسود', answerEn: 'Black' },
  { id: 'kw-g08', categoryId: 'kuwait', difficulty: 'medium', questionAr: 'ما اسم مجلس الكويت المنتخب؟', questionEn: 'What is the elected council in Kuwait called?', answerAr: 'مجلس الأمة', answerEn: 'National Assembly' },
  { id: 'kw-g09', categoryId: 'kuwait', difficulty: 'medium', questionAr: 'ما اسم البرج الشهير للاتصالات في الكويت؟', questionEn: 'What is the famous communications tower in Kuwait called?', answerAr: 'برج التحرير', answerEn: 'Liberation Tower' },
  { id: 'kw-g10', categoryId: 'kuwait', difficulty: 'medium', questionAr: 'ما الاسم الشائع للمنطقة الساحلية الترفيهية المشهورة في العاصمة؟', questionEn: 'What is the well-known waterfront leisure area in the capital called?', answerAr: 'الكورنيش', answerEn: 'Corniche' },
  { id: 'kw-g11', categoryId: 'kuwait', difficulty: 'hard', questionAr: 'ما اسم الجزيرة الكويتية الكبيرة المعروفة؟', questionEn: 'What is the name of a well-known large Kuwaiti island?', answerAr: 'بوبيان', answerEn: 'Bubiyan' },
  { id: 'kw-g12', categoryId: 'kuwait', difficulty: 'hard', questionAr: 'ما لون الدينار الكويتي الورقي الشهير فئة العشرين غالبًا؟', questionEn: 'What is a commonly recognized color of the Kuwaiti twenty-dinar note?', answerAr: 'أخضر', answerEn: 'Green' },
  { id: 'kw-g13', categoryId: 'kuwait', difficulty: 'hard', questionAr: 'ما اسم المطار الدولي الرئيسي في الكويت؟', questionEn: 'What is the main international airport in Kuwait called?', answerAr: 'مطار الكويت الدولي', answerEn: 'Kuwait International Airport' },
  { id: 'kw-g14', categoryId: 'kuwait', difficulty: 'hard', questionAr: 'ما لونين يظهران مع الأخضر والأسود في العلم الكويتي؟', questionEn: 'Which two colors appear with green and black on Kuwait’s flag?', answerAr: 'الأبيض والأحمر', answerEn: 'White and red' },
  { id: 'kw-g15', categoryId: 'kuwait', difficulty: 'hard', questionAr: 'ما اسم الدولة المجاورة للكويت من الجنوب؟', questionEn: 'Which country borders Kuwait to the south?', answerAr: 'السعودية', answerEn: 'Saudi Arabia' },
];

const whoAmISeeds: PromptAnswerSeed[] = [
  { id: 'who-g01', categoryId: 'whoAmI', difficulty: 'easy', questionAr: 'من أنا؟ أنا الحيوان المعروف بملك الغابة.', questionEn: 'Who am I? I am the animal known as the king of the jungle.', answerAr: 'الأسد', answerEn: 'Lion' },
  { id: 'who-g02', categoryId: 'whoAmI', difficulty: 'easy', questionAr: 'من أنا؟ أنا الكوكب الذي نعيش عليه.', questionEn: 'Who am I? I am the planet we live on.', answerAr: 'الأرض', answerEn: 'Earth' },
  { id: 'who-g03', categoryId: 'whoAmI', difficulty: 'easy', questionAr: 'من أنا؟ أنا الحيوان الذي يسمى سفينة الصحراء.', questionEn: 'Who am I? I am the animal called the ship of the desert.', answerAr: 'الجمل', answerEn: 'Camel' },
  { id: 'who-g04', categoryId: 'whoAmI', difficulty: 'easy', questionAr: 'من أنا؟ أنا أداة نكتب بها على الورق.', questionEn: 'Who am I? I am a tool used to write on paper.', answerAr: 'القلم', answerEn: 'Pen' },
  { id: 'who-g05', categoryId: 'whoAmI', difficulty: 'easy', questionAr: 'من أنا؟ أنا مكان تعيش فيه الأسماك.', questionEn: 'Who am I? I am a place where fish live.', answerAr: 'البحر', answerEn: 'Sea' },
  { id: 'who-g06', categoryId: 'whoAmI', difficulty: 'medium', questionAr: 'من أنا؟ أنا الغاز الذي نتنفسه للبقاء.', questionEn: 'Who am I? I am the gas we breathe to stay alive.', answerAr: 'الأكسجين', answerEn: 'Oxygen' },
  { id: 'who-g07', categoryId: 'whoAmI', difficulty: 'medium', questionAr: 'من أنا؟ أنا القارة التي تضم أكبر عدد من السكان.', questionEn: 'Who am I? I am the continent with the largest population.', answerAr: 'آسيا', answerEn: 'Asia' },
  { id: 'who-g08', categoryId: 'whoAmI', difficulty: 'medium', questionAr: 'من أنا؟ أنا المدينة التي توجد فيها الكعبة.', questionEn: 'Who am I? I am the city where the Kaaba is located.', answerAr: 'مكة المكرمة', answerEn: 'Makkah' },
  { id: 'who-g09', categoryId: 'whoAmI', difficulty: 'medium', questionAr: 'من أنا؟ أنا العالم الذي ارتبط بالجاذبية.', questionEn: 'Who am I? I am the scientist associated with gravity.', answerAr: 'نيوتن', answerEn: 'Newton' },
  { id: 'who-g10', categoryId: 'whoAmI', difficulty: 'medium', questionAr: 'من أنا؟ أنا الجهاز الذي نستخدمه للمكالمات والصور والتصفح.', questionEn: 'Who am I? I am the device used for calls, photos, and browsing.', answerAr: 'الهاتف الذكي', answerEn: 'Smartphone' },
  { id: 'who-g11', categoryId: 'whoAmI', difficulty: 'hard', questionAr: 'من أنا؟ أنا الكاتب المرتبط بمسرحية هاملت.', questionEn: 'Who am I? I am the writer associated with Hamlet.', answerAr: 'شكسبير', answerEn: 'Shakespeare' },
  { id: 'who-g12', categoryId: 'whoAmI', difficulty: 'hard', questionAr: 'من أنا؟ أنا البحار الذي اكتشف طريقًا إلى الأمريكتين في الروايات المدرسية الشهيرة.', questionEn: 'Who am I? I am the sailor famous in school books for reaching the Americas.', answerAr: 'كريستوفر كولومبوس', answerEn: 'Christopher Columbus' },
  { id: 'who-g13', categoryId: 'whoAmI', difficulty: 'hard', questionAr: 'من أنا؟ أنا العملية التي يتحول فيها الماء إلى بخار.', questionEn: 'Who am I? I am the process that turns water into vapor.', answerAr: 'التبخر', answerEn: 'Evaporation' },
  { id: 'who-g14', categoryId: 'whoAmI', difficulty: 'hard', questionAr: 'من أنا؟ أنا أصغر عظمة في جسم الإنسان.', questionEn: 'Who am I? I am the smallest bone in the human body.', answerAr: 'عظمة الركاب', answerEn: 'Stapes' },
  { id: 'who-g15', categoryId: 'whoAmI', difficulty: 'hard', questionAr: 'من أنا؟ أنا البحر الذي ترتفع فيه نسبة الملوحة كثيرًا.', questionEn: 'Who am I? I am the sea known for very high salinity.', answerAr: 'البحر الميت', answerEn: 'Dead Sea' },
  { id: 'who-g16', categoryId: 'whoAmI', difficulty: 'easy', questionAr: 'من أنا؟ أنا الطائر الذي لا يطير وأعيش في القطب الجنوبي.', questionEn: 'Who am I? I am the bird that cannot fly and lives in Antarctica.', answerAr: 'البطريق', answerEn: 'Penguin' },
  { id: 'who-g17', categoryId: 'whoAmI', difficulty: 'easy', questionAr: 'من أنا؟ أنا الحيوان الذي يعطي الحليب في المزرعة.', questionEn: 'Who am I? I am the farm animal that gives milk.', answerAr: 'البقرة', answerEn: 'Cow' },
  { id: 'who-g18', categoryId: 'whoAmI', difficulty: 'easy', questionAr: 'من أنا؟ أنا القارة التي فيها مصر ونيجيريا وكينيا.', questionEn: 'Who am I? I am the continent that includes Egypt, Nigeria, and Kenya.', answerAr: 'إفريقيا', answerEn: 'Africa' },
  { id: 'who-g19', categoryId: 'whoAmI', difficulty: 'easy', questionAr: 'من أنا؟ أنا عاصمة اليابان.', questionEn: 'Who am I? I am the capital of Japan.', answerAr: 'طوكيو', answerEn: 'Tokyo' },
  { id: 'who-g20', categoryId: 'whoAmI', difficulty: 'medium', questionAr: 'من أنا؟ أنا الكوكب صاحب الحلقات الأشهر.', questionEn: 'Who am I? I am the planet most famous for rings.', answerAr: 'زحل', answerEn: 'Saturn' },
  { id: 'who-g21', categoryId: 'whoAmI', difficulty: 'medium', questionAr: 'من أنا؟ أنا المعدن المستخدم غالبًا في الأسلاك الكهربائية.', questionEn: 'Who am I? I am the metal commonly used in electrical wires.', answerAr: 'النحاس', answerEn: 'Copper' },
  { id: 'who-g22', categoryId: 'whoAmI', difficulty: 'medium', questionAr: 'من أنا؟ أنا الوحدة المستخدمة لقياس المقاومة الكهربائية.', questionEn: 'Who am I? I am the unit used to measure electrical resistance.', answerAr: 'أوم', answerEn: 'Ohm' },
  { id: 'who-g23', categoryId: 'whoAmI', difficulty: 'medium', questionAr: 'من أنا؟ أنا المدينة التي تقع فيها أبراج الكويت.', questionEn: 'Who am I? I am the city where Kuwait Towers stand.', answerAr: 'مدينة الكويت', answerEn: 'Kuwait City' },
  { id: 'who-g24', categoryId: 'whoAmI', difficulty: 'medium', questionAr: 'من أنا؟ أنا الرياضة التي تُستخدم فيها الريشة.', questionEn: 'Who am I? I am the sport that uses a shuttlecock.', answerAr: 'الريشة الطائرة', answerEn: 'Badminton' },
  { id: 'who-g25', categoryId: 'whoAmI', difficulty: 'hard', questionAr: 'من أنا؟ أنا القناة التي تربط البحر الأحمر بالمتوسط.', questionEn: 'Who am I? I am the canal linking the Red Sea and the Mediterranean.', answerAr: 'قناة السويس', answerEn: 'Suez Canal' },
  { id: 'who-g26', categoryId: 'whoAmI', difficulty: 'hard', questionAr: 'من أنا؟ أنا مخترع الهاتف.', questionEn: 'Who am I? I invented the telephone.', answerAr: 'غراهام بيل', answerEn: 'Graham Bell' },
  { id: 'who-g27', categoryId: 'whoAmI', difficulty: 'hard', questionAr: 'من أنا؟ أنا أصعب مادة طبيعية معروفة.', questionEn: 'Who am I? I am the hardest known natural material.', answerAr: 'الماس', answerEn: 'Diamond' },
  { id: 'who-g28', categoryId: 'whoAmI', difficulty: 'hard', questionAr: 'من أنا؟ أنا المدينة التي يُطلق عليها أحيانًا مدينة الضباب.', questionEn: 'Who am I? I am the city sometimes called the city of fog.', answerAr: 'لندن', answerEn: 'London' },
  { id: 'who-g29', categoryId: 'whoAmI', difficulty: 'hard', questionAr: 'من أنا؟ أنا العملية التي يصنع بها النبات غذاءه من الضوء.', questionEn: 'Who am I? I am the process by which plants make food from light.', answerAr: 'البناء الضوئي', answerEn: 'Photosynthesis' },
  { id: 'who-g30', categoryId: 'whoAmI', difficulty: 'hard', questionAr: 'من أنا؟ أنا البحر الذي تطل عليه الكويت.', questionEn: 'Who am I? I am the body of water Kuwait overlooks.', answerAr: 'الخليج العربي', answerEn: 'Arabian Gulf' },
];

const completeSentenceSeeds: PromptAnswerSeed[] = [
  { id: 'comp-g01', categoryId: 'completeSentence', difficulty: 'easy', questionAr: 'أكمل: درهم وقاية خير من ...', questionEn: 'Complete: Prevention is better than ...', answerAr: 'قنطار علاج', answerEn: 'a pound of cure' },
  { id: 'comp-g02', categoryId: 'completeSentence', difficulty: 'easy', questionAr: 'أكمل: العقل السليم في الجسم ...', questionEn: 'Complete: A healthy mind in a ... body.', answerAr: 'السليم', answerEn: 'healthy' },
  { id: 'comp-g03', categoryId: 'completeSentence', difficulty: 'easy', questionAr: 'أكمل: من جد وجد ومن زرع ...', questionEn: 'Complete: Whoever works hard succeeds, and whoever plants ...', answerAr: 'حصد', answerEn: 'reaps' },
  { id: 'comp-g04', categoryId: 'completeSentence', difficulty: 'easy', questionAr: 'أكمل: الصديق وقت ...', questionEn: 'Complete: A friend is known in times of ...', answerAr: 'الضيق', answerEn: 'hardship' },
  { id: 'comp-g05', categoryId: 'completeSentence', difficulty: 'easy', questionAr: 'أكمل: العلم في الصغر كالنقش على ...', questionEn: 'Complete: Learning in youth is like engraving on ...', answerAr: 'الحجر', answerEn: 'stone' },
  { id: 'comp-g06', categoryId: 'completeSentence', difficulty: 'medium', questionAr: 'أكمل: اليد الواحدة لا تصفق ...', questionEn: 'Complete: One hand does not clap ...', answerAr: 'وحدها', answerEn: 'alone' },
  { id: 'comp-g07', categoryId: 'completeSentence', difficulty: 'medium', questionAr: 'أكمل: من راقب الناس مات ...', questionEn: 'Complete: Whoever keeps watching people dies of ...', answerAr: 'همًا', answerEn: 'worry' },
  { id: 'comp-g08', categoryId: 'completeSentence', difficulty: 'medium', questionAr: 'أكمل: خير الأمور ...', questionEn: 'Complete: The best of matters is ...', answerAr: 'أوسطها', answerEn: 'moderation' },
  { id: 'comp-g09', categoryId: 'completeSentence', difficulty: 'medium', questionAr: 'أكمل: إذا كان الكلام من فضة فالسكوت من ...', questionEn: 'Complete: If speech is silver, silence is ...', answerAr: 'ذهب', answerEn: 'gold' },
  { id: 'comp-g10', categoryId: 'completeSentence', difficulty: 'medium', questionAr: 'أكمل: الحاجة أم ...', questionEn: 'Complete: Necessity is the mother of ...', answerAr: 'الاختراع', answerEn: 'invention' },
  { id: 'comp-g11', categoryId: 'completeSentence', difficulty: 'hard', questionAr: 'أكمل: على قدر أهل العزم تأتي ...', questionEn: 'Complete: To the extent of determination come ...', answerAr: 'العزائم', answerEn: 'resolutions' },
  { id: 'comp-g12', categoryId: 'completeSentence', difficulty: 'hard', questionAr: 'أكمل: كل تأخيرة فيها ...', questionEn: 'Complete: Every delay brings ...', answerAr: 'خيرة', answerEn: 'goodness' },
  { id: 'comp-g13', categoryId: 'completeSentence', difficulty: 'hard', questionAr: 'أكمل: لسانك حصانك إن صنته ...', questionEn: 'Complete: Your tongue is your horse; if you guard it ...', answerAr: 'صانك', answerEn: 'it guards you' },
  { id: 'comp-g14', categoryId: 'completeSentence', difficulty: 'hard', questionAr: 'أكمل: من طلب العلا سهر ...', questionEn: 'Complete: Whoever seeks success stays awake ...', answerAr: 'الليالي', answerEn: 'through the nights' },
  { id: 'comp-g15', categoryId: 'completeSentence', difficulty: 'hard', questionAr: 'أكمل: رب أخ لك لم تلده ...', questionEn: 'Complete: Sometimes a brother is not born of your ...', answerAr: 'أمك', answerEn: 'mother' },
  { id: 'comp-g16', categoryId: 'completeSentence', difficulty: 'easy', questionAr: 'أكمل: لكل مجتهد ...', questionEn: 'Complete: Every hard worker has a ...', answerAr: 'نصيب', answerEn: 'share' },
  { id: 'comp-g17', categoryId: 'completeSentence', difficulty: 'easy', questionAr: 'أكمل: الوقاية خير من ...', questionEn: 'Complete: Prevention is better than ...', answerAr: 'العلاج', answerEn: 'cure' },
  { id: 'comp-g18', categoryId: 'completeSentence', difficulty: 'medium', questionAr: 'أكمل: من لا يشكر الناس لا يشكر ...', questionEn: 'Complete: Whoever does not thank people does not thank ...', answerAr: 'الله', answerEn: 'God' },
  { id: 'comp-g19', categoryId: 'completeSentence', difficulty: 'medium', questionAr: 'أكمل: الكتاب يقرأ من ...', questionEn: 'Complete: A book is read from its ...', answerAr: 'عنوانه', answerEn: 'title' },
  { id: 'comp-g20', categoryId: 'completeSentence', difficulty: 'medium', questionAr: 'أكمل: الوقت كالسيف إن لم تقطعه ...', questionEn: 'Complete: Time is like a sword; if you do not cut it ...', answerAr: 'قطعك', answerEn: 'it cuts you' },
  { id: 'comp-g21', categoryId: 'completeSentence', difficulty: 'hard', questionAr: 'أكمل: لا تؤجل عمل اليوم إلى ...', questionEn: 'Complete: Do not delay today’s work until ...', answerAr: 'الغد', answerEn: 'tomorrow' },
  { id: 'comp-g22', categoryId: 'completeSentence', difficulty: 'hard', questionAr: 'أكمل: إذا هبت رياحك فاغتنمها فإن لكل ...', questionEn: 'Complete: If your winds blow, seize them, for every ... has calm.', answerAr: 'خافقة', answerEn: 'flutter' },
  { id: 'comp-g23', categoryId: 'completeSentence', difficulty: 'hard', questionAr: 'أكمل: الجزاء من جنس ...', questionEn: 'Complete: Reward is of the same kind as ...', answerAr: 'العمل', answerEn: 'deed' },
  { id: 'comp-g24', categoryId: 'completeSentence', difficulty: 'easy', questionAr: 'أكمل: العلم ... يرفع بيوتًا لا عماد لها.', questionEn: 'Complete: ... raises houses with no pillars.', answerAr: 'نور', answerEn: 'Knowledge/light' },
  { id: 'comp-g25', categoryId: 'completeSentence', difficulty: 'medium', questionAr: 'أكمل: من صبر ...', questionEn: 'Complete: Whoever is patient ...', answerAr: 'ظفر', answerEn: 'wins' },
];

const arabicSeeds: PromptAnswerSeed[] = [
  { id: 'ar-g01', categoryId: 'arabicLang', difficulty: 'easy', ageBucket: 'older', questionAr: 'ما معنى كلمة شجاع؟', questionEn: 'What is the meaning of the Arabic word "brave"?', answerAr: 'جريء', answerEn: 'Brave' },
  { id: 'ar-g02', categoryId: 'arabicLang', difficulty: 'easy', ageBucket: 'older', questionAr: 'ما جمع كلمة كتاب؟', questionEn: 'What is the plural of the Arabic word for book?', answerAr: 'كتب', answerEn: 'Books' },
  { id: 'ar-g03', categoryId: 'arabicLang', difficulty: 'easy', ageBucket: 'older', questionAr: 'ما مضاد كلمة طويل؟', questionEn: 'What is the opposite of the Arabic word for tall/long?', answerAr: 'قصير', answerEn: 'Short' },
  { id: 'ar-g04', categoryId: 'arabicLang', difficulty: 'easy', ageBucket: 'older', questionAr: 'أي كلمة تدل على لون؟', questionEn: 'Which word refers to a color?', answerAr: 'أزرق', answerEn: 'Blue' },
  { id: 'ar-g05', categoryId: 'arabicLang', difficulty: 'easy', ageBucket: 'older', questionAr: 'ما مرادف كلمة سعيد؟', questionEn: 'What is a synonym of the Arabic word for happy?', answerAr: 'مسرور', answerEn: 'Happy' },
  { id: 'ar-g06', categoryId: 'arabicLang', difficulty: 'medium', ageBucket: 'older', questionAr: 'أي كلمة تُعد فعلًا؟', questionEn: 'Which word is a verb?', answerAr: 'كتب', answerEn: 'Wrote' },
  { id: 'ar-g07', categoryId: 'arabicLang', difficulty: 'medium', ageBucket: 'older', questionAr: 'ما مفرد كلمة أقلام؟', questionEn: 'What is the singular of the Arabic word for pens?', answerAr: 'قلم', answerEn: 'Pen' },
  { id: 'ar-g08', categoryId: 'arabicLang', difficulty: 'medium', ageBucket: 'older', questionAr: 'ما جمع كلمة مدينة؟', questionEn: 'What is the plural of the Arabic word for city?', answerAr: 'مدن', answerEn: 'Cities' },
  { id: 'ar-g09', categoryId: 'arabicLang', difficulty: 'medium', ageBucket: 'older', questionAr: 'ما مضاد كلمة كرم؟', questionEn: 'What is the opposite of generosity?', answerAr: 'بخل', answerEn: 'Stinginess' },
  { id: 'ar-g10', categoryId: 'arabicLang', difficulty: 'medium', ageBucket: 'older', questionAr: 'أي كلمة تدل على مكان؟', questionEn: 'Which word indicates a place?', answerAr: 'مدرسة', answerEn: 'School' },
  { id: 'ar-g11', categoryId: 'arabicLang', difficulty: 'hard', ageBucket: 'older', questionAr: 'ما معنى كلمة فسيح؟', questionEn: 'What is the meaning of the Arabic word "spacious"?', answerAr: 'واسع', answerEn: 'Spacious' },
  { id: 'ar-g12', categoryId: 'arabicLang', difficulty: 'hard', ageBucket: 'older', questionAr: 'ما جمع كلمة بحر؟', questionEn: 'What is the plural of the Arabic word for sea?', answerAr: 'بحار', answerEn: 'Seas' },
  { id: 'ar-g13', categoryId: 'arabicLang', difficulty: 'hard', ageBucket: 'older', questionAr: 'ما مضاد كلمة صادق؟', questionEn: 'What is the opposite of truthful?', answerAr: 'كاذب', answerEn: 'Liar' },
  { id: 'ar-g14', categoryId: 'arabicLang', difficulty: 'hard', ageBucket: 'older', questionAr: 'أي كلمة اسم زمان؟', questionEn: 'Which word can refer to time?', answerAr: 'صباح', answerEn: 'Morning' },
  { id: 'ar-g15', categoryId: 'arabicLang', difficulty: 'hard', ageBucket: 'older', questionAr: 'ما مرادف كلمة سريع؟', questionEn: 'What is a synonym of the Arabic word for fast?', answerAr: 'عاجل', answerEn: 'Fast' },
  { id: 'ar-g16', categoryId: 'arabicLang', difficulty: 'easy', ageBucket: 'older', questionAr: 'ما معنى كلمة كبير؟', questionEn: 'What is the meaning of the Arabic word for big?', answerAr: 'ضخم', answerEn: 'Big' },
  { id: 'ar-g17', categoryId: 'arabicLang', difficulty: 'easy', ageBucket: 'older', questionAr: 'ما جمع كلمة طفل؟', questionEn: 'What is the plural of the Arabic word for child?', answerAr: 'أطفال', answerEn: 'Children' },
  { id: 'ar-g18', categoryId: 'arabicLang', difficulty: 'medium', ageBucket: 'older', questionAr: 'ما مفرد كلمة نجوم؟', questionEn: 'What is the singular of the Arabic word for stars?', answerAr: 'نجم', answerEn: 'Star' },
  { id: 'ar-g19', categoryId: 'arabicLang', difficulty: 'medium', ageBucket: 'older', questionAr: 'أي كلمة تدل على شعور؟', questionEn: 'Which word indicates an emotion?', answerAr: 'فرح', answerEn: 'Joy' },
  { id: 'ar-g20', categoryId: 'arabicLang', difficulty: 'medium', ageBucket: 'older', questionAr: 'ما مضاد كلمة بارد؟', questionEn: 'What is the opposite of cold?', answerAr: 'حار', answerEn: 'Hot' },
  { id: 'ar-g21', categoryId: 'arabicLang', difficulty: 'hard', ageBucket: 'older', questionAr: 'ما جمع كلمة قلم؟', questionEn: 'What is the plural of the Arabic word for pen?', answerAr: 'أقلام', answerEn: 'Pens' },
  { id: 'ar-g22', categoryId: 'arabicLang', difficulty: 'hard', ageBucket: 'older', questionAr: 'ما مرادف كلمة جميل؟', questionEn: 'What is a synonym of the Arabic word for beautiful?', answerAr: 'حسن', answerEn: 'Beautiful' },
  { id: 'ar-g23', categoryId: 'arabicLang', difficulty: 'hard', ageBucket: 'older', questionAr: 'أي كلمة تدل على صوت؟', questionEn: 'Which word indicates a sound?', answerAr: 'همس', answerEn: 'Whisper' },
  { id: 'ar-g24', categoryId: 'arabicLang', difficulty: 'easy', ageBucket: 'older', questionAr: 'ما معنى كلمة ذكي؟', questionEn: 'What is the meaning of the Arabic word for smart?', answerAr: 'فطن', answerEn: 'Smart' },
  { id: 'ar-g25', categoryId: 'arabicLang', difficulty: 'medium', ageBucket: 'older', questionAr: 'ما مفرد كلمة جبال؟', questionEn: 'What is the singular of the Arabic word for mountains?', answerAr: 'جبل', answerEn: 'Mountain' },
];

const englishSeeds: PromptAnswerSeed[] = [
  { id: 'en-g01', categoryId: 'englishLang', difficulty: 'easy', ageBucket: 'older', questionAr: 'أي كلمة إنجليزية تعني كبير؟', questionEn: 'Which English word means big?', answerAr: 'big', answerEn: 'big' },
  { id: 'en-g02', categoryId: 'englishLang', difficulty: 'easy', ageBucket: 'older', questionAr: 'أي كلمة إنجليزية تعني سريع؟', questionEn: 'Which English word means fast?', answerAr: 'fast', answerEn: 'fast' },
  { id: 'en-g03', categoryId: 'englishLang', difficulty: 'easy', ageBucket: 'older', questionAr: 'أي كلمة إنجليزية تعني سعيد؟', questionEn: 'Which English word means happy?', answerAr: 'happy', answerEn: 'happy' },
  { id: 'en-g04', categoryId: 'englishLang', difficulty: 'easy', ageBucket: 'older', questionAr: 'أي كلمة إنجليزية تعني كتاب؟', questionEn: 'Which English word means book?', answerAr: 'book', answerEn: 'book' },
  { id: 'en-g05', categoryId: 'englishLang', difficulty: 'easy', ageBucket: 'older', questionAr: 'أي كلمة إنجليزية تعني مدرسة؟', questionEn: 'Which English word means school?', answerAr: 'school', answerEn: 'school' },
  { id: 'en-g06', categoryId: 'englishLang', difficulty: 'medium', ageBucket: 'older', questionAr: 'أي كلمة إنجليزية تعني قديم؟', questionEn: 'Which English word means old?', answerAr: 'old', answerEn: 'old' },
  { id: 'en-g07', categoryId: 'englishLang', difficulty: 'medium', ageBucket: 'older', questionAr: 'أي كلمة إنجليزية تعني مدينة؟', questionEn: 'Which English word means city?', answerAr: 'city', answerEn: 'city' },
  { id: 'en-g08', categoryId: 'englishLang', difficulty: 'medium', ageBucket: 'older', questionAr: 'أي كلمة إنجليزية تعني شجاع؟', questionEn: 'Which English word means brave?', answerAr: 'brave', answerEn: 'brave' },
  { id: 'en-g09', categoryId: 'englishLang', difficulty: 'medium', ageBucket: 'older', questionAr: 'أي كلمة إنجليزية تعني ماء؟', questionEn: 'Which English word means water?', answerAr: 'water', answerEn: 'water' },
  { id: 'en-g10', categoryId: 'englishLang', difficulty: 'medium', ageBucket: 'older', questionAr: 'أي كلمة إنجليزية تعني عمل؟', questionEn: 'Which English word means work?', answerAr: 'work', answerEn: 'work' },
  { id: 'en-g11', categoryId: 'englishLang', difficulty: 'hard', ageBucket: 'older', questionAr: 'أي كلمة إنجليزية تعني معرفة؟', questionEn: 'Which English word means knowledge?', answerAr: 'knowledge', answerEn: 'knowledge' },
  { id: 'en-g12', categoryId: 'englishLang', difficulty: 'hard', ageBucket: 'older', questionAr: 'أي كلمة إنجليزية تعني قرار؟', questionEn: 'Which English word means decision?', answerAr: 'decision', answerEn: 'decision' },
  { id: 'en-g13', categoryId: 'englishLang', difficulty: 'hard', ageBucket: 'older', questionAr: 'أي كلمة إنجليزية تعني تحدٍ؟', questionEn: 'Which English word means challenge?', answerAr: 'challenge', answerEn: 'challenge' },
  { id: 'en-g14', categoryId: 'englishLang', difficulty: 'hard', ageBucket: 'older', questionAr: 'أي كلمة إنجليزية تعني تطور؟', questionEn: 'Which English word means development?', answerAr: 'development', answerEn: 'development' },
  { id: 'en-g15', categoryId: 'englishLang', difficulty: 'hard', ageBucket: 'older', questionAr: 'أي كلمة إنجليزية تعني نجاح؟', questionEn: 'Which English word means success?', answerAr: 'success', answerEn: 'success' },
  { id: 'en-g16', categoryId: 'englishLang', difficulty: 'easy', ageBucket: 'older', questionAr: 'أي كلمة إنجليزية تعني منزل؟', questionEn: 'Which English word means home?', answerAr: 'home', answerEn: 'home' },
  { id: 'en-g17', categoryId: 'englishLang', difficulty: 'easy', ageBucket: 'older', questionAr: 'أي كلمة إنجليزية تعني صديق؟', questionEn: 'Which English word means friend?', answerAr: 'friend', answerEn: 'friend' },
  { id: 'en-g18', categoryId: 'englishLang', difficulty: 'medium', ageBucket: 'older', questionAr: 'أي كلمة إنجليزية تعني طريق؟', questionEn: 'Which English word means road?', answerAr: 'road', answerEn: 'road' },
  { id: 'en-g19', categoryId: 'englishLang', difficulty: 'medium', ageBucket: 'older', questionAr: 'أي كلمة إنجليزية تعني ضوء؟', questionEn: 'Which English word means light?', answerAr: 'light', answerEn: 'light' },
  { id: 'en-g20', categoryId: 'englishLang', difficulty: 'medium', ageBucket: 'older', questionAr: 'أي كلمة إنجليزية تعني بحر؟', questionEn: 'Which English word means sea?', answerAr: 'sea', answerEn: 'sea' },
  { id: 'en-g21', categoryId: 'englishLang', difficulty: 'hard', ageBucket: 'older', questionAr: 'أي كلمة إنجليزية تعني حرية؟', questionEn: 'Which English word means freedom?', answerAr: 'freedom', answerEn: 'freedom' },
  { id: 'en-g22', categoryId: 'englishLang', difficulty: 'hard', ageBucket: 'older', questionAr: 'أي كلمة إنجليزية تعني مهارة؟', questionEn: 'Which English word means skill?', answerAr: 'skill', answerEn: 'skill' },
  { id: 'en-g23', categoryId: 'englishLang', difficulty: 'hard', ageBucket: 'older', questionAr: 'أي كلمة إنجليزية تعني ثقافة؟', questionEn: 'Which English word means culture?', answerAr: 'culture', answerEn: 'culture' },
  { id: 'en-g24', categoryId: 'englishLang', difficulty: 'easy', ageBucket: 'older', questionAr: 'أي كلمة إنجليزية تعني قمر؟', questionEn: 'Which English word means moon?', answerAr: 'moon', answerEn: 'moon' },
  { id: 'en-g25', categoryId: 'englishLang', difficulty: 'medium', ageBucket: 'older', questionAr: 'أي كلمة إنجليزية تعني صحة؟', questionEn: 'Which English word means health?', answerAr: 'health', answerEn: 'health' },
];

const trueFalseSeeds: TrueFalseSeed[] = [
  { id: 'tf-g01', difficulty: 'easy', questionAr: 'صح أم خطأ: الماء يتجمد عند صفر درجة مئوية.', questionEn: 'True or False: Water freezes at zero degrees Celsius.', isTrue: true },
  { id: 'tf-g02', difficulty: 'easy', questionAr: 'صح أم خطأ: الشمس كوكب.', questionEn: 'True or False: The Sun is a planet.', isTrue: false },
  { id: 'tf-g03', difficulty: 'easy', questionAr: 'صح أم خطأ: الأسد حيوان لاحم.', questionEn: 'True or False: A lion is a carnivore.', isTrue: true },
  { id: 'tf-g04', difficulty: 'easy', questionAr: 'صح أم خطأ: الأسبوع يتكون من ستة أيام.', questionEn: 'True or False: A week has six days.', isTrue: false },
  { id: 'tf-g05', difficulty: 'easy', questionAr: 'صح أم خطأ: المريخ يُعرف بالكوكب الأحمر.', questionEn: 'True or False: Mars is known as the Red Planet.', isTrue: true },
  { id: 'tf-g06', difficulty: 'easy', questionAr: 'صح أم خطأ: القمر أكبر من الشمس.', questionEn: 'True or False: The Moon is bigger than the Sun.', isTrue: false },
  { id: 'tf-g07', difficulty: 'easy', questionAr: 'صح أم خطأ: السمك يعيش في الماء.', questionEn: 'True or False: Fish live in water.', isTrue: true },
  { id: 'tf-g08', difficulty: 'easy', questionAr: 'صح أم خطأ: جميع الطيور تستطيع الطيران.', questionEn: 'True or False: All birds can fly.', isTrue: false },
  { id: 'tf-g09', difficulty: 'easy', questionAr: 'صح أم خطأ: الكويت عملتها الدينار الكويتي.', questionEn: 'True or False: Kuwait uses the Kuwaiti dinar.', isTrue: true },
  { id: 'tf-g10', difficulty: 'easy', questionAr: 'صح أم خطأ: باريس هي عاصمة إيطاليا.', questionEn: 'True or False: Paris is the capital of Italy.', isTrue: false },
  { id: 'tf-g11', difficulty: 'medium', questionAr: 'صح أم خطأ: الصوت ينتقل في الماء أسرع من الهواء.', questionEn: 'True or False: Sound travels faster in water than in air.', isTrue: true },
  { id: 'tf-g12', difficulty: 'medium', questionAr: 'صح أم خطأ: الحديد أخف من الريشة.', questionEn: 'True or False: Iron is lighter than a feather.', isTrue: false },
  { id: 'tf-g13', difficulty: 'medium', questionAr: 'صح أم خطأ: عدد القارات سبع.', questionEn: 'True or False: There are seven continents.', isTrue: true },
  { id: 'tf-g14', difficulty: 'medium', questionAr: 'صح أم خطأ: النيل يمر في مصر.', questionEn: 'True or False: The Nile flows through Egypt.', isTrue: true },
  { id: 'tf-g15', difficulty: 'medium', questionAr: 'صح أم خطأ: زحل هو أقرب كوكب إلى الشمس.', questionEn: 'True or False: Saturn is the closest planet to the Sun.', isTrue: false },
  { id: 'tf-g16', difficulty: 'medium', questionAr: 'صح أم خطأ: الشجرة تحتاج إلى ضوء لتنمو جيدًا.', questionEn: 'True or False: A tree needs light to grow well.', isTrue: true },
  { id: 'tf-g17', difficulty: 'medium', questionAr: 'صح أم خطأ: العسل يصنعه النحل.', questionEn: 'True or False: Honey is made by bees.', isTrue: true },
  { id: 'tf-g18', difficulty: 'medium', questionAr: 'صح أم خطأ: برشلونة هي عاصمة إسبانيا.', questionEn: 'True or False: Barcelona is the capital of Spain.', isTrue: false },
  { id: 'tf-g19', difficulty: 'medium', questionAr: 'صح أم خطأ: الرقم 10 عدد زوجي.', questionEn: 'True or False: The number 10 is even.', isTrue: true },
  { id: 'tf-g20', difficulty: 'medium', questionAr: 'صح أم خطأ: كل الكواكب لها نفس عدد الأقمار.', questionEn: 'True or False: All planets have the same number of moons.', isTrue: false },
  { id: 'tf-g21', difficulty: 'hard', questionAr: 'صح أم خطأ: العدد 1 عدد أولي.', questionEn: 'True or False: The number 1 is a prime number.', isTrue: false },
  { id: 'tf-g22', difficulty: 'hard', questionAr: 'صح أم خطأ: الألماس يتكون من الكربون.', questionEn: 'True or False: Diamond is made of carbon.', isTrue: true },
  { id: 'tf-g23', difficulty: 'hard', questionAr: 'صح أم خطأ: النيتروجين هو الغاز الأكثر في الغلاف الجوي.', questionEn: 'True or False: Nitrogen is the most abundant gas in the atmosphere.', isTrue: true },
  { id: 'tf-g24', difficulty: 'hard', questionAr: 'صح أم خطأ: غرينلاند قارة مستقلة.', questionEn: 'True or False: Greenland is an independent continent.', isTrue: false },
  { id: 'tf-g25', difficulty: 'hard', questionAr: 'صح أم خطأ: الإلكترون يحمل شحنة سالبة.', questionEn: 'True or False: An electron carries a negative charge.', isTrue: true },
  { id: 'tf-g26', difficulty: 'hard', questionAr: 'صح أم خطأ: مضيق هرمز يربط الخليج العربي بالمحيط الأطلسي مباشرة.', questionEn: 'True or False: The Strait of Hormuz connects the Arabian Gulf directly to the Atlantic Ocean.', isTrue: false },
  { id: 'tf-g27', difficulty: 'hard', questionAr: 'صح أم خطأ: شكسبير كتب هاملت.', questionEn: 'True or False: Shakespeare wrote Hamlet.', isTrue: true },
  { id: 'tf-g28', difficulty: 'hard', questionAr: 'صح أم خطأ: سرعة الضوء أبطأ من سرعة الصوت.', questionEn: 'True or False: The speed of light is slower than the speed of sound.', isTrue: false },
  { id: 'tf-g29', difficulty: 'easy', questionAr: 'صح أم خطأ: الحليب يأتي من البقرة غالبًا.', questionEn: 'True or False: Milk commonly comes from cows.', isTrue: true },
  { id: 'tf-g30', difficulty: 'easy', questionAr: 'صح أم خطأ: السماء خضراء عادة في النهار.', questionEn: 'True or False: The sky is usually green during the day.', isTrue: false },
  { id: 'tf-g31', difficulty: 'medium', questionAr: 'صح أم خطأ: أبوظبي هي عاصمة الإمارات.', questionEn: 'True or False: Abu Dhabi is the capital of the UAE.', isTrue: true },
  { id: 'tf-g32', difficulty: 'medium', questionAr: 'صح أم خطأ: البحر الميت يقع في أوروبا.', questionEn: 'True or False: The Dead Sea is in Europe.', isTrue: false },
  { id: 'tf-g33', difficulty: 'medium', questionAr: 'صح أم خطأ: كرة السلة تُلعب بمضرب.', questionEn: 'True or False: Basketball is played with a racket.', isTrue: false },
  { id: 'tf-g34', difficulty: 'medium', questionAr: 'صح أم خطأ: الكلوروفيل يعطي النبات لونه الأخضر.', questionEn: 'True or False: Chlorophyll gives plants their green color.', isTrue: true },
  { id: 'tf-g35', difficulty: 'hard', questionAr: 'صح أم خطأ: كانبيرا هي عاصمة أستراليا.', questionEn: 'True or False: Canberra is the capital of Australia.', isTrue: true },
  { id: 'tf-g36', difficulty: 'hard', questionAr: 'صح أم خطأ: تساوي الدرجة المئوية 212 عند تجمد الماء.', questionEn: 'True or False: Water freezes at 212 degrees Celsius.', isTrue: false },
  { id: 'tf-g37', difficulty: 'hard', questionAr: 'صح أم خطأ: الضوء يحتاج إلى وسط مادي دائمًا ليمر.', questionEn: 'True or False: Light always needs a material medium to travel.', isTrue: false },
  { id: 'tf-g38', difficulty: 'easy', questionAr: 'صح أم خطأ: القط حيوان أليف شائع.', questionEn: 'True or False: A cat is a common pet.', isTrue: true },
  { id: 'tf-g39', difficulty: 'medium', questionAr: 'صح أم خطأ: جهاز الحاسوب المحمول يسمى Laptop بالإنجليزية.', questionEn: 'True or False: A portable computer is called a laptop in English.', isTrue: true },
  { id: 'tf-g40', difficulty: 'hard', questionAr: 'صح أم خطأ: العدد 53 عدد أولي.', questionEn: 'True or False: The number 53 is prime.', isTrue: true },
];

const flagsSeeds: PromptAnswerSeed[] = [
  { id: 'flags-g01', categoryId: 'flags', difficulty: 'easy', questionAr: 'لأي دولة هذا العلم؟ 🇰🇼', questionEn: 'Which country does this flag belong to? 🇰🇼', answerAr: 'الكويت', answerEn: 'Kuwait' },
  { id: 'flags-g02', categoryId: 'flags', difficulty: 'easy', questionAr: 'لأي دولة هذا العلم؟ 🇸🇦', questionEn: 'Which country does this flag belong to? 🇸🇦', answerAr: 'السعودية', answerEn: 'Saudi Arabia' },
  { id: 'flags-g03', categoryId: 'flags', difficulty: 'easy', questionAr: 'لأي دولة هذا العلم؟ 🇦🇪', questionEn: 'Which country does this flag belong to? 🇦🇪', answerAr: 'الإمارات', answerEn: 'United Arab Emirates' },
  { id: 'flags-g04', categoryId: 'flags', difficulty: 'easy', questionAr: 'لأي دولة هذا العلم؟ 🇶🇦', questionEn: 'Which country does this flag belong to? 🇶🇦', answerAr: 'قطر', answerEn: 'Qatar' },
  { id: 'flags-g05', categoryId: 'flags', difficulty: 'easy', questionAr: 'لأي دولة هذا العلم؟ 🇧🇭', questionEn: 'Which country does this flag belong to? 🇧🇭', answerAr: 'البحرين', answerEn: 'Bahrain' },
  { id: 'flags-g06', categoryId: 'flags', difficulty: 'easy', questionAr: 'لأي دولة هذا العلم؟ 🇪🇬', questionEn: 'Which country does this flag belong to? 🇪🇬', answerAr: 'مصر', answerEn: 'Egypt' },
  { id: 'flags-g07', categoryId: 'flags', difficulty: 'easy', questionAr: 'لأي دولة هذا العلم؟ 🇯🇵', questionEn: 'Which country does this flag belong to? 🇯🇵', answerAr: 'اليابان', answerEn: 'Japan' },
  { id: 'flags-g08', categoryId: 'flags', difficulty: 'easy', questionAr: 'لأي دولة هذا العلم؟ 🇫🇷', questionEn: 'Which country does this flag belong to? 🇫🇷', answerAr: 'فرنسا', answerEn: 'France' },
  { id: 'flags-g09', categoryId: 'flags', difficulty: 'medium', questionAr: 'لأي دولة هذا العلم؟ 🇹🇷', questionEn: 'Which country does this flag belong to? 🇹🇷', answerAr: 'تركيا', answerEn: 'Turkey' },
  { id: 'flags-g10', categoryId: 'flags', difficulty: 'medium', questionAr: 'لأي دولة هذا العلم؟ 🇵🇰', questionEn: 'Which country does this flag belong to? 🇵🇰', answerAr: 'باكستان', answerEn: 'Pakistan' },
  { id: 'flags-g11', categoryId: 'flags', difficulty: 'medium', questionAr: 'لأي دولة هذا العلم؟ 🇮🇹', questionEn: 'Which country does this flag belong to? 🇮🇹', answerAr: 'إيطاليا', answerEn: 'Italy' },
  { id: 'flags-g12', categoryId: 'flags', difficulty: 'medium', questionAr: 'لأي دولة هذا العلم؟ 🇩🇪', questionEn: 'Which country does this flag belong to? 🇩🇪', answerAr: 'ألمانيا', answerEn: 'Germany' },
  { id: 'flags-g13', categoryId: 'flags', difficulty: 'medium', questionAr: 'لأي دولة هذا العلم؟ 🇬🇷', questionEn: 'Which country does this flag belong to? 🇬🇷', answerAr: 'اليونان', answerEn: 'Greece' },
  { id: 'flags-g14', categoryId: 'flags', difficulty: 'medium', questionAr: 'لأي دولة هذا العلم؟ 🇲🇦', questionEn: 'Which country does this flag belong to? 🇲🇦', answerAr: 'المغرب', answerEn: 'Morocco' },
  { id: 'flags-g15', categoryId: 'flags', difficulty: 'medium', questionAr: 'لأي دولة هذا العلم؟ 🇯🇴', questionEn: 'Which country does this flag belong to? 🇯🇴', answerAr: 'الأردن', answerEn: 'Jordan' },
  { id: 'flags-g16', categoryId: 'flags', difficulty: 'hard', questionAr: 'لأي دولة هذا العلم؟ 🇸🇪', questionEn: 'Which country does this flag belong to? 🇸🇪', answerAr: 'السويد', answerEn: 'Sweden' },
  { id: 'flags-g17', categoryId: 'flags', difficulty: 'hard', questionAr: 'لأي دولة هذا العلم؟ 🇳🇴', questionEn: 'Which country does this flag belong to? 🇳🇴', answerAr: 'النرويج', answerEn: 'Norway' },
  { id: 'flags-g18', categoryId: 'flags', difficulty: 'hard', questionAr: 'لأي دولة هذا العلم؟ 🇫🇮', questionEn: 'Which country does this flag belong to? 🇫🇮', answerAr: 'فنلندا', answerEn: 'Finland' },
  { id: 'flags-g19', categoryId: 'flags', difficulty: 'hard', questionAr: 'لأي دولة هذا العلم؟ 🇨🇭', questionEn: 'Which country does this flag belong to? 🇨🇭', answerAr: 'سويسرا', answerEn: 'Switzerland' },
  { id: 'flags-g20', categoryId: 'flags', difficulty: 'hard', questionAr: 'لأي دولة هذا العلم؟ 🇧🇪', questionEn: 'Which country does this flag belong to? 🇧🇪', answerAr: 'بلجيكا', answerEn: 'Belgium' },
];

const guessImageSeeds: PromptAnswerSeed[] = [
  { id: 'guess-g01', categoryId: 'guessImage', difficulty: 'easy', type: 'image', questionAr: 'ماذا تمثل هذه الصورة؟ 🦁', questionEn: 'What does this image show? 🦁', answerAr: 'أسد', answerEn: 'Lion' },
  { id: 'guess-g02', categoryId: 'guessImage', difficulty: 'easy', type: 'image', questionAr: 'ماذا تمثل هذه الصورة؟ 🚗', questionEn: 'What does this image show? 🚗', answerAr: 'سيارة', answerEn: 'Car' },
  { id: 'guess-g03', categoryId: 'guessImage', difficulty: 'easy', type: 'image', questionAr: 'ماذا تمثل هذه الصورة؟ ✈️', questionEn: 'What does this image show? ✈️', answerAr: 'طائرة', answerEn: 'Airplane' },
  { id: 'guess-g04', categoryId: 'guessImage', difficulty: 'easy', type: 'image', questionAr: 'ماذا تمثل هذه الصورة؟ 🍎', questionEn: 'What does this image show? 🍎', answerAr: 'تفاحة', answerEn: 'Apple' },
  { id: 'guess-g05', categoryId: 'guessImage', difficulty: 'easy', type: 'image', questionAr: 'ماذا تمثل هذه الصورة؟ ⚽', questionEn: 'What does this image show? ⚽', answerAr: 'كرة قدم', answerEn: 'Football' },
  { id: 'guess-g06', categoryId: 'guessImage', difficulty: 'easy', type: 'image', questionAr: 'ماذا تمثل هذه الصورة؟ 📚', questionEn: 'What does this image show? 📚', answerAr: 'كتب', answerEn: 'Books' },
  { id: 'guess-g07', categoryId: 'guessImage', difficulty: 'easy', type: 'image', questionAr: 'ماذا تمثل هذه الصورة؟ 🐪', questionEn: 'What does this image show? 🐪', answerAr: 'جمل', answerEn: 'Camel' },
  { id: 'guess-g08', categoryId: 'guessImage', difficulty: 'easy', type: 'image', questionAr: 'ماذا تمثل هذه الصورة؟ 🌙', questionEn: 'What does this image show? 🌙', answerAr: 'قمر', answerEn: 'Moon' },
  { id: 'guess-g09', categoryId: 'guessImage', difficulty: 'medium', type: 'image', questionAr: 'أي معلم تمثله هذه الصورة؟ 🗼', questionEn: 'Which landmark does this image represent? 🗼', answerAr: 'برج إيفل', answerEn: 'Eiffel Tower' },
  { id: 'guess-g10', categoryId: 'guessImage', difficulty: 'medium', type: 'image', questionAr: 'أي وسيلة نقل تمثلها هذه الصورة؟ 🚢', questionEn: 'Which means of transport does this image represent? 🚢', answerAr: 'سفينة', answerEn: 'Ship' },
  { id: 'guess-g11', categoryId: 'guessImage', difficulty: 'medium', type: 'image', questionAr: 'أي جهاز تمثله هذه الصورة؟ 💻', questionEn: 'Which device does this image represent? 💻', answerAr: 'حاسوب محمول', answerEn: 'Laptop' },
  { id: 'guess-g12', categoryId: 'guessImage', difficulty: 'medium', type: 'image', questionAr: 'أي مهنة تمثلها هذه الصورة؟ 👨‍⚕️', questionEn: 'Which profession does this image represent? 👨‍⚕️', answerAr: 'طبيب', answerEn: 'Doctor' },
  { id: 'guess-g13', categoryId: 'guessImage', difficulty: 'medium', type: 'image', questionAr: 'أي ظاهرة جوية تمثلها هذه الصورة؟ ⛈️', questionEn: 'Which weather event does this image represent? ⛈️', answerAr: 'عاصفة رعدية', answerEn: 'Thunderstorm' },
  { id: 'guess-g14', categoryId: 'guessImage', difficulty: 'medium', type: 'image', questionAr: 'أي دولة يشير إليها هذا الرمز؟ 🐼', questionEn: 'Which country is commonly associated with this symbol? 🐼', answerAr: 'الصين', answerEn: 'China' },
  { id: 'guess-g15', categoryId: 'guessImage', difficulty: 'medium', type: 'image', questionAr: 'أي رياضة تمثلها هذه الصورة؟ 🏀', questionEn: 'Which sport does this image represent? 🏀', answerAr: 'كرة السلة', answerEn: 'Basketball' },
  { id: 'guess-g16', categoryId: 'guessImage', difficulty: 'hard', type: 'image', questionAr: 'أي كوكب تمثله هذه الصورة؟ 🪐', questionEn: 'Which planet does this image suggest? 🪐', answerAr: 'زحل', answerEn: 'Saturn' },
  { id: 'guess-g17', categoryId: 'guessImage', difficulty: 'hard', type: 'image', questionAr: 'أي مفهوم علمي تمثله هذه الصورة؟ 🧲', questionEn: 'Which scientific concept does this image represent? 🧲', answerAr: 'المغناطيسية', answerEn: 'Magnetism' },
  { id: 'guess-g18', categoryId: 'guessImage', difficulty: 'hard', type: 'image', questionAr: 'أي معلم عربي تمثله هذه الصورة؟ 🗼🇰🇼', questionEn: 'Which Arab landmark does this image represent? 🗼🇰🇼', answerAr: 'أبراج الكويت', answerEn: 'Kuwait Towers' },
  { id: 'guess-g19', categoryId: 'guessImage', difficulty: 'hard', type: 'image', questionAr: 'أي وسيلة إنقاذ تمثلها هذه الصورة؟ 🚑', questionEn: 'Which emergency vehicle does this image represent? 🚑', answerAr: 'سيارة إسعاف', answerEn: 'Ambulance' },
  { id: 'guess-g20', categoryId: 'guessImage', difficulty: 'hard', type: 'image', questionAr: 'أي مجال تقني تمثله هذه الصورة؟ 🤖', questionEn: 'Which technology field does this image represent? 🤖', answerAr: 'الروبوتات', answerEn: 'Robotics' },
];

const additionPairs: Array<[number, number]> = [
  [4, 5], [7, 6], [8, 9], [12, 3], [14, 5], [11, 7], [9, 8], [13, 6], [16, 4], [18, 5],
  [21, 7], [24, 8], [27, 6], [15, 12], [19, 11], [22, 13], [25, 9], [31, 7], [17, 16], [28, 14],
];

const multiplicationPairs: Array<[number, number]> = [
  [3, 4], [6, 7], [8, 5], [9, 6], [7, 7], [12, 4], [11, 3], [8, 8], [9, 9], [12, 7],
  [5, 11], [6, 12], [7, 8], [4, 13], [9, 5], [3, 14], [15, 4], [11, 6], [13, 5], [16, 3],
];

const squareNumbers = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

const generatedMathQuestions = [
  ...additionPairs.map(([left, right], index) => {
    const correct = left + right;
    return buildQuestion({
      id: `math-add-${index + 1}`,
      categoryId: 'math',
      difficulty: 'easy',
      questionAr: `كم يساوي ${left} + ${right}؟`,
      questionEn: `What is ${left} + ${right}?`,
      answersAr: [String(correct), String(correct + 1), String(correct - 1), String(correct + 2)],
      answersEn: [String(correct), String(correct + 1), String(correct - 1), String(correct + 2)],
      correctAnswerIndex: 0,
    });
  }),
  ...multiplicationPairs.map(([left, right], index) => {
    const correct = left * right;
    return buildQuestion({
      id: `math-mul-${index + 1}`,
      categoryId: 'math',
      difficulty: 'medium',
      questionAr: `كم يساوي ${left} × ${right}؟`,
      questionEn: `What is ${left} × ${right}?`,
      answersAr: [String(correct - right), String(correct), String(correct + right), String(correct + left)],
      answersEn: [String(correct - right), String(correct), String(correct + right), String(correct + left)],
      correctAnswerIndex: 1,
    });
  }),
  ...squareNumbers.map((value, index) => {
    const correct = value * value;
    return buildQuestion({
      id: `math-square-${index + 1}`,
      categoryId: 'math',
      difficulty: 'hard',
      questionAr: `كم يساوي ${value}²؟`,
      questionEn: `What is ${value} squared?`,
      answersAr: [String(correct), String(correct + value), String(correct - value), String(correct + 10)],
      answersEn: [String(correct), String(correct + value), String(correct - value), String(correct + 10)],
      correctAnswerIndex: 0,
    });
  }),
];

export const GENERATED_QUESTIONS: Question[] = [
  ...buildPromptDataset(capitalSeeds),
  ...buildPromptDataset(geographySeeds),
  ...buildPromptDataset(generalSeeds),
  ...buildPromptDataset(animalsSeeds),
  ...buildPromptDataset(scienceSeeds),
  ...buildPromptDataset(spaceSeeds),
  ...buildPromptDataset(sportsSeeds),
  ...buildPromptDataset(footballSeeds),
  ...buildPromptDataset(historySeeds),
  ...buildPromptDataset(technologySeeds),
  ...buildPromptDataset(inventionsSeeds),
  ...buildPromptDataset(islamSeeds),
  ...buildPromptDataset(kuwaitSeeds),
  ...buildPromptDataset(flagsSeeds),
  ...buildPromptDataset(guessImageSeeds),
  ...buildPromptDataset(riddlesSeeds),
  ...buildPromptDataset(musicSeeds),
  ...buildPromptDataset(whoAmISeeds),
  ...buildPromptDataset(completeSentenceSeeds),
  ...buildPromptDataset(arabicSeeds),
  ...buildPromptDataset(englishSeeds),
  ...buildTrueFalseDataset(trueFalseSeeds),
  ...generatedMathQuestions,
];