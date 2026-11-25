import { nextClassName } from './next-class-name';

const label = (n: number) => `Lớp ${n}`;

describe('nextClassName', () => {
  test('số tiếp theo sau số lớp hiện có', () => {
    expect(nextClassName(['Lớp 1', 'Lớp 2'], label)).toBe('Lớp 3');
  });

  test('chưa có lớp nào thì bắt đầu từ 1', () => {
    expect(nextClassName([], label)).toBe('Lớp 1');
  });

  test('bỏ qua tên đã có (không phân biệt hoa thường, khoảng trắng thừa)', () => {
    expect(nextClassName(['Giấy', ' lớp 2 ', 'LỚP 3'], label)).toBe('Lớp 4');
  });

  test('lớp đã bị đổi tên thì vẫn tăng theo số lượng, không trùng', () => {
    expect(nextClassName(['Giấy', 'Nhựa'], label)).toBe('Lớp 3');
  });
});
