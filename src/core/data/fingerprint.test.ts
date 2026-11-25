import { datasetFingerprint } from './fingerprint';

const classes = ['a', 'b'];
const samples = [
  { id: 's1', classId: 'a', split: 'train' as const },
  { id: 's2', classId: 'b', split: 'test' as const },
];

describe('datasetFingerprint', () => {
  test('ổn định: cùng dữ liệu (kể cả khác thứ tự mẫu) cho cùng dấu vân tay', () => {
    expect(datasetFingerprint(classes, samples)).toBe(datasetFingerprint(classes, [...samples].reverse()));
    expect(datasetFingerprint(classes, samples)).toMatch(/^[0-9a-f]{8}$/);
  });

  test.each([
    ['thêm mẫu', classes, [...samples, { id: 's3', classId: 'a', split: 'train' as const }]],
    ['đổi ngăn Huấn luyện/Kiểm tra', classes, [samples[0]!, { ...samples[1]!, split: 'train' as const }]],
    ['đổi thứ tự lớp (đổi nhãn)', ['b', 'a'], samples],
  ])('thay đổi khi %s', (_name, cls, smp) => {
    expect(datasetFingerprint(cls, smp)).not.toBe(datasetFingerprint(classes, samples));
  });
});
