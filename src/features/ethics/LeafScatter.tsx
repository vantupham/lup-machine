import { useTranslation } from 'react-i18next';
import { boundaryLine, boundaryYellowAt, type LeafModel, type LeafSample, type Region } from '@/core/ethics/rice-leaves';

const W = 520;
const H = 340;
const PAD = { left: 48, right: 16, top: 16, bottom: 40 };
const YELLOW_MAX = 100;
const SPOTS_MAX = 14;

const x = (yellow: number) => PAD.left + (yellow / YELLOW_MAX) * (W - PAD.left - PAD.right);
const y = (spots: number) => H - PAD.bottom - (Math.min(spots, SPOTS_MAX) / SPOTS_MAX) * (H - PAD.top - PAD.bottom);

const HEALTH_COLOR = ['var(--color-accent)', 'var(--color-danger)'] as const;
const REGION_DASH: Readonly<Record<Region, string | undefined>> = { lowland: undefined, mountain: '6 4' };

interface LeafScatterProps {
  readonly samples: readonly LeafSample[];
  readonly model: LeafModel;
}

/** Hình dạng theo vùng (tròn / tam giác), đặc / rỗng theo tình trạng: không chỉ dựa vào màu. */
function Marker({ sample }: { readonly sample: LeafSample }) {
  const cx = x(sample.yellow);
  const cy = y(sample.spots);
  const color = HEALTH_COLOR[sample.label];
  const fill = sample.label === 1 ? color : 'none';
  const common = { fill, fillOpacity: 0.6, stroke: color, strokeWidth: 1.5 };
  if (sample.region === 'lowland') return <circle cx={cx} cy={cy} r={3.5} {...common} />;
  return <path d={`M${cx},${cy - 5} L${cx + 4.5},${cy + 3.5} L${cx - 4.5},${cy + 3.5} Z`} {...common} />;
}

/** Mô tả bằng chữ cho trình đọc màn hình: độ vàng tại ranh giới khi lá có 4 đốm. */
function describe(model: LeafModel, regions: readonly Region[], t: ReturnType<typeof useTranslation>['t']): string {
  return regions
    .map((r) => {
      const yellow = boundaryYellowAt(boundaryLine(model, r), 4);
      const region = model.useRegion ? t(`ethics.regions.${r}`) : t('ethics.chart.allRegions');
      return yellow === null ? '' : t('ethics.chart.describe', { region, yellow: Math.round(yellow) });
    })
    .join(' ');
}

/** Đường ranh giới cắt khung vẽ: tính độ vàng tại số đốm 0 và số đốm tối đa. */
function Boundary({ model, region }: { readonly model: LeafModel; readonly region: Region }) {
  const line = boundaryLine(model, region);
  const y0 = boundaryYellowAt(line, 0);
  const y1 = boundaryYellowAt(line, SPOTS_MAX);
  if (y0 === null || y1 === null) return null;
  return (
    <line
      x1={x(y0)}
      y1={y(0)}
      x2={x(y1)}
      y2={y(SPOTS_MAX)}
      stroke="var(--color-ink)"
      strokeWidth={2}
      strokeDasharray={REGION_DASH[region]}
      data-testid={`boundary-${region}`}
    />
  );
}

/** Lá Dạy trên mặt phẳng (độ vàng, số đốm) và ranh giới thật của mô hình (chính xác, không minh họa). */
export function LeafScatter({ samples, model }: LeafScatterProps) {
  const { t } = useTranslation();
  const regions: readonly Region[] = model.useRegion ? ['lowland', 'mountain'] : ['lowland'];
  return (
    <figure className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="leaf-chart-title" aria-describedby="leaf-chart-desc" className="w-full max-w-xl rounded border border-rule bg-paper">
        <title id="leaf-chart-title">{t('ethics.chart.label', { count: samples.length })}</title>
        <desc id="leaf-chart-desc">{describe(model, regions, t)}</desc>
        <defs>
          <clipPath id="leaf-plot">
            <rect x={PAD.left} y={PAD.top} width={W - PAD.left - PAD.right} height={H - PAD.top - PAD.bottom} />
          </clipPath>
        </defs>
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={`x${v}`}>
            <line x1={x(v)} x2={x(v)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--color-rule)" />
            <text x={x(v)} y={H - PAD.bottom + 16} textAnchor="middle" fontSize={11} fill="var(--color-muted)">{v}</text>
          </g>
        ))}
        {[0, 4, 8, 12].map((v) => (
          <g key={`y${v}`}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--color-rule)" />
            <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--color-muted)">{v}</text>
          </g>
        ))}
        <text x={(W + PAD.left) / 2} y={H - 6} textAnchor="middle" fontSize={12} fill="var(--color-ink)">{t('ethics.chart.xAxis')}</text>
        <text x={14} y={(H - PAD.bottom) / 2} textAnchor="middle" fontSize={12} fill="var(--color-ink)" transform={`rotate(-90 14 ${(H - PAD.bottom) / 2})`}>{t('ethics.chart.yAxis')}</text>
        <g clipPath="url(#leaf-plot)">
          {samples.map((s, i) => (
            <Marker key={i} sample={s} />
          ))}
          {regions.map((r) => (
            <Boundary key={r} model={model} region={r} />
          ))}
        </g>
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span><span style={{ color: HEALTH_COLOR[0] }}>○</span> {t('ethics.chart.healthy')}</span>
        <span><span style={{ color: HEALTH_COLOR[1] }}>●</span> {t('ethics.chart.sick')}</span>
        <span>○ {t('ethics.regions.lowland')}</span>
        <span>△ {t('ethics.regions.mountain')}</span>
        <span>{model.useRegion ? t('ethics.chart.boundaryTwo') : t('ethics.chart.boundaryOne')}</span>
      </figcaption>
    </figure>
  );
}
