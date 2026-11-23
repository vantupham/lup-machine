/**
 * k láng giềng gần nhất (k-NN) với khoảng cách Euclid.
 * Khớp KNeighborsClassifier(algorithm="brute", weights="uniform") của scikit-learn:
 * hòa phiếu thì chọn lớp có số thứ tự nhỏ nhất.
 */
export type Vector = readonly number[];

export interface KnnNeighbor {
  readonly index: number;
  readonly distance: number;
}

export interface KnnResult {
  readonly label: number;
  readonly votes: readonly number[];
  readonly neighbors: readonly KnnNeighbor[];
}

export interface GridSpec {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
  /** Số ô mỗi chiều. */
  readonly resolution: number;
}

export function euclidean(a: Vector, b: Vector): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = (a[i] as number) - (b[i] as number);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function knnClassify(
  xs: readonly Vector[],
  ys: readonly number[],
  numClasses: number,
  query: Vector,
  k: number,
): KnnResult {
  if (xs.length === 0) throw new RangeError('Chưa có điểm dữ liệu nào để so sánh');
  if (xs.length !== ys.length) throw new RangeError('Số điểm và số nhãn không bằng nhau');
  if (!Number.isInteger(k) || k < 1) throw new RangeError(`k phải là số nguyên ≥ 1, nhận được: ${k}`);

  const neighbors = xs
    .map((x, index) => ({ index, distance: euclidean(x, query) }))
    .sort((a, b) => a.distance - b.distance || a.index - b.index)
    .slice(0, k);

  const votes = new Array<number>(numClasses).fill(0);
  for (const n of neighbors) votes[ys[n.index] as number]! += 1;

  let label = 0;
  for (let c = 1; c < numClasses; c++) if ((votes[c] as number) > (votes[label] as number)) label = c;
  return { label, votes, neighbors };
}

/** Tâm ô (col, row) của lưới; hàng 0 ở dưới cùng (y nhỏ nhất). */
export function gridCellCenter(spec: GridSpec, col: number, row: number): [number, number] {
  const cw = (spec.xMax - spec.xMin) / spec.resolution;
  const ch = (spec.yMax - spec.yMin) / spec.resolution;
  return [spec.xMin + (col + 0.5) * cw, spec.yMin + (row + 0.5) * ch];
}

/** Nhãn dự đoán cho từng ô của lưới, thứ tự hàng từ dưới lên, cột từ trái sang. */
export function knnGrid(xs: readonly Vector[], ys: readonly number[], numClasses: number, k: number, spec: GridSpec): number[] {
  const out: number[] = [];
  for (let row = 0; row < spec.resolution; row++) {
    for (let col = 0; col < spec.resolution; col++) {
      out.push(knnClassify(xs, ys, numClasses, gridCellCenter(spec, col, row), k).label);
    }
  }
  return out;
}
