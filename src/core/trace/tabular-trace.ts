/**
 * Vết chạy các chương trình Python của Studio bảng số: `tabular_scale.py` (bước 3: chuẩn hóa) và
 * dự đoán một dòng ở bước 6 bằng `tree_predict.py`, `knn_predict.py` (dùng chung với âm thanh, tư thế), `linear_predict.py`.
 * Dùng đúng mô hình và bộ mã hóa của trang (src/core/tabular, src/core/algorithms), nên kết quả trùng trang.
 */
import type { DecisionTree } from '@/core/algorithms/decision-tree';
import { euclidean } from '@/core/algorithms/knn';
import type { LinearModel } from '@/core/algorithms/linear-regression';
import { createProgram, lineOf, type PythonProgram } from './program';
import { pythonFixed, pythonStringList } from './python-format';
import { array, scalar, text, type TraceStep } from './trace-value';
import scaleSource from './python/tabular_scale.py?raw';
import treeSource from './python/tree_predict.py?raw';
import knnSource from './python/knn_predict.py?raw';
import linearSource from './python/linear_predict.py?raw';

export const TABULAR_SCALE_PROGRAM = createProgram('tabular_scale.py', scaleSource);
export const TREE_PREDICT_PROGRAM = createProgram('tree_predict.py', treeSource);
export const KNN_PREDICT_PROGRAM = createProgram('knn_predict.py', knnSource);
export const LINEAR_PREDICT_PROGRAM = createProgram('linear_predict.py', linearSource);

const SHOWN_ITEMS = 6;

const step = (line: number, changed: TraceStep['changed'] = {}, output?: string): TraceStep =>
  output === undefined ? { line, changed, epoch: 0 } : { line, changed, epoch: 0, output };

const linesOf = <K extends string>(program: PythonProgram, anchors: Record<K, string>) =>
  Object.fromEntries(Object.entries<string>(anchors).map(([k, a]) => [k, lineOf(program, a)])) as Record<K, number>;

const names = (items: readonly string[]) => text(pythonStringList(items, SHOWN_ITEMS));

/** Giống `f"{value:+.{digits}f}"`: luôn có dấu. */
export function pythonSigned(value: number, digits: number): string {
  return `${value < 0 || Object.is(value, -0) ? '-' : '+'}${pythonFixed(Math.abs(value), digits)}`;
}

// ── Bước 3: chuẩn hóa ───────────────────────────────────────────────────────────────

const SCALE = linesOf(TABULAR_SCALE_PROGRAM, {
  inputs: '# Đầu vào',
  mean: 'mean = X.mean(',
  std: 'std = X.std(',
  fix: 'std[std == 0] = 1',
  z: 'Z = (X - mean) / std',
  loop: 'for j in range(len(COLUMNS))',
  print: 'print(f"{COLUMNS[j]}',
});

export interface ScaleInput {
  /** Các cột số của tập Huấn luyện, mỗi phần tử là một dòng. */
  readonly rows: readonly (readonly number[])[];
  readonly columns: readonly string[];
}

export function scaleLine(column: string, mean: number, std: number, first: number, scaled: number): string {
  return `${column}: trung bình ${pythonFixed(mean, 2)}, lệch chuẩn ${pythonFixed(std, 2)}, dòng đầu ${pythonFixed(first, 2)} → ${pythonFixed(scaled, 2)}`;
}

