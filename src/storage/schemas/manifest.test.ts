import { parseManifest, CURRENT_FORMAT_VERSION } from './manifest';

const valid = {
  formatVersion: CURRENT_FORMAT_VERSION,
  appVersion: '0.1.0',
  projectType: 'image',
  name: 'Phân loại rác',
  createdAt: '2026-11-22T10:00:00.000Z',
};

describe('parseManifest', () => {
  test('chấp nhận manifest hợp lệ', () => {
    const result = parseManifest(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe('Phân loại rác');
  });

  test('cắt khoảng trắng hai đầu tên dự án', () => {
    const result = parseManifest({ ...valid, name: '  Rác  ' });
    expect(result.success && result.data.name).toBe('Rác');
  });

  test.each([
    ['loại dự án lạ', { projectType: 'video' }],
    ['tên rỗng', { name: '   ' }],
    ['tên quá dài', { name: 'a'.repeat(101) }],
    ['ngày không hợp lệ', { createdAt: 'hom qua' }],
    ['định dạng mới hơn ứng dụng', { formatVersion: CURRENT_FORMAT_VERSION + 1 }],
  ])('từ chối: %s', (_label, patch) => {
    const result = parseManifest({ ...valid, ...patch });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.length).toBeGreaterThan(0);
  });

  test('từ chối dữ liệu không phải object', () => {
    expect(parseManifest(null).success).toBe(false);
    expect(parseManifest('abc').success).toBe(false);
  });
});
