/**
 * So sánh cài đặt của hai lần chạy ở các Studio huấn luyện tức thì (âm thanh, tư thế, văn bản, bảng số).
 * Mỗi cài đặt mô hình là một "thứ" (biến thí nghiệm). Dữ liệu và cách chia gộp lại là MỘT thứ:
 * dữ liệu được chia ngẫu nhiên theo tỉ lệ và seed, nên đổi bất cứ phần nào thì tập Kiểm tra cũng đổi.
 */
export type SettingValue = number | string;

export interface TrialSetupLike {
  readonly settings: Readonly<Record<string, SettingValue>>;
  readonly split: { readonly testRatio: number; readonly seed: number };
  readonly data: { readonly fingerprint: string; readonly train: number; readonly test: number; readonly classNames: readonly string[] };
}

export type TrialChange =
  | { readonly kind: 'setting'; readonly key: string; readonly from: SettingValue | undefined; readonly to: SettingValue | undefined }
  | { readonly kind: 'split'; readonly key: 'testRatio' | 'seed'; readonly from: number; readonly to: number }
  | { readonly kind: 'trainCount' | 'testCount'; readonly from: number; readonly to: number }
  | { readonly kind: 'classes'; readonly from: readonly string[]; readonly to: readonly string[] }
  | { readonly kind: 'samples' };

const sameNames = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((name, i) => name === b[i]);

export function diffTrialSetup(previous: TrialSetupLike, next: TrialSetupLike): TrialChange[] {
  const keys = [...new Set([...Object.keys(previous.settings), ...Object.keys(next.settings)])];
  const settings = keys
    .filter((key) => previous.settings[key] !== next.settings[key])
    .map((key): TrialChange => ({ kind: 'setting', key, from: previous.settings[key], to: next.settings[key] }));
  const split = (['testRatio', 'seed'] as const)
    .filter((key) => previous.split[key] !== next.split[key])
    .map((key): TrialChange => ({ kind: 'split', key, from: previous.split[key], to: next.split[key] }));
  const data: TrialChange[] = [];
  if (previous.data.train !== next.data.train) data.push({ kind: 'trainCount', from: previous.data.train, to: next.data.train });
  if (previous.data.test !== next.data.test) data.push({ kind: 'testCount', from: previous.data.test, to: next.data.test });
  if (!sameNames(previous.data.classNames, next.data.classNames)) data.push({ kind: 'classes', from: previous.data.classNames, to: next.data.classNames });
  if (data.length === 0 && previous.data.fingerprint !== next.data.fingerprint) data.push({ kind: 'samples' });
  return [...settings, ...split, ...data];
}

/** Số "thứ" đã đổi: mỗi cài đặt một thứ; dữ liệu và cách chia gộp lại thành một. */
export function trialVariableCount(changes: readonly TrialChange[]): number {
  const settings = changes.filter((c) => c.kind === 'setting').length;
  return settings + (changes.some((c) => c.kind !== 'setting') ? 1 : 0);
}

/** Tập Kiểm tra đã đổi (chia ngẫu nhiên lại): so điểm Kiểm tra với lần trước chưa công bằng. */
export function isTrialTestChanged(changes: readonly TrialChange[]): boolean {
  return changes.some((c) => c.kind !== 'setting');
}
