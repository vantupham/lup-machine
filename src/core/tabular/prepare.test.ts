import penguinsCsv from '@/content/tabular/penguins.csv?raw';
import irisCsv from '@/content/tabular/iris.csv?raw';
import { parseCsv, type ParsedTable } from './csv';
import { summarizeColumns } from './columns';
import { encodeCells, prepareData, type PrepareOptions } from './prepare';

function load(text: string): ParsedTable {
  const r = parseCsv(text);
  if (!r.ok) throw new Error(r.error);
  return r.table;
}

const penguins = load(penguinsCsv);
const penguinCols = summarizeColumns(penguins);
const base: PrepareOptions = {
  target: 'Loài',
  features: ['Đảo', 'Dài mỏ (mm)', 'Dày mỏ (mm)'],
  task: 'classification',
  testRatio: 0.2,
  seed: 7,
};

describe('prepareData với bộ Palmer Penguins', () => {
  const result = prepareData(penguins, penguinCols, base);
  if (!result.ok) throw new Error(result.error.code);
  const data = result.data;

  test('loại dòng thiếu giá trị và báo số dòng bị loại', () => {
    expect(data.dropped).toBe(2); // 2 con chim thiếu số đo mỏ
    expect(data.train.y.length + data.test.y.length).toBe(342);
  });

  test('cột phân loại được mã hóa one-hot, cột số giữ tên', () => {
    expect(data.featureNames).toEqual(['Đảo = Biscoe', 'Đảo = Dream', 'Đảo = Torgersen', 'Dài mỏ (mm)', 'Dày mỏ (mm)']);
    data.train.raw.forEach((row) => expect(row[0]! + row[1]! + row[2]!).toBe(1));
  });

  test('chuẩn hóa dùng trung bình và độ lệch chuẩn của tập Dạy', () => {
    const col = data.train.scaled.map((r) => r[3]!);
    const m = col.reduce((a, b) => a + b, 0) / col.length;
    const sd = Math.sqrt(col.reduce((s, v) => s + (v - m) ** 2, 0) / col.length);
    expect(m).toBeCloseTo(0, 9);
    expect(sd).toBeCloseTo(1, 9);
  });

  test('chia phân tầng: mỗi loài đều có trong tập Kiểm tra; tái lập theo seed', () => {
    expect(data.classNames).toEqual(['Adelie', 'Chinstrap', 'Gentoo']);
    expect(new Set(data.test.y)).toEqual(new Set([0, 1, 2]));
    const again = prepareData(penguins, penguinCols, base);
    expect(again.ok && again.data.test.rowNumbers).toEqual(data.test.rowNumbers);
  });

  test('mã hóa một dòng mới; giá trị lạ cho one-hot toàn 0; ô thiếu trả về null', () => {
    const e = encodeCells(data.encoders, ['Dream', '40', '18'])!;
    expect(e.raw).toEqual([0, 1, 0, 40, 18]);
    expect(encodeCells(data.encoders, ['Hòn Tre', '40', '18'])!.raw.slice(0, 3)).toEqual([0, 0, 0]);
    expect(encodeCells(data.encoders, ['Dream', '', '18'])).toBeNull();
    expect(encodeCells(data.encoders, ['Dream', 'abc', '18'])).toBeNull();
  });
});

describe('prepareData – hồi quy và lỗi', () => {
  test('hồi quy: y là số, chia ngẫu nhiên theo tỉ lệ', () => {
    const r = prepareData(penguins, penguinCols, { ...base, target: 'Cân nặng (g)', features: ['Dài cánh (mm)'], task: 'regression' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.classNames).toEqual([]);
    expect(r.data.test.y.length).toBe(Math.round(342 * 0.2));
    expect(r.data.train.y.every((v) => v > 2000)).toBe(true);
  });

  test.each([
    [{ features: [] }, 'no-features'],
    [{ features: ['Loài'] }, 'no-features'],
    [{ task: 'regression' as const }, 'target-not-numeric'],
    [{ target: 'Dài mỏ (mm)', features: ['Đảo'] }, 'too-many-classes'],
  ])('lỗi %j → %s', (patch, code) => {
    const r = prepareData(penguins, penguinCols, { ...base, ...patch });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe(code);
  });

  test('quá ít dòng, một lớp duy nhất, quá nhiều giá trị phân loại', () => {
    const small = load('a,b\n1,x\n2,y');
    expect(prepareData(small, summarizeColumns(small), { ...base, target: 'b', features: ['a'] })).toMatchObject({ ok: false, error: { code: 'too-few-rows' } });
    const one = load(`a,b\n${Array.from({ length: 12 }, (_, i) => `${i},x`).join('\n')}`);
    expect(prepareData(one, summarizeColumns(one), { ...base, target: 'b', features: ['a'] })).toMatchObject({ ok: false, error: { code: 'single-class' } });
    const ids = load(`id,b\n${Array.from({ length: 40 }, (_, i) => `ma${i},${i % 2}`).join('\n')}`);
    expect(prepareData(ids, summarizeColumns(ids), { ...base, target: 'b', features: ['id'], testRatio: 0.1 })).toMatchObject({ ok: false, error: { code: 'too-many-categories' } });
  });

  test('Iris: đủ 150 dòng, không dòng nào bị loại', () => {
    const iris = load(irisCsv);
    const r = prepareData(iris, summarizeColumns(iris), { ...base, target: 'Loài', features: iris.headers.slice(0, 4) });
    expect(r.ok && r.data.dropped).toBe(0);
    expect(r.ok && r.data.train.y.length + r.data.test.y.length).toBe(150);
  });
});
