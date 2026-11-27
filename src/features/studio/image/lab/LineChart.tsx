export interface Series {
  readonly label: string;
  readonly color: string;
  readonly dashed?: boolean;
  readonly values: readonly (number | null)[];
}

interface LineChartProps {
  readonly title: string;
  readonly series: readonly Series[];
  readonly maxX: number;
  readonly yMax?: number;
  readonly markerX: number | null;
  /** Nhãn ở cuối trục X (mặc định "epoch N"). */
  readonly xAxisLabel?: string;
  /** Trục Y bám theo khoảng giá trị (không bắt đầu từ 0): để thấy được thay đổi nhỏ của một số lớn. */
  readonly fitY?: boolean;
}

const W = 320;
const H = 160;
const PAD_L = 32;
const PAD_B = 18;
const PAD_T = 8;

/** Khoảng [dưới, trên] ôm sát các giá trị, chừa 10 % mỗi phía; mọi giá trị bằng nhau thì nới ±1 %. */
export function fittedRange(values: readonly number[]): [number, number] {
  if (values.length === 0) return [0, 1];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = hi > lo ? (hi - lo) * 0.1 : Math.max(Math.abs(hi) * 0.01, 1e-9);
  return [lo - pad, hi + pad];
}

/** Biểu đồ đường đơn giản (SVG) cho loss / accuracy theo epoch, có vạch đánh dấu epoch đang xem. */
export function LineChart({ title, series, maxX, yMax, markerX, xAxisLabel, fitY = false }: LineChartProps) {
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const [bottom, top] = fitY ? fittedRange(all) : [0, yMax ?? Math.max(1e-9, ...all) * 1.05];
  const x = (i: number) => PAD_L + (i / Math.max(1, maxX)) * (W - PAD_L - 4);
  const y = (v: number) => PAD_T + (1 - (v - bottom) / (top - bottom)) * (H - PAD_T - PAD_B);
  const path = (values: readonly (number | null)[]) =>
    values
      .map((v, i) => (v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
      .filter(Boolean)
      .join(' ');

  return (
    <figure>
      <figcaption className="mb-1 text-sm font-medium">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={title}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={PAD_L} x2={W - 4} y1={y(bottom + (top - bottom) * f)} y2={y(bottom + (top - bottom) * f)} className="stroke-rule" strokeDasharray="2 3" />
            <text x={PAD_L - 4} y={y(bottom + (top - bottom) * f)} textAnchor="end" dominantBaseline="middle" className="fill-muted text-[9px]">
              {Number((bottom + (top - bottom) * f).toPrecision(fitY ? 3 : 2))}
            </text>
          </g>
        ))}
        <text x={W - 4} y={H - 2} textAnchor="end" className="fill-muted text-[9px]">
          {xAxisLabel ?? `epoch ${maxX}`}
        </text>
        {markerX !== null && <line x1={x(markerX)} x2={x(markerX)} y1={PAD_T} y2={H - PAD_B} stroke="var(--color-ink)" strokeOpacity={0.4} />}
        {series.map((s) => (
          <polyline key={s.label} points={path(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? '5 3' : undefined} />
        ))}
      </svg>
      <ul className="flex gap-4 text-xs">
        {series.map((s) => (
          <li key={s.label} className="flex items-center gap-1">
            <svg width="18" height="6" aria-hidden="true">
              <line x1="0" x2="18" y1="3" y2="3" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? '5 3' : undefined} />
            </svg>
            {s.label}
          </li>
        ))}
      </ul>
    </figure>
  );
}
