import { createRng, type Rng } from '@/core/random/seeded-rng';
import { gaussian } from '@/core/algorithms/datasets-2d';
import { fitLogisticRegression, predictLogistic, type LogisticModel } from '@/core/algorithms/logistic-regression';

/**
 * Bộ dữ liệu "bẫy" cho Phòng đạo đức AI: chẩn đoán bệnh lá lúa từ 2 số đo.
 * Dữ liệu giả lập theo seed (không phải số đo thật), thiết kế để cho thấy:
 * - lá lúa Miền núi (trời lạnh) vàng hơn kể cả khi khỏe;
 * - dữ liệu huấn luyện gần như toàn ở Đồng bằng → mô hình kém hẳn với Miền núi,
 *   dù độ chính xác chung vẫn trông cao.
 */
export type Region = 'lowland' | 'mountain';
export const REGIONS: readonly Region[] = ['lowland', 'mountain'];
/** 0 = khỏe, 1 = bệnh. */
export type Health = 0 | 1;

export interface LeafSample {
  readonly region: Region;
  /** Độ vàng lá (%), 0–100. */
  readonly yellow: number;
  /** Số đốm trên lá. */
  readonly spots: number;
  readonly label: Health;
}

interface Profile {
  readonly yellow: readonly [mean: number, sd: number];
  readonly spots: readonly [mean: number, sd: number];
}

