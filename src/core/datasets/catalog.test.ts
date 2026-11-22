import { datasetClassKeys, type AnyDatasetId } from './catalog';

describe('datasetClassKeys', () => {
  test('trả về lớp của bộ hình vẽ và bộ ảnh thật, đúng thứ tự', () => {
    expect(datasetClassKeys('shapes-3')).toEqual(['circle', 'square', 'triangle']);
    expect(datasetClassKeys('beans-3')).toEqual(['healthy', 'angular-leaf-spot', 'bean-rust']);
  });
  test('báo lỗi với bộ không tồn tại', () => {
    expect(() => datasetClassKeys('khong-co' as AnyDatasetId)).toThrow(/khong-co/);
  });
});
