import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import irisCsv from '@/content/tabular/iris.csv?raw';
import penguinsCsv from '@/content/tabular/penguins.csv?raw';
import { createRng } from '@/core/random/seeded-rng';
import { parseCsv, type ParsedTable } from '@/core/tabular/csv';
import { summarizeColumns } from '@/core/tabular/columns';
import { DEFAULT_MODEL_SETTINGS, evaluateTabular, MODELS_BY_TASK, trainTabular } from '@/core/tabular/models';
import { prepareData, type PrepareOptions } from '@/core/tabular/prepare';
import type { TabularModelKind } from '@/storage/schemas/tabular';
import topicsCsv from '@/content/text/chu-de.csv?raw';
import canteenCsv from '@/content/text/can-tin.csv?raw';
import { evaluateText, prepareText, trainText } from '@/core/text/text-model';
import { evaluateAudio, prepareAudio, trainAudio } from '@/core/audio/audio-model';
import { audioFeatures, fitClip } from '@/core/audio/features';
import { SOUND_KINDS, soundDataset } from '@/core/audio/synthetic-sounds';
import { audioNotebook } from './audio-notebook';
import { imageNotebook } from './image-notebook';
import { textNotebook } from './text-notebook';
import { serializeNotebook, type Notebook } from './notebook';
import { cleanedCsv, SPLIT_COLUMN, tabularNotebook } from './tabular-notebook';

/** Đặt NOTEBOOK_DIR để ghi các notebook ra đĩa rồi chạy thật bằng scripts/check-notebooks.py. */
const OUT_DIR = process.env.NOTEBOOK_DIR;

function save(name: string, nb: Notebook) {
  if (!OUT_DIR) return;
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, name), serializeNotebook(nb));
}

function load(text: string): ParsedTable {
  const r = parseCsv(text);
  if (!r.ok) throw new Error(r.error);
  return r.table;
}

function buildTabular(text: string, options: Omit<PrepareOptions, 'testRatio' | 'seed'>, kind: TabularModelKind) {
  const table = load(text);
  const prepared = prepareData(table, summarizeColumns(table), { ...options, testRatio: 0.2, seed: 5 });
  if (!prepared.ok) throw new Error(prepared.error.code);
  const settings = { ...DEFAULT_MODEL_SETTINGS, kind };
  const trained = trainTabular(prepared.data, settings);
  return { table, data: prepared.data, settings, evaluation: evaluateTabular(trained, prepared.data) };
}

const PENGUIN_CLASSIFY = { target: 'Loài', features: ['Đảo', 'Dài mỏ (mm)', 'Dày mỏ (mm)', 'Dài cánh (mm)', 'Giới tính'], task: 'classification' } as const;
const PENGUIN_MASS = { target: 'Cân nặng (g)', features: ['Dài cánh (mm)', 'Loài', 'Giới tính'], task: 'regression' } as const;

