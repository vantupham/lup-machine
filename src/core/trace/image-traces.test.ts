import { isFlat } from '@/core/data/deep-checks';
import { averageHash, blockContrast, borderBrightness, luminance } from '@/core/data/image-stats';
import dataRef from './data-check.reference.json';
import representRef from './represent.reference.json';
import { DATA_CHECK_PROGRAM, traceDataCheck, type DataCheckImage } from './data-check-trace';
import { nearest, REPRESENT_PROGRAM, similarities, traceRepresent } from './represent-trace';
import type { TraceStep } from './trace-value';

function toRgba(rgb: readonly number[]): Uint8ClampedArray {
  const out = new Uint8ClampedArray((rgb.length / 3) * 4);
  for (let i = 0; i < rgb.length / 3; i++) out.set([rgb[i * 3]!, rgb[i * 3 + 1]!, rgb[i * 3 + 2]!, 255], i * 4);
  return out;
}

const all = (gen: Generator<TraceStep, unknown, void>) => [...(gen as Iterable<TraceStep>)];
const outputs = (steps: readonly TraceStep[]) => steps.flatMap((s) => (s.output ? [s.output] : []));

const size = dataRef.input.size;
const images: DataCheckImage[] = dataRef.input.rgb.map((rgb, i) => {
  const gray = luminance(toRgba(rgb), size);
  return {
    id: String(i),
    label: dataRef.input.labels[i]!,
    split: dataRef.input.splits[i] as 'train' | 'test',
    hash: averageHash(gray),
    contrast: blockContrast(gray),
    border: borderBrightness(gray),
    firstPixel: rgb.slice(0, 3),
    grayHead: Array.from(gray.values.slice(0, 3)),
  };
});
const dataInput = { images, classNames: ['Tròn', 'Vuông'], size, maxBits: 16, minContrast: 8 };

describe('traceDataCheck', () => {
  test('in ra đúng các dòng bản Python in ra', () => {
    expect(outputs(all(traceDataCheck(dataInput)))).toEqual(dataRef.output);
  });

  test('mỗi ảnh 5 dòng; mỗi cặp 3 dòng nếu bỏ qua (ảnh một màu), 4 dòng nếu so (cộng dòng in nếu gần trùng)', () => {
    const steps = all(traceDataCheck(dataInput));
    const n = images.length;
    let pairSteps = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairSteps += isFlat(images[i]!) || isFlat(images[j]!) ? 3 : 4;
    expect(steps).toHaveLength(2 + n * 5 + pairSteps + 1 + 1 + 6);
    for (const s of steps) expect(DATA_CHECK_PROGRAM.lines[s.line]).toBeDefined();
  });

  test('lớp không có ảnh Huấn luyện: dừng trước khi tính ngưỡng (như Python báo lỗi)', () => {
    const steps = all(traceDataCheck({ ...dataInput, classNames: ['Tròn', 'Vuông', 'Tam giác'] }));
    expect(outputs(steps)).toEqual(dataRef.output);
  });

  test('lười: dòng đầu có ngay, chưa tính các cặp', () => {
    const first = traceDataCheck(dataInput).next().value as TraceStep;
    expect(Object.keys(first.changed)).toEqual(['images', 'labels', 'splits', 'CLASS_NAMES', 'MAX_DIFF', 'MIN_CONTRAST']);
  });
});

const representInput = {
  features: representRef.input.features.map((f) => Float32Array.from(f)),
  splits: representRef.input.splits as ('train' | 'test')[],
  index: representRef.input.index,
  size: 224,
};

describe('traceRepresent', () => {
  test('in ra 3 ảnh giống nhất đúng như bản Python', () => {
    expect(outputs(all(traceRepresent(representInput)))).toEqual(representRef.output);
  });

  test('chỉ so với ảnh Huấn luyện khác ảnh đang chọn; sắp xếp ổn định khi bằng nhau', () => {
    const sims = similarities(representInput);
    expect(sims.map((s) => s.index)).toEqual([0, 1, 3, 4]);
    expect(nearest([{ index: 7, similarity: 0.5, dot: 1, norm: 2 }, { index: 3, similarity: 0.5, dot: 1, norm: 2 }]).map((n) => n.index)).toEqual([7, 3]);
  });

  test('mọi bước trỏ vào dòng có thật', () => {
    for (const s of all(traceRepresent(representInput))) expect(REPRESENT_PROGRAM.lines[s.line]).toBeDefined();
  });
});
