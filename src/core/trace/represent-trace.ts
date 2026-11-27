/**
 * Vết chạy của `represent.py` (bước 3 Biểu diễn của Studio ảnh): vector của ảnh đang chọn,
 * độ giống cosine với từng ảnh Huấn luyện và 3 ảnh giống nhất. Vector là vector MobileNetV2 thật.
 */
import { createProgram, lineOf } from './program';
import { pythonFixed, pythonStringList } from './python-format';
import { array, scalar, text, type TraceStep } from './trace-value';
import source from './python/represent.py?raw';

export const REPRESENT_PROGRAM = createProgram('represent.py', source);
export const NEIGHBOR_COUNT = 3;

export interface RepresentInput {
  /** Vector của mọi ảnh, theo thứ tự ảnh. */
  readonly features: readonly Float32Array[];
  readonly splits: readonly ('train' | 'test')[];
  /** Ảnh đang chọn. */
  readonly index: number;
  /** Cạnh ảnh (224). */
  readonly size: number;
}

const at = (anchor: string) => lineOf(REPRESENT_PROGRAM, anchor);
const LINES = {
  inputs: at('# Đầu vào'),
  features: at('features = mobilenet_v2('),
  v: at('v = features[i]'),
  train: at('train = np.array('),
  dots: at('dots = features[train]'),
  norms: at('norms = np.linalg'),
  similarity: at('similarity = dots / norms'),
  order: at('order = np.argsort('),
  loop: at('for k in order'),
  print: at('print(f"ảnh {train[k]}'),
} as const;

const step = (line: number, changed: TraceStep['changed'] = {}, output?: string): TraceStep =>
  output === undefined ? { line, changed, epoch: 0 } : { line, changed, epoch: 0, output };

function dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let s = 0;
  for (let k = 0; k < a.length; k++) s += (a[k] as number) * (b[k] as number);
  return s;
}

export interface Neighbor {
  /** Số thứ tự ảnh (trong danh sách mọi ảnh). */
  readonly index: number;
  readonly similarity: number;
  readonly dot: number;
  readonly norm: number;
}

/** Cosine giữa ảnh đang chọn và từng ảnh Huấn luyện khác, tính như represent.py. */
export function similarities({ features, splits, index }: RepresentInput): Neighbor[] {
  const v = features[index]!;
  const normV = Math.sqrt(dot(v, v));
  return splits.flatMap((split, k) => {
    if (split !== 'train' || k === index) return [];
    const d = dot(features[k]!, v);
    const norm = Math.sqrt(dot(features[k]!, features[k]!)) * normV;
    return [{ index: k, dot: d, norm, similarity: d / norm }];
  });
}

/** 3 ảnh giống nhất (sắp xếp ổn định như `np.argsort(-similarity, kind="stable")`). */
export function nearest(all: readonly Neighbor[], count = NEIGHBOR_COUNT): Neighbor[] {
  return all
    .map((n, pos) => ({ n, pos }))
    .sort((p, q) => q.n.similarity - p.n.similarity || p.pos - q.pos)
    .slice(0, count)
    .map(({ n }) => n);
}

export function neighborLine(index: number, similarity: number): string {
  return `ảnh ${index}: giống ${pythonFixed(similarity, 2)}`;
}

/** Chạy lại `represent.py` từng dòng với ảnh đang chọn. */
export function* traceRepresent(input: RepresentInput): Generator<TraceStep, void, void> {
  const { features, splits, index, size } = input;
  const n = features.length;
  const dim = features[index]!.length;
  yield step(LINES.inputs, {
    images: text(`${n} ảnh (${size}, ${size}, 3)`),
    splits: text(pythonStringList(splits)),
    i: scalar(index, true),
  });
  yield step(LINES.features, { features: array(features[index]!, { shape: [n, dim], view: `features[${index}, :3]` }) });
  yield step(LINES.v, { v: array(features[index]!, { shape: [dim], view: 'v[:3]' }) });
  const all = similarities(input);
  const m = all.length;
  yield step(LINES.train, { train: array(all.map((s) => s.index), { shape: [m], isInt: true, size: 6 }) });
  yield step(LINES.dots, { dots: array(all.map((s) => s.dot), { shape: [m] }) });
  yield step(LINES.norms, { norms: array(all.map((s) => s.norm), { shape: [m] }) });
  yield step(LINES.similarity, { similarity: array(all.map((s) => s.similarity), { shape: [m] }) });
  const positions = new Map(all.map((s, pos) => [s.index, pos]));
  const top = nearest(all);
  yield step(LINES.order, { order: array(top.map((s) => positions.get(s.index)!), { shape: [top.length], isInt: true }) });
  for (const neighbor of top) {
    yield step(LINES.loop, { k: scalar(positions.get(neighbor.index)!, true) });
    yield step(LINES.print, {}, neighborLine(neighbor.index, neighbor.similarity));
  }
}
