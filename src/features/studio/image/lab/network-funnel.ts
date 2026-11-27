/**
 * Bố cục SVG của sơ đồ phễu MobileNetV2 ở bước 4 (Studio ảnh): mỗi khối là một tấm hộp,
 * cao theo kích thước ảnh (112 → 7), dày theo số kênh (8 → 1280). Chỉ tính toạ độ, không vẽ.
 */
import type { FrozenBlock } from '@/core/ml/network-summary';

/** Chiều cao toàn khung vẽ và đường giữa mà mọi khối căn theo. */
export const FUNNEL_HEIGHT = 236;
const CENTER_Y = 122;
/** Kích thước ảnh lớn nhất sau khối đầu (112 × 112). */
const MAX_SIZE = 112;
const MIN_SLAB_H = 28;
const SLAB_H_RANGE = 112;
const MIN_SLAB_W = 5;
const SLAB_W_PER_DOUBLING = 4;
const MIN_CHANNELS = 8;
/** Độ lệch phối cảnh (mặt trên, mặt bên) so với chiều cao khối. */
const DEPTH_RATIO = 0.18;
const GAP_IN_STAGE = 2;
const GAP_BETWEEN_STAGES = 14;
/** Bề ngang tối thiểu của một tầng, đủ chỗ cho nhãn "112 × 112" bên dưới. */
const MIN_STAGE_W = 66;
/** Ô ảnh đầu vào ở bên trái. */
export const INPUT_BOX = { x: 4, size: 96 } as const;
const FROZEN_X0 = 132;
const POOL_GAP = 40;
const DENSE_SPAN = 170;
/** Chỗ cho tên lớp bên phải nút đầu ra. */
const LABEL_SPACE = 150;
const CLASS_SPACING = 30;

export interface Slab {
  readonly block: FrozenBlock;
  /** Góc trên trái của mặt trước. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Độ lệch của mặt trên và mặt bên (phối cảnh). */
  readonly depth: number;
}

export interface Stage {
  /** Cạnh ảnh (px) ở đầu ra các khối của tầng. */
  readonly size: number;
  readonly slabs: readonly Slab[];
  readonly x0: number;
  readonly x1: number;
}

export interface FunnelLayout {
  readonly stages: readonly Stage[];
  readonly centerY: number;
  readonly frozen: { readonly x0: number; readonly x1: number };
  readonly pool: { readonly x: number };
  readonly output: { readonly x: number };
  readonly width: number;
  /** Toạ độ y của K nút lớp đầu ra, trải đều quanh đường giữa. */
  readonly classY: (numClasses: number) => number[];
}

/** Cao theo căn bậc hai của kích thước ảnh: 112 → 140, 7 → 56 (vẫn đủ chỗ bấm). */
export function slabHeight(size: number): number {
  return MIN_SLAB_H + SLAB_H_RANGE * Math.sqrt(size / MAX_SIZE);
}

/** Dày theo log₂ số kênh: 8 → 5, 1280 → khoảng 34. */
export function slabWidth(channels: number): number {
  return MIN_SLAB_W + SLAB_W_PER_DOUBLING * Math.log2(Math.max(1, channels / MIN_CHANNELS));
}

/** Các khối liên tiếp có cùng kích thước ảnh đầu ra gộp thành một tầng. */
function groupBySize(blocks: readonly FrozenBlock[]): FrozenBlock[][] {
  return blocks.reduce<FrozenBlock[][]>((groups, block) => {
    const last = groups.at(-1);
    return last && last[0]!.outShape[0] === block.outShape[0] ? [...groups.slice(0, -1), [...last, block]] : [...groups, [block]];
  }, []);
}

export function funnelLayout(blocks: readonly FrozenBlock[]): FunnelLayout {
  const stages: Stage[] = [];
  let x = FROZEN_X0;
  for (const group of groupBySize(blocks)) {
    const x0 = x;
    const natural = group.reduce((sum, b) => sum + slabWidth(b.outShape[2]) + GAP_IN_STAGE, -GAP_IN_STAGE) + slabHeight(group[0]!.outShape[0]) * DEPTH_RATIO;
    x += Math.max(0, (MIN_STAGE_W - natural) / 2);
    const slabs = group.map((block) => {
      const h = slabHeight(block.outShape[0]);
      const w = slabWidth(block.outShape[2]);
      const depth = h * DEPTH_RATIO;
      const slab: Slab = { block, x, y: CENTER_Y - (h - depth) / 2, w, h, depth };
      x += w + GAP_IN_STAGE;
      return slab;
    });
    const last = slabs.at(-1)!;
    const x1 = Math.max(x0 + MIN_STAGE_W, last.x + last.w + last.depth);
    stages.push({ size: group[0]!.outShape[0], slabs, x0, x1 });
    x = x1 + GAP_BETWEEN_STAGES;
  }
  const frozenX1 = stages.at(-1)?.x1 ?? FROZEN_X0;
  const poolX = frozenX1 + POOL_GAP;
  const outputX = poolX + DENSE_SPAN;
  return {
    stages,
    centerY: CENTER_Y,
    frozen: { x0: FROZEN_X0, x1: frozenX1 },
    pool: { x: poolX },
    output: { x: outputX },
    width: outputX + LABEL_SPACE,
    classY: (numClasses) => Array.from({ length: numClasses }, (_, k) => CENTER_Y + (k - (numClasses - 1) / 2) * CLASS_SPACING),
  };
}
