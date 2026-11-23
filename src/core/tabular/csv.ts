/**
 * Đọc tệp CSV do người dùng cung cấp (dữ liệu KHÔNG tin cậy).
 * - Hỗ trợ ngoặc kép theo RFC 4180 ("a,b", "" là dấu ngoặc kép), dòng CRLF / LF, BOM UTF-8.
 * - Tự nhận dấu phân cách: dấu phẩy, chấm phẩy (Excel tiếng Việt thường dùng) hoặc tab.
 * - Có giới hạn kích thước để máy yếu không bị treo.
 */
export type Delimiter = ',' | ';' | '\t';

export interface ParsedTable {
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
  readonly delimiter: Delimiter;
}

export type CsvErrorCode =
  | 'empty'
  | 'too-large'
  | 'too-many-rows'
  | 'too-many-columns'
  | 'unclosed-quote'
  | 'ragged-row'
  | 'empty-header'
  | 'duplicate-header';

export type CsvResult =
  | { readonly ok: true; readonly table: ParsedTable }
  | { readonly ok: false; readonly error: CsvErrorCode; readonly line?: number; readonly detail?: string };

export const CSV_LIMITS = {
  maxChars: 2_000_000,
  maxRows: 5000,
  maxColumns: 40,
  maxHeaderLength: 60,
} as const;

const DELIMITERS: readonly Delimiter[] = ['\t', ';', ','];

/** Chọn dấu phân cách xuất hiện nhiều nhất ở dòng đầu (ngoài ngoặc kép). */
export function detectDelimiter(firstLine: string): Delimiter {
  const counts = new Map<Delimiter, number>(DELIMITERS.map((d) => [d, 0]));
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && counts.has(ch as Delimiter)) counts.set(ch as Delimiter, counts.get(ch as Delimiter)! + 1);
  }
  let best: Delimiter = ',';
  for (const d of DELIMITERS) if ((counts.get(d) ?? 0) > (counts.get(best) ?? 0)) best = d;
  return best;
}

interface RawRecord {
  readonly cells: string[];
  readonly line: number;
}

function tokenize(text: string, delimiter: Delimiter): RawRecord[] | { error: 'unclosed-quote'; line: number } {
  const records: RawRecord[] = [];
  let cells: string[] = [];
  let cell = '';
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;
  let quoteLine = 1;

  const endRecord = () => {
    cells.push(cell);
    records.push({ cells, line: recordLine });
    cells = [];
    cell = '';
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i] as string;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else {
        if (ch === '\n') line++;
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell.trim() === '') {
      inQuotes = true;
      quoteLine = line;
      cell = '';
    } else if (ch === delimiter) {
      cells.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      endRecord();
      line++;
      recordLine = line;
    } else {
      cell += ch;
    }
  }
  if (inQuotes) return { error: 'unclosed-quote', line: quoteLine };
  if (cell !== '' || cells.length > 0) endRecord();
  return records;
}

export function parseCsv(input: string): CsvResult {
  if (input.length > CSV_LIMITS.maxChars) return { ok: false, error: 'too-large' };
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  if (text.trim() === '') return { ok: false, error: 'empty' };

  const delimiter = detectDelimiter(text.slice(0, text.search(/\r?\n|$/)));
  const tokens = tokenize(text, delimiter);
  if (!Array.isArray(tokens)) return { ok: false, error: tokens.error, line: tokens.line };

  const records = tokens.filter((r) => r.cells.some((c) => c.trim() !== ''));
  const [headerRecord, ...dataRecords] = records;
  if (!headerRecord) return { ok: false, error: 'empty' };

  const headers = headerRecord.cells.map((h) => h.trim().slice(0, CSV_LIMITS.maxHeaderLength));
  if (headers.length > CSV_LIMITS.maxColumns) return { ok: false, error: 'too-many-columns', detail: String(headers.length) };
  const emptyIndex = headers.findIndex((h) => h === '');
  if (emptyIndex >= 0) return { ok: false, error: 'empty-header', line: headerRecord.line, detail: String(emptyIndex + 1) };
  const seen = new Set<string>();
  for (const h of headers) {
    if (seen.has(h)) return { ok: false, error: 'duplicate-header', detail: h };
    seen.add(h);
  }
  if (dataRecords.length > CSV_LIMITS.maxRows) return { ok: false, error: 'too-many-rows', detail: String(dataRecords.length) };

  const rows: string[][] = [];
  for (const record of dataRecords) {
    if (record.cells.length !== headers.length) {
      return { ok: false, error: 'ragged-row', line: record.line, detail: `${record.cells.length}/${headers.length}` };
    }
    rows.push(record.cells.map((c) => c.trim()));
  }
  return { ok: true, table: { headers, rows, delimiter } };
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Ghi bảng thành CSV (RFC 4180): ô có dấu phẩy, ngoặc kép hoặc xuống dòng được đặt trong ngoặc kép. */
export function formatCsv(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  return `${[headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')}\n`;
}
