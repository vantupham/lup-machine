import { useTranslation } from 'react-i18next';
import { useEffect, useRef } from 'react';
import { useModeStore } from '@/ui/mode-store';
import { useThemeStore } from '@/ui/theme-store';

const COLUMNS = 64; // 1280 = 64 × 20
const CELL = 6;

interface FeatureStripProps {
  readonly vector: Float32Array;
  /** Chỉ vẽ dải ô kèm nhãn ngắn (để đặt hai dải cạnh nhau so sánh). */
  readonly compact?: boolean;
  readonly label?: string;
}

/** 1280 con số đặc trưng vẽ thành lưới ô: ô càng đậm, giá trị càng lớn. */
export function FeatureStrip({ vector, compact = false, label }: FeatureStripProps) {
  const { t, i18n } = useTranslation();
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

  const title = label ?? t('project.represent.vectorTitle');
  if (compact) return <CompactStrip vector={vector} min={min} span={span} rows={rows} label={title} />;

  return (
    <figure>
      <figcaption className="mb-1 text-sm font-medium">{title}</figcaption>
      <svg
        viewBox={`0 0 ${COLUMNS * CELL} ${rows * CELL}`}
        className="h-auto w-full rounded-sm border border-rule"
        role="img"
        aria-label={title}
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
      <VectorNotes min={fmt(min)} max={fmt(max)} mean={fmt(sum / vector.length)} head={Array.from(vector.slice(0, 6), fmt)} />
    </figure>
  );
}

interface CompactStripProps {
  readonly vector: Float32Array;
  readonly min: number;
  readonly span: number;
  readonly rows: number;
  readonly label: string;
}

/**
 * Cùng lưới ô nhưng vẽ bằng một canvas (1 phần tử thay vì 1280): dùng khi đặt nhiều dải cạnh nhau.
 * Màu lấy từ màu chữ đã tính của canvas (lớp text-primary), vẽ lại khi đổi giao diện sáng / tối.
 */
function CompactStrip({ vector, min, span, rows, label }: CompactStripProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const theme = useThemeStore((s) => s.theme);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = getComputedStyle(canvas).color;
    vector.forEach((v, i) => {
      ctx.globalAlpha = 0.05 + (0.95 * (v - min)) / span;
      ctx.fillRect(i % COLUMNS, Math.floor(i / COLUMNS), 1, 1);
    });
  }, [vector, min, span, theme]);
  return (
    <figure>
      <figcaption className="text-xs text-muted">{label}</figcaption>
      <canvas
        ref={ref}
        width={COLUMNS}
        height={rows}
        role="img"
        aria-label={label}
        data-testid="feature-strip-compact"
        className="h-auto w-full rounded-sm border border-rule text-primary [image-rendering:pixelated]"
      />
    </figure>
  );
}

function VectorNotes({ min, max, mean, head }: { min: string; max: string; mean: string; head: string[] }) {
  const { t } = useTranslation();
  const mode = useModeStore((s) => s.mode);
  return (
    <>
      <p className="mt-1 text-xs text-muted">{t('project.represent.vectorHint')}</p>
      <p className="mt-1 font-mono text-xs">
        {t('project.represent.vectorStats', { min, max, mean })}
      </p>
      {mode === 'expert' && (
        <p className="mt-1 font-mono text-xs text-muted" data-testid="feature-head">
          x = [{head.join(', ')}, …]
        </p>
      )}
    </>
  );
}
