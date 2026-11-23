/**
 * Phân cụm k-means theo thuật toán Lloyd: lặp lại (1) gán mỗi điểm vào tâm gần nhất,
 * (2) dời tâm về trung bình các điểm của cụm, cho tới khi tâm không đổi.
 * Khớp KMeans(algorithm="lloyd", n_init=1, tol=0) của scikit-learn khi dùng cùng tâm khởi đầu.
 */
import type { Rng } from '@/core/random/seeded-rng';
import type { Vector } from './knn';

export interface KmeansStep {
  readonly centers: readonly (readonly number[])[];
  /** Nhãn cụm của từng điểm, tính với các tâm ở trên. */
  readonly labels: readonly number[];
  readonly inertia: number;
}

function squaredDistance(a: Vector, b: Vector): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += ((a[i] as number) - (b[i] as number)) ** 2;
  return s;
}

export function assignClusters(points: readonly Vector[], centers: readonly Vector[]): number[] {
  return points.map((p) => {
    let best = 0;
    let bestD = Infinity;
    centers.forEach((c, k) => {
      const d = squaredDistance(p, c);
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    });
    return best;
  });
}

/** Tâm mới = trung bình các điểm của cụm. Cụm không còn điểm nào giữ nguyên tâm cũ. */
export function updateCenters(points: readonly Vector[], labels: readonly number[], previous: readonly Vector[]): number[][] {
  const dim = previous[0]?.length ?? 0;
  const sums = previous.map(() => new Array<number>(dim).fill(0));
  const counts = new Array<number>(previous.length).fill(0);
  points.forEach((p, i) => {
    const k = labels[i] as number;
    counts[k]! += 1;
    for (let j = 0; j < dim; j++) sums[k]![j]! += p[j] as number;
  });
  return sums.map((sum, k) => (counts[k] === 0 ? [...(previous[k] as Vector)] : sum.map((s) => s / (counts[k] as number))));
}

export function inertia(points: readonly Vector[], labels: readonly number[], centers: readonly Vector[]): number {
  return points.reduce((s, p, i) => s + squaredDistance(p, centers[labels[i] as number] as Vector), 0);
}

function sameCenters(a: readonly Vector[], b: readonly Vector[]): boolean {
  return a.every((c, k) => c.every((v, j) => v === (b[k] as Vector)[j]));
}

/**
 * Chạy k-means và trả về lịch sử: phần tử 0 là tâm khởi đầu, mỗi phần tử sau là một vòng lặp.
 * Vòng cuối cùng là vòng "kiểm tra": tâm không đổi nữa nên thuật toán dừng.
 */
export function runKmeans(points: readonly Vector[], initCenters: readonly Vector[], maxIter: number): KmeansStep[] {
  if (points.length === 0) throw new RangeError('Cần ít nhất một điểm để phân cụm');
  const step = (centers: readonly Vector[]): KmeansStep => {
    const labels = assignClusters(points, centers);
    return { centers: centers.map((c) => [...c]), labels, inertia: inertia(points, labels, centers) };
  };
  const history = [step(initCenters)];
  for (let i = 0; i < maxIter; i++) {
    const prev = history.at(-1) as KmeansStep;
    const centers = updateCenters(points, prev.labels, prev.centers);
    history.push(step(centers));
    if (sameCenters(centers, prev.centers)) break;
  }
  return history;
}

/** Khởi tạo k-means++: tâm đầu chọn ngẫu nhiên, tâm sau chọn với xác suất tỉ lệ bình phương khoảng cách. */
export function kmeansPlusPlus(points: readonly Vector[], k: number, rng: Rng): number[][] {
  if (k < 1 || k > points.length) throw new RangeError(`k phải nằm trong 1..${points.length}`);
  const centers: number[][] = [[...(points[Math.floor(rng() * points.length)] as Vector)]];
  while (centers.length < k) {
    const d2 = points.map((p) => Math.min(...centers.map((c) => squaredDistance(p, c))));
    const total = d2.reduce((a, b) => a + b, 0);
    let target = rng() * total;
    let chosen = d2.findIndex((d) => (target -= d) < 0);
    if (chosen < 0 || total === 0) chosen = Math.floor(rng() * points.length);
    centers.push([...(points[chosen] as Vector)]);
  }
  return centers;
}
