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

/** Chế độ học: Khám phá (THCS) hoặc Chuyên sâu (THPT). */
export const useModeStore = create<ModeState>()((set) => ({
  mode: readMode(),
  setMode: (mode) => {
    safeStorage.set(STORAGE_KEY, mode);
    set({ mode });
  },
}));
