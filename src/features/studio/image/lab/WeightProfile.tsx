import { useEffect, useRef } from 'react';
import { NEGATIVE, POSITIVE } from './step-visuals';

const WIDTH = 640;
const HEIGHT = 96;
const MID = HEIGHT / 2;

interface WeightProfileProps {
  /** Giá trị theo số thứ tự đặc trưng (0…dim−1). */
  readonly values: ArrayLike<number>;
  /** Thứ tự vẽ: đặc trưng ở vị trí r là order[r]. Giữ cố định qua các epoch để thấy từng thanh lớn lên. */
  readonly order: readonly number[];
  /** Độ cao tối đa ứng với giá trị tuyệt đối này (giữ cố định khi phát lại). */
  readonly scale: number;
  readonly label: string;
  readonly testId?: string;
  readonly onPick?: (index: number) => void;
}

/**
 * 1280 trọng số của một lớp thành 1280 thanh mảnh, xếp theo thứ tự cố định (lớn → nhỏ ở epoch cuối):
 * thanh xanh mọc lên là dương, thanh cam mọc xuống là âm. Nhìn được hình dạng: vài đặc trưng nổi bật, phần lớn gần 0.
 */
export function WeightProfile({ values, order, scale, label, testId, onPick }: WeightProfileProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const barW = WIDTH / order.length;
    const unit = scale > 0 ? (MID - 2) / scale : 0;
    order.forEach((j, r) => {
      const v = values[j] as number;
      const h = Math.min(MID - 1, Math.abs(v) * unit);
      if (h === 0) return;
      ctx.fillStyle = v > 0 ? POSITIVE : NEGATIVE;
      ctx.fillRect(r * barW, v > 0 ? MID - h : MID, Math.max(barW, 0.6), h);
    });
  }, [values, order, scale]);
  return (
    <div className="relative">
      <canvas
        ref={ref}
        width={WIDTH}
        height={HEIGHT}
        role="img"
        aria-label={label}
        data-testid={testId}
        onClick={
          onPick
            ? (e) => {
                const box = e.currentTarget.getBoundingClientRect();
                if (box.width === 0) return;
                const r = Math.min(order.length - 1, Math.max(0, Math.floor(((e.clientX - box.left) / box.width) * order.length)));
                onPick(order[r]!);
              }
            : undefined
        }
        className={`block h-24 w-full rounded-sm border border-rule bg-paper ${onPick ? 'cursor-crosshair' : ''}`}
      />
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-ink/25" />
    </div>
  );
}
