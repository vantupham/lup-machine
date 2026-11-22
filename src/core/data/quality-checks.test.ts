import {
  checkDatasetQuality,
  IMBALANCE_RATIO_THRESHOLD,
  MIN_SAMPLES_PER_CLASS,
} from './quality-checks';

describe('checkDatasetQuality', () => {
  test('dữ liệu tốt: không có cảnh báo', () => {
    expect(checkDatasetQuality({ meo: 40, cho: 35 })).toEqual([]);
  });

  test('ít hơn 2 lớp', () => {
    expect(checkDatasetQuality({ meo: 40 })).toContainEqual({
      code: 'too-few-classes',
      severity: 'error',
      classCount: 1,
    });
  });

  test('lớp có quá ít mẫu', () => {
    expect(checkDatasetQuality({ meo: 40, cho: MIN_SAMPLES_PER_CLASS - 1 })).toContainEqual({
      code: 'too-few-samples',
      severity: 'warning',
      label: 'cho',
      count: MIN_SAMPLES_PER_CLASS - 1,
      minimum: MIN_SAMPLES_PER_CLASS,
    });
  });

  test('lớp rỗng là lỗi và không bị tính vào mất cân bằng', () => {
    const issues = checkDatasetQuality({ meo: 40, cho: 0 });
    expect(issues).toContainEqual({ code: 'empty-class', severity: 'error', label: 'cho' });
    expect(issues.find((i) => i.code === 'class-imbalance')).toBeUndefined();
  });

  test('mất cân bằng khi tỉ lệ lớn nhất/nhỏ nhất vượt ngưỡng', () => {
    expect(checkDatasetQuality({ meo: 120, cho: 15 })).toContainEqual({
      code: 'class-imbalance',
      severity: 'warning',
      largest: { label: 'meo', count: 120 },
      smallest: { label: 'cho', count: 15 },
      ratio: 8,
    });
  });

  test('không báo mất cân bằng khi đúng bằng ngưỡng', () => {
    const issues = checkDatasetQuality({ a: 20 * IMBALANCE_RATIO_THRESHOLD, b: 20 });
    expect(issues.find((i) => i.code === 'class-imbalance')).toBeUndefined();
  });

  test('từ chối số mẫu âm hoặc không nguyên', () => {
    expect(() => checkDatasetQuality({ a: -1, b: 10 })).toThrow(RangeError);
    expect(() => checkDatasetQuality({ a: 1.5, b: 10 })).toThrow(RangeError);
  });
});
