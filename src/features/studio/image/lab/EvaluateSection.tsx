import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { confusionMatrix, perClassMetrics } from '@/core/ml/metrics';
import type { EpochSnapshot } from '@/core/ml/softmax-regression';
import type { ClassRecord, SampleRecord, Split } from '@/storage/db';
import { useModeStore } from '@/ui/mode-store';
import { useObjectUrl } from '../useObjectUrl';
import type { SamplePrediction } from './lab-data';
import { ThresholdPanel } from './ThresholdPanel';
import { StepNumber } from '@/ui/StepNumber';
import { ClassMarker } from '@/ui/ClassMarker';
import { StepNotebook } from '@/features/notebook/StepNotebook';
import { FindingsPanel } from './FindingsPanel';
import type { ImproveActions } from './improve-actions';
import { ACCEPTED_IMAGE_TYPES } from '../image-file';
import { Camera, ImageUp, Trash2 } from '@/ui/icons';

/** Chênh lệch điểm Huấn luyện − Kiểm tra vượt ngưỡng này thì cảnh báo quá khớp. */
export const OVERFIT_GAP = 0.15;

interface EvaluateSectionProps {
  readonly classes: readonly ClassRecord[];
  readonly snapshot: EpochSnapshot | null;
  readonly samplesBySplit: Readonly<Record<Split, readonly SampleRecord[]>>;
  readonly predictions: ReadonlyMap<string, SamplePrediction>;
  /** Xem vì sao mô hình đoán một ảnh như vậy (mở ảnh đó ở bước 3). */
  readonly onInspect: (sample: SampleRecord) => void;
  readonly improve: ImproveActions;
}

type Cell = { readonly actual: number; readonly predicted: number } | null;

/** id vùng ảnh của ô ma trận đang chọn (để cuộn tới khi bấm "Xem các ảnh này"). */
const CELL_IMAGES_ID = 'confusion-cell-images';

export function EvaluateSection({ classes, snapshot, samplesBySplit, predictions, onInspect, improve }: EvaluateSectionProps) {
  const { t, i18n } = useTranslation();
  const hasTest = Boolean(snapshot?.test);
  /** null: theo mặc định (Kiểm tra nếu có, không thì Huấn luyện). */
  const [chosenSplit, setChosenSplit] = useState<Split | null>(null);
  const split: Split = chosenSplit ?? (hasTest ? 'test' : 'train');
  const [cell, setCell] = useState<Cell>(null);
  const scoredSamples = samplesBySplit[split].filter((s) => predictions.has(s.id));
  const showCell = (actual: number, predicted: number) => {
    setCell({ actual, predicted });
    requestAnimationFrame(() => document.getElementById(CELL_IMAGES_ID)?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }));
  };
  const pct = (v: number) => `${(v * 100).toLocaleString(i18n.language, { maximumFractionDigits: 1 })}%`;

  return (
    <section aria-labelledby="evaluate-title" className="space-y-4">
      <h2 id="evaluate-title" className="flex items-center gap-3 text-2xl font-semibold"><StepNumber n={5} />{t('project.evaluate.title')}</h2>
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
          <FindingsPanel classes={classes} split={split} samples={scoredSamples} predictions={predictions} onShowCell={showCell} onInspect={onInspect} />
          <ConfusionPanel
            classes={classes}
            scored={scoredSamples}
            predictions={predictions}
            split={split}
            onSplit={(next) => {
              setChosenSplit(next);
              setCell(null);
            }}
            cell={cell}
            onCell={setCell}
            improve={improve}
          />
          <ThresholdPanel
            predictions={samplesBySplit[snapshot.test ? 'test' : 'train'].flatMap((s) => {
              const p = predictions.get(s.id);
              return p ? [p] : [];
            })}
          />
        </>
      )}
      <StepNotebook step="evaluate" />
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
  /** Ảnh của ngăn đang xem đã có dự đoán. */
  readonly scored: readonly SampleRecord[];
  readonly predictions: ReadonlyMap<string, SamplePrediction>;
  readonly split: Split;
  readonly onSplit: (split: Split) => void;
  readonly cell: Cell;
  readonly onCell: (cell: Cell) => void;
  readonly improve: ImproveActions;
}

