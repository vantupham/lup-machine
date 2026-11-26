import { create } from 'zustand';
import { safeStorage } from './safe-storage';

export type Theme = 'light' | 'dark';

/** Giữ đồng bộ với public/theme-init.js (đặt giao diện trước khi vẽ trang để không nháy màu). */
const STORAGE_KEY = 'lup.theme';

/** Màu thanh trình duyệt / thanh tiêu đề ứng dụng cài đặt, theo từng giao diện. */
export const THEME_COLORS: Readonly<Record<Theme, string>> = { light: '#1b2433', dark: '#0e1420' };

/** Mặc định là sáng; chỉ tối khi người dùng đã chọn tối. */
export function readTheme(): Theme {
  return safeStorage.get(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
}

/** Đặt data-theme ở gốc trang (CSS đổi color-scheme theo đó) và màu thanh trình duyệt. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'dark') root.dataset.theme = 'dark';
  else delete root.dataset.theme;
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
}

interface ThemeState {
  readonly theme: Theme;
  toggle: () => void;
}

/** Giao diện sáng / tối do người dùng chọn, được nhớ cho lần sau. Không tự theo hệ điều hành. */
export const useThemeStore = create<ThemeState>()((set, get) => ({
  theme: readTheme(),
  toggle: () => {
    const theme: Theme = get().theme === 'dark' ? 'light' : 'dark';
    safeStorage.set(STORAGE_KEY, theme);
    applyTheme(theme);
    set({ theme });
  },
}));
