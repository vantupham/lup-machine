import { foldVietnamese, matchesName } from './match-name';

describe('tìm dự án theo tên', () => {
  test('bỏ dấu, kể cả chữ đ', () => {
    expect(foldVietnamese('  Đường đi của Lá CÂY  ')).toBe('duong di cua la cay');
  });

  test('gõ không dấu, có dấu, chữ hoa đều khớp', () => {
    expect(matchesName('Phân loại rác', 'rac')).toBe(true);
    expect(matchesName('Phân loại rác', 'LOẠI')).toBe(true);
    expect(matchesName('Phân loại rác', 'ác')).toBe(true);
    expect(matchesName('Phân loại rác', 'giấy')).toBe(false);
  });

  test('ô tìm trống thì mọi dự án đều khớp', () => {
    expect(matchesName('Bất kỳ', '   ')).toBe(true);
  });
});
