import { useTranslation } from 'react-i18next';
import type { ClassRecord, SampleRecord } from '@/storage/db';
import { colorFor, markerFor } from './class-style';

export interface MapPoint {
  readonly sample: SampleRecord;
  readonly x: number;
  readonly y: number;
}

interface EmbeddingMapProps {
  readonly points: readonly MapPoint[];
  readonly classes: readonly ClassRecord[];
  readonly selectedId: string | null;
  readonly wrongIds: ReadonlySet<string>;
  readonly axisLabels: readonly [string, string];
  readonly onSelect: (sample: SampleRecord) => void;
}

const WIDTH = 480;
const HEIGHT = 320;
const PAD = 24;

function scaler(values: readonly number[], size: number): (v: number) => number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return (v) => PAD + ((v - min) / span) * (size - 2 * PAD);
}

export function EmbeddingMap({ points, classes, selectedId, wrongIds, axisLabels, onSelect }: EmbeddingMapProps) {
  const { t } = useTranslation();
  const sx = scaler(points.map((p) => p.x), WIDTH);
  const sy = scaler(points.map((p) => -p.y), HEIGHT); // trục y hướng lên
  const indexOf = new Map(classes.map((c, i) => [c.id, i]));

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full rounded border border-rule bg-surface" role="group" aria-label={t('project.represent.mapTitle')}>
      <line x1={PAD} y1={HEIGHT - PAD / 2} x2={WIDTH - PAD} y2={HEIGHT - PAD / 2} className="stroke-rule" />
      <line x1={PAD / 2} y1={PAD} x2={PAD / 2} y2={HEIGHT - PAD} className="stroke-rule" />
      <text x={WIDTH - PAD} y={HEIGHT - 2} textAnchor="end" className="fill-muted text-[10px]">
        {axisLabels[0]} →
      </text>
      <text x={4} y={PAD - 8} className="fill-muted text-[10px]">
        ↑ {axisLabels[1]}
      </text>
      {points.map(({ sample, x, y }) => {
        const i = indexOf.get(sample.classId) ?? 0;
        const cx = sx(x);
        const cy = sy(-y);
        const isSelected = sample.id === selectedId;
        const className = classes[i]?.name ?? '';
        return (
          <g
            key={sample.id}
            role="button"
            tabIndex={0}
            aria-label={t('project.represent.pointLabel', { name: className, split: t(`project.class.${sample.split}`) })}
            aria-pressed={isSelected}
            onClick={() => onSelect(sample)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(sample))}
            className="cursor-pointer focus:outline-none [&:focus-visible>circle.focus]:opacity-100"
          >
            <circle className="focus opacity-0" cx={cx} cy={cy} r={11} fill="none" stroke="var(--color-primary)" strokeWidth={2} />
            {sample.split === 'test' && <circle cx={cx} cy={cy} r={8} fill="none" stroke={colorFor(i)} strokeWidth={1.5} />}
            {wrongIds.has(sample.id) && <circle cx={cx} cy={cy} r={10} fill="none" stroke="#C62828" strokeWidth={2.5} data-testid="wrong-ring" />}
            {isSelected && <circle cx={cx} cy={cy} r={13} fill="none" stroke="var(--color-ink)" strokeWidth={1.5} strokeDasharray="3 2" />}
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill={colorFor(i)} fontSize={sample.split === 'test' ? 8 : 11}>
              {markerFor(i)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
