import type { LupDatabase } from '../db';

/**
 * Ghi lại "lần sửa gần nhất" của dự án sau khi dữ liệu bên trong đổi (thêm ảnh, đổi lớp, huấn luyện…),
 * để danh sách dự án và mục "Tiếp tục dự án gần đây" xếp đúng thứ tự.
 * Chỉ gọi sau khi thao tác chính đã thành công. Không bao giờ ném lỗi: thứ tự danh sách chỉ là phụ,
 * còn nếu báo lỗi thì học sinh sẽ bấm lại và dữ liệu (đã lưu rồi) bị nhân đôi.
 */
export async function touchProjects(db: LupDatabase, projectIds: Iterable<string | undefined>, at: string): Promise<void> {
  const ids = [...new Set([...projectIds].filter((id): id is string => typeof id === 'string'))];
  if (ids.length === 0) return;
  try {
    await db.projects.where('id').anyOf(ids).modify({ updatedAt: at });
  } catch (error: unknown) {
    console.error('Không ghi được thời điểm sửa dự án', ids, error);
  }
}
