import { unzipSync } from 'fflate';
import { columnName, safeSheetName, writeXlsx } from './xlsx';

const text = (files: Record<string, Uint8Array>, name: string) => new TextDecoder().decode(files[name]);

describe('writeXlsx', () => {
  test('đủ các tệp bắt buộc của một sổ tính Excel', () => {
    const files = unzipSync(writeXlsx({ sheetName: 'Bảng điểm', header: ['Tên'], rows: [['An']] }));
    expect(Object.keys(files).sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'docProps/app.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
    ]);
    expect(text(files, 'xl/workbook.xml')).toContain('<sheet name="Bảng điểm" sheetId="1" r:id="rId1"/>');
  });

  test('ô chữ là chuỗi nội tuyến (không bao giờ thành công thức), ô số là số, ô trống bỏ qua', () => {
    const files = unzipSync(writeXlsx({ sheetName: 'S', header: ['Tên', 'Điểm', 'Ghi chú'], rows: [['=1+1', 7.5, null]] }));
    const sheet = text(files, 'xl/worksheets/sheet1.xml');
    expect(sheet).toContain('<c r="A1" t="inlineStr" s="1"><is><t xml:space="preserve">Tên</t></is></c>');
    expect(sheet).toContain('<c r="A2" t="inlineStr"><is><t xml:space="preserve">=1+1</t></is></c>');
    expect(sheet).toContain('<c r="B2"><v>7.5</v></c>');
    expect(sheet).not.toContain('r="C2"');
    expect(sheet).toContain('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>');
  });

  test('thoát ký tự đặc biệt XML và bỏ ký tự điều khiển không hợp lệ', () => {
    const sheet = text(unzipSync(writeXlsx({ sheetName: 'S', header: ['x'], rows: [['<a href="x">&\'\u0001\ttab']] })), 'xl/worksheets/sheet1.xml');
    expect(sheet).toContain('&lt;a href=&quot;x&quot;&gt;&amp;&apos;\ttab');
    expect(sheet).not.toContain('\u0001');
  });

  test('ô chữ quá dài bị cắt ở giới hạn của Excel', () => {
    const sheet = text(unzipSync(writeXlsx({ sheetName: 'S', header: ['x'], rows: [['a'.repeat(40_000)]] })), 'xl/worksheets/sheet1.xml');
    expect(sheet).toContain('a'.repeat(32_767) + '</t>');
    expect(sheet).not.toContain('a'.repeat(32_768));
  });

  test('số không hữu hạn được ghi thành ô trống', () => {
    const sheet = text(unzipSync(writeXlsx({ sheetName: 'S', header: ['x'], rows: [[Number.NaN]] })), 'xl/worksheets/sheet1.xml');
    expect(sheet).not.toContain('NaN');
  });

  test('độ rộng cột', () => {
    const sheet = text(unzipSync(writeXlsx({ sheetName: 'S', header: ['a', 'b'], rows: [], widths: [30, 8] })), 'xl/worksheets/sheet1.xml');
    expect(sheet).toContain('<cols><col min="1" max="1" width="30" customWidth="1"/><col min="2" max="2" width="8" customWidth="1"/></cols>');
  });
});

describe('tên cột và tên trang tính', () => {
  test('A, Z, AA, AZ, BA', () => {
    expect([0, 25, 26, 51, 52].map(columnName)).toEqual(['A', 'Z', 'AA', 'AZ', 'BA']);
  });

  test('bỏ ký tự Excel cấm, tối đa 31 ký tự, không để trống', () => {
    expect(safeSheetName('Bài 1: [7A]/8B?')).toBe('Bài 1 7A8B');
    expect(safeSheetName('x'.repeat(40))).toHaveLength(31);
    expect(safeSheetName('???')).toBe('Sheet1');
    expect(safeSheetName("'Bài 1'")).toBe('Bài 1');
    expect(safeSheetName('History')).toBe('Sheet1');
  });
});
