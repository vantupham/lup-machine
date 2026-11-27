/**
 * Vết chạy của `data_check.py` (bước 2 Kiểm tra dữ liệu của Studio ảnh), với số đo thật của từng ảnh.
 * Kết quả in ra trùng với `findNearDuplicates` / `compareBackgrounds` (cùng thứ tự vòng lặp) và với
 * bản Python (số đối chiếu do scripts/gen-trace-reference.py sinh).
 */
import { compareBackgrounds, isFlat, type ImageStat } from '@/core/data/deep-checks';
import { HASH_BITS, hammingDistance } from '@/core/data/image-stats';
import { createProgram, lineOf } from './program';
import { pythonFixed, pythonPercent, pythonStringList } from './python-format';
import { array, scalar, text, type TraceStep } from './trace-value';
import source from './python/data_check.py?raw';

export const DATA_CHECK_PROGRAM = createProgram('data_check.py', source);

export interface DataCheckImage extends ImageStat {
  /** RGB của điểm ảnh đầu tiên (góc trên trái). */
  readonly firstPixel: readonly number[];
  /** Ba giá trị xám đầu tiên của hàng đầu. */
  readonly grayHead: readonly number[];
}

export interface DataCheckInput {
  readonly images: readonly DataCheckImage[];
  readonly classNames: readonly string[];
  /** Cạnh ảnh (224). */
  readonly size: number;
  readonly maxBits: number;
  readonly minContrast: number;
}

const at = (anchor: string) => lineOf(DATA_CHECK_PROGRAM, anchor);
const LINES = {
  inputs: at('# Đầu vào'),
  init: at('hashes, contrasts, borders = [], [], []'),
  image: at('for image in images'),
  gray: at('gray = luminance('),
  hash: at('hashes.append('),
  contrast: at('contrasts.append('),
  border: at('borders.append('),
  pair: at('for i, j in combinations('),
  ifFlat: at('if min(contrasts[i]'),
  skip: at('continue  #'),
  diff: at('diff = int('),
  ifDup: at('if diff <= MAX_DIFF'),
  printDup: at('print(f"ảnh {i}'),
  train: at('train = [k for k'),
  classPair: at('for a, b in combinations('),
  xa: at('xa = [borders'),
  xb: at('xb = [borders'),
  threshold: at('accuracy, cut = best_threshold('),
  gap: at('gap = abs('),
  printClass: at('print(f"{CLASS_NAMES[a]}'),
} as const;

const step = (line: number, changed: TraceStep['changed'] = {}, output?: string): TraceStep =>
  output === undefined ? { line, changed, epoch: 0 } : { line, changed, epoch: 0, output };

export function duplicateLine(i: number, j: number, splits: readonly string[], diff: number): string {
  return `ảnh ${i} (${splits[i]}) gần trùng ảnh ${j} (${splits[j]}): khác ${diff} bit`;
}

export function backgroundLine(nameA: string, nameB: string, accuracy: number, gap: number): string {
  return `${nameA} / ${nameB}: chỉ nhìn nền đúng ${pythonPercent(accuracy)}, chênh ${pythonFixed(gap, 0)}`;
}

function* measureSteps({ images, size }: DataCheckInput): Generator<TraceStep, void, void> {
  for (const [k, img] of images.entries()) {
    yield step(LINES.image, { image: array(img.firstPixel, { shape: [size, size, 3], view: 'image[0, 0]', isInt: true }) });
    yield step(LINES.gray, { gray: array(img.grayHead, { shape: [size, size], view: 'gray[0, :3]' }) });
    yield step(LINES.hash, { hashes: array(img.hash, { shape: [k + 1, HASH_BITS], view: 'hashes[-1][:8]', isInt: true, size: 8 }) });
    yield step(LINES.contrast, { contrasts: array([img.contrast], { shape: [k + 1], view: 'contrasts[-1]' }) });
    yield step(LINES.border, { borders: array([img.border], { shape: [k + 1], view: 'borders[-1]' }) });
  }
}

function* duplicateSteps({ images, maxBits, minContrast }: DataCheckInput, splits: readonly string[]): Generator<TraceStep, void, void> {
  for (let i = 0; i < images.length; i++) {
    for (let j = i + 1; j < images.length; j++) {
      yield step(LINES.pair, { i: scalar(i, true), j: scalar(j, true) });
      yield step(LINES.ifFlat);
      if (isFlat(images[i]!, minContrast) || isFlat(images[j]!, minContrast)) {
        yield step(LINES.skip);
        continue;
      }
      const diff = hammingDistance(images[i]!.hash, images[j]!.hash);
      yield step(LINES.diff, { diff: scalar(diff, true) });
      yield step(LINES.ifDup);
      if (diff <= maxBits) yield step(LINES.printDup, {}, duplicateLine(i, j, splits, diff));
    }
  }
}

function* backgroundSteps({ images, classNames }: DataCheckInput): Generator<TraceStep, void, void> {
  const train = images.flatMap((img, k) => (img.split === 'train' ? [k] : []));
  yield step(LINES.train, { train: array(train, { shape: [train.length], isInt: true, size: 6 }) });
  const borderOf = (label: number) => train.filter((k) => images[k]!.label === label).map((k) => images[k]!.border);
  const results = new Map(compareBackgrounds(images, classNames.length).map((r) => [`${r.a}:${r.b}`, r]));
  for (let a = 0; a < classNames.length; a++) {
    for (let b = a + 1; b < classNames.length; b++) {
      yield step(LINES.classPair, { a: scalar(a, true), b: scalar(b, true) });
      const xa = borderOf(a);
      const xb = borderOf(b);
      yield step(LINES.xa, { xa: array(xa, { shape: [xa.length] }) });
      yield step(LINES.xb, { xb: array(xb, { shape: [xb.length] }) });
      const result = results.get(`${a}:${b}`);
      // Lớp không có ảnh Huấn luyện: Python báo lỗi ở np.mean(); giao diện chỉ chạy khi mọi lớp có ảnh.
      if (!result) return;
      yield step(LINES.threshold, { accuracy: scalar(result.accuracy), cut: scalar(result.cut) });
      yield step(LINES.gap, { gap: scalar(result.gap) });
      yield step(LINES.printClass, {}, backgroundLine(classNames[a]!, classNames[b]!, result.accuracy, result.gap));
    }
  }
}

/** Chạy lại `data_check.py` từng dòng. Lười: chỉ tính khi được hỏi bước tiếp theo. */
export function* traceDataCheck(input: DataCheckInput): Generator<TraceStep, void, void> {
  const { images, classNames, size, maxBits, minContrast } = input;
  const splits = images.map((img) => img.split);
  yield step(LINES.inputs, {
    images: array(images[0]?.firstPixel ?? [], { shape: [images.length, size, size, 3], view: 'images[0][0, 0]', isInt: true }),
    labels: array(images.map((img) => img.label), { shape: [images.length], isInt: true, size: 6 }),
    splits: text(pythonStringList(splits)),
    CLASS_NAMES: text(pythonStringList(classNames)),
    MAX_DIFF: scalar(maxBits, true),
    MIN_CONTRAST: scalar(minContrast, true),
  });
  yield step(LINES.init, { hashes: text('[]'), contrasts: text('[]'), borders: text('[]') });
  yield* measureSteps(input);
  yield* duplicateSteps(input, splits);
  yield* backgroundSteps(input);
}
