import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DecisionTree } from '@/core/algorithms/decision-tree';
import { contributions, logisticRowScores, predictRow, type TrainedModel } from '@/core/tabular/models';
import { encodeCells, type FeatureEncoder, type PreparedData } from '@/core/tabular/prepare';
import { colorFor, markerFor } from '@/features/studio/image/lab/class-style';

/** Mỗi lời giải thích chỉ liệt kê các đóng góp lớn nhất để học sinh dễ đọc. */
const TOP_CONTRIBUTIONS = 4;

function defaultCell(e: FeatureEncoder): string {
  return e.kind === 'numeric' ? String(Number(e.mean.toFixed(1))) : (e.categories[0] ?? '');
}

function TreePath({ tree, path, featureNames }: { readonly tree: DecisionTree; readonly path: readonly number[]; readonly featureNames: readonly string[] }) {
  const { t } = useTranslation();
  return (
    <ol className="list-decimal space-y-1 pl-5 text-sm">
      {path.slice(0, -1).map((id, i) => {
        const split = tree.nodes[id]!.split!;
        const wentLeft = path[i + 1] === split.left;
        return (
          <li key={id} className="font-mono">
            {featureNames[split.feature]} ≤ {split.threshold.toFixed(3)}? → <strong>{wentLeft ? t('tabular.use.yes') : t('tabular.use.no')}</strong>
          </li>
        );
      })}
    </ol>
  );
}

function TopContributions({ values, featureNames }: { readonly values: readonly number[]; readonly featureNames: readonly string[] }) {
  const top = values
    .map((v, j) => ({ v, name: featureNames[j] as string }))
    .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
    .slice(0, TOP_CONTRIBUTIONS);
  return (
    <ul className="font-mono text-xs">
      {top.map(({ v, name }) => (
        <li key={name} className={v >= 0 ? 'text-accent' : 'text-danger'}>{v >= 0 ? '+' : '−'}{Math.abs(v).toFixed(3)} · {name}</li>
      ))}
    </ul>
  );
}

function Explanation({ trained, data, row }: { readonly trained: TrainedModel; readonly data: PreparedData; readonly row: { raw: number[]; scaled: number[] } }) {
  const { t } = useTranslation();
  const prediction = predictRow(trained, row);
  if (trained.kind === 'tree' && prediction.path) {
    return <TreePath tree={trained.tree} path={prediction.path} featureNames={data.featureNames} />;
  }
  if (prediction.neighbors) {
    return (
      <div className="text-sm">
        <p>{t('tabular.use.neighbors', { k: prediction.neighbors.length })}</p>
        <ul className="mt-1 font-mono text-xs">
          {prediction.neighbors.map((n) => {
            const y = data.train.y[n.index] as number;
            return (
              <li key={n.index}>
                {t('tabular.use.neighborRow', { row: data.train.rowNumbers[n.index], distance: n.distance.toFixed(3) })}{' '}
                <strong>{data.task === 'classification' ? data.classNames[y] : y}</strong>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
  const contrib = contributions(trained, row);
  if (!contrib) return null;
  if (trained.kind === 'logistic') {
    const scores = logisticRowScores(trained, row) ?? [];
    const rows = trained.model.numClasses === 2 ? [1] : data.classNames.map((_, k) => k);
    return (
      <div className="space-y-2 text-sm">
        {rows.map((cls, r) => (
          <div key={cls}>
            <p>{t('tabular.use.score', { cls: data.classNames[cls], b: (trained.model.intercepts[r] as number).toFixed(3), score: (scores[r] as number).toFixed(3) })}</p>
            <TopContributions values={contrib[r] as number[]} featureNames={data.featureNames} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="text-sm">
      <p>{t('tabular.use.linearSum', { b: trained.kind === 'linear' ? trained.model.intercept.toFixed(2) : '' })}</p>
      <TopContributions values={contrib[0] as number[]} featureNames={data.featureNames} />
    </div>
  );
}

export function UseSection({ trained, data }: { readonly trained: TrainedModel; readonly data: PreparedData }) {
  const { t } = useTranslation();
  const formId = useId();
  const [cells, setCells] = useState<string[]>(() => data.encoders.map(defaultCell));
  const values = data.encoders.map((e, i) => cells[i] ?? defaultCell(e));
  const row = encodeCells(data.encoders, values);
  const prediction = row ? predictRow(trained, row) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <form className="grid content-start gap-3 sm:grid-cols-2" aria-label={t('tabular.use.formLabel')} onSubmit={(e) => e.preventDefault()}>
        {data.encoders.map((e, i) => (
          <label key={e.name} htmlFor={`${formId}-${i}`} className="text-sm font-medium">
            {e.name}
            {e.kind === 'numeric' ? (
              <input
                id={`${formId}-${i}`}
                inputMode="decimal"
                value={values[i]}
                onChange={(ev) => setCells(values.map((v, j) => (j === i ? ev.target.value : v)))}
                className="mt-1 w-full rounded border border-rule bg-paper px-2 py-1 font-mono"
              />
            ) : (
              <select
                id={`${formId}-${i}`}
                value={values[i]}
                onChange={(ev) => setCells(values.map((v, j) => (j === i ? ev.target.value : v)))}
                className="mt-1 w-full rounded border border-rule bg-surface px-2 py-1"
              >
                {e.categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </label>
        ))}
      </form>

      <section aria-labelledby={`${formId}-result`} className="lab-card space-y-3 p-4" aria-live="polite">
        <h3 id={`${formId}-result`} className="font-semibold">{t('tabular.use.resultTitle')}</h3>
        {!row || !prediction ? (
          <p role="alert" className="text-sm text-danger">{t('tabular.use.invalid')}</p>
        ) : (
          <>
            {data.task === 'classification' ? (
              <>
                <p className="text-lg" data-testid="tabular-prediction">
                  <span aria-hidden="true" style={{ color: colorFor(prediction.value) }}>{markerFor(prediction.value)} </span>
                  {t('tabular.use.predictedClass', { cls: data.classNames[prediction.value] })}
                </p>
                <ul className="space-y-1">
                  {(prediction.proba ?? []).map((p, k) => (
                    <li key={k} className="grid grid-cols-[8rem_1fr_3.5rem] items-center gap-2 text-xs">
                      <span>{data.classNames[k]}</span>
                      <span className="h-2 rounded" style={{ width: `${p * 100}%`, backgroundColor: colorFor(k) }} />
                      <span className="text-right font-mono">{(p * 100).toFixed(1)}%</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-lg" data-testid="tabular-prediction">
                {t('tabular.use.predictedValue', { target: data.target, value: Number(prediction.value.toFixed(2)).toLocaleString('vi') })}
              </p>
            )}
            <h4 className="text-sm font-medium">{t('tabular.use.why')}</h4>
            <Explanation trained={trained} data={data} row={row} />
          </>
        )}
      </section>
    </div>
  );
}
