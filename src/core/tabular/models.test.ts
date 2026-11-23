import irisCsv from '@/content/tabular/iris.csv?raw';
import penguinsCsv from '@/content/tabular/penguins.csv?raw';
import { parseCsv, type ParsedTable } from './csv';
import { summarizeColumns } from './columns';
import { prepareData, type PreparedData, type PrepareOptions } from './prepare';
import {
  contributions,
  defaultModelFor,
  DEFAULT_MODEL_SETTINGS,
  evaluateTabular,
  logisticRowScores,
  MODELS_BY_TASK,
  predictRow,
  trainTabular,
  treeImportances,
} from './models';

function load(text: string): ParsedTable {
  const r = parseCsv(text);
  if (!r.ok) throw new Error(r.error);
  return r.table;
}

function prepared(text: string, options: Omit<PrepareOptions, 'testRatio' | 'seed'>): PreparedData {
  const t = load(text);
  const r = prepareData(t, summarizeColumns(t), { ...options, testRatio: 0.2, seed: 3 });
  if (!r.ok) throw new Error(r.error.code);
  return r.data;
}

const iris = prepared(irisCsv, {
  target: 'Loài',
  features: ['Dài đài hoa (cm)', 'Rộng đài hoa (cm)', 'Dài cánh hoa (cm)', 'Rộng cánh hoa (cm)'],
  task: 'classification',
});
const mass = prepared(penguinsCsv, { target: 'Cân nặng (g)', features: ['Dài cánh (mm)', 'Loài'], task: 'regression' });

describe('mô hình phân loại trên Iris', () => {
  test.each(MODELS_BY_TASK.classification)('%s: đúng trên tập Kiểm tra ≥ 85%', (kind) => {
    const trained = trainTabular(iris, { ...DEFAULT_MODEL_SETTINGS, kind });
    const ev = evaluateTabular(trained, iris);
    expect(ev.task).toBe('classification');
    if (ev.task !== 'classification') return;
    expect(ev.test.accuracy).toBeGreaterThanOrEqual(0.85);
    expect(ev.test.confusion.flat().reduce((a, b) => a + b, 0)).toBe(iris.test.y.length);
  });

  test('cây: có đường đi và độ quan trọng; cánh hoa quan trọng hơn đài hoa', () => {
    const trained = trainTabular(iris, { ...DEFAULT_MODEL_SETTINGS, kind: 'tree' });
    const p = predictRow(trained, { raw: iris.test.raw[0]!, scaled: iris.test.scaled[0]! });
    expect(p.path?.[0]).toBe(0);
    const imp = treeImportances(trained)!;
    expect(imp[2]! + imp[3]!).toBeGreaterThan(imp[0]! + imp[1]!);
  });

  test('logistic: điểm của mỗi lớp = độ lệch + tổng đóng góp', () => {
    const trained = trainTabular(iris, { ...DEFAULT_MODEL_SETTINGS, kind: 'logistic' });
    const row = { raw: iris.test.raw[1]!, scaled: iris.test.scaled[1]! };
    const scores = logisticRowScores(trained, row)!;
    const contrib = contributions(trained, row)!;
    if (trained.kind !== 'logistic') throw new Error('sai loại');
    scores.forEach((s, k) => expect(s).toBeCloseTo(trained.model.intercepts[k]! + contrib[k]!.reduce((a, b) => a + b, 0), 9));
    expect(predictRow(trained, row).proba!.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  test('k-NN: trả về k láng giềng, xác suất là tỉ lệ phiếu', () => {
    const trained = trainTabular(iris, { ...DEFAULT_MODEL_SETTINGS, kind: 'knn', k: 4 });
    const p = predictRow(trained, { raw: iris.test.raw[0]!, scaled: iris.test.scaled[0]! });
    expect(p.neighbors).toHaveLength(4);
    expect(p.proba!.every((v) => [0, 0.25, 0.5, 0.75, 1].includes(v))).toBe(true);
    expect(contributions(trained, { raw: [], scaled: [] })).toBeNull();
    expect(treeImportances(trained)).toBeNull();
    expect(logisticRowScores(trained, { raw: [], scaled: [] })).toBeNull();
  });
});

describe('mô hình hồi quy: dự đoán cân nặng chim cánh cụt', () => {
  test('hồi quy tuyến tính: R² Kiểm tra > 0.7, hệ số cánh dương (cánh dài → nặng hơn)', () => {
    const trained = trainTabular(mass, { ...DEFAULT_MODEL_SETTINGS, kind: 'linear' });
    const ev = evaluateTabular(trained, mass);
    if (ev.task !== 'regression') throw new Error('sai loại');
    expect(ev.test.r2).toBeGreaterThan(0.7);
    if (trained.kind === 'linear') expect(trained.model.weights[0]).toBeGreaterThan(0);
    const row = { raw: mass.test.raw[0]!, scaled: mass.test.scaled[0]! };
    const total = contributions(trained, row)![0]!.reduce((a, b) => a + b, 0);
    if (trained.kind === 'linear') expect(predictRow(trained, row).value).toBeCloseTo(trained.model.intercept + total, 6);
  });

  test('k-NN hồi quy: giá trị là trung bình cân nặng của k láng giềng', () => {
    const trained = trainTabular(mass, { ...DEFAULT_MODEL_SETTINGS, kind: 'knn-regression', k: 3 });
    const p = predictRow(trained, { raw: mass.test.raw[0]!, scaled: mass.test.scaled[0]! });
    const avg = p.neighbors!.reduce((s, n) => s + mass.train.y[n.index]!, 0) / 3;
    expect(p.value).toBeCloseTo(avg);
    expect(p.proba).toBeNull();
  });

  test('mô hình mặc định theo bài toán; mô hình sai loại bài toán bị từ chối', () => {
    expect(defaultModelFor('classification').kind).toBe('tree');
    expect(defaultModelFor('regression').kind).toBe('linear');
    expect(() => trainTabular(mass, { ...DEFAULT_MODEL_SETTINGS, kind: 'tree' })).toThrow(RangeError);
  });
});
