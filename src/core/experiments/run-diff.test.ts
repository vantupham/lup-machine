import { changedVariableCount, diffRunSetup, isTestSetChanged, type RunSetup } from './run-diff';

const base: RunSetup = {
  options: { epochs: 50, learningRate: 0.001, batchSize: 16, seed: 42 },
  counts: { train: 36, test: 12 },
  classNames: ['Tròn', 'Vuông'],
  fingerprint: 'aaaa1111',
};

describe('so sánh cài đặt của hai lần chạy', () => {
  test('không đổi gì: không có thay đổi', () => {
    expect(diffRunSetup(base, base)).toEqual([]);
    expect(changedVariableCount([])).toBe(0);
  });

  test('đổi tham số: liệt kê từng tham số với giá trị cũ và mới', () => {
    const next = { ...base, options: { ...base.options, epochs: 10, learningRate: 0.01 } };
    expect(diffRunSetup(base, next)).toEqual([
      { kind: 'epochs', from: 50, to: 10 },
      { kind: 'learningRate', from: 0.001, to: 0.01 },
    ]);
    expect(changedVariableCount(diffRunSetup(base, next))).toBe(2);
  });

  test('chuyển ảnh giữa hai ngăn: đổi cả hai số lượng nhưng chỉ tính là một thứ (dữ liệu)', () => {
    const next = { ...base, counts: { train: 37, test: 11 }, fingerprint: 'bbbb2222' };
    const changes = diffRunSetup(base, next);
    expect(changes).toEqual([
      { kind: 'trainCount', from: 36, to: 37 },
      { kind: 'testCount', from: 12, to: 11 },
    ]);
    expect(changedVariableCount(changes)).toBe(1);
    expect(isTestSetChanged(changes)).toBe(true);
  });

  test('thêm ảnh Huấn luyện và đổi epoch: hai thứ cùng lúc, tập Kiểm tra giữ nguyên', () => {
    const next = { ...base, options: { ...base.options, epochs: 100 }, counts: { train: 40, test: 12 }, fingerprint: 'cccc' };
    const changes = diffRunSetup(base, next);
    expect(changedVariableCount(changes)).toBe(2);
    expect(isTestSetChanged(changes)).toBe(false);
  });

  test('thay ảnh mà số lượng không đổi: báo "đổi ảnh"', () => {
    expect(diffRunSetup(base, { ...base, fingerprint: 'dddd' })).toEqual([{ kind: 'images' }]);
  });

  test('đổi tên hoặc thêm lớp: báo đổi lớp và coi như tập Kiểm tra đã đổi', () => {
    const changes = diffRunSetup(base, { ...base, classNames: ['Tròn', 'Vuông', 'Tam giác'], fingerprint: 'eeee' });
    expect(changes).toEqual([{ kind: 'classes', from: ['Tròn', 'Vuông'], to: ['Tròn', 'Vuông', 'Tam giác'] }]);
    expect(isTestSetChanged(changes)).toBe(true);
  });

  test('seed không phải là biến thí nghiệm (luôn cố định)', () => {
    expect(diffRunSetup(base, { ...base, options: { ...base.options, seed: 7 } })).toEqual([]);
  });
});
