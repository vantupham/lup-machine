/** Trợ lý kiểm tra dữ liệu văn bản: phát hiện vấn đề TRƯỚC khi huấn luyện. */
import { IMBALANCE_RATIO } from '@/core/tabular/quality';
import type { TextExample } from './text-model';
import { tokenize } from './vectorize';

export type TextIssue =
  | { readonly kind: 'dropped'; readonly count: number }
  | { readonly kind: 'imbalance'; readonly smallest: string; readonly smallestCount: number; readonly largest: string; readonly largestCount: number }
  | { readonly kind: 'few-examples'; readonly label: string; readonly count: number }
  | { readonly kind: 'duplicates'; readonly count: number }
  | { readonly kind: 'conflict'; readonly text: string; readonly labels: string }
  | { readonly kind: 'short'; readonly count: number };

/** Mỗi lớp nên có ít nhất ngần này câu. */
export const MIN_PER_CLASS = 5;
/** Câu ít hơn ngần này âm tiết thì gần như không có thông tin. */
export const SHORT_TOKENS = 3;
/** Chỉ nêu tên tối đa ngần này câu mâu thuẫn để danh sách không quá dài. */
const MAX_CONFLICTS_LISTED = 3;

export function checkTextQuality(examples: readonly TextExample[]): TextIssue[] {
  const issues: TextIssue[] = [];
  const usable = examples.filter((e) => e.label.trim() !== '' && e.text.trim() !== '');
  if (usable.length < examples.length) issues.push({ kind: 'dropped', count: examples.length - usable.length });

  const counts = new Map<string, number>();
  for (const e of usable) counts.set(e.label.trim(), (counts.get(e.label.trim()) ?? 0) + 1);
  const entries = [...counts.entries()];
  if (entries.length >= 2) {
    const [smallest, smallestCount] = entries.reduce((a, b) => (b[1] < a[1] ? b : a));
    const [largest, largestCount] = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
    if (smallestCount < largestCount * IMBALANCE_RATIO) issues.push({ kind: 'imbalance', smallest, smallestCount, largest, largestCount });
  }
  for (const [label, count] of entries) if (count < MIN_PER_CLASS) issues.push({ kind: 'few-examples', label, count });

  // câu trùng nhau sau khi bỏ hoa / thường và dấu câu
  const byKey = new Map<string, { text: string; labels: Set<string>; count: number }>();
  for (const e of usable) {
    const key = tokenize(e.text).join(' ');
    const entry = byKey.get(key) ?? { text: e.text.trim(), labels: new Set<string>(), count: 0 };
    entry.labels.add(e.label.trim());
    entry.count += 1;
    byKey.set(key, entry);
  }
  const duplicates = [...byKey.values()].reduce((s, e) => s + e.count - 1, 0);
  if (duplicates > 0) issues.push({ kind: 'duplicates', count: duplicates });
  [...byKey.values()]
    .filter((e) => e.labels.size > 1)
    .slice(0, MAX_CONFLICTS_LISTED)
    .forEach((e) => issues.push({ kind: 'conflict', text: e.text, labels: [...e.labels].join(' / ') }));

  const short = usable.filter((e) => tokenize(e.text).length < SHORT_TOKENS).length;
  if (short > 0) issues.push({ kind: 'short', count: short });
  return issues;
}
