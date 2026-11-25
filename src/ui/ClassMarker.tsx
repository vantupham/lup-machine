import { colorFor } from '@/features/studio/image/lab/class-style';

/**
 * Hình đánh dấu lớp: lớp được phân biệt bằng cả hình lẫn màu, để người mù màu vẫn đọc được biểu đồ.
 * Đây là ký hiệu dữ liệu (không phải icon), vẽ bằng một <path> duy nhất trong ô 24 × 24 để biểu đồ
 * hàng trăm điểm vẫn nhẹ, và để chú thích ngoài biểu đồ dùng đúng hình bên trong biểu đồ.
 */
const BOX = 24;
const C = BOX / 2;
const R = 9.5;

function polygon(points: readonly (readonly [number, number])[]): string {
  return `M${points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join('L')}Z`;
}

/** Đa giác đều n cạnh, đỉnh đầu tiên hướng lên. */
function regular(n: number, radius = R): string {
  return polygon(Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [C + radius * Math.cos(a), C + radius * Math.sin(a)] as const;
  }));
}

function star(): string {
  return polygon(Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (Math.PI * i) / 5;
    const r = i % 2 === 0 ? R + 1 : R * 0.45;
    return [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
  }));
}

function cross(): string {
  const a = 3.2;
  const b = R;
  return polygon([
    [C - a, C - b], [C + a, C - b], [C + a, C - a], [C + b, C - a], [C + b, C + a], [C + a, C + a],
    [C + a, C + b], [C - a, C + b], [C - a, C + a], [C - b, C + a], [C - b, C - a], [C - a, C - a],
  ]);
}

export const CLASS_SHAPES = ['circle', 'triangle', 'square', 'diamond', 'star', 'cross', 'pentagon', 'hexagon'] as const;
type ClassShape = (typeof CLASS_SHAPES)[number];

const PATHS: Readonly<Record<ClassShape, string>> = {
  circle: `M${C - R},${C}a${R},${R} 0 1,0 ${2 * R},0a${R},${R} 0 1,0 ${-2 * R},0Z`,
  triangle: regular(3, R + 1.5),
  square: polygon([[C - 8, C - 8], [C + 8, C - 8], [C + 8, C + 8], [C - 8, C + 8]]),
  diamond: regular(4, R + 1),
  star: star(),
  cross: cross(),
  pentagon: regular(5),
  hexagon: regular(6),
};

export function shapeFor(index: number): ClassShape {
  return CLASS_SHAPES[index % CLASS_SHAPES.length] as ClassShape;
}

interface ClassMarkerProps {
  readonly index: number;
  /** Mặc định tô bằng màu của lớp; truyền 'current' để theo màu chữ xung quanh. */
  readonly color?: 'class' | 'current';
  readonly className?: string;
}

/** Hình đánh dấu một lớp, đặt trong dòng chữ (HTML). */
export function ClassMarker({ index, color = 'class', className = '' }: ClassMarkerProps) {
  const shape = shapeFor(index);
  return (
    <svg viewBox={`0 0 ${BOX} ${BOX}`} aria-hidden="true" data-class-marker={index} data-shape={shape} className={`class-marker ${className}`}>
      <path d={PATHS[shape]} fill={color === 'class' ? colorFor(index) : 'currentColor'} />
    </svg>
  );
}

interface ChartMarkerProps {
  readonly index: number;
  readonly cx: number;
  readonly cy: number;
  /** Cạnh của hình, theo đơn vị của SVG chứa nó. */
  readonly size: number;
  /** Viền màu nền quanh hình để nổi trên nền có màu (ví dụ vùng quyết định). */
  readonly halo?: boolean;
}

/** Hình đánh dấu một lớp bên trong một biểu đồ SVG, tâm tại (cx, cy). Một phần tử duy nhất. */
export function ChartMarker({ index, cx, cy, size, halo = false }: ChartMarkerProps) {
  const shape = shapeFor(index);
  const scale = size / BOX;
  return (
    <path
      d={PATHS[shape]}
      data-class-marker={index}
      data-shape={shape}
      transform={`translate(${cx - size / 2} ${cy - size / 2}) scale(${scale})`}
      fill={colorFor(index)}
      {...(halo ? { stroke: 'var(--color-surface)', strokeWidth: 4, paintOrder: 'stroke', strokeLinejoin: 'round' as const } : {})}
    />
  );
}
