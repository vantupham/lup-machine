import { useTranslation } from 'react-i18next';
import type { ClassRecord } from '@/storage/db';
import { colorFor } from './class-style';
import { UNCERTAIN_BELOW, type ProbePrediction } from './probe';
import { ClassMarker } from '@/ui/ClassMarker';

interface ProbeResultProps {
  readonly prediction: ProbePrediction;
  readonly classes: readonly ClassRecord[];
}

/** Câu trả lời của mô hình cho ảnh đang thử: lớp đoán, độ tin cậy, xác suất từng lớp (cập nhật trực tiếp). */
export function ProbeResult({ prediction, classes }: ProbeResultProps) {
  const { t, i18n } = useTranslation();
  const pct = (v: number) => `${(v * 100).toLocaleString(i18n.language, { maximumFractionDigits: 1 })}%`;
  const names = classes.slice(0, prediction.probabilities.length);
  const winner = names[prediction.predicted];

  return (
    <div className="space-y-3" aria-live="polite">
      <p
        className="lab-card border-l-4 p-3 font-display text-2xl font-bold"
        style={{ borderLeftColor: colorFor(prediction.predicted) }}
        data-testid="probe-verdict"
      >
        <ClassMarker index={prediction.predicted} className="mr-1.5" />
        {t('project.use.verdict', { name: winner?.name ?? '', percent: pct(prediction.confidence) })}
      </p>
      {prediction.isUncertain && (
        <p className="border-l-4 border-warning pl-3 text-sm" data-testid="probe-uncertain">
          {t('project.use.uncertain', { percent: pct(prediction.confidence), threshold: pct(UNCERTAIN_BELOW) })}
        </p>
      )}
      <ul className="space-y-1" aria-label={t('project.explain.probabilities')}>
        {names.map((c, i) => (
          <li key={c.id} className="grid grid-cols-[7rem_1fr_3.5rem] items-center gap-2 text-sm">
            <span className={`truncate ${i === prediction.predicted ? 'font-semibold' : ''}`}>
              <ClassMarker index={i} className="mr-1" />{c.name}
            </span>
            <span className="h-3 overflow-hidden rounded-sm bg-rule" aria-hidden="true">
              <span
                className="block h-full w-full origin-left transition-transform duration-200 motion-reduce:transition-none"
                style={{ transform: `scaleX(${prediction.probabilities[i]!})`, backgroundColor: colorFor(i) }}
              />
            </span>
            <span className="text-right font-mono text-xs">{pct(prediction.probabilities[i]!)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
