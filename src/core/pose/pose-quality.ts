/** Trợ lý kiểm tra dữ liệu tư thế. */
import { IMBALANCE_RATIO } from '@/core/tabular/quality';
import type { Keypoint } from './detectors';
import { MIN_KEYPOINT_SCORE, normalizationFrame, type PoseKind } from './features';

export type PoseIssue =
  | { readonly kind: 'unusable'; readonly count: number }
  | { readonly kind: 'missing-joints'; readonly count: number }
  | { readonly kind: 'few-poses'; readonly label: string; readonly count: number }
  | { readonly kind: 'imbalance'; readonly smallest: string; readonly smallestCount: number; readonly largest: string; readonly largestCount: number };

export const MIN_POSES_PER_CLASS = 5;
/** Mẫu có hơn tỉ lệ này số khớp không thấy rõ thì cảnh báo (ví dụ chân ra ngoài khung hình). */
export const MISSING_RATIO = 0.25;

export interface PoseSummary {
  readonly label: string;
  readonly keypoints: readonly Keypoint[];
}

export function checkPoseQuality(kind: PoseKind, samples: readonly PoseSummary[], classNames: readonly string[]): PoseIssue[] {
  const issues: PoseIssue[] = [];
  const unusable = samples.filter((s) => normalizationFrame(kind, s.keypoints) === null).length;
  if (unusable > 0) issues.push({ kind: 'unusable', count: unusable });
  const missing = samples.filter((s) => s.keypoints.filter((k) => k.score < MIN_KEYPOINT_SCORE).length > s.keypoints.length * MISSING_RATIO).length;
  if (missing > 0) issues.push({ kind: 'missing-joints', count: missing });

  const counts = classNames.map((name) => ({ name, count: samples.filter((s) => s.label === name).length }));
  for (const { name, count } of counts) if (count < MIN_POSES_PER_CLASS) issues.push({ kind: 'few-poses', label: name, count });
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
