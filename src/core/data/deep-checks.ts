/**
 * Soi kỹ dữ liệu ảnh (bước 2), dựa trên dấu vân tay và độ sáng viền của từng ảnh:
 * - ảnh gần trùng (cùng tập: ít thông tin mới; khác tập: "lộ đề", điểm Kiểm tra cao giả);
 * - lối tắt nền: chỉ nhìn độ sáng nền đã đoán đúng lớp, máy dễ học nền thay vì vật.
 * Ngưỡng đã đo trên ảnh thật (flowers-3, beans-3) và bộ "bẫy nền": xem các hằng số bên dưới.
 */
import { hammingDistance } from './image-stats';

/**
 * Khác nhau tối đa chừng này bit (trên 256) thì coi là gần trùng. Đo trên 180 ảnh thật:
 * hai ảnh khác nhau cách nhau ít nhất 32 bit; cùng ảnh nén lại cách ≤ 4 bit, chỉnh sáng thường 0–1 bit.
 */
export const NEAR_DUPLICATE_MAX_BITS = 16;
/**
 * Ảnh có độ tương phản (độ lệch chuẩn 16 × 16 ô) thấp hơn chừng này thì gần như một màu: dấu vân tay chủ yếu là
 * nhiễu nên không dùng để so trùng. Đo: ảnh thật thấp nhất 14; bộ "bẫy nền" (nền đều, hình nhỏ và mờ) cao nhất 2,7.
 */
export const MIN_HASH_CONTRAST = 8;
/** Chỉ nhìn nền mà đúng từ chừng này trở lên thì cảnh báo (ảnh thật: tối đa 67 %; bẫy nền: 100 %). */
export const SHORTCUT_MIN_ACCURACY = 0.9;
/** …và độ sáng nền trung bình hai lớp chênh ít nhất chừng này (thang 0–255). */
export const SHORTCUT_MIN_GAP = 40;

export interface ImageStat {
  readonly id: string;
  /** Số thứ tự lớp. */
  readonly label: number;
  readonly split: 'train' | 'test';
  readonly hash: Uint8Array;
  readonly contrast: number;
  readonly border: number;
}

export interface DuplicatePair {
  readonly a: number;
  readonly b: number;
  readonly diff: number;
  /** Một ảnh Huấn luyện, một ảnh Kiểm tra: đề thi lộ trong bài học. */
  readonly isLeak: boolean;
}

export function isFlat(stat: Pick<ImageStat, 'contrast'>, minContrast = MIN_HASH_CONTRAST): boolean {
  return stat.contrast < minContrast;
}

/**
 * Mọi cặp ảnh khác nhau ≤ `maxBits` bit, theo thứ tự (i, j) như vòng lặp trong data_check.py.
 * Bỏ qua ảnh gần như một màu (xem MIN_HASH_CONTRAST).
 */
export function findNearDuplicates(stats: readonly ImageStat[], maxBits = NEAR_DUPLICATE_MAX_BITS, minContrast = MIN_HASH_CONTRAST): DuplicatePair[] {
  const pairs: DuplicatePair[] = [];
  for (let a = 0; a < stats.length; a++) {
    if (isFlat(stats[a]!, minContrast)) continue;
    for (let b = a + 1; b < stats.length; b++) {
      if (isFlat(stats[b]!, minContrast)) continue;
      const diff = hammingDistance(stats[a]!.hash, stats[b]!.hash);
      if (diff <= maxBits) pairs.push({ a, b, diff, isLeak: stats[a]!.split !== stats[b]!.split });
    }
  }
  return pairs;
}

export interface ThresholdResult {
  readonly accuracy: number;
  readonly cut: number;
}

/** Thử mọi ngưỡng "sáng hơn ngưỡng là lớp B"; lấy tỉ lệ đúng cao nhất (cả chiều ngược lại). */
export function bestThreshold(xa: readonly number[], xb: readonly number[]): ThresholdResult {
  const cuts = [...new Set([...xa, ...xb])].sort((p, q) => p - q);
  let best = { accuracy: 0, cut: 0 };
  for (const cut of cuts) {
    const right = (xa.filter((x) => x <= cut).length + xb.filter((x) => x > cut).length) / (xa.length + xb.length);
    const accuracy = Math.max(right, 1 - right);
    if (accuracy > best.accuracy) best = { accuracy, cut };
  }
  return best;
}

const mean = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

export interface ClassPairBackground {
  readonly a: number;
  readonly b: number;
  readonly accuracy: number;
  readonly cut: number;
  readonly gap: number;
  /** Lớp có nền sáng hơn (trung bình). */
  readonly brighter: number;
  readonly isShortcut: boolean;
}

/** So từng cặp lớp chỉ bằng độ sáng nền của ảnh Huấn luyện (cặp nào thiếu ảnh thì bỏ qua). */
export function compareBackgrounds(stats: readonly ImageStat[], numClasses: number): ClassPairBackground[] {
  const train = stats.filter((s) => s.split === 'train');
  const borders = (label: number) => train.filter((s) => s.label === label).map((s) => s.border);
  const out: ClassPairBackground[] = [];
  for (let a = 0; a < numClasses; a++) {
    for (let b = a + 1; b < numClasses; b++) {
      const xa = borders(a);
      const xb = borders(b);
      if (xa.length === 0 || xb.length === 0) continue;
      const { accuracy, cut } = bestThreshold(xa, xb);
      const gap = Math.abs(mean(xa) - mean(xb));
      out.push({
        a,
        b,
        accuracy,
        cut,
        gap,
        brighter: mean(xa) >= mean(xb) ? a : b,
        isShortcut: accuracy >= SHORTCUT_MIN_ACCURACY && gap >= SHORTCUT_MIN_GAP,
      });
    }
  }
  return out;
}
