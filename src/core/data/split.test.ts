import { stratifiedSplit, type LabeledItem } from './split';

function makeItems(counts: Record<string, number>): LabeledItem[] {
  return Object.entries(counts).flatMap(([label, n]) =>
    Array.from({ length: n }, (_, i) => ({ id: `${label}-${i}`, label })),
  );
}

describe('stratifiedSplit', () => {
  test('chia theo đúng tỉ lệ trong từng lớp', () => {
    const items = makeItems({ meo: 50, cho: 20 });
    const { train, test } = stratifiedSplit(items, { testRatio: 0.2, seed: 1 });
    expect(test.filter((x) => x.label === 'meo')).toHaveLength(10);
    expect(test.filter((x) => x.label === 'cho')).toHaveLength(4);
    expect(train).toHaveLength(56);
  });

  test('không mất và không trùng mẫu', () => {
    const items = makeItems({ a: 13, b: 7, c: 3 });
    const { train, test } = stratifiedSplit(items, { testRatio: 0.25, seed: 3 });
    const ids = [...train, ...test].map((x) => x.id).sort();
    expect(ids).toEqual(items.map((x) => x.id).sort());
  });

  test('cùng seed cho cùng kết quả', () => {
    const items = makeItems({ a: 30, b: 30 });
    const r1 = stratifiedSplit(items, { testRatio: 0.2, seed: 42 });
    const r2 = stratifiedSplit(items, { testRatio: 0.2, seed: 42 });
    expect(r1.test.map((x) => x.id)).toEqual(r2.test.map((x) => x.id));
  });

  test('lớp có 1 mẫu: giữ ở tập Dạy', () => {
    const { train, test } = stratifiedSplit(makeItems({ a: 1 }), { testRatio: 0.5, seed: 1 });
    expect(train).toHaveLength(1);
    expect(test).toHaveLength(0);
  });

  test('lớp có từ 2 mẫu luôn có ít nhất 1 mẫu Kiểm tra và 1 mẫu Dạy', () => {
    const { train, test } = stratifiedSplit(makeItems({ a: 2, b: 3 }), {
      testRatio: 0.1,
      seed: 1,
    });
    expect(test.filter((x) => x.label === 'a')).toHaveLength(1);
    expect(test.filter((x) => x.label === 'b')).toHaveLength(1);
    expect(train.filter((x) => x.label === 'a')).toHaveLength(1);
  });

  test('testRatio = 0: toàn bộ vào tập Dạy', () => {
    const { train, test } = stratifiedSplit(makeItems({ a: 5 }), { testRatio: 0, seed: 1 });
    expect(train).toHaveLength(5);
    expect(test).toHaveLength(0);
  });

  test('không thay đổi mảng đầu vào', () => {
    const items = makeItems({ a: 5, b: 5 });
    const snapshot = items.map((x) => ({ ...x }));
    stratifiedSplit(items, { testRatio: 0.2, seed: 1 });
    expect(items).toEqual(snapshot);
  });

  test.each([-0.1, 1, 1.5, Number.NaN])('từ chối testRatio không hợp lệ: %s', (ratio) => {
    expect(() =>
      stratifiedSplit(makeItems({ a: 5 }), { testRatio: ratio, seed: 1 }),
    ).toThrow(RangeError);
  });
});
