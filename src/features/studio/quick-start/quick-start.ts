import type { ProjectType } from '@/storage/schemas/project';

/** Thứ tự thẻ "Tạo mô hình mới": các loại dùng webcam/micro (dễ chơi nhất) đứng trước. */
export const QUICK_START_TYPES: readonly ProjectType[] = ['image', 'audio', 'pose', 'text', 'tabular'];

/** Đường dẫn tiếng Việt không dấu để giáo viên dán vào bài giảng: #/studio/moi/anh … */
const SLUGS: Readonly<Record<ProjectType, string>> = {
  image: 'anh',
  audio: 'am-thanh',
  pose: 'tu-the',
  text: 'van-ban',
  tabular: 'bang-so',
};

export function slugForProjectType(type: ProjectType): string {
  return SLUGS[type];
}

export function projectTypeFromSlug(slug: string): ProjectType | null {
  const match = QUICK_START_TYPES.find((type) => SLUGS[type] === slug);
  return match ?? null;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Tên tự đặt "<gốc> <n>", với n lớn hơn mọi số đã dùng cho cùng gốc.
 * Không dùng lại số của dự án đã xóa để học sinh không nhầm dự án cũ với dự án mới.
 */
export function nextProjectName(base: string, existingNames: readonly string[]): string {
  const pattern = new RegExp(`^${escapeRegExp(base)} (\\d+)$`);
  const used = existingNames.map((name) => pattern.exec(name)?.[1]).filter((n): n is string => n !== undefined).map(Number);
  return `${base} ${Math.max(0, ...used) + 1}`;
}
