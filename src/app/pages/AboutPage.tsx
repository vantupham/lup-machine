import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectRepository } from '@/storage/repository-context';
import { getErrorMessage } from '@/ui/error-message';

const REPO_URL = 'https://github.com/vantupham/lup-machine';

type DeleteState =
  | { readonly status: 'idle' }
  | { readonly status: 'done' }
  | { readonly status: 'error'; readonly message: string };

export function AboutPage() {
  const { t } = useTranslation();
  const repository = useProjectRepository();
  const [deleteState, setDeleteState] = useState<DeleteState>({ status: 'idle' });
  const privacyItems = t('about.privacyItems', { returnObjects: true }) as string[];

  const handleDeleteAll = async () => {
    if (!window.confirm(t('about.confirmDeleteAll'))) return;
    try {
      await repository.deleteAll();
      setDeleteState({ status: 'done' });
    } catch (error: unknown) {
      setDeleteState({ status: 'error', message: getErrorMessage(error) });
    }
  };

  return (
    <article className="mx-auto max-w-3xl space-y-12">
      <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold">{t('about.title')}</h1>

      <section aria-labelledby="what-title">
        <h2 id="what-title" className="mb-2 text-xl font-semibold">
          {t('about.whatTitle')}
        </h2>
        <p className="leading-relaxed text-[var(--color-muted)]">{t('about.whatBody')}</p>
      </section>

      <section aria-labelledby="privacy-title" className="lab-card p-6">
        <h2 id="privacy-title" className="mb-4 text-xl font-semibold">
          {t('about.privacyTitle')}
        </h2>
        <ul className="space-y-3">
          {privacyItems.map((item) => (
            <li key={item} className="flex gap-3 leading-relaxed">
              <span aria-hidden="true" className="text-[var(--color-accent)]">
                ✓
              </span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="shared-title" className="border-l-4 border-[var(--color-warning)] pl-5">
        <h2 id="shared-title" className="mb-2 text-xl font-semibold">
          {t('about.sharedTitle')}
        </h2>
        <p className="mb-4 text-[var(--color-muted)]">{t('about.sharedBody')}</p>
        <button type="button" onClick={() => void handleDeleteAll()} className="btn btn-danger">
          {t('about.deleteAll')}
        </button>
        {deleteState.status === 'done' && (
          <p role="status" className="mt-3 text-sm text-[var(--color-accent)]">
            {t('about.deletedAll')}
          </p>
        )}
        {deleteState.status === 'error' && (
          <p role="alert" className="mt-3 text-sm text-[var(--color-danger)]">
            {t('about.deleteError', { message: deleteState.message })}
          </p>
        )}
      </section>

      <section aria-labelledby="license-title">
        <h2 id="license-title" className="mb-2 text-xl font-semibold">
          {t('about.licenseTitle')}
        </h2>
        <p className="mb-3 text-[var(--color-muted)]">{t('about.licenseBody')}</p>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] underline">
          {t('about.sourceCode')} ↗
        </a>
      </section>
    </article>
  );
}
