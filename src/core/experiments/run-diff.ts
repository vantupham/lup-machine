/**
 * So sánh cài đặt của hai lần huấn luyện để học sinh thấy mình đã đổi gì (biến thí nghiệm).
 * Đổi dữ liệu (số ảnh, lớp, ảnh) tính chung là MỘT thứ; mỗi tham số huấn luyện tính riêng.
 */
export interface RunSetup {
  readonly options: { readonly epochs: number; readonly learningRate: number; readonly batchSize: number; readonly seed: number };
  readonly counts: { readonly train: number; readonly test: number };
  readonly classNames: readonly string[];
  readonly fingerprint: string;
}

export type OptionKey = 'epochs' | 'learningRate' | 'batchSize';

export type RunChange =
  | { readonly kind: OptionKey | 'trainCount' | 'testCount'; readonly from: number; readonly to: number }
  | { readonly kind: 'classes'; readonly from: readonly string[]; readonly to: readonly string[] }
  | { readonly kind: 'images' };

const OPTION_KEYS: readonly OptionKey[] = ['epochs', 'learningRate', 'batchSize'];
const DATA_KINDS: ReadonlySet<RunChange['kind']> = new Set(['trainCount', 'testCount', 'classes', 'images']);

const sameNames = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((name, i) => name === b[i]);

export function diffRunSetup(previous: RunSetup, next: RunSetup): RunChange[] {
  const options = OPTION_KEYS.filter((key) => previous.options[key] !== next.options[key]).map(
    (key): RunChange => ({ kind: key, from: previous.options[key], to: next.options[key] }),
  );
  const data: RunChange[] = [];
  if (previous.counts.train !== next.counts.train) data.push({ kind: 'trainCount', from: previous.counts.train, to: next.counts.train });
  if (previous.counts.test !== next.counts.test) data.push({ kind: 'testCount', from: previous.counts.test, to: next.counts.test });
  if (!sameNames(previous.classNames, next.classNames)) data.push({ kind: 'classes', from: previous.classNames, to: next.classNames });
  // Cùng số lượng, cùng lớp nhưng dấu vân tay khác: đã thay ảnh.
  if (data.length === 0 && previous.fingerprint !== next.fingerprint) data.push({ kind: 'images' });
  return [...options, ...data];
}

/** Số "thứ" đã đổi: mỗi tham số một thứ, mọi thay đổi dữ liệu gộp lại thành một. */
export function changedVariableCount(changes: readonly RunChange[]): number {
  const options = changes.filter((c) => !DATA_KINDS.has(c.kind)).length;
  return options + (changes.some((c) => DATA_KINDS.has(c.kind)) ? 1 : 0);
}

/**
 * Tập Kiểm tra (thước đo) đã đổi: so điểm Kiểm tra giữa hai lần không còn công bằng.
 * Thay ảnh mà số lượng giữ nguyên thì không biết chắc ở ngăn nào, nên không cảnh báo.
 */
export function isTestSetChanged(changes: readonly RunChange[]): boolean {
  return changes.some((c) => c.kind === 'testCount' || c.kind === 'classes');
}
