/**
 * Trợ lý kiểm tra chất lượng dữ liệu (mức số lượng mẫu).
 * Trả về danh sách vấn đề có mã (code) để giao diện dịch sang lời giải thích cho học sinh.
 */

/** Số mẫu tối thiểu khuyến nghị cho mỗi lớp. */
export const MIN_SAMPLES_PER_CLASS = 10;
/** Cảnh báo mất cân bằng khi lớp lớn nhất nhiều hơn lớp nhỏ nhất quá số lần này. */
export const IMBALANCE_RATIO_THRESHOLD = 2;
const MIN_CLASS_COUNT = 2;

interface ClassCount {
  readonly label: string;
  readonly count: number;
}

export type QualityIssue =
  | { readonly code: 'too-few-classes'; readonly severity: 'error'; readonly classCount: number }
  | { readonly code: 'empty-class'; readonly severity: 'error'; readonly label: string }
  | {
      readonly code: 'too-few-samples';
      readonly severity: 'warning';
      readonly label: string;
      readonly count: number;
      readonly minimum: number;
    }
  | {
      readonly code: 'class-imbalance';
      readonly severity: 'warning';
      readonly largest: ClassCount;
      readonly smallest: ClassCount;
      readonly ratio: number;
    };

export interface TestCoverageIssue {
  readonly code: 'no-test-samples';
  readonly severity: 'warning';
  readonly label: string;
}

/** Lớp có ảnh Huấn luyện nhưng không có ảnh Kiểm tra thì không thể đánh giá khách quan. */
export function checkTestCoverage(
  counts: Readonly<Record<string, { readonly train: number; readonly test: number }>>,
): TestCoverageIssue[] {
  return Object.entries(counts)
    .filter(([, c]) => c.train > 0 && c.test === 0)
    .map(([label]) => ({ code: 'no-test-samples', severity: 'warning', label }));
}

export function checkDatasetQuality(counts: Readonly<Record<string, number>>): QualityIssue[] {
  const entries = Object.entries(counts).map(([label, count]) => {
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError(`Số mẫu của lớp "${label}" không hợp lệ: ${count}`);
    }
    return { label, count };
  });

  return [
    ...checkClassCount(entries),
    ...checkPerClass(entries),
    ...checkImbalance(entries.filter((e) => e.count > 0)),
  ];
}

function checkClassCount(entries: readonly ClassCount[]): QualityIssue[] {
  return entries.length < MIN_CLASS_COUNT
    ? [{ code: 'too-few-classes', severity: 'error', classCount: entries.length }]
    : [];
}

function checkPerClass(entries: readonly ClassCount[]): QualityIssue[] {
  return entries.flatMap<QualityIssue>(({ label, count }) => {
    if (count === 0) return [{ code: 'empty-class', severity: 'error', label }];
    if (count < MIN_SAMPLES_PER_CLASS) {
      return [
        { code: 'too-few-samples', severity: 'warning', label, count, minimum: MIN_SAMPLES_PER_CLASS },
      ];
    }
    return [];
  });
}

function checkImbalance(nonEmpty: readonly ClassCount[]): QualityIssue[] {
  if (nonEmpty.length < MIN_CLASS_COUNT) return [];
  const sorted = [...nonEmpty].sort((a, b) => b.count - a.count);
  const largest = sorted[0] as ClassCount;
  const smallest = sorted[sorted.length - 1] as ClassCount;
  const ratio = largest.count / smallest.count;
  return ratio > IMBALANCE_RATIO_THRESHOLD
    ? [{ code: 'class-imbalance', severity: 'warning', largest, smallest, ratio }]
    : [];
}
