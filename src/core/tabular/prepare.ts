/**
 * Biến bảng dữ liệu thành ma trận số cho mô hình:
 * - cột số giữ nguyên ("thô") và được chuẩn hóa z = (x − trung bình) / độ lệch chuẩn (tính trên tập Dạy);
 * - cột phân loại được mã hóa one-hot: mỗi giá trị thành một cột 0/1;
 * - dòng thiếu giá trị ở cột cần dự đoán hoặc cột đặc trưng bị loại (có đếm để báo cho học sinh).
 */
import { stratifiedSplit } from '@/core/data/split';
import { createRng, shuffle } from '@/core/random/seeded-rng';
import type { ParsedTable } from './csv';
import { compareLabels, isMissing, MAX_CLASSES, parseNumber, type ColumnSummary, type TaskKind } from './columns';

export const MAX_CATEGORIES_PER_FEATURE = 20;
export const MIN_USABLE_ROWS = 10;

export type FeatureEncoder =
  | { readonly kind: 'numeric'; readonly name: string; readonly mean: number; readonly std: number }
  | { readonly kind: 'categorical'; readonly name: string; readonly categories: readonly string[] };

export interface EncodedSplit {
  /** Giá trị gốc (cột số) và 0/1 (one-hot) — dùng cho cây quyết định, hồi quy tuyến tính. */
  readonly raw: number[][];
  /** Đã chuẩn hóa — dùng cho k-NN và hồi quy logistic (để các cột có cùng thang đo). */
  readonly scaled: number[][];
  /** Nhãn (chỉ số lớp) hoặc giá trị cần dự đoán. */
  readonly y: number[];
  /** Số thứ tự dòng trong bảng gốc (bắt đầu từ 1). */
  readonly rowNumbers: number[];
}

export interface PreparedData {
  readonly task: TaskKind;
  readonly target: string;
  readonly encoders: readonly FeatureEncoder[];
  /** Tên các cột sau khi mã hóa, ví dụ "Đảo = Biscoe". */
  readonly featureNames: readonly string[];
  readonly classNames: readonly string[];
  readonly train: EncodedSplit;
  readonly test: EncodedSplit;
  readonly dropped: number;
}

export interface PrepareOptions {
  readonly target: string;
  readonly features: readonly string[];
  readonly task: TaskKind;
  readonly testRatio: number;
  readonly seed: number;
}

export type PrepareError =
  | { readonly code: 'no-features' }
  | { readonly code: 'target-not-numeric' }
  | { readonly code: 'too-many-classes'; readonly count: number }
  | { readonly code: 'single-class' }
  | { readonly code: 'too-many-categories'; readonly column: string; readonly count: number }
  | { readonly code: 'too-few-rows'; readonly count: number };

export type PrepareResult = { readonly ok: true; readonly data: PreparedData } | { readonly ok: false; readonly error: PrepareError };

interface Row {
  readonly id: string;
  readonly label: string;
  readonly rowNumber: number;
  readonly cells: readonly string[];
}

