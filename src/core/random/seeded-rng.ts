/**
 * Bộ sinh số ngẫu nhiên có seed (thuật toán mulberry32).
 * Cùng seed → cùng dãy số, giúp mọi thí nghiệm của học sinh tái lập được.
 */
export type Rng = () => number;

const UINT32_RANGE = 4294967296; // 2^32

export function createRng(seed: number): Rng {
  if (!Number.isInteger(seed)) {
    throw new RangeError(`Seed phải là số nguyên, nhận được: ${seed}`);
  }
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE;
  };
}

/** Trộn ngẫu nhiên (Fisher–Yates) trên bản sao; không thay đổi mảng gốc. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = result[i] as T;
    result[i] = result[j] as T;
    result[j] = tmp;
  }
  return result;
}
