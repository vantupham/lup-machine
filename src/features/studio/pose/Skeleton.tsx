import type { ReactNode } from 'react';
import { BODY_EDGES, HAND_EDGES, type Keypoint } from '@/core/pose/detectors';
import { MIN_KEYPOINT_SCORE, type PoseKind } from '@/core/pose/features';

interface SkeletonProps {
  readonly kind: PoseKind;
  readonly keypoints: readonly Keypoint[];
  readonly width: number;
  readonly height: number;
  readonly label: string;
  /** Giá trị cho mỗi khớp (đóng góp / độ quan trọng): dương tô cam, âm tô xanh, độ lớn quyết định cỡ chấm. */
  readonly jointValues?: readonly number[] | null;
  readonly color?: string;
  readonly className?: string;
  readonly children?: ReactNode;
  readonly testId?: string;
}

/** Khung xương vẽ theo pixel của khung hình gốc; khớp không thấy rõ vẽ rỗng, đoạn nối của nó vẽ nét đứt. */
export function Skeleton({ kind, keypoints, width, height, label, jointValues, color = 'var(--color-primary)', className, children, testId }: SkeletonProps) {
  const edges = kind === 'body' ? BODY_EDGES : HAND_EDGES;
  const unit = Math.max(width, height) / 100;
  const maxAbs = jointValues ? Math.max(1e-9, ...jointValues.map(Math.abs)) : 1;
  const ok = (k: Keypoint | undefined) => (k?.score ?? 0) >= MIN_KEYPOINT_SCORE;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className ?? 'h-auto w-full rounded border border-rule bg-surface'} role="img" aria-label={label} data-testid={testId}>
      {children}
      {edges.map(([a, b]) => {
        const p = keypoints[a];
        const q = keypoints[b];
        if (!p || !q) return null;
        return <line key={`${a}-${b}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={color} strokeWidth={unit * 0.8} strokeOpacity={ok(p) && ok(q) ? 0.85 : 0.3} strokeDasharray={ok(p) && ok(q) ? undefined : `${unit * 2} ${unit * 1.5}`} />;
      })}
      {keypoints.map((k, i) => {
        const v = jointValues?.[i];
        const r = v === undefined ? unit * 1.4 : unit * (0.8 + 2.6 * (Math.abs(v) / maxAbs));
        const fill = v === undefined ? color : v >= 0 ? '#D55E00' : '#0072B2';
        return (
          <circle key={i} cx={k.x} cy={k.y} r={r} fill={ok(k) ? fill : 'var(--color-surface)'} stroke={fill} strokeWidth={unit * 0.4} data-joint={i} data-value={v?.toFixed(4)} />
        );
      })}
    </svg>
  );
}
