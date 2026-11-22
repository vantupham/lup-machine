const SIZE = 224;
const MAX_OPACITY = 0.65;
const SUPPORT_COLOR = '#D7263D';
const OPPOSE_COLOR = '#1B65D4';

interface GridOverlayProps {
  readonly url: string;
  /** Giá trị từng ô theo hàng; dương = đỏ (ủng hộ lớp), âm = xanh (chống lại). */
  readonly values: ArrayLike<number>;
  readonly gridSize: number;
  readonly label: string;
  readonly testId: string;
}

/** Lưới ô màu phủ lên ảnh (nền thang xám để màu đỏ / xanh luôn dễ phân biệt, bất kể ảnh gốc màu gì). */
export function GridOverlay({ url, values, gridSize, label, testId }: GridOverlayProps) {
  const cells = Array.from(values);
  const maxAbs = Math.max(1e-9, ...cells.map(Math.abs));
  const cell = SIZE / gridSize;

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-auto w-full max-w-70 rounded-sm border border-rule" role="img" aria-label={label} data-testid={testId}>
      <image href={url} width={SIZE} height={SIZE} style={{ filter: 'grayscale(1)' }} opacity={0.85} />
      {cells.map((v, i) => (
        <rect
          key={i}
          x={(i % gridSize) * cell}
          y={Math.floor(i / gridSize) * cell}
          width={cell}
          height={cell}
          fill={v >= 0 ? SUPPORT_COLOR : OPPOSE_COLOR}
          fillOpacity={(MAX_OPACITY * Math.abs(v)) / maxAbs}
          data-value={v}
        />
      ))}
      {Array.from({ length: gridSize - 1 }, (_, i) => (
        <g key={`grid-${i}`} stroke="#ffffff" strokeOpacity={0.5} strokeWidth={0.5}>
          <line x1={(i + 1) * cell} y1={0} x2={(i + 1) * cell} y2={SIZE} />
          <line x1={0} y1={(i + 1) * cell} x2={SIZE} y2={(i + 1) * cell} />
        </g>
      ))}
    </svg>
  );
}
