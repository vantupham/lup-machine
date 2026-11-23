/**
 * Dựng tệp Jupyter notebook (.ipynb, nbformat 4) ngay trong trình duyệt.
 * Notebook được TẢI VỀ máy; học sinh tự mở bằng Google Colab (Tệp → Tải sổ tay lên). Không gửi dữ liệu đi đâu.
 */
export type NotebookCell =
  | { readonly cell_type: 'markdown'; readonly metadata: Record<string, never>; readonly source: string[] }
  | {
      readonly cell_type: 'code';
      readonly metadata: Record<string, never>;
      readonly source: string[];
      readonly execution_count: null;
      readonly outputs: never[];
    };

export interface Notebook {
  readonly nbformat: 4;
  readonly nbformat_minor: 5;
  readonly metadata: {
    readonly kernelspec: { readonly name: string; readonly display_name: string; readonly language: string };
    readonly language_info: { readonly name: string };
    readonly colab: { readonly provenance: never[] };
  };
  readonly cells: NotebookCell[];
}

/** nbformat lưu mã nguồn thành mảng dòng, mỗi dòng (trừ dòng cuối) giữ ký tự xuống dòng. */
function toSource(lines: readonly string[]): string[] {
  const text = lines.join('\n');
  const parts = text.split('\n');
  return parts.map((line, i) => (i < parts.length - 1 ? `${line}\n` : line));
}

export function markdown(...lines: string[]): NotebookCell {
  return { cell_type: 'markdown', metadata: {}, source: toSource(lines) };
}

export function code(...lines: string[]): NotebookCell {
  return { cell_type: 'code', metadata: {}, source: toSource(lines), execution_count: null, outputs: [] };
}

export function notebook(cells: NotebookCell[]): Notebook {
  return {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: { name: 'python3', display_name: 'Python 3', language: 'python' },
      language_info: { name: 'python' },
      colab: { provenance: [] },
    },
    cells,
  };
}

/**
 * Chuỗi Python an toàn cho mọi nội dung (kể cả dữ liệu người dùng):
 * JSON là tập con hợp lệ của cú pháp chuỗi Python khi đã thoát các ký tự ngắt dòng Unicode.
 */
export function pyString(value: string): string {
  return JSON.stringify(value).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

/** Số thực in ra Python: luôn đọc lại đúng giá trị (JS dùng biểu diễn ngắn nhất, khứ hồi chính xác). */
export function pyNumber(value: number): string {
  if (!Number.isFinite(value)) throw new RangeError('Không xuất được số không hữu hạn');
  return String(value);
}

export function pyList(values: readonly (string | number)[]): string {
  return `[${values.map((v) => (typeof v === 'string' ? pyString(v) : pyNumber(v))).join(', ')}]`;
}

/** Gộp các vector float32 (little-endian) rồi mã hóa base64 — numpy đọc lại chính xác từng bit. */
export function float32ToBase64(vectors: readonly ArrayLike<number>[]): string {
  const dim = vectors[0]?.length ?? 0;
  const buffer = new ArrayBuffer(vectors.length * dim * 4);
  const view = new DataView(buffer);
  vectors.forEach((v, i) => {
    if (v.length !== dim) throw new RangeError('Các vector phải cùng độ dài');
    for (let j = 0; j < dim; j++) view.setFloat32((i * dim + j) * 4, v[j] as number, true);
  });
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(binary);
}

export function serializeNotebook(nb: Notebook): string {
  return `${JSON.stringify(nb, null, 1)}\n`;
}

/** Tên tệp an toàn từ tên dự án (bỏ dấu, ký tự lạ). */
export function notebookFileName(projectName: string): string {
  const slug = projectName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);
  return `${slug || 'du-an'}-lup-machine.ipynb`;
}
