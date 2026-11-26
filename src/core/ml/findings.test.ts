import { CONFIDENT_MISTAKE, findInsights, SMALL_SET, type ScoredItem } from './findings';

/** n ảnh lớp `actual` được đoán là `predicted` với độ tin `confidence`. */
function items(actual: number, predicted: number, n: number, confidence = 0.6, prefix = `${actual}-${predicted}`): ScoredItem[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${i}`, actual, predicted, confidence }));
}

describe('phát hiện đáng chú ý từ kết quả đánh giá', () => {
  test('không có ảnh nào: không phát hiện gì', () => {
    expect(findInsights([], 2)).toEqual([]);
  });

  test('đúng hết trên tập lớn: chỉ báo đúng hết', () => {
    expect(findInsights([...items(0, 0, 15), ...items(1, 1, 15)], 2)).toEqual([{ code: 'all-correct', total: 30 }]);
  });

  test('tập nhỏ: nhắc mỗi ảnh làm điểm đổi nhiều', () => {
    expect(findInsights([...items(0, 0, 4), ...items(1, 1, 4)], 2)).toEqual([
      { code: 'all-correct', total: 8 },
      { code: 'small-set', total: 8 },
    ]);
    expect(SMALL_SET).toBe(20);
  });

  test('cặp nhầm nhiều nhất: lớp thật, lớp bị đoán, số ảnh và tổng ảnh của lớp thật', () => {
    const data = [...items(0, 0, 10), ...items(1, 1, 7), ...items(1, 2, 3), ...items(2, 2, 9), ...items(2, 0, 1)];
    const [top] = findInsights(data, 3);
    expect(top).toEqual({ code: 'top-confusion', actual: 1, predicted: 2, count: 3, support: 10 });
  });

  test('lớp yếu nhất khác lớp trong cặp nhầm nhiều nhất thì báo thêm, kèm lớp hay bị nhầm sang', () => {
    // Lớp 0: 4/10 sai thành 1 (cặp nhiều nhất). Lớp 2: 3/4 sai (recall 0,25 thấp nhất).
    const data = [...items(0, 0, 6), ...items(0, 1, 4), ...items(1, 1, 10), ...items(2, 2, 1), ...items(2, 0, 3)];
    const found = findInsights(data, 3);
    expect(found).toContainEqual({ code: 'weakest-class', classIndex: 2, recall: 0.25, support: 4, confusedWith: 0 });
  });

  test('lớp yếu nhất trùng lớp trong cặp nhầm nhiều nhất thì không lặp lại', () => {
    const data = [...items(0, 0, 10), ...items(1, 1, 6), ...items(1, 0, 4)];
    expect(findInsights(data, 2).map((f) => f.code)).not.toContain('weakest-class');
  });

  test(`ảnh sai mà máy vẫn tin từ ${CONFIDENT_MISTAKE * 100}% trở lên: liệt kê, tin nhất trước`, () => {
    const data = [
      ...items(0, 0, 20),
      { id: 'a', actual: 1, predicted: 0, confidence: 0.85 },
      { id: 'b', actual: 1, predicted: 0, confidence: 0.97 },
      { id: 'c', actual: 1, predicted: 0, confidence: 0.55 },
      ...items(1, 1, 20),
    ];
    expect(findInsights(data, 2)).toContainEqual({ code: 'confident-mistakes', ids: ['b', 'a'], threshold: CONFIDENT_MISTAKE });
  });

  test('không có ảnh sai nào đủ tin thì không báo', () => {
    const data = [...items(0, 0, 20), ...items(1, 0, 2, 0.6), ...items(1, 1, 20)];
    expect(findInsights(data, 2).map((f) => f.code)).not.toContain('confident-mistakes');
  });
});