function mean(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function buildEncoders(train: readonly Row[], features: readonly ColumnSummary[]): FeatureEncoder[] | PrepareError {
  const encoders: FeatureEncoder[] = [];
  for (const [f, col] of features.entries()) {
    if (col.kind === 'numeric') {
      const values = train.map((r) => parseNumber(r.cells[f] as string) as number);
      const m = mean(values);
      const std = Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
      encoders.push({ kind: 'numeric', name: col.name, mean: m, std: std > 0 ? std : 1 });
    } else {
      const categories = [...new Set(train.map((r) => r.cells[f] as string))].sort(compareLabels);
      if (categories.length > MAX_CATEGORIES_PER_FEATURE) return { code: 'too-many-categories', column: col.name, count: categories.length };
      encoders.push({ kind: 'categorical', name: col.name, categories });
    }
  }
  return encoders;
}

export function expandedFeatureNames(encoders: readonly FeatureEncoder[]): string[] {
  return encoders.flatMap((e) => (e.kind === 'numeric' ? [e.name] : e.categories.map((c) => `${e.name} = ${c}`)));
}

/** Mã hóa một dòng (các ô theo thứ tự đặc trưng). Trả về null nếu thiếu hoặc sai kiểu số. */
export function encodeCells(encoders: readonly FeatureEncoder[], cells: readonly string[]): { raw: number[]; scaled: number[] } | null {
  const raw: number[] = [];
  const scaled: number[] = [];
  for (const [i, e] of encoders.entries()) {
    const cell = cells[i] ?? '';
    if (isMissing(cell)) return null;
    if (e.kind === 'numeric') {
      const v = parseNumber(cell);
      if (v === null) return null;
      raw.push(v);
      scaled.push((v - e.mean) / e.std);
    } else {
      // giá trị chưa gặp trong tập Dạy: mọi cột one-hot bằng 0
      for (const c of e.categories) {
        const bit = c === cell.trim() ? 1 : 0;
        raw.push(bit);
        scaled.push(bit);
      }
    }
  }
  return { raw, scaled };
}

function encodeSplit(rows: readonly Row[], encoders: readonly FeatureEncoder[], toY: (label: string) => number): EncodedSplit {
  const out: EncodedSplit = { raw: [], scaled: [], y: [], rowNumbers: [] };
  for (const r of rows) {
    const encoded = encodeCells(encoders, r.cells) as { raw: number[]; scaled: number[] };
    out.raw.push(encoded.raw);
    out.scaled.push(encoded.scaled);
    out.y.push(toY(r.label));
    out.rowNumbers.push(r.rowNumber);
  }
  return out;
}

function splitRows(rows: readonly Row[], task: TaskKind, testRatio: number, seed: number): { train: Row[]; test: Row[] } {
  if (task === 'classification') return stratifiedSplit(rows, { testRatio, seed });
  const shuffled = shuffle(rows, createRng(seed));
  const testCount = Math.round(rows.length * testRatio);
  const byRow = (a: Row, b: Row) => a.rowNumber - b.rowNumber;
  return { test: shuffled.slice(0, testCount).sort(byRow), train: shuffled.slice(testCount).sort(byRow) };
}

export function prepareData(table: ParsedTable, columns: readonly ColumnSummary[], options: PrepareOptions): PrepareResult {
  const fail = (error: PrepareError): PrepareResult => ({ ok: false, error });
  const target = columns.find((c) => c.name === options.target);
  const features = options.features
    .filter((name) => name !== options.target)
    .map((name) => columns.find((c) => c.name === name))
    .filter((c): c is ColumnSummary => c !== undefined);
  if (!target || features.length === 0) return fail({ code: 'no-features' });
  if (options.task === 'regression' && target.kind !== 'numeric') return fail({ code: 'target-not-numeric' });

  const rows: Row[] = [];
  table.rows.forEach((cells, i) => {
    const label = (cells[target.index] as string).trim();
    const featureCells = features.map((f) => cells[f.index] as string);
    const usable =
      !isMissing(label) &&
      featureCells.every((c, j) => !isMissing(c) && (features[j]!.kind !== 'numeric' || parseNumber(c) !== null));
    if (usable) rows.push({ id: String(i), label, rowNumber: i + 1, cells: featureCells });
  });
  if (rows.length < MIN_USABLE_ROWS) return fail({ code: 'too-few-rows', count: rows.length });

  let classNames: string[] = [];
  let toY: (label: string) => number;
  if (options.task === 'classification') {
    classNames = [...new Set(rows.map((r) => r.label))].sort(compareLabels);
    if (classNames.length > MAX_CLASSES) return fail({ code: 'too-many-classes', count: classNames.length });
    if (classNames.length < 2) return fail({ code: 'single-class' });
    const index = new Map(classNames.map((c, i) => [c, i]));
    toY = (label) => index.get(label) as number;
  } else {
    toY = (label) => parseNumber(label) as number;
  }

  const { train, test } = splitRows(rows, options.task, options.testRatio, options.seed);
  const encoders = buildEncoders(train, features);
  if (!Array.isArray(encoders)) return fail(encoders);

  return {
    ok: true,
    data: {
      task: options.task,
      target: target.name,
      encoders,
      featureNames: expandedFeatureNames(encoders),
      classNames,
      train: encodeSplit(train, encoders, toY),
      test: encodeSplit(test, encoders, toY),
      dropped: table.rows.length - rows.length,
    },
  };
}
