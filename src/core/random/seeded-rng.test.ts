import { createRng, shuffle } from './seeded-rng';

describe('createRng', () => {
  test('cùng seed cho cùng dãy số (tái lập được)', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  test('seed khác cho dãy số khác', () => {
    expect(createRng(1)()).not.toBe(createRng(2)());
  });

  test('mọi giá trị nằm trong [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 10_000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  test('phân bố xấp xỉ đều (trung bình gần 0,5)', () => {
    const rng = createRng(123);
    const n = 20_000;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += rng();
    expect(sum / n).toBeCloseTo(0.5, 1);
  });

  test('từ chối seed không phải số nguyên hữu hạn', () => {
    expect(() => createRng(Number.NaN)).toThrow(RangeError);
    expect(() => createRng(1.5)).toThrow(RangeError);
  });
});

describe('shuffle', () => {
  test('không thay đổi mảng gốc và giữ nguyên các phần tử', () => {
    const original = [1, 2, 3, 4, 5, 6, 7, 8];
    const snapshot = [...original];
    const result = shuffle(original, createRng(9));
    expect(original).toEqual(snapshot);
    expect([...result].sort((x, y) => x - y)).toEqual(snapshot);
    expect(result).not.toBe(original);
  });

  test('cùng seed cho cùng thứ tự', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(shuffle(items, createRng(5))).toEqual(shuffle(items, createRng(5)));
  });

  test('xử lý mảng rỗng và một phần tử', () => {
    expect(shuffle([], createRng(1))).toEqual([]);
    expect(shuffle(['x'], createRng(1))).toEqual(['x']);
  });
});
