/**
 * Bộ phân loại dùng chung cho các vector đặc trưng có ý nghĩa rõ ràng (âm thanh: 160 ô ảnh phổ mel;
 * tư thế: tọa độ các khớp đã chuẩn hóa). Ví dụ với âm thanh:
 * hồi quy logistic (trên số đã chuẩn hóa theo tập Dạy, để tối ưu ổn định) hoặc k-NN (trên dB gốc:
 * khoảng cách "khác nhau bao nhiêu dB" có ý nghĩa vật lý, còn chuẩn hóa sẽ phóng to tiếng ồn ở các ô im lặng).
 * Với hồi quy logistic, trọng số đọc ngược được thành bản đồ "đặc trưng nào quan trọng" CHÍNH XÁC (từng ô / từng khớp).
 */
import { knnClassify, type KnnNeighbor } from '@/core/algorithms/knn';
import {
  fitLogisticRegression,
  logisticBase,
  logisticLeaning,
  logisticRelativeScore,
  predictLogisticProba,
  type LogisticModel,
} from '@/core/algorithms/logistic-regression';
import { stratifiedSplit } from '@/core/data/split';
import { accuracy, confusionMatrix } from '@/core/ml/metrics';

export interface VectorExample {
  readonly id: string;
  readonly label: number;
  readonly features: ArrayLike<number>;
}

export interface VectorSplit {
  readonly ids: string[];
  /** Đặc trưng gốc (dB). */
  readonly raw: number[][];
  /** Đặc trưng đã chuẩn hóa theo tập Dạy. */
  readonly xs: number[][];
  readonly ys: number[];
}

/** Một đoạn âm thanh đã mã hóa: dB gốc và bản chuẩn hóa. */
export interface EncodedVector {
  readonly raw: readonly number[];
  readonly scaled: readonly number[];
}

export interface VectorData {
  readonly classNames: readonly string[];
  readonly mean: readonly number[];
  readonly std: readonly number[];
  readonly train: VectorSplit;
  readonly test: VectorSplit;
}

export type VectorPrepareError = { readonly code: 'too-few-samples'; readonly count: number } | { readonly code: 'single-class' };

/** Cần ít nhất ngần này mẫu để chia Dạy / Kiểm tra và huấn luyện. */
export const MIN_VECTOR_SAMPLES = 6;

export function standardize(data: Pick<VectorData, 'mean' | 'std'>, features: ArrayLike<number>): number[] {
  return Array.from(features, (v, j) => (v - (data.mean[j] as number)) / (data.std[j] as number));
}

export function encodeVector(data: Pick<VectorData, 'mean' | 'std'>, features: ArrayLike<number>): EncodedVector {
  return { raw: Array.from(features), scaled: standardize(data, features) };
}

export function prepareVectors(
  examples: readonly VectorExample[],
  classNames: readonly string[],
  { testRatio, seed }: { readonly testRatio: number; readonly seed: number },
): { ok: true; data: VectorData } | { ok: false; error: VectorPrepareError } {
  if (examples.length < MIN_VECTOR_SAMPLES) return { ok: false, error: { code: 'too-few-samples', count: examples.length } };
  if (new Set(examples.map((e) => e.label)).size < 2) return { ok: false, error: { code: 'single-class' } };
  const { train, test } = stratifiedSplit(
    examples.map((e) => ({ ...e, label: String(e.label) })),
    { testRatio, seed },
  );
  const order = new Map(examples.map((e, i) => [e.id, i]));
  const byOrder = (a: { id: string }, b: { id: string }) => (order.get(a.id) as number) - (order.get(b.id) as number);
  const trainRaw = [...train].sort(byOrder);
  const testRaw = [...test].sort(byOrder);
  const dim = examples[0]?.features.length ?? 0;
  const mean = Array.from({ length: dim }, (_, j) => trainRaw.reduce((s, e) => s + (e.features[j] as number), 0) / trainRaw.length);
  const std = mean.map((m, j) => Math.sqrt(trainRaw.reduce((s, e) => s + ((e.features[j] as number) - m) ** 2, 0) / trainRaw.length) || 1);
  const scaler = { mean, std };
  const toSplit = (list: typeof trainRaw): VectorSplit => ({
    ids: list.map((e) => e.id),
    raw: list.map((e) => Array.from(e.features)),
    xs: list.map((e) => standardize(scaler, e.features)),
    ys: list.map((e) => Number(e.label)),
  });
  return { ok: true, data: { classNames, mean, std, train: toSplit(trainRaw), test: toSplit(testRaw) } };
}

