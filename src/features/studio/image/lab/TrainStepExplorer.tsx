import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { LabeledVectors, TrainOptions } from '@/core/ml/softmax-regression';
import { batchesPerEpoch, explainSample, replayBatch, topContributions, type ReplayedBatch, type SampleStep } from '@/core/ml/train-step';
import { lineOf } from '@/core/trace/program';
import { SOFTMAX_PROGRAM } from '@/core/trace/softmax-trace';
import type { ClassRecord, SampleRecord } from '@/storage/db';
import { ExactBadge } from '@/ui/ExactBadge';
import { ArrowLeft, ArrowRight, Pause, Play } from '@/ui/icons';
import { maxAbs, rankOrder } from '@/core/ml/weight-stats';
import { usePlayback } from '@/ui/usePlayback';
import { useModeStore } from '@/ui/mode-store';
import { useObjectUrl } from '../useObjectUrl';
import { ClassBars, POSITIVE } from './step-visuals';
import { ProbaShift, STAGES, StepFlow, type Stage } from './StepFlow';
import { WeightProfile } from './WeightProfile';

/** Tự chạy: mỗi chặng dừng chừng này (ms). */
const AUTOPLAY_STEP_MS = 2200;
/** Số con số lớn nhất của vector ảnh hiện ở chặng 1. */
const TOP_VALUES = 32;
/** Dòng tương ứng trong softmax_train.py (khung "Mã Python" ngay bên dưới). */
const PYTHON_ANCHOR: Record<Stage, string> = {
  input: 'X, y = X_train[batch]',
  logits: 'logits = X @ W.T',
  proba: 'loss = -np.log(',
  error: 'error = p - one_hot(',
  gradient: 'grad_W = error.T',
  update: 'W = adam_W.step(',
};

export interface TrainStepExplorerProps {
  readonly train: LabeledVectors;
  readonly test: LabeledVectors | null;
  readonly options: TrainOptions;
  /** Ảnh Huấn luyện, cùng thứ tự với `train`. */
  readonly samples: readonly SampleRecord[];
  readonly classes: readonly ClassRecord[];
  /** Epoch lớn nhất đã chạy xong. */
  readonly lastEpoch: number;
}

/** Bước 4: xem một bước học của một ảnh trong một lô, qua 6 chặng, với số thật của lần huấn luyện vừa rồi. */
export function TrainStepExplorer(props: TrainStepExplorerProps) {
  const { t } = useTranslation();
  const { train, test, options, lastEpoch } = props;
  const [epoch, setEpoch] = useState(1);
  const [batch, setBatch] = useState(0);
  const [position, setPosition] = useState(0);
  const [stage, setStage] = useState(0);
  const perEpoch = batchesPerEpoch(train.xs.length, options.batchSize);
  const atEpoch = Math.min(epoch, lastEpoch);
  const atBatch = Math.min(batch, perEpoch - 1);
  const replay = useMemo(() => replayBatch(train, test, options, { epoch: atEpoch, batch: atBatch }), [train, test, options, atEpoch, atBatch]);
  const pos = Math.min(position, replay.indices.length - 1);
  const step = useMemo(() => explainSample(train, replay, pos), [train, replay, pos]);
  const autoplay = usePlayback({ value: stage, max: STAGES.length - 1, onChange: setStage, stepMs: AUTOPLAY_STEP_MS });
  const sample = props.samples[replay.indices[pos]!]!;

  return (
    <section aria-labelledby="train-step-title" className="space-y-3 rounded border border-rule p-3" data-testid="train-step">
      <h3 id="train-step-title" className="flex flex-wrap items-center gap-2 font-semibold">
        {t('project.trainStep.title')}
        <ExactBadge label={t('playground.exact')} hint={t('project.trainStep.exactHint')} />
      </h3>
      <p className="text-sm text-muted">{t('project.trainStep.lead')}</p>
      <div className="flex flex-wrap items-end gap-4 text-sm">
        <label className="flex flex-col text-xs text-muted">
          {t('project.trainStep.epoch', { max: lastEpoch })}
          <input type="number" min={1} max={lastEpoch} value={atEpoch} onChange={(e) => setEpoch(Math.max(1, Math.min(lastEpoch, Number(e.target.value) || 1)))} className="w-20 rounded border border-rule bg-paper px-2 py-1 font-mono text-ink" />
        </label>
        <label className="flex flex-col text-xs text-muted">
          {t('project.trainStep.batch', { max: perEpoch })}
          <select value={atBatch} onChange={(e) => setBatch(Number(e.target.value))} className="rounded border border-rule bg-surface px-2 py-1 text-ink">
            {Array.from({ length: perEpoch }, (_, b) => <option key={b} value={b}>{b + 1}</option>)}
          </select>
        </label>
      </div>
      <BatchPicker replay={replay} samples={props.samples} position={pos} onPick={setPosition} />
      <StepFlow stage={stage} onPick={setStage} step={step} sample={sample} />
      <StageView stage={STAGES[stage]!} step={step} replay={replay} classes={props.classes} options={options} />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost" onClick={autoplay.toggle} aria-pressed={autoplay.isPlaying}>
          {autoplay.isPlaying ? <Pause /> : <Play />} {t(autoplay.isPlaying ? 'project.trainStep.autoplayStop' : 'project.trainStep.autoplay')}
        </button>
        <button type="button" className="btn btn-ghost" disabled={stage === 0} onClick={() => setStage(stage - 1)}><ArrowLeft /> {t('project.trainStep.prev')}</button>
        <button type="button" className="btn btn-primary" disabled={stage === STAGES.length - 1} onClick={() => setStage(stage + 1)}>{t('project.trainStep.next')} <ArrowRight /></button>
      </div>
    </section>
  );
}

