import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ModeSwitch } from '@/ui/ModeSwitch';
import { rememberLanguage, type Language } from '@/i18n';

const NAV_ITEMS = [
  { to: '/', key: 'nav.home', end: true },
  { to: '/studio', key: 'nav.studio', end: false },
  { to: '/about', key: 'nav.about', end: false },
] as const;

export function Layout() {
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const next: Language = i18n.language === 'vi' ? 'en' : 'vi';
    void i18n.changeLanguage(next);
    rememberLanguage(next);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-[var(--color-rule)] bg-[var(--color-surface)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <NavLink to="/" className="group flex items-baseline gap-2">
            <span className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
              LUP<span className="text-[var(--color-primary)]">·</span>Machine
            </span>
            <span className="hidden text-xs uppercase tracking-[0.18em] text-[var(--color-muted)] sm:inline">
              {t('app.tagline')}
            </span>
          </NavLink>

          <nav aria-label={t('nav.label')} className="order-3 w-full sm:order-none sm:w-auto">
            <ul className="flex gap-1 overflow-x-auto">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `block whitespace-nowrap rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                          : 'hover:bg-[var(--color-rule)]/60'
                      }`
                    }
                  >
                    {t(item.key)}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <ModeSwitch />
            <button
              type="button"
              onClick={toggleLanguage}
              className="btn btn-ghost px-3 py-1.5 text-sm"
              lang={i18n.language === 'vi' ? 'en' : 'vi'}
            >
              {t('nav.switchTo')}
            </button>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <Outlet />
      </main>

      <footer className="border-t border-[var(--color-rule)] py-6 text-center font-[family-name:var(--font-mono)] text-xs text-[var(--color-muted)]">
        {t('footer.privacy')}
      </footer>
    </div>
  );
}
