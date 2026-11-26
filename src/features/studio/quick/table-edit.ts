import { formatCsv, type ParsedTable } from '@/core/tabular/csv';

/** Đổi mọi ô của cột `column` có giá trị `from` (bỏ khoảng trắng hai đầu) thành `to`; trả về CSV mới. */
export function renameValue(table: ParsedTable, column: string, from: string, to: string): string {
  const index = table.headers.indexOf(column);
  const next = to.replace(/\s+/g, ' ').trim();
  const rows = table.rows.map((r) => (index >= 0 && r[index]?.trim() === from ? r.map((cell, i) => (i === index ? next : cell)) : r));
  return formatCsv(table.headers, rows);
}
