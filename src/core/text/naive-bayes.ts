/**
 * Naive Bayes đa thức (khớp MultinomialNB của scikit-learn):
 *   log P(lớp | câu) ∝ log P(lớp) + Σ_từ  số lần(từ) × log P(từ | lớp)
 *   P(từ | lớp) = (số lần từ xuất hiện trong lớp + α) / (tổng số từ của lớp + α × cỡ bộ từ vựng)
 */
export interface NaiveBayesModel {
  readonly classLogPrior: readonly number[];
  /** featureLogProb[lớp][từ] = log P(từ | lớp). */
  readonly featureLogProb: readonly (readonly number[])[];
  readonly alpha: number;
}

function softmax(z: readonly number[]): number[] {
  const max = Math.max(...z);
  const e = z.map((v) => Math.exp(v - max));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}

export function fitNaiveBayes(counts: readonly (readonly number[])[], ys: readonly number[], numClasses: number, alpha = 1): NaiveBayesModel {
  if (counts.length === 0) throw new RangeError('Cần ít nhất một câu để huấn luyện');
  if (counts.length !== ys.length) throw new RangeError('Số câu và số nhãn không bằng nhau');
  if (!(alpha > 0)) throw new RangeError('α phải dương');
  const dim = counts[0]?.length ?? 0;
  const classCount = new Array<number>(numClasses).fill(0);
  const featureCount = Array.from({ length: numClasses }, () => new Array<number>(dim).fill(0));
  counts.forEach((row, n) => {
    const c = ys[n] as number;
    classCount[c]! += 1;
    row.forEach((v, j) => (featureCount[c]![j]! += v));
  });
  return {
    alpha,
    classLogPrior: classCount.map((c) => Math.log(c / counts.length)),
    featureLogProb: featureCount.map((row) => {
      const total = row.reduce((a, b) => a + b, 0) + alpha * dim;
      return row.map((v) => Math.log((v + alpha) / total));
    }),
  };
}

/** Điểm log (chưa chuẩn hóa) của từng lớp. */
export function naiveBayesScores(model: NaiveBayesModel, counts: readonly number[]): number[] {
  return model.featureLogProb.map((row, c) => row.reduce((s, lp, j) => s + lp * (counts[j] as number), model.classLogPrior[c] as number));
}

export function predictNaiveBayesProba(model: NaiveBayesModel, counts: readonly number[]): number[] {
  return softmax(naiveBayesScores(model, counts));
}
