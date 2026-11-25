import type { MouseEvent, ReactNode } from 'react';
import { colorFor } from '@/features/studio/image/lab/class-style';
import { ChartMarker } from '@/ui/ClassMarker';

export const PLOT_SIZE = 300;

export interface PlotScale {
  /** Đổi tọa độ dữ liệu sang tọa độ SVG. */
  readonly sx: (x: number) => number;
  readonly sy: (y: number) => number;
  readonly domain: number;
}

export interface PlotPoint {
  readonly x: number;
  readonly y: number;
  /** null = điểm chưa có nhãn (vẽ màu xám). */
  readonly label: number | null;
  readonly highlight?: boolean;
}

interface Plot2dProps {
  readonly label: string;
  readonly points: readonly PlotPoint[];
  /** Nửa độ rộng miền hiển thị: trục chạy từ −domain tới +domain. */
  readonly domain?: number;
  readonly background?: (scale: PlotScale) => ReactNode;
  readonly overlay?: (scale: PlotScale) => ReactNode;
  readonly onPlotClick?: (x: number, y: number) => void;
}

export function makeScale(domain: number): PlotScale {
  return {
    domain,
    sx: (x) => ((x + domain) / (2 * domain)) * PLOT_SIZE,
    sy: (y) => (1 - (y + domain) / (2 * domain)) * PLOT_SIZE,
  };
}

/** Tô màu từng ô của lưới theo nhãn dự đoán (hàng 0 ở dưới cùng). */
export function RegionCells({ labels, resolution, opacity = 0.2 }: {
  readonly labels: readonly (number | null)[];
  readonly resolution: number;
  readonly opacity?: number | readonly number[];
}) {
  const cell = PLOT_SIZE / resolution;
  return (
    <g aria-hidden="true" data-testid="region-cells">
      {labels.map((label, i) => {
        if (label === null) return null;
        const col = i % resolution;
        const row = Math.floor(i / resolution);
        const alpha = typeof opacity === 'number' ? opacity : (opacity[i] ?? 0.2);
        return (
          <rect
            key={i}
            x={col * cell}
            y={PLOT_SIZE - (row + 1) * cell}
            width={cell + 0.5}
            height={cell + 0.5}
            fill={colorFor(label)}
            fillOpacity={alpha}
          />
        );
      })}
    </g>
  );
}

export function ClassMarker({ x, y, label, highlight = false, size = 13 }: {
  readonly x: number;
  readonly y: number;
  readonly label: number | null;
  readonly highlight?: boolean;
  readonly size?: number;
}) {
  if (label === null) return <circle cx={x} cy={y} r={3.5} fill="var(--color-muted)" fillOpacity={0.7} />;
  return (
    <ChartMarker index={label} cx={x} cy={y} size={(highlight ? size * 1.5 : size) * 0.8} halo />
  );
}

/** Mặt phẳng tọa độ 2D (SVG) dùng chung cho mọi thuật toán của trang Thuật toán. */
export function Plot2d({ label, points, domain = 1.2, background, overlay, onPlotClick }: Plot2dProps) {
  const scale = makeScale(domain);

  const handleClick = (event: MouseEvent<SVGSVGElement>) => {
    if (!onPlotClick) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const fx = (event.clientX - rect.left) / rect.width;
    const fy = (event.clientY - rect.top) / rect.height;
    onPlotClick(fx * 2 * domain - domain, (1 - fy) * 2 * domain - domain);
  };

  return (
    <svg
      viewBox={`0 0 ${PLOT_SIZE} ${PLOT_SIZE}`}
      role="img"
      aria-label={label}
      onClick={handleClick}
      className={`h-auto w-full max-w-[520px] rounded border border-rule bg-surface ${onPlotClick ? 'cursor-crosshair' : ''}`}
    >
      {background?.(scale)}
      <line x1={scale.sx(-domain)} x2={scale.sx(domain)} y1={scale.sy(0)} y2={scale.sy(0)} className="stroke-rule" />
      <line x1={scale.sx(0)} x2={scale.sx(0)} y1={scale.sy(-domain)} y2={scale.sy(domain)} className="stroke-rule" />
      <text x={PLOT_SIZE - 4} y={scale.sy(0) - 4} textAnchor="end" className="fill-muted text-[9px]">x₁</text>
      <text x={scale.sx(0) + 4} y={10} className="fill-muted text-[9px]">x₂</text>
      {points.map((p, i) => (
        <ClassMarker key={i} x={scale.sx(p.x)} y={scale.sy(p.y)} label={p.label} highlight={p.highlight ?? false} />
      ))}
      {overlay?.(scale)}
    </svg>
  );
}
