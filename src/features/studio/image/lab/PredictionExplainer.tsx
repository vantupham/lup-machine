import { useState } from 'react';
import type { ImageSubject } from './image-subject';
import { useTranslation } from 'react-i18next';
import { logitBreakdown } from '@/core/ml/explain';
import { argmax } from '@/core/ml/metrics';
import { computeLogits, softmax, type SoftmaxParams } from '@/core/ml/softmax-regression';
import type { ClassRecord } from '@/storage/db';
import { ExactBadge } from '@/ui/ExactBadge';
import { useModeStore } from '@/ui/mode-store';
import { CamHeatmap } from './CamHeatmap';
import { colorFor, markerFor } from './class-style';
import { OcclusionMap } from './OcclusionMap';

const TOP_FEATURES = 5;

interface PredictionExplainerProps {
  readonly sample: ImageSubject;
  readonly vector: Float32Array;
  readonly classes: readonly ClassRecord[];
  readonly params: SoftmaxParams;
  /** Ẩn khi nơi gọi đã hiện xác suất (bước ⑥ hiện xác suất trực tiếp ở trên). */
  readonly showProbabilities?: boolean;
}

/** "Vì sao mô hình đoán như vậy?": xác suất, bản đồ nhìn vào đâu, và (Chuyên sâu) đường đi phép tính. */
export function PredictionExplainer({ sample, vector, classes, params, showProbabilities = true }: PredictionExplainerProps) {
  const { t, i18n } = useTranslation();
  const mode = useModeStore((s) => s.mode);
  const logits = computeLogits(params, vector);
  const probs = softmax(logits);
  const predicted = argmax(probs);
  const pct = (v: number) => `${(v * 100).toLocaleString(i18n.language, { maximumFractionDigits: 1 })}%`;
  const names = classes.slice(0, params.numClasses);
  const [chosen, setChosen] = useState<number | null>(null);
  const classIndex = chosen !== null && chosen < names.length ? chosen : predicted;

  return (
    <section aria-label={t('project.explain.title')} className="space-y-4 border-t border-rule pt-4" data-testid="explainer">
      <h4 className="font-semibold">{t('project.explain.title')}</h4>
      {showProbabilities && (
        <div>
          <p className="mb-1 text-xs text-muted">{t('project.explain.probabilities')}</p>
          <ul className="space-y-1">
            {names.map((c, i) => (
              <li key={c.id} className="grid grid-cols-[7rem_1fr_3.5rem] items-center gap-2 text-sm">
                <span className={`truncate ${i === predicted ? 'font-semibold' : ''}`}>
                  {markerFor(i)} {c.name}
                </span>
                <span className="h-2 overflow-hidden rounded-sm bg-rule" aria-hidden="true">
                  <span className="block h-full" style={{ width: `${probs[i]! * 100}%`, backgroundColor: colorFor(i) }} />
                </span>
                <span className="text-right font-mono text-xs" data-testid={`prob-${i}`}>{pct(probs[i]!)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1 text-sm" role="group" aria-label={t('project.explain.heatmapFor')}>
        <span className="text-xs text-muted">{t('project.explain.heatmapFor')}:</span>
        {names.map((c, i) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={i === classIndex}
            onClick={() => setChosen(i)}
            className={`rounded px-2 py-0.5 ${i === classIndex ? 'bg-ink text-paper' : 'border border-rule'}`}
          >
            {markerFor(i)} {c.name}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <CamHeatmap sample={sample} params={params} classIndex={classIndex} />
        <OcclusionMap sample={sample} params={params} classIndex={classIndex} className={names[classIndex]?.name ?? ''} />
      </div>
      {mode === 'expert' && <CalculationPath vector={vector} params={params} logits={logits} probs={probs} classIndex={predicted} names={names} />}
    </section>
  );
}

interface PathProps {
  readonly vector: Float32Array;
  readonly params: SoftmaxParams;
  readonly logits: Float64Array;
  readonly probs: Float64Array;
  readonly classIndex: number;
  readonly names: readonly ClassRecord[];
}

function CalculationPath({ vector, params, logits, probs, classIndex, names }: PathProps) {
  const { t, i18n } = useTranslation();
  const b = logitBreakdown(params, vector, classIndex, TOP_FEATURES);
  const fmt = (v: number) => v.toLocaleString(i18n.language, { maximumFractionDigits: 4, signDisplay: 'auto' });

  return (
    <div className="space-y-3" data-testid="calculation-path">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{t('project.explain.pathTitle')}</span>
        <ExactBadge label={t('project.explain.pathExact')} hint={t('project.explain.pathExactHint')} />
      </div>
      <p className="text-xs text-muted">{t('project.explain.pathLead')}</p>
      <table className="font-mono text-xs">
        <tbody>
          {b.top.map((c) => (
            <tr key={c.feature}>
              <th scope="row" className="pr-3 text-left font-sans font-normal">{t('project.explain.feature', { k: c.feature })}</th>
              <td className="pr-2 text-right">{fmt(c.value)}</td>
              <td className="pr-2">×</td>
              <td className="pr-2 text-right">{fmt(c.weight)}</td>
              <td className="pr-2">=</td>
              <td className="text-right">{fmt(c.contribution)}</td>
            </tr>
          ))}
          <tr>
            <th scope="row" className="pr-3 text-left font-sans font-normal">{t('project.explain.others', { count: params.dim - b.top.length })}</th>
            <td colSpan={4} />
            <td className="text-right">{fmt(b.otherSum)}</td>
          </tr>
          <tr>
            <th scope="row" className="pr-3 text-left font-sans font-normal">+ {t('project.explain.bias')}</th>
            <td colSpan={4} />
            <td className="text-right">{fmt(b.bias)}</td>
          </tr>
          <tr className="border-t border-rule font-semibold">
            <th scope="row" className="pr-3 text-left font-sans">= {t('project.explain.logit', { name: names[classIndex]?.name ?? '' })}</th>
            <td colSpan={4} />
            <td className="text-right" data-testid="path-logit">{fmt(b.logit)}</td>
          </tr>
        </tbody>
      </table>
      <div>
        <p className="mb-1 text-xs font-medium">{t('project.explain.softmaxTitle')}</p>
        <ul className="font-mono text-xs">
          {names.map((c, i) => (
            <li key={c.id}>
              {markerFor(i)} {c.name}: {t('project.explain.softmaxRow', { logit: fmt(logits[i]!), prob: fmt(probs[i]!) })}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
