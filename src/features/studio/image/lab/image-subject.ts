import type { SampleRecord } from '@/storage/db';

/**
 * Một ảnh cần giải thích: ảnh đã lưu trong dự án, hoặc ảnh thử ở bước ⑥ (không được lưu).
 * `id` chỉ dùng để biết ảnh đã đổi (hủy kết quả tính dở của ảnh cũ).
 */
export type ImageSubject = Pick<SampleRecord, 'id' | 'image'>;
