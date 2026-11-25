/**
 * Tên mặc định cho lớp / nhóm mới ("Lớp 3", "Nhóm 4"…): số tiếp theo sau số lớp hiện có,
 * bỏ qua những tên đã dùng. Người dùng đổi tên sau, không phải gõ tên trước khi thêm.
 */
export function nextClassName(existing: readonly string[], label: (n: number) => string): string {
  const taken = new Set(existing.map((name) => name.trim().toLocaleLowerCase('vi')));
  let n = existing.length + 1;
  while (taken.has(label(n).toLocaleLowerCase('vi'))) n++;
  return label(n);
}
