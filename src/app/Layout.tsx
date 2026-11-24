import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ModeSwitch } from '@/ui/ModeSwitch';
import { useOfflineStore } from '@/ui/offline';
import { rememberLanguage, type Language } from '@/i18n';

const NAV_ITEMS = [
  { to: '/', key: 'nav.home', end: true },
  { to: '/studio', key: 'nav.studio', end: false },
  { to: '/playground', key: 'nav.playground', end: false },
  { to: '/lessons', key: 'nav.lessons', end: false },
  { to: '/giao-vien', key: 'nav.teacher', end: false },
  { to: '/about', key: 'nav.about', end: false },
] as const;

export function Layout() {
  const { t, i18n } = useTranslation();
  const offline = useOfflineStore((s) => s.status);

  const toggleLanguage = () => {
    const next: Language = i18n.language === 'vi' ? 'en' : 'vi';
    void i18n.changeLanguage(next);
    rememberLanguage(next);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-rule bg-surface/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <NavLink to="/" className="group flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold tracking-tight">
              LUP<span className="text-primary">·</span>Machine
            </span>
            <span className="hidden text-xs uppercase tracking-[0.18em] text-muted sm:inline">
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
                          ? 'bg-ink text-paper'
                          : 'hover:bg-rule/60'
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

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 print:p-0">
        <Outlet />
      </main>

      <footer className="border-t border-rule py-6 text-center font-mono text-xs text-muted print:hidden">
        <p>{t('footer.privacy')}</p>
        {offline !== 'off' && (
          <p role="status" className={`mt-1 ${offline === 'error' ? 'text-warning' : offline === 'ready' ? 'text-accent' : ''}`} data-testid="offline-status">
            {t(`footer.offline.${offline}`)}
          </p>
        )}
      </footer>
    </div>
  );
}
