import { useTranslation } from 'react-i18next';

const STEPS = ['data', 'check', 'represent', 'train', 'evaluate', 'use'] as const;
export type StepId = (typeof STEPS)[number];

/** Sáu bước của một dự án ảnh, theo đúng thứ tự các phần trên trang. */
export function StepNav() {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('project.steps.label')}>
      <ol className="flex flex-wrap gap-2">
        {STEPS.map((step, i) => (
          <li key={step} className="flex items-center gap-2 rounded-full border border-ink bg-surface px-3 py-1 text-sm font-medium">
            <span className="font-mono text-xs">{i + 1}</span>
            {t(`project.steps.${step}`)}
          </li>
        ))}
      </ol>
    </nav>
  );
}
