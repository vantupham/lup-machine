import { useTranslation } from 'react-i18next';
import type { Evaluation, TrainedModel } from '@/core/tabular/models';
import { treeImportances } from '@/core/tabular/models';
import type { PreparedData } from '@/core/tabular/prepare';
import { formatPercent, Stat } from '@/features/playground/controls';
import { Plot2d } from '@/features/playground/Plot2d';
import { TreeDiagram } from '@/features/playground/tree/TreeDiagram';
import { growthOrder } from '@/features/playground/tree/tree-view';
import { colorFor } from '@/features/studio/image/lab/class-style';
import { ExactBadge } from '@/ui/ExactBadge';

const OVERFIT_GAP = 0.1;

function formatNumber(v: number | null, digits = 3): string {
  return v === null ? '—' : Number(v.toPrecision(6)).toLocaleString('vi', { maximumFractionDigits: digits });
}

function ConfusionTable({ matrix, classNames }: { readonly matrix: readonly (readonly number[])[]; readonly classNames: readonly string[] }) {
  const { t } = useTranslation();
  return (
    <table className="text-sm" data-testid="tabular-confusion">
      <caption className="mb-1 text-left text-sm font-medium">{t('tabular.evaluate.confusion')}</caption>
      <thead>
        <tr>
          <th scope="col" className="p-1 text-left text-xs text-muted">{t('tabular.evaluate.trueVsPred')}</th>
          {classNames.map((c) => <th key={c} scope="col" className="p-1 text-xs">{c}</th>)}
        </tr>
      </thead>
      <tbody>
        {matrix.map((row, i) => (
          <tr key={i}>
            <th scope="row" className="p-1 text-left text-xs">{classNames[i]}</th>
            {row.map((v, j) => (
              <td key={j} className={`min-w-10 border border-rule p-1 text-center font-mono ${i === j ? 'bg-accent/15' : v > 0 ? 'bg-danger/15' : ''}`}>{v}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Bars({ items }: { readonly items: readonly { label: string; value: number }[] }) {
  const max = Math.max(1e-9, ...items.map((i) => Math.abs(i.value)));
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.label} className="grid grid-cols-[minmax(0,10rem)_1fr_4rem] items-center gap-2 text-xs">
          <span className="truncate" title={item.label}>{item.label}</span>
          <span className="relative h-2 rounded bg-rule/50">
            <span
              className="absolute top-0 h-2 rounded"
              style={{
                width: `${(Math.abs(item.value) / max) * 50}%`,
                left: item.value >= 0 ? '50%' : `${50 - (Math.abs(item.value) / max) * 50}%`,
                backgroundColor: item.value >= 0 ? 'var(--color-accent)' : 'var(--color-danger)',
              }}
            />
          </span>
          <span className="text-right font-mono">{item.value.toFixed(3)}</span>
        </li>
      ))}
    </ul>
  );
}

function ModelExplanation({ trained, data }: { readonly trained: TrainedModel; readonly data: PreparedData }) {
  const { t } = useTranslation();
  switch (trained.kind) {
    case 'tree': {
      const importances = treeImportances(trained) ?? [];
      return (
        <div className="space-y-4">
          <TreeDiagram tree={trained.tree} opened={new Set(growthOrder(trained.tree))} latest={null} featureNames={data.featureNames} />
          <div>
            <h4 className="mb-1 text-sm font-medium">{t('tabular.evaluate.importances')}</h4>
            <Bars items={data.featureNames.map((label, i) => ({ label, value: importances[i] ?? 0 }))} />
          </div>
        </div>
      );
    }
    case 'logistic':
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted">{t(trained.model.numClasses === 2 ? 'tabular.evaluate.logisticBinary' : 'tabular.evaluate.logisticMulti', { cls: data.classNames[1] })}</p>
          {trained.model.weights.map((w, k) => (
            <div key={k}>
              <h4 className="mb-1 text-sm font-medium" style={{ color: colorFor(trained.model.numClasses === 2 ? 1 : k) }}>
                {t('tabular.evaluate.weightsFor', { cls: data.classNames[trained.model.numClasses === 2 ? 1 : k], b: (trained.model.intercepts[k] as number).toFixed(3) })}
              </h4>
              <Bars items={data.featureNames.map((label, j) => ({ label, value: w[j] ?? 0 }))} />
            </div>
          ))}
        </div>
      );
    case 'linear':
      return (
        <div className="space-y-2">
          <p className="font-mono text-sm" data-testid="linear-equation">
            {data.target} ≈ {trained.model.intercept.toFixed(2)}
            {trained.model.weights.map((w, j) => ` ${w < 0 ? '−' : '+'} ${Math.abs(w).toFixed(3)} × [${data.featureNames[j]}]`).join('')}
          </p>
          <p className="text-sm text-muted">{t('tabular.evaluate.linearHint')}</p>
        </div>
      );
    case 'knn':
    case 'knn-regression':
      return <p className="text-sm text-muted">{t('tabular.evaluate.knnHint', { k: trained.k, n: trained.train.y.length })}</p>;
  }
}

export function EvaluateSection({ evaluation, trained, data }: { readonly evaluation: Evaluation; readonly trained: TrainedModel; readonly data: PreparedData }) {
  const { t } = useTranslation();
  const range = data.task === 'regression' ? [...data.test.y, ...evaluation.testPredictions] : [];
  const lo = Math.min(...range);
  const hi = Math.max(...range);
  const toPlot = (v: number) => ((v - lo) / Math.max(1e-9, hi - lo)) * 2 - 1;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-4">
        {evaluation.task === 'classification' ? (
          <>
            <dl className="grid grid-cols-2 gap-3">
              <Stat label={t('playground.common.trainAccuracy')} value={evaluation.train.accuracy === null ? '—' : formatPercent(evaluation.train.accuracy)} />
              <Stat label={t('playground.common.testAccuracy')} value={evaluation.test.accuracy === null ? '—' : formatPercent(evaluation.test.accuracy)} />
            </dl>
            {evaluation.train.accuracy !== null && evaluation.test.accuracy !== null && evaluation.train.accuracy - evaluation.test.accuracy > OVERFIT_GAP && (
              <p className="border-l-4 border-warning pl-2 text-sm" role="note">{t('tabular.evaluate.overfit')}</p>
            )}
            <ConfusionTable matrix={evaluation.test.confusion} classNames={data.classNames} />
          </>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3">
              <Stat label={t('tabular.evaluate.r2Train')} value={formatNumber(evaluation.train.r2)} />
              <Stat label={t('tabular.evaluate.r2Test')} value={formatNumber(evaluation.test.r2)} />
              <Stat label={t('tabular.evaluate.rmseTrain')} value={formatNumber(evaluation.train.mse === null ? null : Math.sqrt(evaluation.train.mse), 1)} />
              <Stat label={t('tabular.evaluate.rmseTest')} value={formatNumber(evaluation.test.mse === null ? null : Math.sqrt(evaluation.test.mse), 1)} />
            </dl>
            <p className="text-xs text-muted">{t('tabular.evaluate.regressionHint', { target: data.target })}</p>
            {data.test.y.length > 0 && (
              <Plot2d
                label={t('tabular.evaluate.predVsTrue')}
                domain={1.1}
                points={data.test.y.map((y, i) => ({ x: toPlot(y), y: toPlot(evaluation.testPredictions[i] as number), label: 0 }))}
                overlay={(s) => <line x1={s.sx(-1)} y1={s.sy(-1)} x2={s.sx(1)} y2={s.sy(1)} stroke="var(--color-accent)" strokeDasharray="4 3" />}
              />
            )}
          </>
        )}
      </div>
      <section aria-labelledby="tabular-explain-title" className="lab-card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id="tabular-explain-title" className="font-semibold">{t('tabular.evaluate.explainTitle')}</h3>
          <ExactBadge label={t('playground.exact')} hint={t('tabular.evaluate.explainHint')} />
        </div>
        <ModelExplanation trained={trained} data={data} />
      </section>
    </div>
  );
}
