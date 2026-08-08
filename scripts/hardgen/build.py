#!/usr/bin/env python3
"""
Builds src/services/questions/hardQuestionsPack.ts from per-category JSON data
in scripts/hardgen/data/<categoryId>.json.

Each JSON file is a list of items:
  { "ar": "...", "en": "...", "aAr": ["a","b","c","d"], "aEn": ["a","b","c","d"], "correct": 0 }
or for true/false style:
  { "ar": "...", "en": "...", "aAr": ["صح","خطأ"], "aEn": ["True","False"], "correct": 0 }

Validates: no duplicate question text within a category, exactly the same
answer-option count for all answers of the same question (already enforced by
schema), correct index in range, no empty strings.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(ROOT, 'data')
OUT_FILE = os.path.join(ROOT, '..', '..', 'src', 'services', 'questions', 'hardQuestionsPack.ts')

TYPE_BY_CATEGORY = {
    'trueFalse': 'true_false',
}

errors = []
all_question_texts_global = {}
category_blocks = []
total = 0

for filename in sorted(os.listdir(DATA_DIR)):
    if not filename.endswith('.json'):
        continue
    category_id = filename[:-5]
    with open(os.path.join(DATA_DIR, filename), encoding='utf-8') as f:
        items = json.load(f)

    seen_ar = set()
    q_type = TYPE_BY_CATEGORY.get(category_id, 'multiple_choice')
    expected_len = 2 if q_type == 'true_false' else 4

    lines = []
    for i, item in enumerate(items):
        ar = item['ar'].strip()
        en = item['en'].strip()
        a_ar = item['aAr']
        a_en = item['aEn']
        correct = item['correct']

        norm = re.sub(r'\s+', ' ', ar)
        if norm in seen_ar:
            errors.append(f'{category_id}: duplicate question text within category -> {ar}')
        seen_ar.add(norm)

        if norm in all_question_texts_global:
            errors.append(f'{category_id}: duplicate question text across categories (also in {all_question_texts_global[norm]}) -> {ar}')
        all_question_texts_global[norm] = category_id

        if len(a_ar) != expected_len or len(a_en) != expected_len:
            errors.append(f'{category_id}[{i}]: expected {expected_len} answers, got ar={len(a_ar)} en={len(a_en)} -> {ar}')
        if not (0 <= correct < len(a_ar)):
            errors.append(f'{category_id}[{i}]: correct index {correct} out of range -> {ar}')
        if any(not str(x).strip() for x in a_ar + a_en):
            errors.append(f'{category_id}[{i}]: empty answer option -> {ar}')
        if len(set(a_ar)) != len(a_ar):
            errors.append(f'{category_id}[{i}]: duplicate answer options (ar) -> {ar}')

        qid = f'{category_id}-hard-{i + 1}'

        def ts_str(s):
            return json.dumps(s, ensure_ascii=False)

        def ts_arr(arr):
            return '[' + ', '.join(ts_str(x) for x in arr) + ']'

        correct_ar = a_ar[correct] if 0 <= correct < len(a_ar) else ''
        correct_en = a_en[correct] if 0 <= correct < len(a_en) else ''

        lines.append(
            "  { id: %s, type: %s, categoryId: %s, difficulty: 'hard', ageGroups: ['kids11','teens','adults','family'], "
            "questionAr: %s, questionEn: %s, answersAr: %s, answersEn: %s, correctAnswerIndex: %d, "
            "correctAnswerAr: %s, correctAnswerEn: %s, points: 30, isKidsSafe: true, isActive: true, isPremium: false, source: 'builtin' },"
            % (
                ts_str(qid), ts_str(q_type), ts_str(category_id),
                ts_str(ar), ts_str(en), ts_arr(a_ar), ts_arr(a_en), correct,
                ts_str(correct_ar), ts_str(correct_en),
            )
        )

    total += len(items)
    category_blocks.append((category_id, len(items), lines))

if errors:
    print(f'VALIDATION FAILED: {len(errors)} issue(s)')
    for e in errors[:50]:
        print(' -', e)
    sys.exit(1)

header = "import { Question } from '../../types';\n\nexport const HARD_QUESTIONS_PACK: Question[] = [\n"
footer = "\n];\n"

body_parts = []
for category_id, count, lines in category_blocks:
    body_parts.append(f'  // {category_id}: {count} hard questions')
    body_parts.extend(lines)

with open(OUT_FILE, 'w', encoding='utf-8') as f:
    f.write(header + '\n'.join(body_parts) + footer)

print(f'OK: wrote {total} questions across {len(category_blocks)} categories to {OUT_FILE}')
for category_id, count, _ in category_blocks:
    print(f'  {category_id}: {count}')
