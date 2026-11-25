import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { thresholdCurve } from '@/core/ml/explain';
import { LineChart } from './LineChart';
import type { SamplePrediction } from './lab-data';
import { Info } from '@/ui/icons';

const CURVE_STEPS = Array.from({ length: 20 }, (_, i) => i / 20); // 0, 0.05, …, 0.95

interface ThresholdPanelProps {
  readonly predictions: readonly SamplePrediction[];
}

/** Ngưỡng tin cậy: đánh đổi giữa "dám trả lời" và "trả lời đúng". */
export function ThresholdPanel({ predictions }: ThresholdPanelProps) {
  const { t, i18n } = useTranslation();
  const [threshold, setThreshold] = useState(0.5);
  const scored = useMemo(
    () => predictions.map((p) => ({ confidence: p.probabilities[p.predicted]!, isCorrect: p.isCorrect })),
    [predictions],
  );
  const curve = useMemo(() => thresholdCurve(scored, CURVE_STEPS), [scored]);
  const [point] = thresholdCurve(scored, [threshold]);
  const pct = (v: number) => (v * 100).toLocaleString(i18n.language, { maximumFractionDigits: 0 });

  return (
    <section aria-labelledby="threshold-title" className="space-y-3">
      <h3 id="threshold-title" className="font-semibold">{t('project.threshold.title')}</h3>
      <p className="max-w-2xl text-xs text-muted">{t('project.threshold.lead')}</p>
      <label className="block max-w-md text-sm">
        <span className="font-medium">{t('project.threshold.label', { percent: pct(threshold) })}</span>
        <input type="range" min={0} max={0.95} step={0.05} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="mt-1 block w-full" />
      </label>
      <p className="font-mono text-sm" data-testid="threshold-summary">
        {point && point.answered > 0
          ? t('project.threshold.summary', {
              answered: point.answered,
              total: scored.length,
              coverage: pct(point.coverage),
              accuracy: `${pct(point.accuracy ?? 0)}%`,
            })
          : t('project.threshold.noneAnswered')}
      </p>
      <div className="max-w-md">
        <LineChart
          title={t('project.threshold.chart')}
          yMax={100}
          maxX={CURVE_STEPS.length - 1}
          markerX={Math.round(threshold * 20)}
          xAxisLabel={t('project.threshold.axis')}
          series={[
            { label: t('project.threshold.coverage'), color: '#0072B2', values: curve.map((p) => p.coverage * 100) },
            { label: t('project.threshold.accuracy'), color: '#009E73', dashed: true, values: curve.map((p) => (p.accuracy === null ? null : p.accuracy * 100)) },
          ]}
        />
      </div>
      <p className="max-w-2xl text-xs text-muted"><Info /> {t('project.threshold.tradeoff')}</p>
    </section>
  );
}
