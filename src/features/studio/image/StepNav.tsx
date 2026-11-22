import { useTranslation } from 'react-i18next';

const STEPS = ['data', 'check', 'represent', 'train', 'evaluate', 'use'] as const;
export type StepId = (typeof STEPS)[number];

/** Các bước đã có trong phiên bản hiện tại. */
const AVAILABLE: ReadonlySet<StepId> = new Set(['data', 'check', 'represent', 'train', 'evaluate']);

export function StepNav() {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('project.steps.label')}>
      <ol className="flex flex-wrap gap-2">
        {STEPS.map((step, i) => {
          const isAvailable = AVAILABLE.has(step);
          return (
            <li
              key={step}
              aria-disabled={!isAvailable}
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${
                isAvailable
                  ? 'border-ink bg-surface font-medium'
                  : 'border-dashed border-rule text-muted'
              }`}
            >
              <span className="font-mono text-xs">{i + 1}</span>
              {t(`project.steps.${step}`)}
              {!isAvailable && <span className="text-xs">· {t('project.steps.soon')}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
