/**
 * Bộ dữ liệu mẫu TỔNG HỢP: ảnh hình học sinh bằng thuật toán có seed.
 * Không tốn dung lượng, không vướng bản quyền, không có ảnh người thật, và tái lập tuyệt đối.
 */
import { createRng, type Rng } from '@/core/random/seeded-rng';

export type ShapeKind = 'circle' | 'square' | 'triangle';
export type SampleDatasetId = 'shapes-2' | 'shapes-3' | 'background-trap';

export interface ShapeSpec {
  readonly kind: ShapeKind;
  readonly cx: number;
  readonly cy: number;
  readonly size: number;
  readonly rotation: number;
  readonly fill: string;
  readonly background: string;
}

export interface SyntheticSample {
  readonly classKey: ShapeKind;
  readonly split: 'train' | 'test';
  readonly shape: ShapeSpec;
}

type BackgroundRule = 'varied' | 'trap';

export interface SampleDatasetDefinition {
  readonly id: SampleDatasetId;
  readonly classKeys: readonly ShapeKind[];
  readonly perClass: number;
  readonly testPerClass: number;
  readonly background: BackgroundRule;
  /** Cạnh / đường kính của hình (px, trên khung 224). */
  readonly shapeSize: readonly [number, number];
  /** Chênh lệch độ sáng giữa hình và nền (điểm %), càng nhỏ hình càng mờ. */
  readonly contrast: readonly [number, number];
  readonly seed: number;
}

export const SAMPLE_DATASETS: readonly SampleDatasetDefinition[] = [
  { id: 'shapes-2', classKeys: ['circle', 'square'], perClass: 24, testPerClass: 6, background: 'varied', shapeSize: [60, 140], contrast: [28, 50], seed: 101 },
  { id: 'shapes-3', classKeys: ['circle', 'square', 'triangle'], perClass: 24, testPerClass: 6, background: 'varied', shapeSize: [60, 140], contrast: [28, 50], seed: 202 },
  // Bẫy: hình nhỏ, mờ (tín hiệu thật yếu) trong khi nền sáng/tối khác hẳn (lối tắt mạnh).
  // Đã kiểm chứng bằng MobileNetV2 thật trong tests/e2e/samples-lessons.spec.ts.
  { id: 'background-trap', classKeys: ['circle', 'square'], perClass: 24, testPerClass: 6, background: 'trap', shapeSize: [16, 26], contrast: [10, 14], seed: 303 },
];

const CANVAS = 224;
const LIGHT_BG: readonly [number, number] = [78, 95];
const DARK_BG: readonly [number, number] = [6, 22];

const between = (rng: Rng, [lo, hi]: readonly [number, number]) => lo + rng() * (hi - lo);
const round = (v: number) => Math.round(v * 10) / 10;
const hsl = (h: number, s: number, l: number) => `hsl(${round(h)} ${round(s)}% ${round(l)}%)`;

function backgroundLightness(rng: Rng, rule: BackgroundRule, classIndex: number, split: 'train' | 'test'): number {
  if (rule === 'varied') return rng() < 0.5 ? between(rng, LIGHT_BG) : between(rng, DARK_BG);
  // Bẫy: trong tập Huấn luyện lớp 0 luôn nền sáng, lớp 1 luôn nền tối; lúc Kiểm tra thì đảo ngược.
  const isLight = (classIndex === 0) === (split === 'train');
  return between(rng, isLight ? LIGHT_BG : DARK_BG);
}

function makeShape(rng: Rng, def: SampleDatasetDefinition, kind: ShapeKind, bgLightness: number): ShapeSpec {
  const size = between(rng, def.shapeSize);
  const half = size / 2;
  const offset = between(rng, def.contrast);
  const fillLightness = bgLightness > 50 ? bgLightness - offset : bgLightness + offset;
  return {
    kind,
    size: round(size),
    cx: round(between(rng, [half, CANVAS - half])),
    cy: round(between(rng, [half, CANVAS - half])),
    rotation: round(between(rng, [0, 360])),
    fill: hsl(between(rng, [0, 360]), between(rng, [55, 90]), fillLightness),
    background: hsl(between(rng, [0, 360]), between(rng, [10, 40]), bgLightness),
  };
}

export function generateDataset(def: SampleDatasetDefinition): SyntheticSample[] {
  const rng = createRng(def.seed);
  return def.classKeys.flatMap((classKey, classIndex) =>
    Array.from({ length: def.perClass }, (_, i): SyntheticSample => {
      const split = i < def.perClass - def.testPerClass ? 'train' : 'test';
      const bg = backgroundLightness(rng, def.background, classIndex, split);
      return { classKey, split, shape: makeShape(rng, def, classKey, bg) };
    }),
  );
}
