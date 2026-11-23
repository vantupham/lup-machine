/**
 * Mô hình phân loại âm thanh trên 160 đặc trưng ảnh phổ mel (40 dải × 4 đoạn thời gian):
 * hồi quy logistic (trên số đã chuẩn hóa theo tập Dạy, để tối ưu ổn định) hoặc k-NN (trên dB gốc:
 * khoảng cách "khác nhau bao nhiêu dB" có ý nghĩa vật lý, còn chuẩn hóa sẽ phóng to tiếng ồn ở các ô im lặng).
 * Với hồi quy logistic, trọng số đọc ngược được thành "bản đồ vùng phổ quan trọng" CHÍNH XÁC (40 × 4 ô).
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

export interface AudioExample {
  readonly id: string;
  readonly label: number;
  readonly features: ArrayLike<number>;
}

export interface AudioSplit {
  readonly ids: string[];
  /** Đặc trưng gốc (dB). */
  readonly raw: number[][];
  /** Đặc trưng đã chuẩn hóa theo tập Dạy. */
  readonly xs: number[][];
  readonly ys: number[];
}

/** Một đoạn âm thanh đã mã hóa: dB gốc và bản chuẩn hóa. */
export interface EncodedClip {
  readonly raw: readonly number[];
  readonly scaled: readonly number[];
}

export interface AudioData {
  readonly classNames: readonly string[];
  readonly mean: readonly number[];
  readonly std: readonly number[];
  readonly train: AudioSplit;
  readonly test: AudioSplit;
}

export type AudioPrepareError = { readonly code: 'too-few-clips'; readonly count: number } | { readonly code: 'single-class' };

export const MIN_CLIPS = 6;

export function standardize(data: Pick<AudioData, 'mean' | 'std'>, features: ArrayLike<number>): number[] {
  return Array.from(features, (v, j) => (v - (data.mean[j] as number)) / (data.std[j] as number));
}

export function encodeClip(data: Pick<AudioData, 'mean' | 'std'>, features: ArrayLike<number>): EncodedClip {
  return { raw: Array.from(features), scaled: standardize(data, features) };
}

export function prepareAudio(
  examples: readonly AudioExample[],
  classNames: readonly string[],
  { testRatio, seed }: { readonly testRatio: number; readonly seed: number },
): { ok: true; data: AudioData } | { ok: false; error: AudioPrepareError } {
  if (examples.length < MIN_CLIPS) return { ok: false, error: { code: 'too-few-clips', count: examples.length } };
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
  const toSplit = (list: typeof trainRaw): AudioSplit => ({
    ids: list.map((e) => e.id),
    raw: list.map((e) => Array.from(e.features)),
    xs: list.map((e) => standardize(scaler, e.features)),
    ys: list.map((e) => Number(e.label)),
  });
  return { ok: true, data: { classNames, mean, std, train: toSplit(trainRaw), test: toSplit(testRaw) } };
}

export type AudioModelKind = 'logistic' | 'knn';

export interface AudioModelSettings {
  readonly kind: AudioModelKind;
  readonly c: number;
  readonly k: number;
}

export type TrainedAudio =
  | { readonly kind: 'logistic'; readonly model: LogisticModel }
  | { readonly kind: 'knn'; readonly k: number; readonly train: AudioSplit; readonly numClasses: number };

export function trainAudio(data: AudioData, settings: AudioModelSettings): TrainedAudio {
  const numClasses = data.classNames.length;
  if (settings.kind === 'knn') return { kind: 'knn', k: settings.k, train: data.train, numClasses };
  return { kind: 'logistic', model: fitLogisticRegression(data.train.xs, data.train.ys, numClasses, { c: settings.c }) };
}

export interface AudioPrediction {
  readonly label: number;
  readonly proba: readonly number[];
  readonly neighbors: readonly KnnNeighbor[] | null;
}

export function predictAudio(trained: TrainedAudio, clip: EncodedClip): AudioPrediction {
  if (trained.kind === 'knn') {
    const r = knnClassify(trained.train.raw, trained.train.ys, trained.numClasses, clip.raw, trained.k);
    return { label: r.label, proba: r.votes.map((v) => v / r.neighbors.length), neighbors: r.neighbors };
  }
  const proba = predictLogisticProba(trained.model, clip.scaled);
  return { label: proba.indexOf(Math.max(...proba)), proba, neighbors: null };
}

export interface AudioEvaluation {
  readonly trainAccuracy: number | null;
  readonly testAccuracy: number | null;
  readonly confusion: number[][];
  readonly testPredictions: number[];
}

export function evaluateAudio(trained: TrainedAudio, data: AudioData): AudioEvaluation {
  const predict = (split: AudioSplit) => split.raw.map((raw, i) => predictAudio(trained, { raw, scaled: split.xs[i] as number[] }).label);
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
export function importanceMap(trained: TrainedAudio, c: number): number[] | null {
  return trained.kind === 'logistic' ? logisticLeaning(trained.model, c) : null;
}

export interface AudioContribution {
  /** Đóng góp của từng ô (160) = giá trị đã chuẩn hóa × trọng số nghiêng về lớp c. */
  readonly cells: number[];
  readonly base: number;
  readonly total: number;
}

/** Đóng góp của từng ô ảnh phổ của MỘT đoạn âm thanh; base + Σ cells = điểm tương đối của lớp c (chính xác). */
export function contributionMap(trained: TrainedAudio, x: readonly number[], c: number): AudioContribution | null {
  if (trained.kind !== 'logistic') return null;
  const leaning = logisticLeaning(trained.model, c);
  const cells = x.map((v, j) => v * (leaning[j] as number));
  const base = logisticBase(trained.model, c);
  return { cells, base, total: base + cells.reduce((a, b) => a + b, 0) };
}

export { logisticRelativeScore as audioRelativeScore };
