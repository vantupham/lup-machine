/** Sửa bảng câu ngay ở khối "Dạy máy trong 3 bước": thêm một câu, đổi tên một nhóm. Luôn trả về CSV mới. */
import { formatCsv, type ParsedTable } from '@/core/tabular/csv';
import type { TextExample } from '@/core/text/text-model';
import type { TextConfig } from '@/storage/schemas/text';
import { renameValue } from '@/features/studio/quick/table-edit';
import { EDITOR_COLUMNS } from './text-samples';

type TextColumns = Pick<TextConfig, 'textColumn' | 'labelColumn'>;

export interface TextGroup {
  readonly name: string;
  readonly count: number;
}

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();

/** Thêm một câu vào nhóm `label`. Chưa có bảng thì tạo bảng hai cột như trình soạn câu. */
export function addSentence(table: ParsedTable | null, columns: TextColumns | null, label: string, text: string): string {
  if (!table || !columns) return formatCsv([EDITOR_COLUMNS.label, EDITOR_COLUMNS.text], [[clean(label), clean(text)]]);
  const ti = table.headers.indexOf(columns.textColumn);
  const li = table.headers.indexOf(columns.labelColumn);
  const row = table.headers.map((_, i) => (i === ti ? clean(text) : i === li ? clean(label) : ''));
  return formatCsv(table.headers, [...table.rows, row]);
}

/** Đổi tên nhóm: mọi ô nhãn bằng `from` (bỏ khoảng trắng hai đầu) thành `to`. */
export function renameLabel(table: ParsedTable, columns: TextColumns, from: string, to: string): string {
  return renameValue(table, columns.labelColumn, from, to);
}

/** Các nhóm và số câu của mỗi nhóm, theo thứ tự xuất hiện; bỏ dòng thiếu câu hoặc thiếu nhãn. */
export function textGroups(examples: readonly TextExample[]): TextGroup[] {
  const counts = new Map<string, number>();
  for (const e of examples) {
    const label = e.label.trim();
    if (!label || !e.text.trim()) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count }));
}