export type VectorModelKind = 'logistic' | 'knn';

export interface VectorModelSettings {
  readonly kind: VectorModelKind;
  readonly c: number;
  readonly k: number;
}

export type TrainedVectorModel =
  | { readonly kind: 'logistic'; readonly model: LogisticModel }
  | { readonly kind: 'knn'; readonly k: number; readonly train: VectorSplit; readonly numClasses: number };

export function trainVectorModel(data: VectorData, settings: VectorModelSettings): TrainedVectorModel {
  const numClasses = data.classNames.length;
  if (settings.kind === 'knn') return { kind: 'knn', k: settings.k, train: data.train, numClasses };
  return { kind: 'logistic', model: fitLogisticRegression(data.train.xs, data.train.ys, numClasses, { c: settings.c }) };
}

export interface VectorPrediction {
  readonly label: number;
  readonly proba: readonly number[];
  readonly neighbors: readonly KnnNeighbor[] | null;
}

export function predictVector(trained: TrainedVectorModel, clip: EncodedVector): VectorPrediction {
  if (trained.kind === 'knn') {
    const r = knnClassify(trained.train.raw, trained.train.ys, trained.numClasses, clip.raw, trained.k);
    return { label: r.label, proba: r.votes.map((v) => v / r.neighbors.length), neighbors: r.neighbors };
  }
  const proba = predictLogisticProba(trained.model, clip.scaled);
  return { label: proba.indexOf(Math.max(...proba)), proba, neighbors: null };
}

export interface VectorEvaluation {
  readonly trainAccuracy: number | null;
  readonly testAccuracy: number | null;
  readonly confusion: number[][];
  readonly testPredictions: number[];
}

export function evaluateVectors(trained: TrainedVectorModel, data: VectorData): VectorEvaluation {
  const predict = (split: VectorSplit) => split.raw.map((raw, i) => predictVector(trained, { raw, scaled: split.xs[i] as number[] }).label);
  const trainPred = predict(data.train);
  const testPred = predict(data.test);
  return {
    trainAccuracy: accuracy(data.train.ys, trainPred),
    testAccuracy: accuracy(data.test.ys, testPred),
    confusion: confusionMatrix(data.test.ys, testPred, data.classNames.length),
    testPredictions: testPred,
  };
}

/** Bản đồ 160 ô: ô nào làm điểm của lớp c tăng (dương) hay giảm (âm) khi to hơn mức trung bình. Chỉ có với hồi quy logistic. */
export function importanceMap(trained: TrainedVectorModel, c: number): number[] | null {
  return trained.kind === 'logistic' ? logisticLeaning(trained.model, c) : null;
}

export interface FeatureContribution {
  /** Đóng góp của từng ô (160) = giá trị đã chuẩn hóa × trọng số nghiêng về lớp c. */
  readonly cells: number[];
  readonly base: number;
  readonly total: number;
}

/** Đóng góp của từng ô ảnh phổ của MỘT đoạn âm thanh; base + Σ cells = điểm tương đối của lớp c (chính xác). */
export function contributionMap(trained: TrainedVectorModel, x: readonly number[], c: number): FeatureContribution | null {
  if (trained.kind !== 'logistic') return null;
  const leaning = logisticLeaning(trained.model, c);
  const cells = x.map((v, j) => v * (leaning[j] as number));
  const base = logisticBase(trained.model, c);
  return { cells, base, total: base + cells.reduce((a, b) => a + b, 0) };
}

export { logisticRelativeScore as vectorRelativeScore };
