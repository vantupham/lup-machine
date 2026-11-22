import { useTranslation } from 'react-i18next';
import { useModeStore } from '@/ui/mode-store';

const COLUMNS = 64; // 1280 = 64 × 20
const CELL = 6;

interface FeatureStripProps {
  readonly vector: Float32Array;
}

/** 1280 con số đặc trưng vẽ thành lưới ô: ô càng đậm, giá trị càng lớn. */
export function FeatureStrip({ vector }: FeatureStripProps) {
  const { t, i18n } = useTranslation();
  const mode = useModeStore((s) => s.mode);
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (const v of vector) {
    min = Math.min(min, v);
    max = Math.max(max, v);
    sum += v;
  }
  const span = max - min || 1;
  const rows = Math.ceil(vector.length / COLUMNS);
  const fmt = (v: number) => v.toLocaleString(i18n.language, { maximumFractionDigits: 3 });

  return (
    <figure>
      <figcaption className="mb-1 text-sm font-medium">{t('project.represent.vectorTitle')}</figcaption>
      <svg
        viewBox={`0 0 ${COLUMNS * CELL} ${rows * CELL}`}
        className="h-auto w-full rounded-sm border border-rule"
        role="img"
        aria-label={t('project.represent.vectorTitle')}
        data-testid="feature-strip"
      >
        {Array.from(vector, (v, i) => (
          <rect
            key={i}
            x={(i % COLUMNS) * CELL}
            y={Math.floor(i / COLUMNS) * CELL}
            width={CELL}
            height={CELL}
            fill="var(--color-primary)"
            fillOpacity={0.05 + (0.95 * (v - min)) / span}
          />
        ))}
      </svg>
      <p className="mt-1 text-xs text-muted">{t('project.represent.vectorHint')}</p>
      <p className="mt-1 font-mono text-xs">
        {t('project.represent.vectorStats', { min: fmt(min), max: fmt(max), mean: fmt(sum / vector.length) })}
      </p>
      {mode === 'expert' && (
        <p className="mt-1 font-mono text-xs text-muted" data-testid="feature-head">
          x = [{Array.from(vector.slice(0, 6), fmt).join(', ')}, …]
        </p>
      )}
    </figure>
  );
}
