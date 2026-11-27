import { createProgram, lineOf } from './program';
import { tokenizeLine } from './python-tokens';
import { array, formatNumber, formatShape, formatValue, scalar, text } from './trace-value';

describe('createProgram và lineOf', () => {
  const program = createProgram('a.py', 'x = 1\r\nfor i in range(3):\n    x += i\n\n');

  test('tách dòng, bỏ dòng trống ở cuối', () => {
    expect(program.lines).toEqual(['x = 1', 'for i in range(3):', '    x += i']);
  });

  test('tìm đúng dòng duy nhất', () => {
    expect(lineOf(program, 'for i')).toBe(1);
  });

  test('báo lỗi khi không có hoặc có nhiều dòng khớp', () => {
    expect(() => lineOf(program, 'while')).toThrow(/đang có 0/);
    expect(() => lineOf(program, 'x')).toThrow(/đang có 2/);
  });
});

describe('tokenizeLine', () => {
  const kinds = (line: string) => tokenizeLine(line).map((t) => [t.kind, t.text]);

  test('từ khóa, hàm có sẵn, số và chú thích', () => {
    expect(kinds('for i in range(10):  # lặp')).toEqual([
      ['keyword', 'for'],
      ['plain', ' i '],
      ['keyword', 'in'],
      ['plain', ' '],
      ['builtin', 'range'],
      ['plain', '('],
      ['number', '10'],
      ['plain', '):  '],
      ['comment', '# lặp'],
    ]);
  });

  test('dấu # trong chuỗi không phải chú thích; f-string là một chuỗi', () => {
    expect(kinds('print(f"#{x}")')).toEqual([
      ['builtin', 'print'],
      ['plain', '('],
      ['string', 'f"#{x}"'],
      ['plain', ')'],
    ]);
  });

  test('tên biến có số và số thực dạng mũ', () => {
    expect(kinds('X_train2 = 1e-8')).toEqual([
      ['plain', 'X_train2 = '],
      ['number', '1e-8'],
    ]);
  });

  test('ghép lại đúng dòng gốc', () => {
    const line = '        loss = -np.log(p[np.arange(len(y)), y]).mean()  # sai';
    expect(tokenizeLine(line).map((t) => t.text).join('')).toBe(line);
  });
});

describe('định dạng giá trị', () => {
  test('số nguyên, số thực, số rất nhỏ', () => {
    expect(formatNumber(7, true)).toBe('7');
    expect(formatNumber(0.123456, false)).toBe('0.1235');
    expect(formatNumber(0.00001234, false)).toBe('1.23e-5');
    expect(formatNumber(0, false)).toBe('0.0');
  });

  test('kích thước mảng kiểu numpy', () => {
    expect(formatShape([16])).toBe('(16,)');
    expect(formatShape([16, 1280])).toBe('(16, 1280)');
  });

  test('mảng chỉ giữ vài số đầu', () => {
    const value = array([1, 2, 3, 4], { shape: [4], isInt: true });
    expect(formatValue(value)).toBe('[1, 2, 3, …]');
    expect(formatValue(array([0.5, 0.25], { shape: [2] }))).toBe('[0.5000, 0.2500]');
  });

  test('số và chuỗi', () => {
    expect(formatValue(scalar(3, true))).toBe('3');
    expect(formatValue(text('Rng(42)'))).toBe('Rng(42)');
  });
});
