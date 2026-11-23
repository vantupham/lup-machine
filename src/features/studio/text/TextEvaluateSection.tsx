import { useTranslation } from 'react-i18next';
import { topTerms, type TextData, type TextEvaluation, type TrainedText } from '@/core/text/text-model';
import { formatPercent, Stat } from '@/features/playground/controls';
import { colorFor } from '@/features/studio/image/lab/class-style';
import { ExactBadge } from '@/ui/ExactBadge';
import { ConfusionTable } from '../tabular/EvaluateSection';

const TOP_TERMS = 8;
const MAX_WRONG_LISTED = 8;
const OVERFIT_GAP = 0.1;

export function TextEvaluateSection({ evaluation, trained, data }: { readonly evaluation: TextEvaluation; readonly trained: TrainedText; readonly data: TextData }) {
  const { t } = useTranslation();
  const wrong = data.test.texts
    .map((text, i) => ({ text, actual: data.test.y[i] as number, predicted: evaluation.testPredictions[i] as number }))
    .filter((w) => w.actual !== w.predicted);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <dl className="grid grid-cols-2 gap-3">
          <Stat label={t('playground.common.trainAccuracy')} value={evaluation.trainAccuracy === null ? '—' : formatPercent(evaluation.trainAccuracy)} />
          <Stat label={t('playground.common.testAccuracy')} value={evaluation.testAccuracy === null ? '—' : formatPercent(evaluation.testAccuracy)} />
        </dl>
        {evaluation.trainAccuracy !== null && evaluation.testAccuracy !== null && evaluation.trainAccuracy - evaluation.testAccuracy > OVERFIT_GAP && (
          <p className="border-l-4 border-warning pl-2 text-sm" role="note">{t('tabular.evaluate.overfit')}</p>
        )}
        <ConfusionTable matrix={evaluation.confusion} classNames={data.classNames} />
        <div>
          <h4 className="text-sm font-medium">{t('text.evaluate.wrongTitle', { n: wrong.length })}</h4>
          <ul className="mt-1 space-y-1 text-sm" data-testid="text-wrong">
            {wrong.slice(0, MAX_WRONG_LISTED).map((w, i) => (
              <li key={i}>
                “{w.text}” — <span className="text-muted">{t('text.evaluate.wrongItem', { actual: data.classNames[w.actual], predicted: data.classNames[w.predicted] })}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <section aria-labelledby="text-explain-title" className="lab-card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id="text-explain-title" className="font-semibold">{t('text.evaluate.topTitle')}</h3>
          <ExactBadge label={t('playground.exact')} hint={t('text.evaluate.topHint')} />
        </div>
        <p className="text-xs text-muted">{t(trained.kind === 'naive-bayes' ? 'text.evaluate.topNb' : 'text.evaluate.topLogistic')}</p>
        <ul className="space-y-2 text-sm" data-testid="text-top-terms">
          {data.classNames.map((label, c) => (
            <li key={label}>
              <span className="font-semibold" style={{ color: colorFor(c) }}>{label}:</span>{' '}
              <span className="font-mono text-xs">{topTerms(trained, data, c, TOP_TERMS).map((term) => term.term).join(' · ')}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
