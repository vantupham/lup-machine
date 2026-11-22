/**
 * UMAP 2D (thư viện umap-js): giữ quan hệ "ai gần ai" của các vector 1280 chiều.
 * KHÁC PCA: đây là phép biến đổi phi tuyến, khoảng cách giữa các cụm và các trục KHÔNG có ý nghĩa
 * → giao diện gắn nhãn "xấp xỉ". Bộ sinh số có seed giúp cùng dữ liệu luôn cho cùng bản đồ.
 */
import { UMAP } from 'umap-js';
import { createRng } from '@/core/random/seeded-rng';
import { UMAP_MIN_POINTS } from './umap-limits';

export { UMAP_MIN_POINTS };
const MAX_NEIGHBORS = 15;
const MIN_DIST = 0.1;
const N_EPOCHS = 300;

export function fitUmap2(vectors: readonly ArrayLike<number>[], seed: number): [number, number][] {
  if (vectors.length < UMAP_MIN_POINTS) {
    throw new RangeError(`UMAP cần ít nhất ${UMAP_MIN_POINTS} ảnh, mới có ${vectors.length}`);
  }
  const umap = new UMAP({
    nComponents: 2,
    nNeighbors: Math.min(MAX_NEIGHBORS, vectors.length - 1),
    minDist: MIN_DIST,
    nEpochs: N_EPOCHS,
    random: createRng(seed),
  });
  const embedding = umap.fit(vectors.map((v) => Array.from(v)));
  return embedding.map((p) => [p[0]!, p[1]!]);
}
