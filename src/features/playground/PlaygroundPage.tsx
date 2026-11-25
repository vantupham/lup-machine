import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PLAYGROUND_ALGOS } from './catalog';
import { AlgoIcon } from './AlgoIcon';

export function PlaygroundPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-accent">{t('playground.eyebrow')}</p>
        <h1 className="font-display text-4xl font-bold">{t('playground.title')}</h1>
        <p className="mt-3 text-lg text-muted">{t('playground.lead')}</p>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLAYGROUND_ALGOS.map((algo, i) => (
          <li key={algo}>
            <Link
              to={`/playground/${algo}`}
              className="lab-card lab-card-interactive flex h-full flex-col gap-2 p-5"
            >
              <span className="flex items-baseline justify-between">
                <AlgoIcon algo={algo} />
                <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, '0')}</span>
              </span>
              <span className="text-lg font-semibold">{t(`playground.algos.${algo}.name`)}</span>
              <span className="text-sm text-muted">{t(`playground.algos.${algo}.summary`)}</span>
              <span className="mt-auto pt-2 font-mono text-xs text-accent">{t(`playground.algos.${algo}.concept`)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
