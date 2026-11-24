import { writeZip } from '@/core/project-file/zip';

/**
 * Ghi tệp Excel (.xlsx, Office Open XML) tối giản: một trang tính, hàng tiêu đề in đậm và được cố định.
 * Không dùng CSV vì Excel cài tiếng Việt dùng dấu ";" phân cột nên CSV hay bị dồn vào một cột.
 * Chữ luôn ghi dạng chuỗi nội tuyến: tên học sinh như "=1+1" không bao giờ thành công thức.
 */
export type CellValue = string | number | null;

export interface SheetInput {
  readonly sheetName: string;
  readonly header: readonly string[];
  readonly rows: readonly (readonly CellValue[])[];
  /** Độ rộng cột theo số ký tự (tùy chọn). */
  readonly widths?: readonly number[];
}

const encoder = new TextEncoder();
// Ký tự XML 1.0 không cho phép (ký tự điều khiển trừ tab, xuống dòng).
// eslint-disable-next-line no-control-regex -- cố ý khớp ký tự điều khiển để loại bỏ chúng
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

function escapeXml(text: string): string {
  return text
    .replace(INVALID_XML, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function columnName(index: number): string {
  let n = index + 1;
  let name = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

/** Excel cấm : \ / ? * [ ] trong tên trang tính, cấm dấu ' ở đầu / cuối và tên "History"; tối đa 31 ký tự. */
export function safeSheetName(name: string): string {
  const cleaned = name
    .replace(/[:\\/?*[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 31)
    .replace(/^'+|'+$/g, '')
    .trim();
  return cleaned && cleaned.toLowerCase() !== 'history' ? cleaned : 'Sheet1';
}

/** Excel giới hạn mỗi ô 32 767 ký tự. */
const MAX_CELL_CHARS = 32_767;

function cell(ref: string, value: CellValue, isHeader: boolean): string {
  const style = isHeader ? ' s="1"' : '';
  if (typeof value === 'number') return Number.isFinite(value) ? `<c r="${ref}"${style}><v>${value}</v></c>` : '';
  if (value === null || value === '') return '';
  return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeXml(value.slice(0, MAX_CELL_CHARS))}</t></is></c>`;
}

function row(index: number, values: readonly CellValue[], isHeader: boolean): string {
  const r = index + 1;
  const cells = values.map((v, c) => cell(`${columnName(c)}${r}`, v, isHeader)).join('');
  return `<row r="${r}">${cells}</row>`;
}

function sheetXml(input: SheetInput): string {
  const cols = input.widths?.length
    ? `<cols>${input.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
    : '';
  const rows = [row(0, input.header, true), ...input.rows.map((values, i) => row(i + 1, values, false))].join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `${cols}<sheetData>${rows}</sheetData></worksheet>`
  );
}

const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
  '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
  '</Types>';

const ROOT_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
  '</Relationships>';

const WORKBOOK_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  '</Relationships>';

/** Kiểu 0: thường; kiểu 1: chữ đậm (hàng tiêu đề). */
const STYLES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

const APP =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>LUP Machine</Application></Properties>';

function workbookXml(sheetName: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets><sheet name="${escapeXml(safeSheetName(sheetName))}" sheetId="1" r:id="rId1"/></sheets></workbook>`
  );
}

export function writeXlsx(input: SheetInput): Uint8Array {
  return writeZip({
    '[Content_Types].xml': encoder.encode(CONTENT_TYPES),
    '_rels/.rels': encoder.encode(ROOT_RELS),
    'docProps/app.xml': encoder.encode(APP),
    'xl/workbook.xml': encoder.encode(workbookXml(input.sheetName)),
    'xl/_rels/workbook.xml.rels': encoder.encode(WORKBOOK_RELS),
    'xl/styles.xml': encoder.encode(STYLES),
    'xl/worksheets/sheet1.xml': encoder.encode(sheetXml(input)),
  });
}
