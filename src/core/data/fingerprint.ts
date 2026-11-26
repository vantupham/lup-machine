/**
 * "Dấu vân tay" của tập dữ liệu: đổi khi thêm/xóa ảnh, đổi ngăn Huấn luyện/Kiểm tra hoặc đổi thứ tự lớp.
 * Dùng để biết một lần huấn luyện cũ có chạy lại được trên đúng dữ liệu đó không.
 */
interface SampleKey {
  readonly id: string;
  readonly classId: string;
  readonly split: string;
}

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** Băm FNV-1a 32 bit (không dùng cho bảo mật, chỉ để so sánh). */
function fnv1a(text: string): string {
  let hash = FNV_OFFSET;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function datasetFingerprint(classIds: readonly string[], samples: readonly SampleKey[]): string {
  const sampleLines = samples.map((s) => `${s.id}:${s.classId}:${s.split}`).sort();
  return fnv1a(`${classIds.join(',')}\n${sampleLines.join('\n')}`);
}

/** Băm ngắn một chuỗi (ví dụ thời điểm sửa bảng + cột đã chọn) để làm dấu vân tay dữ liệu. */
export function hashText(text: string): string {
  return fnv1a(text);
}
