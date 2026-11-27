import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { EpochSnapshot, TrainOptions } from '@/core/ml/softmax-regression';
import { useModeStore } from '@/ui/mode-store';
import { LineChart } from './LineChart';
import { NetworkMap } from './NetworkMap';
import type { TrainingReadiness } from './lab-data';
import type { TrainingSpeed, TrainingStatus } from './useTraining';
import { ArrowRight, Info } from '@/ui/icons';
import { StepNumber } from '@/ui/StepNumber';
import { StepNotebook } from '@/features/notebook/StepNotebook';

export const DEFAULT_TRAIN_OPTIONS: TrainOptions = { epochs: 50, learningRate: 0.001, batchSize: 16, seed: 42 };
const LIMITS = { epochs: [1, 500], learningRate: [0.00001, 1], batchSize: [1, 256] } as const;
const SPEEDS: readonly TrainingSpeed[] = ['normal', 'slow', 'step'];
/** Chế độ Khám phá chọn số epoch theo 3 mức thay vì gõ số. */
export const EPOCH_LEVELS = [
  { key: 'few', epochs: 10 },
  { key: 'medium', epochs: 50 },
  { key: 'many', epochs: 200 },
] as const;

interface TrainSectionProps {
  readonly readiness: TrainingReadiness;
  readonly numClasses: number;
  readonly snapshots: readonly EpochSnapshot[];
  readonly status: TrainingStatus;
  readonly selectedEpoch: number | null;
  readonly onSelectEpoch: (epoch: number) => void;
  /** `guess`: điểm Kiểm tra (0–1) học sinh đoán trước, null nếu không đoán. */
  readonly onStart: (options: TrainOptions, speed: TrainingSpeed, guess: number | null) => void;
  /** Có ảnh Kiểm tra thì mới hỏi đoán điểm Kiểm tra. */
  readonly canGuess: boolean;
  /** Lần chạy vừa xong có đoán trước: điểm đoán và điểm thật (0–1). */
  readonly guessResult: { readonly guess: number; readonly actual: number } | null;
  readonly onStep: () => void;
  readonly onFinish: () => void;
  /** Khung "đã đổi gì so với lần trước", tính theo cài đặt đang chọn. */
  readonly renderPlan?: ((options: TrainOptions) => ReactNode) | undefined;
  /** Hiện dưới kết quả huấn luyện (so sánh với lần trước, kết luận). */
  readonly afterResult?: ReactNode;
  /** Khung "Mã Python" của bước (đặt cuối bước, trước Sổ tay). */
  readonly codeTrace?: ReactNode;
}

function isValid(o: TrainOptions): boolean {
  const inRange = (v: number, [lo, hi]: readonly [number, number]) => Number.isFinite(v) && v >= lo && v <= hi;
  return (
    Number.isInteger(o.epochs) && inRange(o.epochs, LIMITS.epochs) && inRange(o.learningRate, LIMITS.learningRate) &&
    Number.isInteger(o.batchSize) && inRange(o.batchSize, LIMITS.batchSize)
  );
}

