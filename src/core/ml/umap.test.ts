import { createRng } from '@/core/random/seeded-rng';
import { fitUmap2, UMAP_MIN_POINTS } from './umap';

/** Hai cụm điểm 20 chiều tách biệt rõ: cụm A quanh 0, cụm B quanh 5. */
function twoBlobs(perBlob: number): Float32Array[] {
  const rng = createRng(7);
  return Array.from({ length: perBlob * 2 }, (_, i) => {
    const center = i < perBlob ? 0 : 5;
    return Float32Array.from({ length: 20 }, () => center + (rng() - 0.5));
  });
}

const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!);

describe('fitUmap2', () => {
  test('mỗi vector thành một điểm 2D hữu hạn', () => {
    const points = fitUmap2(twoBlobs(8), 1);
    expect(points).toHaveLength(16);
    points.flat().forEach((v) => expect(Number.isFinite(v)).toBe(true));
  });

  test('cùng seed → cùng bản đồ (tái lập được); seed khác → bản đồ khác', () => {
    const data = twoBlobs(8);
    expect(fitUmap2(data, 3)).toEqual(fitUmap2(data, 3));
    expect(fitUmap2(data, 3)).not.toEqual(fitUmap2(data, 4));
  });

  test('giữ quan hệ lân cận: hai cụm tách biệt vẫn tách biệt trên bản đồ', () => {
    const points = fitUmap2(twoBlobs(10), 1);
    const a = points.slice(0, 10);
    const b = points.slice(10);
    const mean = (pairs: [number, number][][]) => pairs.reduce((s, [p, q]) => s + dist(p!, q!), 0) / pairs.length;
    const within = mean([...a.flatMap((p, i) => a.slice(i + 1).map((q) => [p, q])), ...b.flatMap((p, i) => b.slice(i + 1).map((q) => [p, q]))]);
    const between = mean(a.flatMap((p) => b.map((q) => [p, q])));
    expect(between).toBeGreaterThan(2 * within);
  });

  test('chạy được với số điểm tối thiểu, từ chối khi quá ít', () => {
    expect(fitUmap2(twoBlobs(3).slice(0, UMAP_MIN_POINTS), 1)).toHaveLength(UMAP_MIN_POINTS);
    expect(() => fitUmap2(twoBlobs(2).slice(0, UMAP_MIN_POINTS - 1), 1)).toThrow(RangeError);
  });
});
