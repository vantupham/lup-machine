/**
 * Bộ dữ liệu 2D sinh theo seed cho Sân chơi thuật toán. Tọa độ nằm khoảng trong [-1, 1].
 */
import { createRng, type Rng } from '@/core/random/seeded-rng';

export type Dataset2dKind = 'blobs' | 'xor' | 'circles' | 'moons' | 'spiral';

export const DATASET_2D_KINDS: readonly Dataset2dKind[] = ['blobs', 'xor', 'circles', 'moons', 'spiral'];

export type Point2 = [number, number];

export interface Dataset2d {
  readonly points: Point2[];
  readonly labels: number[];
  readonly numClasses: number;
}

export interface RegressionData {
  readonly xs: number[];
  readonly ys: number[];
}

/** Số ngẫu nhiên phân phối chuẩn N(0, 1) (Box–Muller). */
export function gaussian(rng: Rng): number {
  const u = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

const BLOB_CENTERS: readonly Point2[] = [[-0.5, -0.4], [0.5, -0.3], [0, 0.55]];

function samplePoint(kind: Dataset2dKind, i: number, n: number, rng: Rng): { point: Point2; label: number } {
  switch (kind) {
    case 'blobs': {
      const label = i % 3;
      const c = BLOB_CENTERS[label] as Point2;
      return { point: [c[0], c[1]], label };
    }
    case 'xor': {
      const x = rng() * 2 - 1;
      const y = rng() * 2 - 1;
      return { point: [x, y], label: x * y > 0 ? 0 : 1 };
    }
    case 'circles': {
      const label = i % 2;
      const r = label === 0 ? 0.35 : 0.8;
      const a = rng() * 2 * Math.PI;
      return { point: [r * Math.cos(a), r * Math.sin(a)], label };
    }
    case 'moons': {
      const label = i % 2;
      const t = rng() * Math.PI;
      return label === 0
        ? { point: [Math.cos(t) * 0.6 - 0.25, Math.sin(t) * 0.6 - 0.15], label }
        : { point: [0.25 - Math.cos(t) * 0.6, 0.15 - Math.sin(t) * 0.6], label };
    }
    case 'spiral': {
      const label = i % 2;
      const t = (Math.floor(i / 2) / Math.ceil(n / 2)) * 3 * Math.PI;
      const r = 0.1 + (t / (3 * Math.PI)) * 0.85;
      const a = t + label * Math.PI;
      return { point: [r * Math.cos(a), r * Math.sin(a)], label };
    }
  }
}

export function makeDataset2d(kind: Dataset2dKind, n: number, noise: number, seed: number): Dataset2d {
  const rng = createRng(seed);
  const points: Point2[] = [];
  const labels: number[] = [];
  for (let i = 0; i < n; i++) {
    const { point, label } = samplePoint(kind, i, n, rng);
    const spread = kind === 'blobs' ? Math.max(noise, 0.05) * 2 : noise;
    points.push([point[0] + gaussian(rng) * spread, point[1] + gaussian(rng) * spread]);
    labels.push(label);
  }
  return { points, labels, numClasses: kind === 'blobs' ? 3 : 2 };
}

/** Dữ liệu cho hồi quy: y = slope·x + intercept + nhiễu, x trong [-1, 1]. */
export function makeRegressionData(n: number, slope: number, intercept: number, noise: number, seed: number): RegressionData {
  const rng = createRng(seed);
  const xs = Array.from({ length: n }, () => rng() * 2 - 1);
  return { xs, ys: xs.map((x) => slope * x + intercept + gaussian(rng) * noise) };
}
