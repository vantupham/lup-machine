/** Trợ lý kiểm tra chất lượng cho dữ liệu bảng: phát hiện vấn đề TRƯỚC khi huấn luyện. */
import type { ColumnSummary } from './columns';
import type { PreparedData } from './prepare';

export type TabularIssue =
  | { readonly kind: 'dropped-rows'; readonly count: number }
  | { readonly kind: 'imbalance'; readonly smallest: string; readonly smallestCount: number; readonly largest: string; readonly largestCount: number }
  | { readonly kind: 'id-like'; readonly column: string }
  | { readonly kind: 'constant'; readonly column: string }
  | { readonly kind: 'small-data'; readonly count: number };

/** Lớp nhỏ nhất ít hơn tỉ lệ này so với lớp lớn nhất thì cảnh báo mất cân bằng. */
export const IMBALANCE_RATIO = 0.5;
/** Cột phân loại có số giá trị khác nhau ≥ tỉ lệ này so với số dòng: giống mã định danh. */
export const ID_LIKE_RATIO = 0.9;
export const SMALL_DATA_ROWS = 30;
/** Ít giá trị khác nhau hơn mức này thì không coi là mã định danh (dù bảng nhỏ). */
const ID_LIKE_MIN_DISTINCT = 10;

function presentCount(col: ColumnSummary): number {
  return col.kind === 'categorical' ? col.categories.reduce((s, c) => s + c.count, 0) : 0;
}

export function checkTabularQuality(columns: readonly ColumnSummary[], featureNames: readonly string[], data: PreparedData): TabularIssue[] {
  const issues: TabularIssue[] = [];
  if (data.dropped > 0) issues.push({ kind: 'dropped-rows', count: data.dropped });

  const total = data.train.y.length + data.test.y.length;
  if (total < SMALL_DATA_ROWS) issues.push({ kind: 'small-data', count: total });

  if (data.task === 'classification') {
    const counts = data.classNames.map((_, k) => [...data.train.y, ...data.test.y].filter((y) => y === k).length);
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    if (min < max * IMBALANCE_RATIO) {
      issues.push({
        kind: 'imbalance',
        smallest: data.classNames[counts.indexOf(min)] as string,
        smallestCount: min,
        largest: data.classNames[counts.indexOf(max)] as string,
        largestCount: max,
      });
    }
  }

  for (const name of featureNames) {
    const col = columns.find((c) => c.name === name);
    if (!col) continue;
    const distinct = col.kind === 'numeric' ? col.unique : col.categories.length;
    if (distinct <= 1) issues.push({ kind: 'constant', column: name });
    else if (col.kind === 'categorical' && distinct > ID_LIKE_MIN_DISTINCT && distinct >= presentCount(col) * ID_LIKE_RATIO) {
      issues.push({ kind: 'id-like', column: name });
    }
  }
  return issues;
}
