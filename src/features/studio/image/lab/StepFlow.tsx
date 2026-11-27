import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { SampleStep } from '@/core/ml/train-step';
import { maxAbs, rankOrder } from '@/core/ml/weight-stats';
import type { SampleRecord } from '@/storage/db';
import { ChevronRight } from '@/ui/icons';
import { useObjectUrl } from '../useObjectUrl';
import { colorFor } from './class-style';
import { NEGATIVE, POSITIVE } from './step-visuals';

export const STAGES = ['input', 'logits', 'proba', 'error', 'gradient', 'update'] as const;
export type Stage = (typeof STAGES)[number];

const MINI_W = 72;
const MINI_H = 28;
/** Số thanh lấy mẫu khi vẽ thu nhỏ 1280 số. */
const PROFILE_BARS = 36;

interface StepFlowProps {
  readonly stage: number;
  readonly onPick: (stage: number) => void;
  readonly step: SampleStep;
  readonly sample: SampleRecord;
}

/**
 * Sáu chặng của một bước học nối thành một dòng chảy: mỗi chặng là một nút, kèm hình thu nhỏ của
 * chính con số ở chặng đó (ảnh, điểm, xác suất, sai lệch, gradient, mức thay đổi). Chặng đã qua tô nhạt.
 */
export function StepFlow({ stage, onPick, step, sample }: StepFlowProps) {
  const { t, i18n } = useTranslation();
  const pct = (v: number) => `${(v * 100).toLocaleString(i18n.language, { maximumFractionDigits: 0 })}%`;
  const mini: Record<Stage, ReactNode> = {
    input: <StageImage sample={sample} />,
    logits: <MiniBars values={step.logits} signed highlight={step.label} />,
    proba: <MiniBars values={step.proba} signed={false} highlight={step.label} />,
    error: <MiniBars values={step.error} signed highlight={step.label} />,
    gradient: <MiniProfile values={step.gradRow} />,
    update: (
      <span className="font-mono text-[11px] leading-7">
        {pct(step.proba[step.label]!)} → {pct(step.probaAfter[step.label]!)}
      </span>
    ),
  };

  return (
    <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label={t('project.trainStep.stages')} data-testid="step-flow">
      {STAGES.map((s, i) => {
        const isCurrent = i === stage;
        const isDone = i < stage;
        return (
          <li key={s} className="relative">
            <button
              type="button"
              aria-current={isCurrent ? 'step' : undefined}
              onClick={() => onPick(i)}
              className={`flex h-full w-full flex-col items-center gap-1 rounded border px-1 py-2 text-xs transition-colors ${
                isCurrent ? 'border-primary bg-primary/10 font-semibold text-ink shadow-[0_0_0_1px_var(--color-primary)]' : isDone ? 'border-primary/40 bg-surface text-ink' : 'border-rule bg-surface text-muted'
              }`}
            >
              <span>
                {i + 1}. {t(`project.trainStep.stage.${s}`)}
              </span>
              <span aria-hidden="true" className="flex h-8 items-center">
                {mini[s]}
              </span>
            </button>
            {i < STAGES.length - 1 && (
              <ChevronRight aria-hidden="true" className={`absolute -right-2.5 top-1/2 z-10 hidden -translate-y-1/2 sm:block ${isDone || isCurrent ? 'text-primary' : 'text-muted'}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function StageImage({ sample }: { readonly sample: SampleRecord }) {
  const url = useObjectUrl(sample.image);
  return <img src={url} alt="" width={28} height={28} className="h-7 w-7 rounded-sm object-cover" />;
}

/** Một thanh nhỏ cho mỗi lớp (màu theo lớp); có dấu thì mọc hai phía từ đường giữa. Lớp đúng viền đậm. */
function MiniBars({ values, signed, highlight }: { readonly values: ArrayLike<number>; readonly signed: boolean; readonly highlight: number }) {
  const list = Array.from(values);
  const max = signed ? Math.max(1e-12, maxAbs(list)) : 1;
  const slot = MINI_W / Math.max(1, list.length);
  const barW = Math.min(14, slot * 0.7);
  const base = signed ? MINI_H / 2 : MINI_H;
  return (
    <svg width={MINI_W} height={MINI_H} viewBox={`0 0 ${MINI_W} ${MINI_H}`}>
      <line x1={0} x2={MINI_W} y1={base} y2={base} className="stroke-rule" />
      {list.map((v, k) => {
        const h = (Math.abs(v) / max) * (signed ? MINI_H / 2 - 1 : MINI_H - 1);
        return (
          <rect
            key={k}
            x={k * slot + (slot - barW) / 2}
            y={v >= 0 ? base - h : base}
            width={barW}
            height={Math.max(0.5, h)}
            fill={colorFor(k)}
            stroke={k === highlight ? 'var(--color-ink)' : 'none'}
            strokeWidth={1}
          />
        );
      })}
    </svg>
  );
}

/** 1280 số thu nhỏ: xếp từ lớn đến nhỏ rồi lấy mẫu đều, xanh dương / cam âm. */
function MiniProfile({ values }: { readonly values: ArrayLike<number> }) {
  const order = rankOrder(values);
  const max = Math.max(1e-12, maxAbs(values));
  const slot = MINI_W / PROFILE_BARS;
  const mid = MINI_H / 2;
  return (
    <svg width={MINI_W} height={MINI_H} viewBox={`0 0 ${MINI_W} ${MINI_H}`}>
      <line x1={0} x2={MINI_W} y1={mid} y2={mid} className="stroke-rule" />
      {Array.from({ length: PROFILE_BARS }, (_, b) => {
        const v = values[order[Math.floor((b / PROFILE_BARS) * order.length)]!] as number;
        const h = (Math.abs(v) / max) * (mid - 1);
        return <rect key={b} x={b * slot} y={v >= 0 ? mid - h : mid} width={slot * 0.8} height={Math.max(0.5, h)} fill={v >= 0 ? POSITIVE : NEGATIVE} />;
      })}
    </svg>
  );
}

/** Chặng cập nhật: xác suất mỗi lớp trước (vạch) và sau một bước (thanh), cùng một trục. */
export function ProbaShift({ classNames, before, after, highlight }: { readonly classNames: readonly string[]; readonly before: ArrayLike<number>; readonly after: ArrayLike<number>; readonly highlight: number }) {
  const { i18n } = useTranslation();
  const fmt = (v: number) => (v * 100).toLocaleString(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    <ul className="space-y-1" data-testid="step-proba-shift">
      {classNames.map((name, k) => {
        const b = before[k] as number;
        const a = after[k] as number;
        return (
          <li key={k} className={`grid grid-cols-[7rem_1fr_7.5rem] items-center gap-2 text-xs ${k === highlight ? 'font-semibold' : ''}`}>
            <span className="truncate">{name}</span>
            <span aria-hidden="true" className="relative h-3 rounded-sm bg-rule/40">
              <span className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${a * 100}%`, backgroundColor: colorFor(k) }} />
              <span className="absolute -inset-y-1 w-0.5 bg-ink" style={{ left: `calc(${b * 100}% - 1px)` }} />
            </span>
            <span className="text-right font-mono">
              {fmt(b)}% → {fmt(a)}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}