describe('notebook dữ liệu bảng', () => {
  test('bảng đã làm sạch: đủ dòng dùng được, đúng cột Dạy / Kiểm tra, số viết bằng dấu chấm', () => {
    const { table, data } = buildTabular(penguinsCsv, PENGUIN_CLASSIFY, 'tree');
    const cleaned = load(cleanedCsv(table, data));
    expect(cleaned.headers).toEqual([...PENGUIN_CLASSIFY.features, 'Loài', SPLIT_COLUMN]);
    expect(cleaned.rows).toHaveLength(data.train.y.length + data.test.y.length);
    expect(cleaned.rows.filter((r) => r.at(-1) === 'test')).toHaveLength(data.test.y.length);
    expect(cleaned.rows.every((r) => r.every((c) => c !== ''))).toBe(true);
  });

  test('ô có dấu phẩy hoặc ngoặc kép được đặt trong ngoặc kép', () => {
    const rows = Array.from({ length: 12 }, (_, i) => `"Hà Nội, ""cũ""",${i},${i % 2 ? 'có' : 'không'}`);
    const { table, data } = buildTabular(`nơi,điểm,đỗ\n${rows.join('\n')}`, { target: 'đỗ', features: ['nơi', 'điểm'], task: 'classification' }, 'knn');
    const cleaned = load(cleanedCsv(table, data));
    expect(cleaned.rows[0]![0]).toBe('Hà Nội, "cũ"');
  });

  const cases: [string, string, Omit<PrepareOptions, 'testRatio' | 'seed'>, TabularModelKind][] = [
    ...MODELS_BY_TASK.classification.map((k): [string, string, Omit<PrepareOptions, 'testRatio' | 'seed'>, TabularModelKind] => ['penguins', penguinsCsv, PENGUIN_CLASSIFY, k]),
    ...MODELS_BY_TASK.regression.map((k): [string, string, Omit<PrepareOptions, 'testRatio' | 'seed'>, TabularModelKind] => ['penguins', penguinsCsv, PENGUIN_MASS, k]),
    ['iris-2-lop', irisCsv.split('\n').filter((l) => !l.includes('virginica')).join('\n'), { target: 'Loài', features: ['Dài đài hoa (cm)', 'Rộng đài hoa (cm)'], task: 'classification' }, 'logistic'],
  ];

  test.each(cases)('%s · %s: notebook đủ các mục, chứa dữ liệu, mô hình và kết quả của LUP Machine', (name, text, options, kind) => {
    const built = buildTabular(text, options, kind);
    const nb = tabularNotebook({ projectName: 'Thử nghiệm', appVersion: '0.1.0', exportedAt: '2026-11-23', ...built });
    save(`tabular-${name}-${kind}.ipynb`, nb);
    const source = nb.cells.map((c) => c.source.join('')).join('\n');
    expect(nb.cells.filter((c) => c.cell_type === 'code').length).toBe(7);
    expect(source).toContain(`TARGET = "${options.target}"`);
    expect(source).toContain('LUP = {');
    expect(source).toMatch(kind === 'tree' ? /DecisionTreeClassifier\(criterion="gini", max_depth=3/ : /model = /);
    expect(JSON.parse(serializeNotebook(nb))).toEqual(nb);
  });
});

describe('notebook dự án ảnh', () => {
  const rng = createRng(4);
  const vector = (label: number) => Float32Array.from({ length: 1280 }, (_, j) => Math.max(0, rng() - 0.5 + (j % 3 === label ? 0.8 : 0)));
  const make = (n: number) => {
    const ys = Array.from({ length: n }, (_, i) => i % 3);
    return { xs: ys.map(vector), ys };
  };

  test('chứa vector đặc trưng (base64), nhãn, tham số huấn luyện và bước TFLite', () => {
    const nb = imageNotebook({
      projectName: 'Hình học',
      appVersion: '0.1.0',
      exportedAt: '2026-11-23',
      classNames: ['tròn', 'vuông', 'tam giác'],
      train: make(24),
      test: make(6),
      options: { epochs: 30, learningRate: 0.001, batchSize: 16, seed: 42 },
      results: { trainAccuracy: 1, testAccuracy: 5 / 6 },
    });
    save('image-shapes.ipynb', nb);
    const source = nb.cells.map((c) => c.source.join('')).join('\n');
    expect(source).toContain('CLASS_NAMES = ["tròn", "vuông", "tam giác"]');
    expect(source).toContain('EPOCHS, LEARNING_RATE, BATCH_SIZE, SEED = 30, 0.001, 16, 42');
    expect(source).toContain('alpha=0.35');
    expect(source).toContain('TFLiteConverter');
    expect(source).toContain('"test_accuracy": 0.8333333333333334');
    expect(source).not.toContain('data:image');
  });

  test('dự án không có tập Kiểm tra vẫn xuất được', () => {
    const nb = imageNotebook({
      projectName: 'x', appVersion: '0.1.0', exportedAt: 'x', classNames: ['a', 'b', 'c'],
      train: make(6), test: null, options: { epochs: 1, learningRate: 0.01, batchSize: 4, seed: 1 }, results: { trainAccuracy: 0.5, testAccuracy: null },
    });
    const source = nb.cells.map((c) => c.source.join('')).join('\n');
    expect(source).toContain('X_test = decode("")');
    expect(source).not.toContain('"test_accuracy": ');
  });
});

describe('notebook dự án văn bản', () => {
  test.each([
    ['chu-de', 'naive-bayes', 1, topicsCsv],
    ['chu-de', 'logistic', 2, topicsCsv],
    ['can-tin', 'logistic', 1, canteenCsv],
    ['can-tin', 'naive-bayes', 2, canteenCsv],
  ] as const)('%s · %s · n-gram 1–%d: chứa câu, cùng cách tách từ và kết quả của LUP Machine', (name, kind, maxN, csv) => {
    const parsed = parseCsv(csv);
    if (!parsed.ok) throw new Error(parsed.error);
    const prepared = prepareText(parsed.table.rows.map(([label, text]) => ({ label: label!, text: text! })), { testRatio: 0.25, seed: 2, maxN });
    if (!prepared.ok) throw new Error(prepared.error.code);
    const settings = { kind, alpha: 1, c: 10 };
    const trained = trainText(prepared.data, settings);
    const nb = textNotebook({ projectName: 'Văn bản', appVersion: '0.1.0', exportedAt: 'x', data: prepared.data, settings, evaluation: evaluateText(trained, prepared.data) });
    save(`text-${name}-${kind}-${maxN}.ipynb`, nb);
    const source = nb.cells.map((c) => c.source.join('')).join('\n');
    expect(source).toContain(`ngram_range=(1, ${maxN})`);
    expect(source).toContain(String.raw`token_pattern=r"(?u)\b\w+\b"`);
    expect(source).toContain(kind === 'naive-bayes' ? 'MultinomialNB(alpha=1)' : 'LogisticRegression(C=10');
  });
});

describe('notebook dự án âm thanh', () => {
  const examples = soundDataset(1).map((s, i) => ({ id: `c${i}`, label: SOUND_KINDS.indexOf(s.kind), features: audioFeatures(fitClip(s.signal)) }));
  const prepared = prepareAudio(examples, ['chuông', 'còi', 'trống'], { testRatio: 0.25, seed: 3 });
  if (!prepared.ok) throw new Error(prepared.error.code);
  const data = prepared.data;

  test.each(['logistic', 'knn'] as const)('%s: chứa đặc trưng (không chứa âm thanh), cùng mô hình và kết quả', (kind) => {
    const settings = { kind, c: 1, k: 3 };
    const nb = audioNotebook({ projectName: 'Âm thanh', appVersion: '0.1.0', exportedAt: 'x', data, settings, evaluation: evaluateAudio(trainAudio(data, settings), data) });
    save(`audio-${kind}.ipynb`, nb);
    const source = nb.cells.map((c) => c.source.join('')).join('\n');
    expect(source).toContain('CLASS_NAMES = ["chuông", "còi", "trống"]');
    expect(source).toContain(kind === 'knn' ? 'KNeighborsClassifier(n_neighbors=3, algorithm="brute")' : 'LogisticRegression(C=1, max_iter=10000)');
    expect(source.includes('imshow')).toBe(kind === 'logistic');
  });
});
