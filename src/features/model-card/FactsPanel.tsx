import { useTranslation } from 'react-i18next';
import { ExactBadge } from '@/ui/ExactBadge';
import { floorPercent } from '@/core/percent';
import type { ModelCardFacts } from './facts';

const percent = floorPercent;

interface FactsPanelProps {
  readonly facts: ModelCardFacts;
}

/** Số liệu đọc thẳng từ dự án, để học sinh dựa vào khi viết thẻ (không tự bịa số). */
export function FactsPanel({ facts }: FactsPanelProps) {
  const { t } = useTranslation();
  const hasClasses = facts.projectType === 'image' || facts.projectType === 'audio' || facts.projectType === 'pose';

  return (
    <section aria-labelledby="model-card-facts" className="lab-card space-y-3 p-5 print:border print:p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="model-card-facts" className="font-semibold">{t('modelCard.factsTitle')}</h2>
        <ExactBadge label={t('modelCard.factsExact')} hint={t('modelCard.factsExactHint')} />
      </div>
      <p className="text-xs text-muted">{t('modelCard.factsNote')}</p>
      <ul className="space-y-1 text-sm" data-testid="model-card-facts">
        <li>{t('modelCard.factsType', { type: t(`studio.types.${facts.projectType}`) })}</li>
        {hasClasses && facts.classes.length === 0 && <li>{t('modelCard.factsNoClasses')}</li>}
        {facts.classes.map((c, i) => (
          <li key={i}>
            {c.train === null || c.test === null
              ? t('modelCard.factsClass', { name: c.name, count: c.count })
              : t('modelCard.factsClassSplit', { name: c.name, count: c.count, train: c.train, test: c.test })}
          </li>
        ))}
        {!hasClasses && (
          <li>{facts.table ? t('modelCard.factsTable', { rows: facts.table.rows, columns: facts.table.columns }) : t('modelCard.factsNoTable')}</li>
        )}
        {facts.projectType === 'image' && <li>{runText(t, facts.latestRun)}</li>}
        {facts.latestRun && !facts.latestRun.matchesData && <li className="text-warning">{t('modelCard.factsRunOutdated')}</li>}
        {facts.projectType !== 'image' && <li className="text-muted">{t('modelCard.factsMeasureHint')}</li>}
      </ul>
    </section>
  );
}

type Translate = ReturnType<typeof useTranslation>['t'];

function runText(t: Translate, run: ModelCardFacts['latestRun']): string {
  if (!run) return t('modelCard.factsNoRun');
  const base = { number: run.number, epochs: run.epochs, train: percent(run.trainAccuracy) };
  return run.testAccuracy === null
    ? t('modelCard.factsRunNoTest', base)
    : t('modelCard.factsRun', { ...base, test: percent(run.testAccuracy) });
}