function ConfusionPanel({ classes, scored, predictions, split, onSplit, cell, onCell, improve }: ConfusionPanelProps) {
  const { t } = useTranslation();
  const mode = useModeStore((s) => s.mode);
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
            <button key={s} type="button" aria-pressed={split === s} onClick={() => onSplit(s)} className={`rounded px-2 py-0.5 ${split === s ? 'bg-ink text-paper' : 'border border-rule'}`}>
              {t(`project.class.${s}`)}
            </button>
          ))}
        </div>
        <p className="max-w-md text-xs text-muted">{t('project.evaluate.matrixLead')}</p>
        <table className="border-collapse text-sm" aria-label={t('project.evaluate.matrixTitle')}>
          <thead>
            <tr>
              <th className="p-1 text-left text-xs text-muted">{t('project.evaluate.actual')} ↓ / {t('project.evaluate.predicted')} →</th>
              {classes.map((c, j) => <th key={c.id} scope="col" className="p-1 text-xs"><ClassMarker index={j} className="mr-1" />{c.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={classes[i]!.id}>
                <th scope="row" className="p-1 text-left text-xs"><ClassMarker index={i} className="mr-1" />{classes[i]!.name}</th>
                {row.map((count, j) => {
                  const isDiag = i === j;
                  const alpha = count === 0 ? 0 : 0.15 + (0.75 * count) / max;
                  return (
                    <td key={j} className="p-0.5">
                      <button
                        type="button"
                        onClick={() => onCell({ actual: i, predicted: j })}
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
        <div aria-live="polite" id={CELL_IMAGES_ID}>
          <p className="mb-2 text-sm font-medium">{t('project.evaluate.cellImages', { actual: classes[cell.actual]!.name, predicted: classes[cell.predicted]!.name })}</p>
          {cellSamples.length === 0 ? (
            <p className="text-sm text-muted">{t('project.evaluate.cellEmpty')}</p>
          ) : (
            <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6" data-testid="cell-samples">
              {cellSamples.map((s) => (
                <PredictedThumb key={s.id} sample={s} confidence={predictions.get(s.id)!.probabilities[cell.predicted]!} onDelete={improve.deleteSample} />
              ))}
            </ul>
          )}
          {cell.actual !== cell.predicted && classes[cell.actual] && classes[cell.predicted] && (
            <div className="mt-3">
              <AddImagesBar cls={classes[cell.actual]!} other={classes[cell.predicted]!} improve={improve} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface PredictedThumbProps {
  readonly sample: SampleRecord;
  readonly confidence: number;
  readonly onDelete: (sample: SampleRecord) => void;
}

function PredictedThumb({ sample, confidence, onDelete }: PredictedThumbProps) {
  const { t } = useTranslation();
  const url = useObjectUrl(sample.image);
  return (
    <li className="relative text-center text-xs">
      <img src={url} alt="" width={80} height={80} className="w-full rounded-sm border border-rule" />
      <span className="font-mono">{t('project.evaluate.confidence', { percent: Math.round(confidence * 100) })}</span>
      <button
        type="button"
        onClick={() => onDelete(sample)}
        aria-label={t('project.improve.deleteImage')}
        title={t('project.improve.deleteImage')}
        className="absolute right-0.5 top-0.5 rounded-sm bg-paper/90 p-0.5 text-danger hover:bg-paper"
      >
        <Trash2 />
      </button>
    </li>
  );
}

/** Ở ô nhầm (ngoài đường chéo): thêm ảnh Huấn luyện cho lớp thật để máy học phân biệt rõ hơn. */
function AddImagesBar({ cls, other, improve }: { readonly cls: ClassRecord; readonly other: ClassRecord; readonly improve: ImproveActions }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2 rounded border border-dashed border-rule p-3 text-sm" data-testid="improve-bar">
      <p>{t('project.improve.advice', { actual: cls.name, predicted: other.name })}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost" onClick={() => improve.capture(cls)}>
          <Camera /> {t('project.improve.capture')}
        </button>
        <label className="btn btn-ghost cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-primary">
          <ImageUp /> {t('project.improve.upload')}
          <input
            type="file"
            multiple
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            className="sr-only"
            aria-label={t('project.improve.uploadLabel', { name: cls.name })}
            onChange={(e) => {
              // Chép danh sách tệp TRƯỚC khi xóa giá trị ô chọn tệp (FileList bị rỗng theo).
              const files = Array.from(e.target.files ?? []);
              e.target.value = '';
              if (files.length > 0) improve.upload(cls, files);
            }}
          />
        </label>
      </div>
    </div>
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
