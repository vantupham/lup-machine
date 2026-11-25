import type { TFunction } from 'i18next';
import type { RunChange, RunSetup } from '@/core/experiments/run-diff';
import type { RunRecord } from '@/storage/db';

/** Phần cài đặt của một lần chạy đã lưu (để so với lần khác). */
export function setupOf(run: RunRecord): RunSetup {
  return { options: run.options, counts: run.counts, classNames: run.classNames, fingerprint: run.fingerprint };
}

/** Một dòng mô tả thay đổi, ví dụ "số epoch 50 → 10". */
export function describeChange(t: TFunction, change: RunChange): string {
  if (change.kind === 'images') return t('project.compare.changes.images');
  if (change.kind === 'classes') {
    return t('project.compare.changes.classes', { from: change.from.join(', '), to: change.to.join(', '), interpolation: { escapeValue: false } });
  }
  return t(`project.compare.changes.${change.kind}`, { from: change.from, to: change.to });
}

/** Điểm cuối cùng của lần chạy: điểm Kiểm tra nếu có, không thì điểm Huấn luyện. */
export function finalScore(run: RunRecord, kind: 'test' | 'train'): number | null {
  const last = run.metrics.at(-1);
  if (!last) return null;
  return kind === 'test' ? last.testAccuracy : last.trainAccuracy;
}
