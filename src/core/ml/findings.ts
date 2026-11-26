/**
 * Những điều đáng chú ý trong kết quả đánh giá: chỉ cho học sinh NÊN NHÌN VÀO ĐÂU,
 * mỗi phát hiện gắn với bằng chứng (ô ma trận, ảnh cụ thể) để học sinh tự giải thích vì sao.
 * Mọi con số tính thẳng từ dự đoán thật của mô hình, không ước lượng.
 */
export interface ScoredItem {
  readonly id: string;
  readonly actual: number;
  readonly predicted: number;
  /** Xác suất mô hình gán cho lớp nó đoán (0–1). */
  readonly confidence: number;
}

/** Ảnh sai mà máy vẫn tin từ mức này trở lên: "sai mà rất chắc chắn". */
export const CONFIDENT_MISTAKE = 0.8;
/** Ít hơn ngần này ảnh thì mỗi ảnh làm điểm thay đổi nhiều (≥ 5 điểm). */
export const SMALL_SET = 20;

export type Finding =
  | { readonly code: 'all-correct'; readonly total: number }
  | { readonly code: 'top-confusion'; readonly actual: number; readonly predicted: number; readonly count: number; readonly support: number }
  | { readonly code: 'weakest-class'; readonly classIndex: number; readonly recall: number; readonly support: number; readonly confusedWith: number }
  | { readonly code: 'confident-mistakes'; readonly ids: readonly string[]; readonly threshold: number }
  | { readonly code: 'small-set'; readonly total: number };

function countMatrix(items: readonly ScoredItem[], numClasses: number): number[][] {
  const matrix = Array.from({ length: numClasses }, () => new Array<number>(numClasses).fill(0));
  for (const item of items) {
    const row = matrix[item.actual];
    if (row && item.predicted >= 0 && item.predicted < numClasses) row[item.predicted] = (row[item.predicted] ?? 0) + 1;
  }
  return matrix;
}

/** Ô ngoài đường chéo lớn nhất (bằng nhau thì lấy ô đứng trước). */
function topConfusion(matrix: readonly (readonly number[])[]): Finding | null {
  let best: { actual: number; predicted: number; count: number } | null = null;
  matrix.forEach((row, actual) =>
    row.forEach((count, predicted) => {
      if (actual !== predicted && count > 0 && (!best || count > best.count)) best = { actual, predicted, count };
    }),
  );
  if (!best) return null;
  const { actual, predicted, count } = best;
  const support = (matrix[actual] ?? []).reduce((sum, v) => sum + v, 0);
  return { code: 'top-confusion', actual, predicted, count, support };
}

/** Lớp có tỉ lệ nhận ra (recall) thấp nhất, kèm lớp nó hay bị nhầm sang. */
function weakestClass(matrix: readonly (readonly number[])[]): Extract<Finding, { code: 'weakest-class' }> | null {
  let weakest: Extract<Finding, { code: 'weakest-class' }> | null = null;
  matrix.forEach((row, classIndex) => {
    const support = row.reduce((sum, v) => sum + v, 0);
    if (support === 0) return;
    const recall = (row[classIndex] ?? 0) / support;
    if (recall >= 1 || (weakest && recall >= weakest.recall)) return;
    let confusedWith = -1;
    row.forEach((count, j) => {
      if (j !== classIndex && count > 0 && (confusedWith < 0 || count > (row[confusedWith] ?? 0))) confusedWith = j;
    });
    weakest = { code: 'weakest-class', classIndex, recall, support, confusedWith };
  });
  return weakest;
}

export function findInsights(items: readonly ScoredItem[], numClasses: number): Finding[] {
  if (items.length === 0) return [];
  const findings: Finding[] = [];
  const matrix = countMatrix(items, numClasses);
  const top = topConfusion(matrix);

  if (!top) {
    findings.push({ code: 'all-correct', total: items.length });
  } else {
    findings.push(top);
    const weakest = weakestClass(matrix);
    if (weakest && top.code === 'top-confusion' && weakest.classIndex !== top.actual) findings.push(weakest);
    const confident = items
      .filter((item) => item.actual !== item.predicted && item.confidence >= CONFIDENT_MISTAKE)
      .sort((a, b) => b.confidence - a.confidence)
      .map((item) => item.id);
    if (confident.length > 0) findings.push({ code: 'confident-mistakes', ids: confident, threshold: CONFIDENT_MISTAKE });
  }
  if (items.length < SMALL_SET) findings.push({ code: 'small-set', total: items.length });
  return findings;
}
