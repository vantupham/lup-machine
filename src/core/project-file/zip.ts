import { unzipSync, zipSync, type Zippable } from 'fflate';

/** Giới hạn khi mở tệp zip do người dùng đưa vào (dữ liệu không tin cậy). */
export interface ZipLimits {
  readonly maxArchiveBytes: number;
  readonly maxEntries: number;
  /** Tổng kích thước SAU giải nén. */
  readonly maxTotalBytes: number;
}

export class ZipLimitError extends RangeError {}

/** Đuôi tệp đã nén sẵn (ảnh JPEG/PNG, tệp dự án .lup lồng trong gói bài tập): lưu nguyên, nén thêm chỉ tốn thời gian. */
const STORED_EXTENSIONS = /\.(jpe?g|png|lup)$/i;

/** Ghi tệp zip. Ngày giờ cố định để cùng nội dung luôn ra cùng một tệp. */
export function writeZip(files: Readonly<Record<string, Uint8Array>>): Uint8Array {
  const entries: Zippable = {};
  for (const [name, data] of Object.entries(files)) {
    entries[name] = [data, { level: STORED_EXTENSIONS.test(name) ? 0 : 6, mtime: new Date(Date.UTC(2026, 0, 1)) }];
  }
  return zipSync(entries);
}

/**
 * Đọc tệp zip an toàn:
 * - kiểm tra số tệp và kích thước khai báo TRƯỚC khi giải nén (chống "bom zip");
 * - bộ đệm giải nén có kích thước cố định bằng kích thước khai báo, nên khai báo sai cũng không tràn bộ nhớ;
 * - chỉ giải nén những tệp có tên được `accept` chấp nhận (tên lạ bị bỏ qua);
 *   `accept` trả về số byte tối đa SAU giải nén cho tệp đó, hoặc false để bỏ qua.
 */
export function readZip(
  archive: Uint8Array,
  limits: ZipLimits,
  accept: (name: string) => number | false,
): Map<string, Uint8Array> {
  if (archive.length > limits.maxArchiveBytes) throw new ZipLimitError('Tệp quá lớn');
  let entries = 0;
  let total = 0;
  let raw: Record<string, Uint8Array>;
  try {
    raw = unzipSync(archive, {
      filter: (file) => {
        if (file.name.endsWith('/')) return false;
        entries += 1;
        if (entries > limits.maxEntries) throw new ZipLimitError('Tệp nén chứa quá nhiều tệp');
        const maxBytes = accept(file.name);
        if (maxBytes === false) return false;
        total += file.originalSize;
        if (file.originalSize > maxBytes || total > limits.maxTotalBytes) {
          throw new ZipLimitError('Nội dung giải nén quá lớn');
        }
        return true;
      },
    });
  } catch (error: unknown) {
    if (error instanceof ZipLimitError) throw error;
    throw new RangeError('Không đọc được tệp nén (tệp hỏng hoặc không phải tệp zip)', { cause: error });
  }
  return new Map(Object.entries(raw));
}
