/** Kiểm tra tệp ảnh người dùng tải lên (dữ liệu không tin cậy) trước khi giải mã. */

export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
] as const;

export const MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 100;

export type ImageFileError = 'unsupported-type' | 'too-large' | 'empty';

export function validateImageFile(file: Pick<File, 'type' | 'size'>): ImageFileError | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) return 'unsupported-type';
  if (file.size === 0) return 'empty';
  if (file.size > MAX_IMAGE_FILE_BYTES) return 'too-large';
  return null;
}

export interface UploadPlan<T> {
  readonly accepted: T[];
  readonly rejected: { readonly file: T; readonly reason: ImageFileError | 'too-many' }[];
}

/** Chia danh sách tệp thành nhận / từ chối, giới hạn số tệp mỗi lần tải. */
export function planUpload<T extends Pick<File, 'type' | 'size'>>(files: readonly T[]): UploadPlan<T> {
  const accepted: T[] = [];
  const rejected: UploadPlan<T>['rejected'] = [];
  for (const file of files) {
    const reason = validateImageFile(file);
    if (reason) rejected.push({ file, reason });
    else if (accepted.length >= MAX_FILES_PER_UPLOAD) rejected.push({ file, reason: 'too-many' });
    else accepted.push(file);
  }
  return { accepted, rejected };
}
