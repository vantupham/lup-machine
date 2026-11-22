import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { confusionMatrix, perClassMetrics } from '@/core/ml/metrics';
import type { EpochSnapshot } from '@/core/ml/softmax-regression';
import type { ClassRecord, SampleRecord, Split } from '@/storage/db';
import { useModeStore } from '@/ui/mode-store';
import { useObjectUrl } from '../useObjectUrl';
import { markerFor } from './class-style';
import type { SamplePrediction } from './lab-data';

/** Chênh lệch điểm Dạy − Kiểm tra vượt ngưỡng này thì cảnh báo quá khớp. */
export const OVERFIT_GAP = 0.15;

interface EvaluateSectionProps {
  readonly classes: readonly ClassRecord[];
  readonly snapshot: EpochSnapshot | null;
  readonly samplesBySplit: Readonly<Record<Split, readonly SampleRecord[]>>;
  readonly predictions: ReadonlyMap<string, SamplePrediction>;
}

export function EvaluateSection({ classes, snapshot, samplesBySplit, predictions }: EvaluateSectionProps) {
  const { t, i18n } = useTranslation();
  const pct = (v: number) => `${(v * 100).toLocaleString(i18n.language, { maximumFractionDigits: 1 })}%`;

  return (
    <section aria-labelledby="evaluate-title" className="space-y-4">
      <h2 id="evaluate-title" className="text-2xl font-semibold">{t('project.evaluate.title')}</h2>
      {!snapshot ? (
        <p className="text-sm text-muted">{t('project.evaluate.empty')}</p>
      ) : (
        <>
          <p className="font-mono text-xs text-muted">{t('project.evaluate.atEpoch', { epoch: snapshot.epoch })}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <ScoreCard label={t('project.evaluate.trainScore')} hint={t('project.evaluate.trainHint')} value={pct(snapshot.train.accuracy)} testId="score-train" />
            {snapshot.test ? (
              <ScoreCard label={t('project.evaluate.testScore')} hint={t('project.evaluate.testHint')} value={pct(snapshot.test.accuracy)} testId="score-test" emphasis />
            ) : (
              <p className="lab-card p-4 text-sm text-warning">{t('project.evaluate.noTest')}</p>
            )}
          </div>
          {snapshot.test && snapshot.train.accuracy - snapshot.test.accuracy > OVERFIT_GAP && (
            <p role="alert" className="border-l-4 border-warning pl-3 text-sm">{t('project.evaluate.overfit')}</p>
          )}
          <ConfusionPanel classes={classes} samplesBySplit={samplesBySplit} predictions={predictions} defaultSplit={snapshot.test ? 'test' : 'train'} />
        </>
      )}
    </section>
  );
}

