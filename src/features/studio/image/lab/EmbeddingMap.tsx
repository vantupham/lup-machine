import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClassRecord, SampleRecord } from '@/storage/db';
import type { DecisionGrid } from '@/core/ml/explain';
import { colorFor, markerFor } from './class-style';
import { pointBounds } from './boundary';

export interface MapPoint {
  readonly sample: SampleRecord;
  readonly x: number;
  readonly y: number;
}

export interface ProbePoint {
  readonly x: number;
  readonly y: number;
  readonly classIndex: number;
  readonly label: string;
}

interface EmbeddingMapProps {
  readonly points: readonly MapPoint[];
  readonly classes: readonly ClassRecord[];
  readonly selectedId: string | null;
  readonly wrongIds: ReadonlySet<string>;
  readonly axisLabels: readonly [string, string];
  /** Không truyền thì bản đồ chỉ để xem: các chấm không bấm được. */
  readonly onSelect?: (sample: SampleRecord) => void;
  /** Ảnh đang thử ở bước ⑥: vẽ thành dấu ✱ trên cùng hệ tọa độ (không làm xê dịch bản đồ). */
  readonly probe?: ProbePoint | null;
  /** Lưới ranh giới quyết định (tùy chọn), vẽ dưới các chấm theo đúng hệ tọa độ của bản đồ. */
  readonly grid?: DecisionGrid | null;
}

const WIDTH = 480;
const HEIGHT = 320;
const PAD = 24;

export function EmbeddingMap({ points, classes, selectedId, wrongIds, axisLabels, onSelect, grid = null, probe = null }: EmbeddingMapProps) {
  const { t } = useTranslation();
  const b = pointBounds(points);
  const sx = (x: number) => PAD + ((x - b.minX) / (b.maxX - b.minX)) * (WIDTH - 2 * PAD);
  const sy = (y: number) => PAD + ((b.maxY - y) / (b.maxY - b.minY)) * (HEIGHT - 2 * PAD); // trục y hướng lên
  const indexOf = new Map(classes.map((c, i) => [c.id, i]));

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full rounded border border-rule bg-surface" role="group" aria-label={t('project.represent.mapTitle')}>
      {grid && <GridLayer grid={grid} sx={sx} sy={sy} bounds={b} />}
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
        const cy = sy(y);
        const isSelected = sample.id === selectedId;
        const className = classes[i]?.name ?? '';
        return (
          <g
            key={sample.id}
            {...(onSelect
              ? {
                  role: 'button',
                  tabIndex: 0,
                  'aria-label': t('project.represent.pointLabel', { name: className, split: t(`project.class.${sample.split}`) }),
                  'aria-pressed': isSelected,
                  onClick: () => onSelect(sample),
                  onKeyDown: (e: KeyboardEvent<SVGGElement>) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(sample)),
                  className: 'cursor-pointer focus:outline-none [&:focus-visible>circle.focus]:opacity-100',
                }
              : { 'aria-hidden': true })}
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
      {probe && <ProbeMarker probe={probe} cx={sx(probe.x)} cy={sy(probe.y)} />}
    </svg>
  );
}

/** Dấu ✱ của ảnh đang thử. Nằm ngoài khung thì ghim vào mép, kèm mũi tên chỉ hướng. */
function ProbeMarker({ probe, cx, cy }: { probe: ProbePoint; cx: number; cy: number }) {
  const x = Math.min(WIDTH - PAD / 2, Math.max(PAD / 2, cx));
  const y = Math.min(HEIGHT - PAD / 2, Math.max(PAD / 2, cy));
  const isClamped = x !== cx || y !== cy;
  return (
    <g role="img" aria-label={probe.label} data-testid="probe-marker" data-clamped={isClamped}>
      <circle cx={x} cy={y} r={12} fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth={2} />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill={colorFor(probe.classIndex)} fontSize={16} fontWeight="bold">
        ✱
      </text>
      {isClamped && (
        <line x1={x} y1={y} x2={x + Math.sign(cx - x) * 10} y2={y + Math.sign(cy - y) * 10} stroke="var(--color-ink)" strokeWidth={2} />
      )}
    </g>
  );
}

interface GridLayerProps {
  readonly grid: DecisionGrid;
  readonly bounds: { minX: number; maxX: number; minY: number; maxY: number };
  readonly sx: (x: number) => number;
  readonly sy: (y: number) => number;
}

/** Tô mỗi ô lưới theo lớp mà mô hình 2D chọn; càng chắc chắn màu càng đậm. */
function GridLayer({ grid, bounds, sx, sy }: GridLayerProps) {
  const dx = (bounds.maxX - bounds.minX) / grid.size;
  const dy = (bounds.maxY - bounds.minY) / grid.size;
  return (
    <g data-testid="decision-grid" aria-hidden="true">
      {Array.from(grid.classes, (cls, i) => {
        const col = i % grid.size;
        const row = Math.floor(i / grid.size);
        const x0 = sx(bounds.minX + col * dx);
        const y0 = sy(bounds.maxY - row * dy);
        return (
          <rect
            key={i}
            x={x0}
            y={y0}
            width={sx(bounds.minX + (col + 1) * dx) - x0 + 0.5}
            height={sy(bounds.maxY - (row + 1) * dy) - y0 + 0.5}
            fill={colorFor(cls)}
            fillOpacity={0.06 + 0.22 * grid.confidence[i]!}
          />
        );
      })}
    </g>
  );
}
