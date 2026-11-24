import { create } from 'zustand';
import { safeStorage } from './safe-storage';

/** Cỡ chữ khi trình chiếu (nhân với cỡ chữ gốc). Mọi kích thước dùng rem nên phóng to theo. */
export const PRESENTATION_SCALES = [1.125, 1.25, 1.5, 1.75] as const;
const DEFAULT_SCALE_INDEX = 1;
const SCALE_KEY = 'lup.presentationScale';

export function readScaleIndex(): number {
  const raw = safeStorage.get(SCALE_KEY);
  // Chưa lưu (null) hoặc giá trị hỏng thì dùng cỡ mặc định; lưu ý Number(null) = 0.
  const stored = raw === null || raw.trim() === '' ? Number.NaN : Number(raw);
  return Number.isInteger(stored) && stored >= 0 && stored < PRESENTATION_SCALES.length ? stored : DEFAULT_SCALE_INDEX;
}

interface PresentationState {
  readonly isOn: boolean;
  readonly isLaserOn: boolean;
  readonly scaleIndex: number;
  enter: () => void;
  exit: () => void;
  toggleLaser: () => void;
  bigger: () => void;
  smaller: () => void;
}

function setScale(index: number): { scaleIndex: number } {
  const scaleIndex = Math.min(PRESENTATION_SCALES.length - 1, Math.max(0, index));
  safeStorage.set(SCALE_KEY, String(scaleIndex));
  return { scaleIndex };
}

/** Chế độ trình chiếu cho giáo viên: chữ to, ẩn chi tiết phụ, con trỏ laser. Cỡ chữ được nhớ cho lần sau. */
export const usePresentationStore = create<PresentationState>()((set) => ({
  isOn: false,
  isLaserOn: false,
  scaleIndex: readScaleIndex(),
  enter: () => set({ isOn: true }),
  exit: () => set({ isOn: false, isLaserOn: false }),
  toggleLaser: () => set((s) => ({ isLaserOn: s.isOn && !s.isLaserOn })),
  bigger: () => set((s) => setScale(s.scaleIndex + 1)),
  smaller: () => set((s) => setScale(s.scaleIndex - 1)),
}));

export function presentationScale(index: number): number {
  return PRESENTATION_SCALES[index] ?? PRESENTATION_SCALES[DEFAULT_SCALE_INDEX];
}
