/** Các phép đo đánh giá mô hình phân loại. Định nghĩa khớp với scikit-learn. */

export function argmax(values: ArrayLike<number>): number {
  if (values.length === 0) throw new RangeError('Không thể tìm argmax của mảng rỗng');
  let best = 0;
  for (let i = 1; i < values.length; i++) {
    if ((values[i] as number) > (values[best] as number)) best = i;
  }
  return best;
}

/** Ma trận nhầm lẫn: hàng = lớp thật, cột = lớp dự đoán. */
export function confusionMatrix(yTrue: readonly number[], yPred: readonly number[], numClasses: number): number[][] {
  if (yTrue.length !== yPred.length) throw new RangeError('Số nhãn thật và nhãn dự đoán không bằng nhau');
  const matrix = Array.from({ length: numClasses }, () => new Array<number>(numClasses).fill(0));
  yTrue.forEach((t, i) => {
    const p = yPred[i] as number;
    if (t < 0 || t >= numClasses || p < 0 || p >= numClasses) {
      throw new RangeError(`Nhãn ngoài phạm vi 0..${numClasses - 1}`);
    }
    (matrix[t] as number[])[p]! += 1;
  });
  return matrix;
}

export function accuracy(yTrue: readonly number[], yPred: readonly number[]): number | null {
  if (yTrue.length === 0) return null;
  let correct = 0;
  yTrue.forEach((t, i) => {
    if (t === yPred[i]) correct += 1;
  });
  return correct / yTrue.length;
}

export interface ClassMetrics {
  /** Trong số ảnh máy đoán là lớp này, bao nhiêu phần đúng. null nếu máy chưa đoán lớp này lần nào. */
  readonly precision: number | null;
  /** Trong số ảnh thật sự thuộc lớp này, máy nhận ra bao nhiêu phần. null nếu lớp không có mẫu. */
  readonly recall: number | null;
  readonly support: number;
}

export function perClassMetrics(matrix: readonly (readonly number[])[]): ClassMetrics[] {
  return matrix.map((row, k) => {
    const tp = row[k] as number;
    const support = row.reduce((a, b) => a + b, 0);
    const predicted = matrix.reduce((sum, r) => sum + (r[k] as number), 0);
    return {
      precision: predicted === 0 ? null : tp / predicted,
      recall: support === 0 ? null : tp / support,
      support,
    };
  });
}

export function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length) throw new RangeError('Hai vector phải cùng độ dài');
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] as number;
    const y = b[i] as number;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / Math.sqrt(na * nb);
}
