import type { StageState } from './StageList';

/**
 * Trạng thái của `count` chặng chạy lần lượt. `current` là chặng đang chạy (`count` = đã xong hết);
 * `failedAt` là chặng bị lỗi (null nếu không lỗi). Chặng cuối "sẵn sàng" không có việc để chạy:
 * xong khi các chặng trước xong.
 */
export function stageStates(count: number, current: number, failedAt: number | null): StageState[] {
  return Array.from({ length: count }, (_, i) => {
    if (failedAt !== null) return i < failedAt ? 'done' : i === failedAt ? 'error' : 'pending';
    if (i < current || current >= count) return 'done';
    return i === current ? 'active' : 'pending';
  });
}
