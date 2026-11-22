import { getErrorMessage } from './error-message';
import { safeStorage } from './safe-storage';

describe('getErrorMessage', () => {
  test('lấy message từ Error', () => {
    expect(getErrorMessage(new Error('hỏng'))).toBe('hỏng');
  });
  test('chuyển giá trị khác thành chuỗi', () => {
    expect(getErrorMessage('lỗi lạ')).toBe('lỗi lạ');
    expect(getErrorMessage(42)).toBe('42');
  });
});

describe('safeStorage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('đọc và ghi bình thường', () => {
    safeStorage.set('lup.test', 'x');
    expect(safeStorage.get('lup.test')).toBe('x');
  });

  test('không ném lỗi khi trình duyệt chặn lưu trữ', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(safeStorage.get('lup.test')).toBeNull();
    expect(() => safeStorage.set('lup.test', 'y')).not.toThrow();
  });
});
