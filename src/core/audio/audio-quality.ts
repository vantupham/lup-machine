/** Trợ lý kiểm tra dữ liệu âm thanh: phát hiện vấn đề TRƯỚC khi huấn luyện. */
import { IMBALANCE_RATIO } from '@/core/tabular/quality';

export type AudioIssue =
  | { readonly kind: 'silent'; readonly count: number }
  | { readonly kind: 'clipped'; readonly count: number }
  | { readonly kind: 'few-clips'; readonly label: string; readonly count: number }
  | { readonly kind: 'imbalance'; readonly smallest: string; readonly smallestCount: number; readonly largest: string; readonly largestCount: number };

/** Biên độ đỉnh nhỏ hơn mức này (khoảng −40 dB): gần như im lặng. */
export const SILENT_PEAK = 0.01;
/** Biên độ chạm ngưỡng này: micro bị quá tải, âm thanh bị "rè". */
export const CLIPPED_PEAK = 0.999;
export const MIN_CLIPS_PER_CLASS = 5;

export interface ClipSummary {
  readonly label: string;
  readonly peak: number;
}

export function peakAmplitude(samples: ArrayLike<number>): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i] as number));
  return peak;
}

export function checkAudioQuality(clips: readonly ClipSummary[], classNames: readonly string[]): AudioIssue[] {
  const issues: AudioIssue[] = [];
  const silent = clips.filter((c) => c.peak < SILENT_PEAK).length;
  if (silent > 0) issues.push({ kind: 'silent', count: silent });
  const clipped = clips.filter((c) => c.peak >= CLIPPED_PEAK).length;
  if (clipped > 0) issues.push({ kind: 'clipped', count: clipped });

  const counts = classNames.map((name) => ({ name, count: clips.filter((c) => c.label === name).length }));
  for (const { name, count } of counts) if (count < MIN_CLIPS_PER_CLASS) issues.push({ kind: 'few-clips', label: name, count });
  const nonEmpty = counts.filter((c) => c.count > 0);
  if (nonEmpty.length >= 2) {
    const smallest = nonEmpty.reduce((a, b) => (b.count < a.count ? b : a));
    const largest = nonEmpty.reduce((a, b) => (b.count > a.count ? b : a));
    if (smallest.count < largest.count * IMBALANCE_RATIO) {
      issues.push({ kind: 'imbalance', smallest: smallest.name, smallestCount: smallest.count, largest: largest.name, largestCount: largest.count });
    }
  }
  return issues;
}
