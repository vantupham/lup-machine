/** Cấu hình mặc định của dự án văn bản và cách lấy các câu từ bảng CSV. */
import type { ParsedTable } from '@/core/tabular/csv';
import type { TextExample } from '@/core/text/text-model';
import type { TextConfig } from '@/storage/schemas/text';
import { EDITOR_COLUMNS } from './text-samples';

export const DEFAULT_TEXT_MODEL: TextConfig['model'] = { kind: 'naive-bayes', alpha: 1, c: 10 };

function averageLength(table: ParsedTable, column: number): number {
  return table.rows.reduce((s, r) => s + (r[column]?.length ?? 0), 0) / Math.max(1, table.rows.length);
}

/** Cột câu: cột "văn bản" nếu có, không thì cột có nội dung dài nhất. Cột nhãn: "nhãn" hoặc cột còn lại ngắn nhất. */
export function initialTextConfig(table: ParsedTable): TextConfig | null {
  if (table.headers.length < 2) return null;
  const byLength = table.headers.map((name, i) => ({ name, avg: averageLength(table, i) })).sort((a, b) => b.avg - a.avg);
  const textColumn = table.headers.includes(EDITOR_COLUMNS.text) ? EDITOR_COLUMNS.text : (byLength[0]?.name as string);
  const labelColumn = table.headers.includes(EDITOR_COLUMNS.label) && textColumn !== EDITOR_COLUMNS.label
    ? EDITOR_COLUMNS.label
    : (byLength.filter((c) => c.name !== textColumn).at(-1)?.name as string);
  return { kind: 'text', textColumn, labelColumn, testRatio: 0.2, seed: 1, maxN: 1, model: DEFAULT_TEXT_MODEL };
}

export function isTextConfigValid(config: TextConfig, table: ParsedTable): boolean {
  return config.textColumn !== config.labelColumn && table.headers.includes(config.textColumn) && table.headers.includes(config.labelColumn);
}

export function examplesFrom(table: ParsedTable, config: TextConfig): TextExample[] {
  const ti = table.headers.indexOf(config.textColumn);
  const li = table.headers.indexOf(config.labelColumn);
  return table.rows.map((r) => ({ text: r[ti] ?? '', label: r[li] ?? '' }));
}
