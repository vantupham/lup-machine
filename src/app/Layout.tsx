import { Link, NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ModeSwitch } from '@/ui/ModeSwitch';
import { PresentationController, PresentationToggle } from '@/ui/PresentationMode';
import { useOfflineStore } from '@/ui/offline';
import { rememberLanguage, type Language } from '@/i18n';
import { Check } from '@/ui/icons';

/** Logo dẫn về trang chủ; Giới thiệu và đổi ngôn ngữ nằm ở chân trang. */
const NAV_ITEMS = [
  { to: '/studio', key: 'nav.studio', end: false, featured: true },
  { to: '/playground', key: 'nav.playground', end: false },
  { to: '/lessons', key: 'nav.lessons', end: false },
  { to: '/dao-duc', key: 'nav.ethics', end: false },
  { to: '/giao-vien', key: 'nav.teacher', end: false },
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
      <header className="border-b border-rule bg-surface/90 backdrop-blur print:hidden presentation:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <NavLink to="/" className="group flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold tracking-tight">
              LUP<span className="text-primary">·</span>Machine
            </span>
            <span className="hidden text-sm text-muted sm:inline">
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
                    data-featured={'featured' in item ? 'true' : undefined}
                    className={({ isActive }) =>
                      `block whitespace-nowrap rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-ink text-paper'
                          : 'featured' in item
                            ? 'bg-primary/10 font-semibold text-primary ring-1 ring-primary/40 hover:bg-primary/20'
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
            <PresentationToggle />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 print:p-0 presentation:max-w-none presentation:px-10 presentation:pt-16">
        <Outlet />
      </main>

      <footer className="border-t border-rule py-6 text-center font-mono text-xs text-muted print:hidden presentation:hidden">
        <p>{t('footer.privacy')}</p>
        <p className="mt-2 flex items-center justify-center gap-4 font-sans text-sm">
          <Link to="/about" className="text-primary hover:underline">
            {t('nav.about')}
          </Link>
          <button type="button" onClick={toggleLanguage} className="text-primary hover:underline" lang={i18n.language === 'vi' ? 'en' : 'vi'}>
            {t('nav.switchTo')}
          </button>
        </p>
        {offline !== 'off' && (
          <p role="status" className={`mt-1 ${offline === 'error' ? 'text-warning' : offline === 'ready' ? 'text-accent' : ''}`} data-testid="offline-status">
            {offline === 'ready' && <Check className="mr-1" />}
            {t(`footer.offline.${offline}`)}
          </p>
        )}
      </footer>
      <PresentationController />
    </div>
  );
}
