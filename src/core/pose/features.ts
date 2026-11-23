/**
 * Biến tọa độ khớp (pixel) thành đặc trưng không phụ thuộc vị trí và khoảng cách tới máy ảnh:
 *   cơ thể – gốc tọa độ ở giữa hai hông, đơn vị = chiều dài thân (giữa vai → giữa hông);
 *   bàn tay – gốc tọa độ ở cổ tay, đơn vị = khoảng cách cổ tay → gốc ngón giữa.
 * Mỗi khớp cho 2 số (x, y; trục y hướng xuống như ảnh). Khớp mô hình không thấy rõ được đặt về 0.
 */
import { BODY_KEYPOINTS, HAND_KEYPOINTS, type Keypoint } from './detectors';

export type PoseKind = 'body' | 'hand';

/** Khớp có độ tin cậy dưới mức này coi như "không thấy rõ". */
export const MIN_KEYPOINT_SCORE = 0.3;

const BODY = { leftShoulder: 5, rightShoulder: 6, leftHip: 11, rightHip: 12 } as const;
const HAND = { wrist: 0, middleMcp: 9 } as const;

export function keypointCount(kind: PoseKind): number {
  return kind === 'body' ? BODY_KEYPOINTS.length : HAND_KEYPOINTS.length;
}

export function keypointNames(kind: PoseKind): readonly string[] {
  return kind === 'body' ? BODY_KEYPOINTS : HAND_KEYPOINTS;
}

export interface NormalizationFrame {
  readonly cx: number;
  readonly cy: number;
  readonly scale: number;
}

function mid(a: Keypoint, b: Keypoint): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Gốc tọa độ và đơn vị đo; null nếu không đủ khớp tin cậy để chuẩn hóa. */
export function normalizationFrame(kind: PoseKind, keypoints: readonly Keypoint[]): NormalizationFrame | null {
  const ok = (i: number) => (keypoints[i]?.score ?? 0) >= MIN_KEYPOINT_SCORE;
  if (kind === 'hand') {
    const wrist = keypoints[HAND.wrist];
    const mcp = keypoints[HAND.middleMcp];
    if (!wrist || !mcp || !ok(HAND.wrist) || !ok(HAND.middleMcp)) return null;
    const scale = Math.hypot(mcp.x - wrist.x, mcp.y - wrist.y);
    return scale > 0 ? { cx: wrist.x, cy: wrist.y, scale } : null;
  }
  if (![BODY.leftShoulder, BODY.rightShoulder, BODY.leftHip, BODY.rightHip].every(ok)) return null;
  const shoulders = mid(keypoints[BODY.leftShoulder]!, keypoints[BODY.rightShoulder]!);
  const hips = mid(keypoints[BODY.leftHip]!, keypoints[BODY.rightHip]!);
  const scale = Math.hypot(shoulders.x - hips.x, shoulders.y - hips.y);
  return scale > 0 ? { cx: hips.x, cy: hips.y, scale } : null;
}

/** Đặc trưng [x0, y0, x1, y1, …]; null nếu không chuẩn hóa được. */
export function poseFeatures(kind: PoseKind, keypoints: readonly Keypoint[]): number[] | null {
  if (keypoints.length !== keypointCount(kind)) return null;
  const frame = normalizationFrame(kind, keypoints);
  if (!frame) return null;
  return keypoints.flatMap((k) =>
    k.score >= MIN_KEYPOINT_SCORE ? [(k.x - frame.cx) / frame.scale, (k.y - frame.cy) / frame.scale] : [0, 0],
  );
}

/** Gộp đóng góp của 2 số (x, y) thành một giá trị cho mỗi khớp. */
export function perJoint(values: readonly number[]): number[] {
  return Array.from({ length: values.length / 2 }, (_, j) => (values[2 * j] as number) + (values[2 * j + 1] as number));
}

/** Tọa độ khớp lưu gọn: [x0, y0, s0, x1, y1, s1, …]. */
export function packKeypoints(keypoints: readonly Keypoint[]): number[] {
  return keypoints.flatMap((k) => [k.x, k.y, k.score]);
}

export function unpackKeypoints(packed: readonly number[]): Keypoint[] {
  return Array.from({ length: packed.length / 3 }, (_, i) => ({ x: packed[3 * i] as number, y: packed[3 * i + 1] as number, score: packed[3 * i + 2] as number }));
}
