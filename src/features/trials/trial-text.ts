import type { TFunction } from 'i18next';
import type { SettingValue, TrialChange } from '@/core/experiments/trial-diff';
import type { TrialMetric } from '@/storage/schemas/trial';

/** Tên cài đặt và giá trị dễ đọc, ví dụ "mô hình: Hồi quy logistic → k-NN", "C: 1 → 10". */
function settingValue(t: TFunction, key: string, value: SettingValue | undefined): string {
  if (value === undefined) return '–';
  if (key === 'kind') return t(`trials.models.${value}`, { defaultValue: String(value) });
  if (key === 'maxN') return t(`trials.maxN.${value}`, { defaultValue: String(value) });
  if (typeof value === 'number') return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return value;
}

export function describeTrialChange(t: TFunction, change: TrialChange): string {
  switch (change.kind) {
    case 'setting':
      return t('trials.changes.setting', {
        name: t(`trials.settings.${change.key}`, { defaultValue: change.key }),
        from: settingValue(t, change.key, change.from),
        to: settingValue(t, change.key, change.to),
      });
    case 'split':
      return change.key === 'seed'
        ? t('trials.changes.seed', { from: change.from, to: change.to })
        : t('trials.changes.testRatio', { from: Math.round(change.from * 100), to: Math.round(change.to * 100) });
    case 'trainCount':
    case 'testCount':
      return t(`trials.changes.${change.kind}`, { from: change.from, to: change.to });
    case 'classes':
      return t('project.compare.changes.classes', { from: change.from.join(', '), to: change.to.join(', ') });
    case 'samples':
      return t('trials.changes.samples');
  }
}

/** Điểm hiển thị: độ chính xác theo %, R² theo số thập phân. */
export function formatScore(metric: TrialMetric, value: number | null | undefined, language?: string): string {
  if (value === null || value === undefined) return '–';
  if (metric === 'accuracy') return `${Math.round(value * 100)}%`;
  return value.toLocaleString(language, { maximumFractionDigits: 2 });
}

/** Chênh lệch giữa hai lần: điểm phần trăm (độ chính xác) hoặc chênh R². */
export function describeDelta(t: TFunction, metric: TrialMetric, from: number, to: number, language?: string): string {
  const diff = metric === 'accuracy' ? Math.round(to * 100) - Math.round(from * 100) : Math.round((to - from) * 100) / 100;
  if (diff === 0) return t('project.compare.same');
  const d = Math.abs(diff).toLocaleString(language, { maximumFractionDigits: 2 });
  return t(diff > 0 ? 'project.compare.up' : 'project.compare.down', { d });
}
