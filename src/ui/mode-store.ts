import { useEffect } from 'react';
import { create } from 'zustand';
import { safeStorage } from './safe-storage';

export type LearningMode = 'explore' | 'expert';
const STORAGE_KEY = 'lup.mode';

function readMode(): LearningMode {
  return safeStorage.get(STORAGE_KEY) === 'expert' ? 'expert' : 'explore';
}

interface ModeState {
  readonly mode: LearningMode;
  setMode: (mode: LearningMode) => void;
}

/** Chế độ học: Khám phá (trực quan) hoặc Chuyên sâu (số liệu thật, công thức). */
export const useModeStore = create<ModeState>()((set) => ({
  mode: readMode(),
  setMode: (mode) => {
    safeStorage.set(STORAGE_KEY, mode);
    set({ mode });
  },
}));

interface ModeSwitchState {
  /** Số trang đang hiển thị có nội dung đổi theo chế độ học. */
  readonly users: number;
  register: () => () => void;
}

/** Công tắc chế độ học chỉ hiện khi trang đang xem thật sự đổi nội dung theo chế độ. */
export const useModeSwitchStore = create<ModeSwitchState>()((set) => ({
  users: 0,
  register: () => {
    set((s) => ({ users: s.users + 1 }));
    return () => set((s) => ({ users: s.users - 1 }));
  },
}));

/** Gọi ở trang có nội dung Khám phá / Chuyên sâu khác nhau để thanh điều hướng hiện công tắc. */
export function useModeSwitch(): void {
  const register = useModeSwitchStore((s) => s.register);
  useEffect(() => register(), [register]);
}
