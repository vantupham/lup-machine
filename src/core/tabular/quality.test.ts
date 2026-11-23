import penguinsCsv from '@/content/tabular/penguins.csv?raw';
import { parseCsv, type ParsedTable } from './csv';
import { summarizeColumns } from './columns';
import { prepareData, type PrepareOptions } from './prepare';
import { checkTabularQuality } from './quality';

function load(text: string): ParsedTable {
  const r = parseCsv(text);
  if (!r.ok) throw new Error(r.error);
  return r.table;
}

function issuesFor(table: ParsedTable, options: Omit<PrepareOptions, 'testRatio' | 'seed' | 'task'> & { task?: PrepareOptions['task'] }) {
  const columns = summarizeColumns(table);
  const r = prepareData(table, columns, { task: 'classification', testRatio: 0.2, seed: 1, ...options });
  if (!r.ok) throw new Error(r.error.code);
  return checkTabularQuality(columns, options.features, r.data);
}

describe('checkTabularQuality', () => {
  test('Penguins: báo số dòng bị loại vì thiếu giá trị và lớp Chinstrap ít mẫu', () => {
    const issues = issuesFor(load(penguinsCsv), { target: 'Loài', features: ['Dài mỏ (mm)', 'Giới tính'] });
    expect(issues).toContainEqual({ kind: 'dropped-rows', count: 11 });
    expect(issues).toContainEqual({ kind: 'imbalance', smallest: 'Chinstrap', smallestCount: 68, largest: 'Adelie', largestCount: 146 });
  });

  test('cột giống mã định danh, cột hằng số, dữ liệu quá ít', () => {
    const rows = Array.from({ length: 20 }, (_, i) => `HS${i},lớp 6,${i},${i % 2 ? 'đỗ' : 'trượt'}`);
    const issues = issuesFor(load(`mã,lớp,điểm,kết quả\n${rows.join('\n')}`), { target: 'kết quả', features: ['mã', 'lớp', 'điểm'] });
    expect(issues).toContainEqual({ kind: 'id-like', column: 'mã' });
    expect(issues).toContainEqual({ kind: 'constant', column: 'lớp' });
    expect(issues).toContainEqual({ kind: 'small-data', count: 20 });
    expect(issues.some((i) => i.kind === 'imbalance' || i.kind === 'dropped-rows')).toBe(false);
  });
});
