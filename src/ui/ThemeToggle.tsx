import { useTranslation } from 'react-i18next';
import { Moon, Sun } from './icons';
import { useThemeStore } from './theme-store';

/** Nút bật / tắt giao diện tối trên thanh đầu trang. Icon cho biết giao diện sẽ chuyển sang. */
export function ThemeToggle() {
  const { t } = useTranslation();
  const isDark = useThemeStore((s) => s.theme === 'dark');
  const toggle = useThemeStore((s) => s.toggle);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isDark}
      aria-label={t('theme.dark')}
      title={t(isDark ? 'theme.toLight' : 'theme.toDark')}
      className="btn btn-ghost px-2.5 py-1.5 text-sm"
    >
      {isDark ? <Sun /> : <Moon />}
    </button>
  );
}
