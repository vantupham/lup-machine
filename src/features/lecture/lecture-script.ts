import type { EpochMetrics } from '@/storage/db';
import type { Finding } from '@/core/ml/findings';

/** Kịch bản video bài giảng: không phụ thuộc khổ hình; khổ 16:9 / 9:16 chỉ ảnh hưởng lúc dựng hình. */
export type AspectRatio = '16:9' | '9:16';
export type LectureLevel = 'explore' | 'expert';

/** Một câu lời giảng: `display` làm phụ đề (giữ chữ số), `spoken` cho giọng đọc (số viết bằng chữ). */
export interface NarrationLine {
  readonly display: string;
  readonly spoken: string;
}

export type SceneId = 'title' | 'data' | 'data-check' | 'network' | 'training' | 'evaluation' | 'experiments' | 'limits' | 'summary';

export interface ClassCount {
  readonly name: string;
  readonly train: number;
  readonly test: number;
}

/** Số liệu thật để dựng hình cho từng cảnh. */
export type SceneVisual =
  | { readonly kind: 'title'; readonly projectName: string; readonly classNames: readonly string[] }
  | { readonly kind: 'data'; readonly classes: readonly ClassCount[] }
  | { readonly kind: 'data-check'; readonly sameSplitPairs: number; readonly leakPairs: number; readonly shortcutAccuracy: number | null }
  | { readonly kind: 'network'; readonly totalLayers: number; readonly frozenParams: number; readonly featureDim: number; readonly denseParams: number; readonly classNames: readonly string[] }
  | { readonly kind: 'training'; readonly metrics: readonly EpochMetrics[]; readonly epochs: number }
  | { readonly kind: 'evaluation'; readonly classNames: readonly string[]; readonly matrix: readonly (readonly number[])[]; readonly findings: readonly Finding[] }
  | { readonly kind: 'experiments'; readonly runs: readonly { readonly number: number; readonly testAccuracy: number | null }[] }
  | { readonly kind: 'limits'; readonly classNames: readonly string[] }
  | { readonly kind: 'summary'; readonly testAccuracy: number | null };

export interface LectureScene {
  readonly id: SceneId;
  readonly title: string;
  readonly lines: readonly NarrationLine[];
  readonly visual: SceneVisual;
}

export interface LectureScript {
  readonly language: string;
  readonly level: LectureLevel;
  readonly scenes: readonly LectureScene[];
}
