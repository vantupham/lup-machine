import { accuracy, argmax, confusionMatrix, cosineSimilarity, perClassMetrics } from './metrics';

describe('argmax', () => {
  test('chỉ số của giá trị lớn nhất; hòa thì lấy chỉ số đầu', () => {
    expect(argmax([0.1, 0.7, 0.2])).toBe(1);
    expect(argmax([0.5, 0.5])).toBe(0);
  });
  test('mảng rỗng là lỗi', () => {
    expect(() => argmax([])).toThrow(RangeError);
  });
});

describe('confusionMatrix', () => {
  test('hàng = lớp thật, cột = lớp dự đoán', () => {
    expect(confusionMatrix([0, 0, 1, 1, 2], [0, 1, 1, 1, 0], 3)).toEqual([
      [1, 1, 0],
      [0, 2, 0],
      [1, 0, 0],
    ]);
  });
  test('từ chối nhãn ngoài phạm vi hoặc độ dài lệch', () => {
    expect(() => confusionMatrix([3], [0], 3)).toThrow(RangeError);
    expect(() => confusionMatrix([0, 1], [0], 2)).toThrow(RangeError);
  });
});

describe('accuracy', () => {
  test('tỉ lệ dự đoán đúng', () => {
    expect(accuracy([0, 1, 1, 0], [0, 1, 0, 0])).toBe(0.75);
  });
  test('không có mẫu thì trả về null', () => {
    expect(accuracy([], [])).toBeNull();
  });
});

describe('perClassMetrics', () => {
  test('precision và recall theo từng lớp (khớp định nghĩa của scikit-learn)', () => {
    const m = confusionMatrix([0, 0, 1, 1, 2], [0, 1, 1, 1, 0], 3);
    expect(perClassMetrics(m)).toEqual([
      { precision: 0.5, recall: 0.5, support: 2 },
      { precision: 2 / 3, recall: 1, support: 2 },
      { precision: null, recall: 0, support: 1 },
    ]);
  });
});

describe('cosineSimilarity', () => {
  test('cùng hướng = 1, vuông góc = 0, ngược hướng = -1', () => {
    expect(cosineSimilarity([1, 2], [2, 4])).toBeCloseTo(1, 10);
    expect(cosineSimilarity([1, 0], [0, 3])).toBeCloseTo(0, 10);
    expect(cosineSimilarity([1, 1], [-1, -1])).toBeCloseTo(-1, 10);
  });
  test('vector 0 trả về 0; độ dài lệch là lỗi', () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
    expect(() => cosineSimilarity([1], [1, 2])).toThrow(RangeError);
  });
});
