import { CSV_LIMITS, detectDelimiter, formatCsv, parseCsv } from './csv';

function ok(text: string) {
  const result = parseCsv(text);
  if (!result.ok) throw new Error(`Không đọc được: ${result.error}`);
  return result.table;
}

describe('parseCsv', () => {
  test('đọc bảng đơn giản, cắt khoảng trắng thừa', () => {
    const t = ok('a, b ,c\n1,2,3\n 4 ,5,6\n');
    expect(t.headers).toEqual(['a', 'b', 'c']);
    expect(t.rows).toEqual([['1', '2', '3'], ['4', '5', '6']]);
    expect(t.delimiter).toBe(',');
  });

  test('ngoặc kép chứa dấu phẩy, xuống dòng và "" (RFC 4180)', () => {
    const t = ok('tên,ghi chú\n"Lan, Hoa","nói ""xin chào""\ndòng 2"\n');
    expect(t.rows[0]).toEqual(['Lan, Hoa', 'nói "xin chào"\ndòng 2']);
  });

  test('CRLF, BOM UTF-8 và dòng trống được bỏ qua', () => {
    const t = ok('﻿x;y\r\n1,5;2\r\n\r\n3;4\r\n');
    expect(t.delimiter).toBe(';');
    expect(t.headers).toEqual(['x', 'y']);
    expect(t.rows).toEqual([['1,5', '2'], ['3', '4']]);
  });

  test('nhận dấu tab', () => {
    expect(ok('a\tb\n1\t2').delimiter).toBe('\t');
    expect(detectDelimiter('"a;b",c,d')).toBe(',');
  });

  test('ô trống được giữ lại (giá trị thiếu)', () => {
    expect(ok('a,b,c\n1,,3').rows[0]).toEqual(['1', '', '3']);
  });

  test.each([
    ['', 'empty'],
    ['   \n  \n', 'empty'],
    ['a,b\n"1,2', 'unclosed-quote'],
    ['a,b\n1,2,3', 'ragged-row'],
    ['a,,c\n1,2,3', 'empty-header'],
    ['a,a\n1,2', 'duplicate-header'],
  ])('báo lỗi rõ ràng: %j → %s', (text, error) => {
    const result = parseCsv(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(error);
  });

  test('báo số dòng của dòng bị lệch số cột', () => {
    const result = parseCsv('a,b\n1,2\n3\n');
    expect(result).toMatchObject({ ok: false, error: 'ragged-row', line: 3 });
  });

  test('chặn tệp quá lớn, quá nhiều dòng hoặc cột', () => {
    expect(parseCsv('x'.repeat(CSV_LIMITS.maxChars + 1))).toMatchObject({ ok: false, error: 'too-large' });
    expect(parseCsv(`a\n${'1\n'.repeat(CSV_LIMITS.maxRows + 1)}`)).toMatchObject({ ok: false, error: 'too-many-rows' });
    const wide = Array.from({ length: CSV_LIMITS.maxColumns + 1 }, (_, i) => `c${i}`).join(',');
    expect(parseCsv(`${wide}\n`)).toMatchObject({ ok: false, error: 'too-many-columns' });
  });

  test('tiêu đề quá dài bị cắt ngắn', () => {
    expect(ok(`${'x'.repeat(200)}\n1`).headers[0]).toHaveLength(CSV_LIMITS.maxHeaderLength);
  });
});

describe('formatCsv', () => {
  test('ghi rồi đọc lại được đúng bảng, kể cả ô có dấu phẩy, ngoặc kép, xuống dòng', () => {
    const rows = [['khen', 'Ngon, "rẻ"\nvà nhanh'], ['chê', 'Chậm']];
    const result = parseCsv(formatCsv(['nhãn', 'văn bản'], rows));
    expect(result).toMatchObject({ ok: true, table: { headers: ['nhãn', 'văn bản'], rows } });
  });
});