function BatchThumb({ sample, isSelected, onPick, label }: { readonly sample: SampleRecord; readonly isSelected: boolean; readonly onPick: () => void; readonly label: string }) {
  const url = useObjectUrl(sample.image);
  return (
    <li>
      <button type="button" aria-pressed={isSelected} aria-label={label} onClick={onPick} className={`block rounded-sm border-2 ${isSelected ? 'border-primary' : 'border-transparent'}`}>
        <img src={url} alt="" width={40} height={40} className="h-10 w-10 rounded-sm object-cover" />
      </button>
    </li>
  );
}

function BatchPicker({ replay, samples, position, onPick }: { readonly replay: ReplayedBatch; readonly samples: readonly SampleRecord[]; readonly position: number; readonly onPick: (p: number) => void }) {
  const { t } = useTranslation();
  return (
    <div>
      <p className="mb-1 text-xs text-muted">{t('project.trainStep.batchImages', { count: replay.indices.length })}</p>
      <ul className="flex flex-wrap gap-1">
        {replay.indices.map((index, p) => (
          <BatchThumb key={index} sample={samples[index]!} isSelected={p === position} onPick={() => onPick(p)} label={t('project.trainStep.pick', { n: p + 1 })} />
        ))}
      </ul>
    </div>
  );
}

interface StageViewProps {
  readonly stage: Stage;
  readonly step: SampleStep;
  readonly replay: ReplayedBatch;
  readonly classes: readonly ClassRecord[];
  readonly options: TrainOptions;
}

