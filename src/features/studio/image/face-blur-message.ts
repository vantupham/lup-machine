import type { TFunction } from 'i18next';

/**
 * Câu báo kết quả làm mờ sau khi thêm ảnh. Không thấy khuôn mặt nào thì nói rõ (có thể mặt quá nhỏ / ở xa),
 * để công tắc "đang bật" không tạo cảm giác an toàn giả.
 */
export function faceBlurSummary(t: TFunction, faces: number, images: number): string {
  if (images === 0) return '';
  return faces > 0 ? t('project.faceBlur.blurred', { count: faces }) : t('project.faceBlur.none');
}
