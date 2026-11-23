/** Suy kiểu và thống kê từng cột của bảng: cột số hay cột phân loại, bao nhiêu ô thiếu. */
import type { ParsedTable } from './csv';

const MISSING_TOKENS: ReadonlySet<string> = new Set(['', 'na', 'n/a', 'nan', 'null', '?', '-']);
const NUMBER_PATTERN = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;
const DECIMAL_COMMA_PATTERN = /^[+-]?\d+,\d+$/;
/** Cột số có ít hơn mức này giá trị nguyên khác nhau thì gợi ý là bài toán phân loại. */
export const MAX_CLASSES = 10;

export function isMissing(cell: string): boolean {
  return MISSING_TOKENS.has(cell.trim().toLowerCase());
}

/** Đọc số; chấp nhận dấu phẩy thập phân kiểu Việt Nam ("5,1"). Không phải số thì trả về null. */
export function parseNumber(cell: string): number | null {
  const s = cell.trim();
  if (NUMBER_PATTERN.test(s)) return Number(s);
  if (DECIMAL_COMMA_PATTERN.test(s)) return Number(s.replace(',', '.'));
  return null;
}

interface ColumnBase {
  readonly name: string;
  readonly index: number;
  readonly missing: number;
}

export interface NumericColumn extends ColumnBase {
  readonly kind: 'numeric';
  readonly unique: number;
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly allIntegers: boolean;
}

export interface CategoricalColumn extends ColumnBase {
  readonly kind: 'categorical';
  /** Các giá trị khác nhau và số lần xuất hiện, sắp theo thứ tự chữ cái. */
  readonly categories: readonly { readonly value: string; readonly count: number }[];
}

export type ColumnSummary = NumericColumn | CategoricalColumn;

export type TaskKind = 'classification' | 'regression';

const collator = new Intl.Collator('vi', { numeric: true });

export function summarizeColumn(table: ParsedTable, index: number): ColumnSummary {
  const name = table.headers[index] as string;
  const cells = table.rows.map((r) => r[index] as string);
  const present = cells.filter((c) => !isMissing(c));
  const missing = cells.length - present.length;
  const numbers = present.map(parseNumber);

  if (present.length > 0 && numbers.every((n) => n !== null)) {
    const values = numbers as number[];
    return {
      kind: 'numeric',
      name,
      index,
      missing,
      unique: new Set(values).size,
      min: Math.min(...values),
      max: Math.max(...values),
      mean: values.reduce((a, b) => a + b, 0) / values.length,
      allIntegers: values.every(Number.isInteger),
    };
  }
  const counts = new Map<string, number>();
  for (const c of present) counts.set(c, (counts.get(c) ?? 0) + 1);
  const categories = [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => collator.compare(a.value, b.value));
  return { kind: 'categorical', name, index, missing, categories };
}

export function summarizeColumns(table: ParsedTable): ColumnSummary[] {
  return table.headers.map((_, i) => summarizeColumn(table, i));
}

/** Gợi ý loại bài toán khi chọn cột cần dự đoán. */
export function suggestTask(column: ColumnSummary): TaskKind {
  if (column.kind === 'categorical') return 'classification';
  return column.allIntegers && column.unique <= MAX_CLASSES ? 'classification' : 'regression';
}

export function compareLabels(a: string, b: string): number {
  return collator.compare(a, b);
}
