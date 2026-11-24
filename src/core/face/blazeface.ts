/**
 * Phát hiện khuôn mặt bằng MediaPipe BlazeFace short-range (đầu vào 128×128, 896 "anchor").
 * Chỉ dùng để LÀM MỜ khuôn mặt trước khi lưu ảnh; không nhận dạng ai, không lưu đặc điểm khuôn mặt.
 *
 * Đầu ra mô hình [896, 17] cho mỗi anchor: [logit độ tin cậy, cx, cy, w, h, 6 điểm mốc × (x, y)],
 * tọa độ theo pixel của ô 128 so với tâm anchor. LƯU Ý: bản TF.js này đặt điểm tin cậy ở ĐẦU
 * (đo trên ảnh thật: ô trắng có kênh 0 ≤ −3, ảnh có mặt > 0; kênh 3 và 4 luôn bằng nhau = khung vuông),
 * khác bản MediaPipe gốc (điểm ở cuối). Anchor theo cấu hình gốc của MediaPipe:
 * 4 tầng, bước 8 / 16 / 16 / 16, mỗi tầng 2 anchor mỗi ô, tâm ô lệch 0,5, kích thước anchor cố định 1.
 */
import * as tf from '@tensorflow/tfjs-core';
import type { GraphModel } from '@tensorflow/tfjs-converter';
import type { RgbaImage } from '@/core/image/preprocess';

export const BLAZEFACE_INPUT = 128;
const STRIDES = [8, 16, 16, 16] as const;
const ANCHORS_PER_LAYER = 2;
const VALUES_PER_ANCHOR = 17;
/** Vị trí từng giá trị trong 17 số của một anchor (đã đo trên mô hình thật). */
export const OFFSETS = { score: 0, cx: 1, cy: 2, width: 3, height: 4 } as const;
export const DEFAULT_MIN_SCORE = 0.5;
export const DEFAULT_IOU_THRESHOLD = 0.3;

export interface Anchor {
  readonly x: number;
  readonly y: number;
}

/** Khung khuôn mặt, tọa độ chuẩn hóa 0–1 trong ô vuông đầu vào. */
export interface NormalizedBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly score: number;
}

/** Khung khuôn mặt theo pixel của ảnh gốc. */
export type FaceBox = NormalizedBox;

/** Anchor theo đúng thứ tự đầu ra: các tầng liền nhau cùng bước được gộp thành một lưới. */
export function generateAnchors(): Anchor[] {
  const anchors: Anchor[] = [];
  let layer = 0;
  while (layer < STRIDES.length) {
    const stride = STRIDES[layer] as number;
    let perCell = 0;
    while (layer < STRIDES.length && STRIDES[layer] === stride) {
      perCell += ANCHORS_PER_LAYER;
      layer++;
    }
    const cells = Math.ceil(BLAZEFACE_INPUT / stride);
    for (let gy = 0; gy < cells; gy++) {
      for (let gx = 0; gx < cells; gx++) {
        for (let k = 0; k < perCell; k++) anchors.push({ x: (gx + 0.5) / cells, y: (gy + 0.5) / cells });
      }
    }
  }
  return anchors;
}

const ANCHORS = generateAnchors();

const sigmoid = (v: number) => 1 / (1 + Math.exp(-v));

/** Giải mã đầu ra thô thành các khung có độ tin cậy ≥ minScore (chưa lọc trùng). */
export function decodeBoxes(raw: ArrayLike<number>, minScore = DEFAULT_MIN_SCORE): NormalizedBox[] {
  const boxes: NormalizedBox[] = [];
  for (let i = 0; i < ANCHORS.length; i++) {
    const o = i * VALUES_PER_ANCHOR;
    const score = sigmoid(raw[o + OFFSETS.score] as number);
    if (score < minScore) continue;
    const anchor = ANCHORS[i] as Anchor;
    const cx = (raw[o + OFFSETS.cx] as number) / BLAZEFACE_INPUT + anchor.x;
    const cy = (raw[o + OFFSETS.cy] as number) / BLAZEFACE_INPUT + anchor.y;
    const width = (raw[o + OFFSETS.width] as number) / BLAZEFACE_INPUT;
    const height = (raw[o + OFFSETS.height] as number) / BLAZEFACE_INPUT;
    boxes.push({ x: cx - width / 2, y: cy - height / 2, width, height, score });
  }
  return boxes;
}

export function iou(a: NormalizedBox, b: NormalizedBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.width * a.height + b.width * b.height - inter;
  return union <= 0 ? 0 : inter / union;
}

/** Lọc khung trùng: giữ khung tin cậy cao nhất, bỏ các khung chồng lên nó quá ngưỡng. */
export function nonMaxSuppression(boxes: readonly NormalizedBox[], threshold = DEFAULT_IOU_THRESHOLD): NormalizedBox[] {
  const kept: NormalizedBox[] = [];
  for (const box of [...boxes].sort((a, b) => b.score - a.score)) {
    if (kept.every((k) => iou(k, box) <= threshold)) kept.push(box);
  }
  return kept;
}

function toInput(image: RgbaImage): tf.Tensor4D {
  const size = Math.max(image.width, image.height);
  const rgb = new Float32Array(size * size * 3); // ô vuông, ảnh nằm giữa, viền đen (0 → −1 sau chuẩn hóa)
  rgb.fill(0);
  const ox = Math.floor((size - image.width) / 2);
  const oy = Math.floor((size - image.height) / 2);
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const i = (y * image.width + x) * 4;
      const j = ((y + oy) * size + (x + ox)) * 3;
      rgb[j] = image.data[i] as number;
      rgb[j + 1] = image.data[i + 1] as number;
      rgb[j + 2] = image.data[i + 2] as number;
    }
  }
  return tf.tidy(() => {
    const square = tf.tensor4d(rgb, [1, size, size, 3]);
    const resized = tf.image.resizeBilinear(square, [BLAZEFACE_INPUT, BLAZEFACE_INPUT], true);
    return tf.sub(tf.div(resized, 127.5), 1) as tf.Tensor4D; // [0, 255] → [−1, 1]
  });
}

export interface FaceDetectorOptions {
  readonly minScore?: number;
  readonly iouThreshold?: number;
}

/** Trả về khung khuôn mặt theo pixel của ảnh gốc (đã lọc trùng). */
export function createFaceDetector(model: GraphModel, options: FaceDetectorOptions = {}): (image: RgbaImage) => Promise<FaceBox[]> {
  const { minScore = DEFAULT_MIN_SCORE, iouThreshold = DEFAULT_IOU_THRESHOLD } = options;
  return async (image) => {
    const output = tf.tidy(() => model.execute(toInput(image)) as tf.Tensor);
    let raw: Awaited<ReturnType<tf.Tensor['data']>>;
    try {
      raw = await output.data();
    } finally {
      output.dispose();
    }
    const size = Math.max(image.width, image.height);
    const ox = Math.floor((size - image.width) / 2);
    const oy = Math.floor((size - image.height) / 2);
    return nonMaxSuppression(decodeBoxes(raw, minScore), iouThreshold).map((b) => ({
      x: b.x * size - ox,
      y: b.y * size - oy,
      width: b.width * size,
      height: b.height * size,
      score: b.score,
    }));
  };
}
