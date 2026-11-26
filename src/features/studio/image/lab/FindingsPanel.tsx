import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { findInsights, type Finding } from '@/core/ml/findings';
import type { ClassRecord, SampleRecord, Split } from '@/storage/db';
import { ClassMarker } from '@/ui/ClassMarker';
import { Lightbulb } from '@/ui/icons';
import { useObjectUrl } from '../useObjectUrl';
import type { SamplePrediction } from './lab-data';

/** Hiện tối đa ngần này ảnh "sai mà rất chắc chắn". */
const MAX_CONFIDENT_THUMBS = 6;

interface FindingsPanelProps {
  readonly classes: readonly ClassRecord[];
  readonly split: Split;
  /** Ảnh của ngăn đang chấm (đã có dự đoán). */
  readonly samples: readonly SampleRecord[];
  readonly predictions: ReadonlyMap<string, SamplePrediction>;
  /** Mở ô ma trận nhầm lẫn (lớp thật, lớp đoán) để xem ảnh. */
  readonly onShowCell: (actual: number, predicted: number) => void;
  /** Xem vì sao mô hình đoán ảnh này như vậy (bản đồ nhiệt, láng giềng ở bước 3). */
  readonly onInspect: (sample: SampleRecord) => void;
}

/** "Điểm đáng chú ý": chỉ chỗ nên nhìn, kèm bằng chứng bấm được và câu hỏi "Vì sao?". */
export function FindingsPanel({ classes, split, samples, predictions, onShowCell, onInspect }: FindingsPanelProps) {
  const { t } = useTranslation();
  const scored = samples.flatMap((s) => {
    const p = predictions.get(s.id);
    return p ? [{ id: s.id, actual: p.actual, predicted: p.predicted, confidence: p.probabilities[p.predicted] ?? 0 }] : [];
  });
  const findings = findInsights(scored, classes.length);
  if (findings.length === 0) return null;
  const byId = new Map(samples.map((s) => [s.id, s]));

  return (
    <section aria-labelledby="findings-title" className="lab-card space-y-3 p-4" data-testid="findings">
      <h3 id="findings-title" className="flex flex-wrap items-baseline gap-2 font-semibold">
        <Lightbulb />
        {t('project.findings.title')}
        <span className="text-xs font-normal text-muted">{t('project.findings.on', { split: t(`project.class.${split}`) })}</span>
      </h3>
      <ul className="space-y-3">
        {findings.map((finding) => (
          <li key={finding.code} className="space-y-1 border-l-4 border-primary pl-3 text-sm" data-testid={`finding-${finding.code}`}>
            <FindingText finding={finding} classes={classes} />
            <p className="text-xs text-muted">
              <span className="font-medium">{t('project.findings.why')}</span> {whyText(t, finding, classes)}
            </p>
            {finding.code === 'top-confusion' && (
              <button type="button" className="text-xs text-primary hover:underline" onClick={() => onShowCell(finding.actual, finding.predicted)}>
                {t('project.findings.showImages')}
              </button>
            )}
            {finding.code === 'weakest-class' && finding.confusedWith >= 0 && (
              <button type="button" className="text-xs text-primary hover:underline" onClick={() => onShowCell(finding.classIndex, finding.confusedWith)}>
                {t('project.findings.showImages')}
              </button>
            )}
            {finding.code === 'confident-mistakes' && (
              <ul className="flex flex-wrap gap-2">
                {finding.ids.slice(0, MAX_CONFIDENT_THUMBS).map((id) => {
                  const sample = byId.get(id);
                  const p = predictions.get(id);
                  return sample && p ? (
                    <MistakeThumb key={id} sample={sample} prediction={p} classes={classes} onInspect={onInspect} />
                  ) : null;
                })}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

const nameOf = (classes: readonly ClassRecord[], i: number) => classes[i]?.name ?? '';
const pct = (v: number) => Math.round(v * 100);

function FindingText({ finding, classes }: { readonly finding: Finding; readonly classes: readonly ClassRecord[] }) {
  const { t, i18n } = useTranslation();
  switch (finding.code) {
    case 'all-correct':
      return <p>{t('project.findings.allCorrect', { total: finding.total })}</p>;
    case 'top-confusion':
      return (
        <p>
          <ClassMarker index={finding.actual} className="mr-1" />
          {t('project.findings.topConfusion', {
            count: finding.count,
            support: finding.support,
            actual: nameOf(classes, finding.actual),
            predicted: nameOf(classes, finding.predicted),
          })}
        </p>
      );
    case 'weakest-class':
      return (
        <p>
          <ClassMarker index={finding.classIndex} className="mr-1" />
          {t('project.findings.weakestClass', {
            name: nameOf(classes, finding.classIndex),
            percent: pct(finding.recall),
            support: finding.support,
            other: nameOf(classes, finding.confusedWith),
          })}
        </p>
      );
    case 'confident-mistakes':
      return <p>{t('project.findings.confidentMistakes', { count: finding.ids.length, percent: pct(finding.threshold) })}</p>;
    case 'small-set':
      return <p>{t('project.findings.smallSet', { total: finding.total, step: (100 / finding.total).toLocaleString(i18n.language, { maximumFractionDigits: 1 }) })}</p>;
  }
}

function whyText(t: TFunction, finding: Finding, classes: readonly ClassRecord[]): string {
  switch (finding.code) {
    case 'all-correct':
      return t('project.findings.whyAllCorrect');
    case 'top-confusion':
      return t('project.findings.whyTopConfusion', { actual: nameOf(classes, finding.actual), predicted: nameOf(classes, finding.predicted) });
    case 'weakest-class':
      return t('project.findings.whyWeakestClass', { name: nameOf(classes, finding.classIndex) });
    case 'confident-mistakes':
      return t('project.findings.whyConfidentMistakes');
    case 'small-set':
      return t('project.findings.whySmallSet');
  }
}

interface MistakeThumbProps {
  readonly sample: SampleRecord;
  readonly prediction: SamplePrediction;
  readonly classes: readonly ClassRecord[];
  readonly onInspect: (sample: SampleRecord) => void;
}

function MistakeThumb({ sample, prediction, classes, onInspect }: MistakeThumbProps) {
  const { t } = useTranslation();
  const url = useObjectUrl(sample.image);
  const label = t('project.findings.inspect', {
    actual: nameOf(classes, prediction.actual),
    predicted: nameOf(classes, prediction.predicted),
    percent: pct(prediction.probabilities[prediction.predicted] ?? 0),
  });
  return (
    <li>
      <button type="button" onClick={() => onInspect(sample)} aria-label={label} title={label} className="block text-center text-xs">
        <img src={url} alt="" width={64} height={64} className="rounded-sm border-2 border-danger" />
        <span className="font-mono">{pct(prediction.probabilities[prediction.predicted] ?? 0)}%</span>
      </button>
    </li>
  );
}
