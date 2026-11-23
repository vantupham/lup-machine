/**
 * Tư thế giả lập theo seed: tạo thẳng TỌA ĐỘ khớp (không có ảnh, không có người thật) cho bộ mẫu của Studio tư thế.
 * Đơn vị khung mẫu: cơ thể – chiều dài thân = 1, gốc ở giữa hông; bàn tay – cổ tay → gốc ngón giữa = 1, gốc ở cổ tay.
 * Trục y hướng xuống như ảnh; người quay mặt về máy ảnh nên khớp TRÁI của người nằm bên PHẢI ảnh (x dương).
 */
import { gaussian } from '@/core/algorithms/datasets-2d';
import { createRng, type Rng } from '@/core/random/seeded-rng';
import type { Keypoint } from './detectors';
import type { PoseKind } from './features';

export type BodyPose = 'arms-up' | 'arms-out' | 'hands-on-hips' | 'arms-down';
export type HandPose = 'open' | 'fist' | 'victory';
export const BODY_POSES: readonly BodyPose[] = ['arms-up', 'arms-out', 'hands-on-hips', 'arms-down'];
export const HAND_POSES: readonly HandPose[] = ['open', 'fist', 'victory'];

type P = [number, number];

/** Khuỷu và cổ tay bên TRÁI của người (x dương); bên phải lấy đối xứng. */
const ARMS: Record<BodyPose, [P, P]> = {
  'arms-up': [[0.45, -1.6], [0.5, -2.2]],
  'arms-out': [[0.95, -1.0], [1.55, -1.0]],
  'hands-on-hips': [[0.8, -0.55], [0.3, -0.05]],
  'arms-down': [[0.4, -0.5], [0.42, 0.0]],
};

function rotateAround(p: P, c: P, angle: number): P {
  const dx = p[0] - c[0];
  const dy = p[1] - c[1];
  return [c[0] + dx * Math.cos(angle) - dy * Math.sin(angle), c[1] + dx * Math.sin(angle) + dy * Math.cos(angle)];
}

function bodyTemplate(pose: BodyPose, rng: Rng): P[] {
  const side = (s: 1 | -1): { shoulder: P; elbow: P; wrist: P } => {
    const shoulder: P = [0.35 * s, -1];
    const [e, w] = ARMS[pose];
    const angle = gaussian(rng) * 0.15 * s; // mỗi tay lệch góc một chút
    return { shoulder, elbow: rotateAround([e[0] * s, e[1]], shoulder, angle), wrist: rotateAround([w[0] * s, w[1]], shoulder, angle) };
  };
  const L = side(1);
  const R = side(-1);
  // thứ tự 17 khớp của MoveNet
  return [
    [0, -1.35], [0.07, -1.42], [-0.07, -1.42], [0.14, -1.38], [-0.14, -1.38],
    L.shoulder, R.shoulder, L.elbow, R.elbow, L.wrist, R.wrist,
    [0.2, 0], [-0.2, 0], [0.22, 0.9], [-0.22, 0.9], [0.24, 1.8], [-0.24, 1.8],
  ];
}

const MCP: P[] = [[-0.33, -0.95], [0, -1], [0.3, -0.93], [0.55, -0.8]];
const FINGER_SEGMENTS = [0.45, 0.28, 0.24];

function finger(mcp: P, extended: boolean): P[] {
  const len = Math.hypot(mcp[0], mcp[1]);
  const dir: P = [mcp[0] / len, mcp[1] / len];
  if (extended) {
    let p = mcp;
    return FINGER_SEGMENTS.map((s) => (p = [p[0] + dir[0] * s, p[1] + dir[1] * s]));
  }
  // ngón co: nhìn từ trước, đốt ngón gập về phía lòng bàn tay nên đầu ngón quay ngược lại gần cổ tay
  return [
    [mcp[0] + dir[0] * 0.22, mcp[1] + dir[1] * 0.22],
    [mcp[0] + dir[0] * 0.08, mcp[1] + dir[1] * 0.08],
    [mcp[0] - dir[0] * 0.12, mcp[1] - dir[1] * 0.12],
  ];
}

function handTemplate(pose: HandPose): P[] {
  const extended = { open: [true, true, true, true], fist: [false, false, false, false], victory: [true, true, false, false] }[pose];
  const thumbOut = pose === 'open';
  const cmc: P = [-0.35, -0.3];
  const thumb: P[] = thumbOut
    ? [[-0.6, -0.5], [-0.85, -0.7], [-1.05, -0.85]]
    : [[-0.45, -0.55], [-0.3, -0.75], [-0.1, -0.8]];
  const out: P[] = [[0, 0], cmc, ...thumb];
  MCP.forEach((m, i) => out.push(m, ...finger(m, extended[i] as boolean)));
  return out;
}

export interface SyntheticPose {
  readonly kind: PoseKind;
  readonly pose: BodyPose | HandPose;
  readonly keypoints: Keypoint[];
}

/** Đặt khung mẫu vào ảnh 640 × 480 với vị trí, cỡ, góc ngẫu nhiên và nhiễu ở từng khớp. */
export function synthesizePose(kind: PoseKind, pose: BodyPose | HandPose, seed: number): SyntheticPose {
  const rng = createRng(seed);
  const template = kind === 'body' ? bodyTemplate(pose as BodyPose, rng) : handTemplate(pose as HandPose);
  const scale = kind === 'body' ? 70 + rng() * 40 : 70 + rng() * 60;
  const cx = 220 + rng() * 200;
  const cy = kind === 'body' ? 260 + rng() * 60 : 330 + rng() * 60;
  const tilt = gaussian(rng) * (kind === 'body' ? 0.05 : 0.2);
  const jitter = kind === 'body' ? 0.06 : 0.04;
  const handScore = 0.8 + rng() * 0.19;
  const anklesHidden = kind === 'body' && rng() < 0.2; // đôi khi chân ra ngoài khung hình
  const keypoints = template.map(([x, y], i): Keypoint => {
    const [rx, ry] = rotateAround([x + gaussian(rng) * jitter, y + gaussian(rng) * jitter], [0, 0], tilt);
    const hidden = anklesHidden && i >= 15;
    return { x: cx + rx * scale, y: cy + ry * scale, score: kind === 'hand' ? handScore : hidden ? 0.05 + rng() * 0.15 : 0.5 + rng() * 0.45 };
  });
  return { kind, pose, keypoints };
}

export const POSES_PER_CLASS = 15;

export function poseDataset(kind: PoseKind, seed = 1): SyntheticPose[] {
  const poses: readonly (BodyPose | HandPose)[] = kind === 'body' ? BODY_POSES : HAND_POSES;
  return poses.flatMap((pose, p) => Array.from({ length: POSES_PER_CLASS }, (_, i) => synthesizePose(kind, pose, seed * 10_000 + p * 1_000 + i)));
}
