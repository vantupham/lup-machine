import { parseCsv, type ParsedTable } from './csv';
import { isMissing, parseNumber, summarizeColumns, suggestTask } from './columns';

function table(text: string): ParsedTable {
  const r = parseCsv(text);
  if (!r.ok) throw new Error(r.error);
  return r.table;
}

describe('parseNumber và isMissing', () => {
  test.each([
    ['3', 3], ['-2.5', -2.5], ['.5', 0.5], ['1e3', 1000], ['5,1', 5.1], [' 7 ', 7],
  ])('đọc %j thành %d', (cell, value) => expect(parseNumber(cell)).toBe(value));

  test.each(['abc', '1.2.3', '1,234,5', '12a', ''])('%j không phải số', (cell) => expect(parseNumber(cell)).toBeNull());

  test.each(['', 'NA', 'nan', 'NULL', '?', '-'])('%j là ô thiếu', (cell) => expect(isMissing(cell)).toBe(true));
  test('"0" không phải ô thiếu', () => expect(isMissing('0')).toBe(false));
});

describe('summarizeColumns', () => {
  const cols = summarizeColumns(table('cao,loài,lớp,ghi\n1.5,mèo,6,\n2,chó,7,NA\nNA,mèo,6,\n3,chó,8,'));

  test('cột số: bỏ qua ô thiếu khi tính thống kê', () => {
    expect(cols[0]).toMatchObject({ kind: 'numeric', missing: 1, unique: 3, min: 1.5, max: 3, allIntegers: false });
    expect(cols[0]!.kind === 'numeric' && cols[0]!.mean).toBeCloseTo(6.5 / 3);
  });

  test('cột phân loại: đếm từng giá trị, sắp theo chữ cái tiếng Việt', () => {
    expect(cols[1]).toMatchObject({ kind: 'categorical', missing: 0, categories: [{ value: 'chó', count: 2 }, { value: 'mèo', count: 2 }] });
  });

  test('cột toàn ô thiếu được coi là phân loại, không có giá trị nào', () => {
    expect(cols[3]).toMatchObject({ kind: 'categorical', missing: 4, categories: [] });
  });

  test('gợi ý bài toán: chữ → phân loại; số nguyên ít giá trị → phân loại; số thực → hồi quy', () => {
    expect(suggestTask(cols[1]!)).toBe('classification');
    expect(suggestTask(cols[2]!)).toBe('classification');
    expect(suggestTask(cols[0]!)).toBe('regression');
  });
});
