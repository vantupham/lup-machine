import { parseCsv, type ParsedTable } from '@/core/tabular/csv';
import { addSentence, renameLabel, textGroups } from './text-edit';

function parse(csv: string): ParsedTable {
  const result = parseCsv(csv);
  if (!result.ok) throw new Error(result.error);
  return result.table;
}

const COLUMNS = { textColumn: 'văn bản', labelColumn: 'nhãn' } as const;

describe('addSentence', () => {
  test('chưa có bảng: tạo bảng hai cột (nhãn, văn bản) với câu đầu tiên', () => {
    expect(parse(addSentence(null, null, 'khen', 'Cơm ngon.')).rows).toEqual([['khen', 'Cơm ngon.']]);
    expect(parse(addSentence(null, null, 'khen', 'Cơm ngon.')).headers).toEqual(['nhãn', 'văn bản']);
  });

  test('bảng có thêm cột khác: điền đúng cột câu và cột nhãn, cột khác để trống', () => {
    const table = parse('id,câu,loại\n1,Trời mưa.,thời tiết\n');
    const next = parse(addSentence(table, { textColumn: 'câu', labelColumn: 'loại' }, 'thể thao', 'Đội nhà thắng.'));
    expect(next.rows).toEqual([
      ['1', 'Trời mưa.', 'thời tiết'],
      ['', 'Đội nhà thắng.', 'thể thao'],
    ]);
  });

  test('bỏ khoảng trắng thừa và xuống dòng trong câu', () => {
    const next = parse(addSentence(null, null, ' khen ', '  Cơm\nngon  '));
    expect(next.rows).toEqual([['khen', 'Cơm ngon']]);
  });
});

describe('renameLabel', () => {
  test('đổi mọi ô nhãn trùng tên cũ, giữ nguyên các ô khác', () => {
    const table = parse('nhãn,văn bản\nkhen,Ngon.\n chê ,Dở.\nkhen,Rẻ.\n');
    expect(parse(renameLabel(table, COLUMNS, 'khen', 'thích')).rows).toEqual([
      ['thích', 'Ngon.'],
      ['chê', 'Dở.'],
      ['thích', 'Rẻ.'],
    ]);
  });
});

describe('textGroups', () => {
  test('gom câu theo nhãn theo thứ tự xuất hiện; bỏ dòng thiếu câu hoặc thiếu nhãn', () => {
    const groups = textGroups([
      { label: 'khen', text: 'Ngon.' },
      { label: 'chê', text: 'Dở.' },
      { label: '', text: 'Không nhãn.' },
      { label: 'khen', text: ' ' },
      { label: ' khen', text: 'Rẻ.' },
    ]);
    expect(groups).toEqual([
      { name: 'khen', count: 2 },
      { name: 'chê', count: 1 },
    ]);
  });
});