function StageView({ stage, step, replay, classes, options }: StageViewProps) {
  const { t, i18n } = useTranslation();
  const mode = useModeStore((s) => s.mode);
  const names = classes.map((c) => c.name);
  const fmt = (v: number, d = 3) => v.toLocaleString(i18n.language, { minimumFractionDigits: d, maximumFractionDigits: d });
  const trueName = names[step.label] ?? '';
  const line = lineOf(SOFTMAX_PROGRAM, PYTHON_ANCHOR[stage]);
  const body: Record<Stage, ReactNode> = {
    input: (
      <>
        <p>{t('project.trainStep.inputText', { cls: trueName })}</p>
        <TopValues vector={step.x} />
      </>
    ),
    logits: (
      <>
        <p>{t('project.trainStep.logitsText')}</p>
        <ClassBars classNames={names} values={step.logits} signed highlight={step.label} testId="step-logits" />
        {mode === 'expert' && (
          <p className="font-mono text-xs">
            {t('project.trainStep.topTerms', { cls: trueName })}{' '}
            {topContributions(replay.before, step.x, step.label).map((c) => `W[${step.label}, ${c.index}]·x[${c.index}] = ${fmt(c.value)}`).join(' · ')}
          </p>
        )}
      </>
    ),
    proba: (
      <>
        <p>{t('project.trainStep.probaText', { cls: trueName, p: fmt(step.proba[step.label]! * 100, 1), loss: fmt(step.loss) })}</p>
        <ClassBars classNames={names} values={step.proba} signed={false} highlight={step.label} testId="step-proba" />
      </>
    ),
    error: (
      <>
        <p>{t('project.trainStep.errorText', { cls: trueName })}</p>
        <ClassBars classNames={names} values={step.error} signed highlight={step.label} testId="step-error" />
      </>
    ),
    gradient: (
      <>
        <p>{t('project.trainStep.gradientText', { count: replay.indices.length, cls: trueName })}</p>
        <WeightProfile values={step.gradRow} order={rankOrder(step.gradRow)} scale={maxAbs(step.gradRow)} label={t('project.trainStep.gradientLabel', { cls: trueName })} testId="step-gradient" />
        <p className="text-xs text-muted">{t('project.trainStep.colorNote')}</p>
      </>
    ),
    update: (
      <>
        <p>{t('project.trainStep.updateText', { cls: trueName, lr: options.learningRate.toLocaleString(i18n.language, { maximumSignificantDigits: 6 }) })}</p>
        <WeightProfile values={step.deltaRow} order={rankOrder(step.deltaRow)} scale={maxAbs(step.deltaRow)} label={t('project.trainStep.deltaLabel', { cls: trueName })} testId="step-delta" />
        <p className="text-xs text-muted">{t('project.trainStep.adamNote')}</p>
        <p className="text-xs text-muted">{t('project.trainStep.shiftNote')}</p>
        <ProbaShift classNames={names} before={step.proba} after={step.probaAfter} highlight={step.label} />
        <p data-testid="step-before-after">
          {t('project.trainStep.beforeAfter', {
            before: fmt(step.proba[step.label]! * 100, 1),
            after: fmt(step.probaAfter[step.label]! * 100, 1),
            lossBefore: fmt(step.loss),
            lossAfter: fmt(step.lossAfter),
          })}
        </p>
        <p className="text-xs text-muted">{t('project.trainStep.batchNote')}</p>
      </>
    ),
  };
  return (
    <div className="space-y-2 text-sm" data-testid="step-view" aria-live="polite">
      {body[stage]}
      <p className="font-mono text-xs text-muted">
        {t('project.trainStep.pythonLine', { n: line + 1 })} <code>{SOFTMAX_PROGRAM.lines[line]!.trim()}</code>
      </p>
    </div>
  );
}

/** Chặng 1: 32 số lớn nhất của vector ảnh (cột cao = số lớn), và đếm số bằng 0 trong 1280 số. */
function TopValues({ vector }: { readonly vector: Float32Array }) {
  const { t, i18n } = useTranslation();
  const order = rankOrder(vector).slice(0, TOP_VALUES);
  const max = Math.max(1e-12, vector[order[0]!]!);
  const zeros = vector.reduce((n, v) => (v === 0 ? n + 1 : n), 0);
  const fmt = (v: number) => v.toLocaleString(i18n.language, { maximumFractionDigits: 3 });
  const W = 640;
  const H = 96;
  const slot = W / TOP_VALUES;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H + 14}`} className="h-auto w-full max-w-2xl" role="img" aria-label={t('project.trainStep.vector')} data-testid="step-input-top">
        {order.map((j, r) => {
          const h = (vector[j]! / max) * (H - 4);
          return (
            <g key={j}>
              <title>{`x[${j}] = ${fmt(vector[j]!)}`}</title>
              <rect x={r * slot + 2} y={H - h} width={slot - 4} height={Math.max(0.5, h)} rx={1.5} fill={POSITIVE} fillOpacity={0.35 + 0.65 * (vector[j]! / max)} />
              {r % 4 === 0 && (
                <text x={r * slot + slot / 2} y={H + 11} textAnchor="middle" className="fill-muted font-mono text-[9px]">
                  #{j}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="text-xs text-muted">{t('project.trainStep.inputTop', { n: TOP_VALUES, zeros })}</figcaption>
    </figure>
  );
}