export function* traceScale({ rows, columns }: ScaleInput): Generator<TraceStep, void, void> {
  const n = rows.length;
  const d = columns.length;
  yield step(SCALE.inputs, { X: array(rows[0] ?? [], { shape: [n, d], view: 'X[0]', size: SHOWN_ITEMS }), COLUMNS: names(columns) });
  const mean = columns.map((_, j) => rows.reduce((s, r) => s + r[j]!, 0) / n);
  yield step(SCALE.mean, { mean: array(mean, { shape: [d], size: SHOWN_ITEMS }) });
  const rawStd = columns.map((_, j) => Math.sqrt(rows.reduce((s, r) => s + (r[j]! - mean[j]!) ** 2, 0) / n));
  yield step(SCALE.std, { std: array(rawStd, { shape: [d], size: SHOWN_ITEMS }) });
  const std = rawStd.map((s) => (s === 0 ? 1 : s));
  yield step(SCALE.fix, { std: array(std, { shape: [d], size: SHOWN_ITEMS }) });
  const z0 = (rows[0] ?? []).map((v, j) => (v - mean[j]!) / std[j]!);
  yield step(SCALE.z, { Z: array(z0, { shape: [n, d], view: 'Z[0]', size: SHOWN_ITEMS }) });
  for (let j = 0; j < d; j++) {
    yield step(SCALE.loop, { j: scalar(j, true) });
    yield step(SCALE.print, {}, scaleLine(columns[j]!, mean[j]!, std[j]!, rows[0]![j]!, z0[j]!));
  }
}

// ── Bước 6: cây quyết định ──────────────────────────────────────────────────────────

const TREE = linesOf(TREE_PREDICT_PROGRAM, {
  inputs: '# Đầu vào',
  start: 'node = 0',
  loop: 'while tree[node]',
  split: 'f, t = tree[node]',
  ask: 'go_left = x[f] <= t',
  print: 'print(f"{FEATURES[f]}',
  next: 'node = tree[node]["split"]["left"]',
  counts: 'counts = tree[node]["counts"]',
  leaf: 'print(f"Lá {node}',
});

export interface TreePredictInput {
  readonly x: readonly number[];
  readonly tree: DecisionTree;
  readonly features: readonly string[];
  readonly classNames: readonly string[];
}

export function* traceTreePredict({ x, tree, features, classNames }: TreePredictInput): Generator<TraceStep, void, void> {
  yield step(TREE.inputs, {
    x: array(x, { shape: [x.length], size: SHOWN_ITEMS }),
    tree: text(`${tree.nodes.length} nút`),
    FEATURES: names(features),
    CLASS_NAMES: names(classNames),
  });
  let node = 0;
  yield step(TREE.start, { node: scalar(node, true) });
  for (;;) {
    yield step(TREE.loop);
    const split = tree.nodes[node]!.split;
    if (!split) break;
    yield step(TREE.split, { f: scalar(split.feature, true), t: scalar(split.threshold) });
    const goLeft = x[split.feature]! <= split.threshold;
    yield step(TREE.ask, { go_left: text(goLeft ? 'True' : 'False') });
    const relation = goLeft ? '<=' : '>';
    yield step(TREE.print, {}, `${features[split.feature]} = ${pythonFixed(x[split.feature]!, 2)} ${relation} ${pythonFixed(split.threshold, 3)}`);
    node = goLeft ? split.left : split.right;
    yield step(TREE.next, { node: scalar(node, true) });
  }
  const counts = tree.nodes[node]!.counts;
  yield step(TREE.counts, { counts: array(counts, { shape: [counts.length], isInt: true, size: counts.length }) });
  let best = 0;
  counts.forEach((c, k) => {
    if (c > counts[best]!) best = k;
  });
  yield step(TREE.leaf, {}, `Lá ${node}: [${counts.join(', ')}] → Máy đoán: ${classNames[best]}`);
}

// ── Bước 6: k láng giềng gần nhất ─────────────────────────────────────────────────

const KNN = linesOf(KNN_PREDICT_PROGRAM, {
  inputs: '# Đầu vào',
  distances: 'distances = np.sqrt(',
  nearest: 'nearest = np.argsort(',
  loop: 'for i in nearest',
  print: 'print(f"{NAMES[i]}',
  ifTask: 'if TASK == "classification"',
  votes: 'votes = np.bincount(',
  printVotes: 'print(f"Phiếu',
  orElse: 'else:',
  printMean: 'print(f"Máy đoán: trung bình',
});