export function TrainSection(props: TrainSectionProps) {
  const { t } = useTranslation();
  const mode = useModeStore((s) => s.mode);
  const [options, setOptions] = useState<TrainOptions>(DEFAULT_TRAIN_OPTIONS);
  const [speed, setSpeed] = useState<TrainingSpeed>('normal');
  const [guessText, setGuessText] = useState('');
  const { readiness, snapshots, status } = props;
  const isActive = status === 'running' || status === 'waiting-step';
  const guess = parseGuess(guessText);
  const isGuessValid = !props.canGuess || guess !== undefined;
  const valid = isValid(options);
  const last = snapshots.at(-1);

  return (
    <section aria-labelledby="train-title" data-step-done={!isActive && snapshots.length > 0 ? 'true' : undefined} className="space-y-4">
      <div>
        <h2 id="train-title" className="flex items-center gap-3 text-2xl font-semibold"><StepNumber n={4} />{t('project.train.title')}</h2>
        <p className="max-w-3xl text-sm text-muted">
          {mode === 'expert' ? t('project.train.leadExpert', { classes: props.numClasses }) : t('project.train.leadExplore')}
        </p>
      </div>

      <NetworkMap numClasses={props.numClasses} isTraining={isActive} />

      {readiness.readiness !== 'ready' ? (
        <p className="text-sm text-warning">{t(readiness.readiness === 'need-features' ? 'project.train.needFeatures' : 'project.train.needClasses')}</p>
      ) : (
        <div className="space-y-3">
        {!isActive && props.renderPlan?.(options)}
        <div className="flex flex-wrap items-end gap-4">
          <fieldset className="flex gap-1 text-sm">
            <legend className="mb-1 text-xs text-muted">{t('project.train.speed')}</legend>
            {SPEEDS.map((s) => (
              <label key={s} className={`cursor-pointer rounded border px-2 py-1 ${speed === s ? 'border-primary' : 'border-rule'}`}>
                <input type="radio" name="speed" className="sr-only" checked={speed === s} onChange={() => setSpeed(s)} disabled={isActive} />
                {t(`project.train.speeds.${s}`)}
              </label>
            ))}
          </fieldset>
          {mode === 'expert' ? (
            <OptionInputs options={options} onChange={setOptions} disabled={isActive} />
          ) : (
            <EpochLevels epochs={options.epochs} onChange={(epochs) => setOptions({ ...options, epochs })} disabled={isActive} />
          )}
          {props.canGuess && (
            <label className="flex flex-col text-xs text-muted">
              {t('project.train.guessLabel')}
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={guessText}
                disabled={isActive}
                onChange={(e) => setGuessText(e.target.value)}
                className="w-24 rounded border border-rule bg-paper px-2 py-1 font-mono text-sm text-ink"
              />
            </label>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={isActive || !valid || !isGuessValid}
            onClick={() => {
              props.onStart(options, speed, props.canGuess ? (guess ?? null) : null);
              setGuessText('');
            }}
          >
            {snapshots.length > 0 ? t('project.train.restart') : t('project.train.start')}
          </button>
          {status === 'waiting-step' && (
            <>
              <button type="button" className="btn btn-ghost" onClick={props.onStep}>{t('project.train.next')} <ArrowRight /></button>
              <button type="button" className="btn btn-ghost" onClick={props.onFinish}>{t('project.train.finish')}</button>
            </>
          )}
          {!valid && <p role="alert" className="text-sm text-danger">{t('project.train.invalid')}</p>}
          {!isGuessValid && <p role="alert" className="text-sm text-danger">{t('project.train.guessInvalid')}</p>}
        </div>
        </div>
      )}

      {last && (
        <p role="status" className="font-mono text-sm">
          {isActive ? t('project.train.running', { epoch: last.epoch, total: options.epochs }) : t('project.train.done', { total: last.epoch })}
        </p>
      )}
      {props.guessResult && <GuessResult {...props.guessResult} />}
      {!isActive && props.afterResult}
      {snapshots.length > 0 && <Charts {...props} />}
      {props.codeTrace}
      <StepNotebook step="train" />
    </section>
  );
}

/** '' → null (không đoán); số từ 0 đến 100 → 0–1; còn lại → undefined (không hợp lệ). */
function parseGuess(text: string): number | null | undefined {
  if (text.trim() === '') return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value / 100 : undefined;
}

function GuessResult({ guess, actual }: { readonly guess: number; readonly actual: number }) {
  const { t } = useTranslation();
  const percent = (v: number) => Math.round(v * 100);
  return (
    <p className="border-l-4 border-primary pl-3 text-sm" data-testid="guess-result">
      {t('project.train.guessResult', { guess: percent(guess), actual: percent(actual), diff: Math.abs(percent(actual) - percent(guess)) })}
    </p>
  );
}

function EpochLevels({ epochs, onChange, disabled }: { epochs: number; onChange: (epochs: number) => void; disabled: boolean }) {
  const { t } = useTranslation();
  return (
    <fieldset className="flex gap-1 text-sm">
      <legend className="mb-1 text-xs text-muted">{t('project.train.epochLevel')}</legend>
      {EPOCH_LEVELS.map((level) => (
        <label key={level.key} className={`cursor-pointer rounded border px-2 py-1 ${epochs === level.epochs ? 'border-primary' : 'border-rule'}`}>
          <input type="radio" name="epoch-level" className="sr-only" checked={epochs === level.epochs} onChange={() => onChange(level.epochs)} disabled={disabled} />
          {t(`project.train.epochLevels.${level.key}`, { n: level.epochs })}
        </label>
      ))}
    </fieldset>
  );
}

function OptionInputs({ options, onChange, disabled }: { options: TrainOptions; onChange: (o: TrainOptions) => void; disabled: boolean }) {
  const { t } = useTranslation();
  const field = (key: 'epochs' | 'learningRate' | 'batchSize', step: string) => (
    <label className="flex flex-col text-xs text-muted">
      {t(`project.train.${key}`)}
      <input
        type="number"
        step={step}
        min={LIMITS[key][0]}
        max={LIMITS[key][1]}
        value={options[key]}
        disabled={disabled}
        onChange={(e) => onChange({ ...options, [key]: Number(e.target.value) })}
        className="w-24 rounded border border-rule bg-paper px-2 py-1 font-mono text-sm text-ink"
      />
    </label>
  );
  return (
    <>
      {field('epochs', '1')}
      {field('learningRate', '0.0001')}
      {field('batchSize', '1')}
    </>
  );
}

function Charts({ snapshots, selectedEpoch, onSelectEpoch }: TrainSectionProps) {
  const { t } = useTranslation();
  const maxEpoch = snapshots.at(-1)?.epoch ?? 0;
  const hasTest = snapshots.some((s) => s.test);
  const series = (pick: (s: EpochSnapshot) => number | null) => [
    { label: t('project.train.seriesTrain'), color: '#0072B2', values: snapshots.map(pick) },
    ...(hasTest ? [{ label: t('project.train.seriesTest'), color: '#D55E00', dashed: true, values: snapshots.map((s) => (s.test ? pick({ ...s, train: s.test }) : null)) }] : []),
  ];

  return (
    <div className="space-y-3">
      <div className="grid gap-6 md:grid-cols-2">
        <LineChart title={t('project.train.chartAccuracy')} series={series((s) => s.train.accuracy * 100)} maxX={maxEpoch} yMax={100} markerX={selectedEpoch} />
        <LineChart title={t('project.train.chartLoss')} series={series((s) => s.train.loss)} maxX={maxEpoch} markerX={selectedEpoch} />
      </div>
      <label className="block text-sm">
        <span className="font-medium">{t('project.train.replay', { epoch: selectedEpoch ?? maxEpoch })}</span>
        <input type="range" min={0} max={maxEpoch} value={selectedEpoch ?? maxEpoch} onChange={(e) => onSelectEpoch(Number(e.target.value))} className="mt-1 block w-full" />
        <span className="text-xs text-muted">{t('project.train.replayHint')}</span>
      </label>
      <p className="text-xs text-muted"><Info /> {t('project.train.notSaved')}</p>
    </div>
  );
}
