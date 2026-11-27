import reference from '@/core/trace/data-check.reference.json';
import { bestThreshold, compareBackgrounds, findNearDuplicates, NEAR_DUPLICATE_MAX_BITS, type ImageStat } from './deep-checks';
import { averageHash, blockContrast, blockMeans, borderBrightness, hammingDistance, luminance } from './image-stats';

/** Ảnh RGB (từ số đối chiếu Python) thành RGBA như canvas trả về. */
function toRgba(rgb: readonly number[]): Uint8ClampedArray {
  const out = new Uint8ClampedArray((rgb.length / 3) * 4);
  for (let i = 0; i < rgb.length / 3; i++) out.set([rgb[i * 3]!, rgb[i * 3 + 1]!, rgb[i * 3 + 2]!, 255], i * 4);
  return out;
}

const { size } = reference.input;
const grays = reference.input.rgb.map((rgb) => luminance(toRgba(rgb), size));

describe('số đo trên ảnh (khớp lup_helpers.py)', () => {
  test('độ sáng viền khớp bản Python', () => {
    grays.forEach((g, i) => expect(borderBrightness(g)).toBeCloseTo(reference.borders[i]!, 9));
  });

  test('độ tương phản khớp bản Python; ảnh một màu gần 0', () => {
    grays.forEach((g, i) => expect(blockContrast(g)).toBeCloseTo(reference.contrasts[i]!, 9));
    expect(blockContrast(grays[6]!)).toBeLessThan(1);
  });

  test('dấu vân tay 256 bit khớp bản Python', () => {
    grays.forEach((g, i) => expect(Array.from(averageHash(g))).toEqual(reference.hashes[i]));
  });

  test('ảnh xám: 0,299 R + 0,587 G + 0,114 B', () => {
    expect(luminance([100, 200, 50, 255], 1).values[0]).toBeCloseTo(100 * 0.299 + 200 * 0.587 + 50 * 0.114, 12);
  });

  test('báo lỗi khi ảnh không vuông hoặc cạnh không chia hết cho lưới', () => {
    expect(() => luminance([1, 2, 3], 1)).toThrow(RangeError);
    expect(() => blockMeans({ size: 20, values: new Float64Array(400) })).toThrow(/chia hết/);
    expect(() => hammingDistance([1], [1, 0])).toThrow(RangeError);
  });
});

const stats: ImageStat[] = grays.map((g, i) => ({
  id: String(i),
  label: reference.input.labels[i]!,
  split: reference.input.splits[i] as 'train' | 'test',
  hash: averageHash(g),
  contrast: blockContrast(g),
  border: borderBrightness(g),
}));

describe('findNearDuplicates', () => {
  test('tìm ra ảnh Kiểm tra chụp lại từ ảnh Huấn luyện ("lộ đề"); bỏ qua hai ảnh gần như một màu', () => {
    expect(findNearDuplicates(stats)).toEqual([{ a: 0, b: 5, diff: 0, isLeak: true }]);
    expect(hammingDistance(stats[6]!.hash, stats[7]!.hash)).toBe(0);
    expect(findNearDuplicates(stats, 16, 0)).toContainEqual({ a: 6, b: 7, diff: 0, isLeak: false });
  });

  test('cặp cùng tập không phải lộ đề; quá ngưỡng thì bỏ qua', () => {
    const same = stats.map((s) => ({ ...s, split: 'train' as const }));
    expect(findNearDuplicates(same)[0]!.isLeak).toBe(false);
    const far = [stats[0]!, { ...stats[0]!, hash: stats[0]!.hash.map((v, i) => (i <= NEAR_DUPLICATE_MAX_BITS ? 1 - v : v)) }];
    expect(findNearDuplicates(far)).toEqual([]);
  });
});

describe('bestThreshold và compareBackgrounds', () => {
  test('tách hẳn được thì đúng 100 %; trộn lẫn thì quanh 50 %', () => {
    expect(bestThreshold([10, 20], [200, 210])).toEqual({ accuracy: 1, cut: 20 });
    expect(bestThreshold([210, 200], [10, 20]).accuracy).toBe(1);
    expect(bestThreshold([10, 200], [20, 210]).accuracy).toBe(0.75);
  });

  test('bộ mẫu: chỉ nhìn nền đã đúng 100 % ảnh Huấn luyện, lớp 0 sáng hơn: cảnh báo lối tắt', () => {
    const [pair] = compareBackgrounds(stats, 2);
    expect(pair).toMatchObject({ a: 0, b: 1, accuracy: 1, brighter: 0, isShortcut: true });
    expect(pair!.gap).toBeCloseTo(154, 0);
  });

  test('chênh ít thì không cảnh báo dù tách được; lớp không có ảnh Huấn luyện thì bỏ qua', () => {
    const close = stats.map((s) => ({ ...s, border: s.label === 0 ? 100 : 120 }));
    expect(compareBackgrounds(close, 2)[0]!.isShortcut).toBe(false);
    expect(compareBackgrounds(stats, 3).map((p) => [p.a, p.b])).toEqual([[0, 1]]);
  });
});