export interface KnnPredictInput {
  readonly x: readonly number[];
  readonly train: readonly (readonly number[])[];
  /** Lớp (phân loại) hoặc giá trị (hồi quy) của từng dòng Huấn luyện. */
  readonly ys: readonly number[];
  /** Tên từng mẫu Huấn luyện để in ("dòng 12", "Vỗ tay #3"). */
  readonly names: readonly string[];
  readonly k: number;
  readonly task: 'classification' | 'regression';
  readonly classNames: readonly string[];
}

export function* traceKnnPredict(input: KnnPredictInput): Generator<TraceStep, void, void> {
  const { x, train, ys, names: sampleNames, k, task, classNames } = input;
  yield step(KNN.inputs, {
    x: array(x, { shape: [x.length], size: SHOWN_ITEMS }),
    X_train: array(train[0] ?? [], { shape: [train.length, x.length], view: 'X_train[0]', size: SHOWN_ITEMS }),
    y_train: array(ys, { shape: [ys.length], isInt: task === 'classification', size: SHOWN_ITEMS }),
    K: scalar(k, true),
    TASK: text(`'${task}'`),
  });
  const distances = train.map((row) => euclidean(row, x));
  yield step(KNN.distances, { distances: array(distances, { shape: [distances.length] }) });
  const nearest = distances
    .map((dist, i) => ({ dist, i }))
    .sort((a, b) => a.dist - b.dist || a.i - b.i)
    .slice(0, k)
    .map((n) => n.i);
  yield step(KNN.nearest, { nearest: array(nearest, { shape: [nearest.length], isInt: true, size: k }) });
  for (const i of nearest) {
    yield step(KNN.loop, { i: scalar(i, true) });
    yield step(KNN.print, {}, `${sampleNames[i]}: khoảng cách ${pythonFixed(distances[i]!, 3)}`);
  }
  yield step(KNN.ifTask);
  if (task === 'classification') {
    const votes = classNames.map((_, c) => nearest.filter((i) => ys[i] === c).length);
    yield step(KNN.votes, { votes: array(votes, { shape: [votes.length], isInt: true, size: votes.length }) });
    const best = votes.indexOf(Math.max(...votes));
    yield step(KNN.printVotes, {}, `Phiếu: [${votes.join(', ')}] → Máy đoán: ${classNames[best]}`);
    return;
  }
  yield step(KNN.orElse);
  const mean = nearest.reduce((s, i) => s + ys[i]!, 0) / nearest.length;
  yield step(KNN.printMean, {}, `Máy đoán: trung bình ${k} láng giềng = ${pythonFixed(mean, 2)}`);
}

// ── Bước 6: hồi quy tuyến tính ─────────────────────────────────────────────────────

const LIN = linesOf(LINEAR_PREDICT_PROGRAM, {
  inputs: '# Đầu vào',
  total: 'total = b',
  loop: 'for j in range(len(w))',
  add: 'total += w[j] * x[j]',
  print: 'print(f"{FEATURES[j]}',
  result: 'print(f"Máy đoán',
});

export interface LinearPredictInput {
  readonly x: readonly number[];
  readonly model: LinearModel;
  readonly features: readonly string[];
}

export function* traceLinearPredict({ x, model, features }: LinearPredictInput): Generator<TraceStep, void, void> {
  const { weights, intercept } = model;
  yield step(LIN.inputs, {
    x: array(x, { shape: [x.length], size: SHOWN_ITEMS }),
    FEATURES: names(features),
    w: array(weights, { shape: [weights.length], size: SHOWN_ITEMS }),
    b: scalar(intercept),
  });
  let total = intercept;
  yield step(LIN.total, { total: scalar(total) });
  for (let j = 0; j < weights.length; j++) {
    yield step(LIN.loop, { j: scalar(j, true) });
    const part = weights[j]! * x[j]!;
    total += part;
    yield step(LIN.add, { total: scalar(total) });
    yield step(LIN.print, {}, `${features[j]}: ${pythonFixed(weights[j]!, 3)} × ${pythonFixed(x[j]!, 2)} = ${pythonSigned(part, 3)}`);
  }
  yield step(LIN.result, {}, `Máy đoán: ${pythonFixed(intercept, 3)} + các đóng góp = ${pythonFixed(total, 2)}`);
}
