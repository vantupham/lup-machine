import { useEffect, useRef } from 'react';
import { cellAt } from '@/core/ml/weight-stats';
import { useTranslation } from 'react-i18next';
import { ClassMarker } from '@/ui/ClassMarker';
import { colorFor } from './class-style';

/** Màu dương / âm (Okabe–Ito: xanh dương / cam), dễ phân biệt kể cả với người mù màu, ở cả hai giao diện. */
export const POSITIVE = '#0072B2';
export const NEGATIVE = '#D55E00';
const COLUMNS = 64;

/** 1280 số có dấu thành lưới 64 × 20 ô trên một canvas: xanh là dương, cam là âm, càng đậm càng lớn. */
interface SignedStripProps {
  readonly values: ArrayLike<number>;
  readonly label: string;
  readonly testId?: string;
  /** Bấm vào một ô: số thứ tự ô (0…n−1). */
  readonly onPick?: (index: number) => void;
}

export function SignedStrip({ values, label, testId, onPick }: SignedStripProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const rows = Math.ceil(values.length / COLUMNS);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    let max = 0;
    for (let i = 0; i < values.length; i++) max = Math.max(max, Math.abs(values[i] as number));
    ctx.clearRect(0, 0, COLUMNS, rows);
    for (let i = 0; i < values.length; i++) {
      const v = values[i] as number;
      if (v === 0 || max === 0) continue;
      ctx.globalAlpha = Math.abs(v) / max;
      ctx.fillStyle = v > 0 ? POSITIVE : NEGATIVE;
      ctx.fillRect(i % COLUMNS, Math.floor(i / COLUMNS), 1, 1);
    }
  }, [values, rows]);
  return (
    <canvas
      ref={ref}
      width={COLUMNS}
      height={rows}
      role="img"
      aria-label={label}
      data-testid={testId}
      onClick={
        onPick
          ? (e) => {
              const box = e.currentTarget.getBoundingClientRect();
              if (box.width > 0 && box.height > 0) onPick(cellAt((e.clientX - box.left) / box.width, (e.clientY - box.top) / box.height, COLUMNS, values.length));
            }
          : undefined
      }
      className={`h-auto w-full max-w-xl rounded-sm border border-rule bg-paper [image-rendering:pixelated] ${onPick ? 'cursor-crosshair' : ''}`}
    />
  );
}

interface ClassBarsProps {
  readonly classNames: readonly string[];
  readonly values: ArrayLike<number>;
  /** Có dấu: thanh mọc hai phía từ giữa; không dấu (xác suất 0–1): mọc từ trái. */
  readonly signed: boolean;
  readonly highlight: number;
  readonly digits?: number;
  readonly testId?: string;
}

/** Một thanh cho mỗi lớp (điểm, xác suất hoặc sai lệch), kèm con số; lớp đúng in đậm. */
export function ClassBars({ classNames, values, signed, highlight, digits = 3, testId }: ClassBarsProps) {
  const { i18n } = useTranslation();
  const list = Array.from(values);
  const max = signed ? Math.max(1e-12, ...list.map(Math.abs)) : 1;
  const fmt = (v: number) => v.toLocaleString(i18n.language, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return (
    <ul className="space-y-1" data-testid={testId}>
      {list.map((v, k) => {
        const share = Math.abs(v) / max;
        return (
          <li key={k} className={`grid grid-cols-[7rem_1fr_4.5rem] items-center gap-2 text-xs ${k === highlight ? 'font-semibold' : ''}`}>
            <span className="truncate"><ClassMarker index={k} className="mr-1" />{classNames[k]}</span>
            <span aria-hidden="true" className="relative h-3 rounded-sm bg-rule/40">
              {signed && <span className="absolute inset-y-0 left-1/2 w-px bg-ink/40" />}
              <span
                className="absolute inset-y-0 rounded-sm"
                style={
                  signed
                    ? { left: v >= 0 ? '50%' : `${50 - share * 50}%`, width: `${share * 50}%`, backgroundColor: v >= 0 ? POSITIVE : NEGATIVE }
                    : { left: 0, width: `${share * 100}%`, backgroundColor: colorFor(k) }
                }
              />
            </span>
            <span className="text-right font-mono">{fmt(v)}</span>
          </li>
        );
      })}
    </ul>
  );
}
