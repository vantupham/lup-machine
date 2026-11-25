import { createRng, shuffle } from '@/core/random/seeded-rng';

export interface LabeledItem {
  readonly id: string;
  readonly label: string;
}

export interface SplitOptions {
  /** Tỉ lệ mẫu đưa vào tập Kiểm tra, trong khoảng [0, 1). */
  readonly testRatio: number;
  readonly seed: number;
}

export interface SplitResult<T> {
  readonly train: T[];
  readonly test: T[];
}

/**
 * Chia dữ liệu thành tập Huấn luyện / Kiểm tra theo từng lớp (phân tầng),
 * để mỗi lớp đều có mặt ở cả hai tập với cùng tỉ lệ.
 *
 * Quy tắc cho lớp ít mẫu:
 * - 1 mẫu: giữ ở tập Huấn luyện.
 * - từ 2 mẫu và testRatio > 0: luôn có ít nhất 1 mẫu Kiểm tra và 1 mẫu Huấn luyện.
 */
export function stratifiedSplit<T extends LabeledItem>(
  items: readonly T[],
  { testRatio, seed }: SplitOptions,
): SplitResult<T> {
  if (!(testRatio >= 0 && testRatio < 1)) {
    throw new RangeError(`testRatio phải trong khoảng [0, 1), nhận được: ${testRatio}`);
  }

  const rng = createRng(seed);
  const byLabel = groupByLabel(items);
  const train: T[] = [];
  const test: T[] = [];

  for (const group of byLabel.values()) {
    const shuffled = shuffle(group, rng);
    const testCount = countTestSamples(shuffled.length, testRatio);
    test.push(...shuffled.slice(0, testCount));
    train.push(...shuffled.slice(testCount));
  }

  return { train, test };
}

function groupByLabel<T extends LabeledItem>(items: readonly T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    groups.set(item.label, [...(groups.get(item.label) ?? []), item]);
  }
  return groups;
}

function countTestSamples(size: number, testRatio: number): number {
  if (size < 2 || testRatio === 0) return 0;
  const raw = Math.round(size * testRatio);
  return Math.min(Math.max(raw, 1), size - 1);
}
