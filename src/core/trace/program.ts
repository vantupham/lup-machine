/** Một chương trình Python hiển thị trong khung "Mã Python": các dòng và cách tìm dòng theo đoạn chữ. */
export interface PythonProgram {
  readonly fileName: string;
  readonly lines: readonly string[];
}

export function createProgram(fileName: string, source: string): PythonProgram {
  const lines = source.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
  return { fileName, lines };
}

/**
 * Số thứ tự (từ 0) của dòng DUY NHẤT chứa `anchor`. Vết chạy gắn bước vào dòng bằng đoạn chữ này,
 * nên sửa mã Python mà quên sửa vết sẽ báo lỗi ngay (có test), thay vì tô sáng sai dòng.
 */
export function lineOf(program: PythonProgram, anchor: string): number {
  const found = program.lines.flatMap((line, i) => (line.includes(anchor) ? [i] : []));
  if (found.length !== 1) {
    throw new Error(`"${anchor}" phải nằm trên đúng 1 dòng của ${program.fileName}, đang có ${found.length}`);
  }
  return found[0]!;
}