function ScoreCard({ label, hint, value, testId, emphasis = false }: { label: string; hint: string; value: string; testId: string; emphasis?: boolean }) {
  return (
    <div className={`lab-card p-4 ${emphasis ? 'border-2 border-ink' : ''}`}>
      <p className="text-sm font-medium">{label}</p>
      <p className="font-display text-4xl font-bold" data-testid={testId}>{value}</p>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}

interface ConfusionPanelProps {
  readonly classes: readonly ClassRecord[];
  readonly samplesBySplit: Readonly<Record<Split, readonly SampleRecord[]>>;
  readonly predictions: ReadonlyMap<string, SamplePrediction>;
  readonly defaultSplit: Split;
}

function ConfusionPanel({ classes, samplesBySplit, predictions, defaultSplit }: ConfusionPanelProps) {
  const { t } = useTranslation();
  const mode = useModeStore((s) => s.mode);
  const [split, setSplit] = useState<Split>(defaultSplit);
  const [cell, setCell] = useState<{ actual: number; predicted: number } | null>(null);
  const scored = samplesBySplit[split].filter((s) => predictions.has(s.id));
  const preds = scored.map((s) => predictions.get(s.id)!);
  const matrix = confusionMatrix(preds.map((p) => p.actual), preds.map((p) => p.predicted), classes.length);
  const max = Math.max(1, ...matrix.flat());
  const cellSamples = cell ? scored.filter((s) => { const p = predictions.get(s.id)!; return p.actual === cell.actual && p.predicted === cell.predicted; }) : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold">{t('project.evaluate.matrixTitle')}</span>
          <span className="text-muted">· {t('project.evaluate.matrixOn')}</span>
          {(['test', 'train'] as const).map((s) => (
            <button key={s} type="button" aria-pressed={split === s} onClick={() => { setSplit(s); setCell(null); }} className={`rounded px-2 py-0.5 ${split === s ? 'bg-ink text-paper' : 'border border-rule'}`}>
              {t(`project.class.${s}`)}
            </button>
          ))}
        </div>
        <p className="max-w-md text-xs text-muted">{t('project.evaluate.matrixLead')}</p>
        <table className="border-collapse text-sm" aria-label={t('project.evaluate.matrixTitle')}>
          <thead>
            <tr>
              <th className="p-1 text-left text-xs text-muted">{t('project.evaluate.actual')} ↓ / {t('project.evaluate.predicted')} →</th>
              {classes.map((c, j) => <th key={c.id} scope="col" className="p-1 text-xs">{markerFor(j)} {c.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={classes[i]!.id}>
                <th scope="row" className="p-1 text-left text-xs">{markerFor(i)} {classes[i]!.name}</th>
                {row.map((count, j) => {
                  const isDiag = i === j;
                  const alpha = count === 0 ? 0 : 0.15 + (0.75 * count) / max;
                  return (
                    <td key={j} className="p-0.5">
                      <button
                        type="button"
                        onClick={() => setCell({ actual: i, predicted: j })}
                        aria-label={t('project.evaluate.cellLabel', { count, actual: classes[i]!.name, predicted: classes[j]!.name })}
                        aria-pressed={cell?.actual === i && cell.predicted === j}
                        className="h-12 w-14 rounded-sm border border-rule font-mono text-base font-semibold"
                        style={{ backgroundColor: isDiag ? `rgb(0 158 115 / ${alpha})` : `rgb(198 40 40 / ${alpha})` }}
                      >
                        {count}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {mode === 'expert' && <PerClassTable matrix={matrix} classes={classes} />}
      </div>
      {cell && (
        <div aria-live="polite">
          <p className="mb-2 text-sm font-medium">{t('project.evaluate.cellImages', { actual: classes[cell.actual]!.name, predicted: classes[cell.predicted]!.name })}</p>
          {cellSamples.length === 0 ? (
            <p className="text-sm text-muted">{t('project.evaluate.cellEmpty')}</p>
          ) : (
            <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6" data-testid="cell-samples">
              {cellSamples.map((s) => <PredictedThumb key={s.id} sample={s} confidence={predictions.get(s.id)!.probabilities[cell.predicted]!} />)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function PredictedThumb({ sample, confidence }: { sample: SampleRecord; confidence: number }) {
  const { t } = useTranslation();
  const url = useObjectUrl(sample.image);
  return (
    <li className="text-center text-xs">
      <img src={url} alt="" width={80} height={80} className="w-full rounded-sm border border-rule" />
      <span className="font-mono">{t('project.evaluate.confidence', { percent: Math.round(confidence * 100) })}</span>
    </li>
  );
}

function PerClassTable({ matrix, classes }: { matrix: number[][]; classes: readonly ClassRecord[] }) {
  const { t, i18n } = useTranslation();
  const fmt = (v: number | null) => (v === null ? t('project.evaluate.na') : v.toLocaleString(i18n.language, { maximumFractionDigits: 2 }));
  return (
    <table className="mt-3 text-xs" aria-label={t('project.evaluate.perClass')}>
      <thead>
        <tr className="text-muted">
          <th className="pr-3 text-left">{t('project.evaluate.perClass')}</th>
          <th className="pr-3" title={t('project.evaluate.precisionHint')}>{t('project.evaluate.precision')}</th>
          <th className="pr-3" title={t('project.evaluate.recallHint')}>{t('project.evaluate.recall')}</th>
          <th>{t('project.evaluate.support')}</th>
        </tr>
      </thead>
      <tbody className="font-mono">
        {perClassMetrics(matrix).map((m, i) => (
          <tr key={classes[i]!.id}>
            <th scope="row" className="pr-3 text-left font-sans font-normal">{classes[i]!.name}</th>
            <td className="pr-3 text-center">{fmt(m.precision)}</td>
            <td className="pr-3 text-center">{fmt(m.recall)}</td>
            <td className="text-center">{m.support}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
