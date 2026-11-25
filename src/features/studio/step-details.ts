import { flushSync } from 'react-dom';
import { create } from 'zustand';
import { safeStorage } from '@/ui/safe-storage';

const STORAGE_KEY = 'lup.stepDetails';

interface StepDetailsState {
  /** Các bước chi tiết đang mở (chế độ Khám phá mặc định thu gọn; Chuyên sâu luôn mở). */
  readonly isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
}

/** Ghi nhớ lựa chọn của người xem: đã mở một lần thì lần sau vẫn mở. */
export const useStepDetailsStore = create<StepDetailsState>()((set) => ({
  isOpen: safeStorage.get(STORAGE_KEY) === 'open',
  setOpen: (isOpen) => {
    safeStorage.set(STORAGE_KEY, isOpen ? 'open' : 'closed');
    set({ isOpen });
  },
}));

/** Vùng chứa các bước có thể thu gọn mang thuộc tính này. */
export const STEP_DETAILS_ATTR = 'data-step-details';

/**
 * Tiêu đề một bước đang nằm trong vùng đã thu gọn thì mở vùng đó ngay (đồng bộ),
 * để nơi gọi đo được vị trí và cuộn tới.
 */
export function ensureStepVisible(heading: HTMLElement): void {
  if (!heading.closest(`[${STEP_DETAILS_ATTR}][hidden]`)) return;
  flushSync(() => useStepDetailsStore.getState().setOpen(true));
}
