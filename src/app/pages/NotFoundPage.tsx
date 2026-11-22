import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="py-20 text-center">
      <p className="font-[family-name:var(--font-mono)] text-6xl text-[var(--color-primary)]">404</p>
      <h1 className="mt-4 text-2xl font-semibold">{t('notFound.title')}</h1>
      <Link to="/" className="btn btn-ghost mt-6">
        {t('notFound.back')}
      </Link>
    </div>
  );
}
