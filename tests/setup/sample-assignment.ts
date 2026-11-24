import type { Assignment } from '@/storage/schemas/assignment';

/** Bài tập mẫu dùng chung trong kiểm thử. */
export const sampleAssignment: Assignment = {
  id: '6f1c2b1e-8a4d-4c5e-9b7a-1d2e3f4a5b6c',
  title: 'Phân loại rác bằng ảnh',
  teacher: 'Cô Lan',
  instructions: 'Thu ít nhất 20 ảnh mỗi loại.',
  projectType: 'image',
  questions: ['Nhóm nào hay bị nhầm?', 'Em sửa dữ liệu thế nào?'],
  rubric: [
    { criterion: 'Dữ liệu', description: 'Đủ, cân bằng', maxPoints: 4 },
    { criterion: 'Thẻ mô hình', description: '', maxPoints: 6 },
  ],
  createdAt: '2026-11-24T08:00:00.000Z',
};
