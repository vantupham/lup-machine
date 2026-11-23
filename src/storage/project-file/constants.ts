import type { ZipLimits } from '@/core/project-file/zip';

/** Lỗi khi đọc tệp dự án; thông điệp đủ rõ để hiện cho giáo viên / học sinh. */
export class ProjectFileError extends Error {}

export const PROJECT_FILE_EXTENSION = '.lup';

const MB = 1024 * 1024;

export const PROJECT_FILE_LIMITS: ZipLimits = {
  maxArchiveBytes: 256 * MB,
  maxEntries: 20_000,
  maxTotalBytes: 256 * MB,
};

/** Kích thước tối đa SAU giải nén của từng loại tệp bên trong tệp .lup. */
export const ENTRY_LIMITS = {
  /** Ảnh đã chuẩn hóa 224 px chỉ vài chục KB; cho dư tới 2 MB. */
  image: 2 * MB,
  /** Đoạn 1 giây, 16 kHz, số thực 32 bit = 64 000 byte, cộng tiêu đề và khối phụ. */
  wav: 70_000,
  csv: 8 * MB,
  json: 32 * MB,
} as const;