/** Phân bố của từng vùng × tình trạng lá. Miền núi: lá khỏe vàng hơn (lạnh), lá bệnh cũng vàng hơn. */
export const LEAF_PROFILES: Readonly<Record<Region, Readonly<Record<Health, Profile>>>> = {
  lowland: { 0: { yellow: [22, 7], spots: [3, 1.8] }, 1: { yellow: [48, 8], spots: [6, 2.2] } },
  mountain: { 0: { yellow: [44, 7], spots: [3, 1.8] }, 1: { yellow: [68, 8], spots: [6, 2.2] } },
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

function sampleLeaf(rng: Rng, region: Region, label: Health): LeafSample {
  const p = LEAF_PROFILES[region][label];
  return {
    region,
    label,
    yellow: round1(clamp(p.yellow[0] + gaussian(rng) * p.yellow[1], 0, 100)),
    spots: Math.round(clamp(p.spots[0] + gaussian(rng) * p.spots[1], 0, 30)),
  };
}

/** n mẫu mỗi tình trạng (khỏe / bệnh) của một vùng, thứ tự xen kẽ. */
export function generateLeaves(seed: number, region: Region, perLabel: number): LeafSample[] {
  const rng = createRng(seed);
  const out: LeafSample[] = [];
  for (let i = 0; i < perLabel; i++) out.push(sampleLeaf(rng, region, 0), sampleLeaf(rng, region, 1));
  return out;
}

/** Số mẫu mỗi tình trạng trong từng phần của thí nghiệm. */
export const EXPERIMENT_SIZES = {
  trainLowland: 100,
  trainMountainFew: 10,
  trainMountainMore: 100,
  testPerRegion: 50,
} as const;

/** Seed cố định cho từng phần: dữ liệu Kiểm tra không bao giờ trùng dữ liệu Huấn luyện. */
const SEEDS = { lowland: 11, mountainFew: 23, mountainMore: 37, testLowland: 101, testMountain: 103 } as const;

export interface BiasExperimentData {
  readonly trainBiased: readonly LeafSample[];
  readonly trainBalanced: readonly LeafSample[];
  readonly test: readonly LeafSample[];
}

/** offset: đổi seed để kiểm tra kết quả không phụ thuộc một lần lấy mẫu may mắn. */
export function biasExperimentData(offset = 0): BiasExperimentData {
  const lowland = generateLeaves(SEEDS.lowland + offset, 'lowland', EXPERIMENT_SIZES.trainLowland);
  const mountainFew = generateLeaves(SEEDS.mountainFew + offset, 'mountain', EXPERIMENT_SIZES.trainMountainFew);
  const mountainMore = generateLeaves(SEEDS.mountainMore + offset, 'mountain', EXPERIMENT_SIZES.trainMountainMore);
  return {
    trainBiased: [...lowland, ...mountainFew],
    trainBalanced: [...lowland, ...mountainFew, ...mountainMore],
    test: [
      ...generateLeaves(SEEDS.testLowland + offset, 'lowland', EXPERIMENT_SIZES.testPerRegion),
      ...generateLeaves(SEEDS.testMountain + offset, 'mountain', EXPERIMENT_SIZES.testPerRegion),
    ],
  };
}

/**
 * Mô hình hồi quy logistic, chuẩn hóa theo dữ liệu Huấn luyện.
 * Mặc định chỉ nhìn 2 số đo (không biết lá ở vùng nào); `useRegion` thêm cột "ở Miền núi" (0/1).
 */
export interface LeafModel {
  readonly logistic: LogisticModel;
  readonly useRegion: boolean;
  readonly mean: readonly number[];
  readonly std: readonly number[];
}

function features(s: LeafSample, useRegion: boolean): number[] {
  return useRegion ? [s.yellow, s.spots, s.region === 'mountain' ? 1 : 0] : [s.yellow, s.spots];
}

function standardize(x: readonly number[], mean: readonly number[], std: readonly number[]): number[] {
  return x.map((v, j) => (v - mean[j]!) / std[j]!);
}

export function trainLeafModel(train: readonly LeafSample[], { useRegion = false }: { readonly useRegion?: boolean } = {}): LeafModel {
  const xs = train.map((s) => features(s, useRegion));
  const d = xs[0]?.length ?? 0;
  const mean = Array.from({ length: d }, (_, j) => xs.reduce((a, x) => a + x[j]!, 0) / xs.length);
  const std = Array.from({ length: d }, (_, j) => Math.sqrt(xs.reduce((a, x) => a + (x[j]! - mean[j]!) ** 2, 0) / xs.length) || 1);
  const logistic = fitLogisticRegression(
    xs.map((x) => standardize(x, mean, std)),
    train.map((s) => s.label),
    2,
  );
  return { logistic, useRegion, mean, std };
}

export function predictLeaf(model: LeafModel, s: LeafSample): Health {
  return predictLogistic(model.logistic, standardize(features(s, model.useRegion), model.mean, model.std)) as Health;
}

export interface GroupScore {
  readonly total: number;
  readonly correct: number;
  /** Lá khỏe bị báo bệnh (báo động nhầm). */
  readonly falseAlarm: number;
  /** Lá bệnh bị bỏ sót. */
  readonly missed: number;
}

export interface BiasScores {
  readonly overall: GroupScore;
  readonly byRegion: Readonly<Record<Region, GroupScore>>;
}

function score(model: LeafModel, samples: readonly LeafSample[]): GroupScore {
  let correct = 0;
  let falseAlarm = 0;
  let missed = 0;
  for (const s of samples) {
    const p = predictLeaf(model, s);
    if (p === s.label) correct++;
    else if (p === 1) falseAlarm++;
    else missed++;
  }
  return { total: samples.length, correct, falseAlarm, missed };
}

export function scoreByRegion(model: LeafModel, test: readonly LeafSample[]): BiasScores {
  return {
    overall: score(model, test),
    byRegion: {
      lowland: score(model, test.filter((s) => s.region === 'lowland')),
      mountain: score(model, test.filter((s) => s.region === 'mountain')),
    },
  };
}

export const accuracy = (g: GroupScore) => (g.total === 0 ? 0 : g.correct / g.total);

/**
 * Ranh giới quyết định của mô hình trong mặt phẳng (độ vàng, số đốm), đổi về đơn vị gốc:
 *   a·vàng + b·đốm + c = 0  (phía > 0 là "bệnh").
 * Mô hình biết vùng có một đường riêng cho mỗi vùng (cột vùng là hằng số trong từng vùng).
 */
export interface BoundaryLine {
  readonly a: number;
  readonly b: number;
  readonly c: number;
}

export function boundaryLine(model: LeafModel, region: Region): BoundaryLine {
  const w = model.logistic.weights[0] ?? [];
  const z = (j: number) => (w[j] ?? 0) / (model.std[j] ?? 1);
  const a = z(0);
  const b = z(1);
  let c = (model.logistic.intercepts[0] ?? 0) - a * (model.mean[0] ?? 0) - b * (model.mean[1] ?? 0);
  if (model.useRegion) c += z(2) * ((region === 'mountain' ? 1 : 0) - (model.mean[2] ?? 0));
  return { a, b, c };
}

/** Độ vàng tại ranh giới với một số đốm cho trước (null nếu ranh giới không phụ thuộc độ vàng). */
export function boundaryYellowAt(line: BoundaryLine, spots: number): number | null {
  return Math.abs(line.a) < 1e-12 ? null : -(line.b * spots + line.c) / line.a;
}
