import { formatScore, parseScore } from './GradeForm';

describe('parseScore', () => {
  test('ô trống là chưa chấm', () => {
    expect(parseScore('  ', 4)).toBeNull();
  });

  test('nhận dấu phẩy hoặc dấu chấm thập phân, làm tròn tới 0,25', () => {
    expect(parseScore('3,5', 4)).toBe(3.5);
    expect(parseScore('2.6', 4)).toBe(2.5);
    expect(parseScore('4', 4)).toBe(4);
  });

  test('gõ sai hoặc vượt điểm tối đa thì báo không hợp lệ (không âm thầm sửa)', () => {
    for (const raw of ['abc', '3,5,5', '1.234,5', '0x10', '1e1', '-1', '4,5']) expect(parseScore(raw, 4)).toBe('invalid');
  });
});

describe('formatScore', () => {
  test('theo ngôn ngữ giao diện', () => {
    expect(formatScore(9.5, 'vi')).toBe('9,5');
    expect(formatScore(9.5, 'en')).toBe('9.5');
    expect(formatScore(10, 'vi')).toBe('10');
  });
});
