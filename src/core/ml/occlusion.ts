/**
 * Bản đồ che khuất (occlusion): che lần lượt từng ô của ảnh bằng màu xám rồi đo xác suất của lớp giảm bao nhiêu.
 * Đây là PHÉP ĐO TRỰC TIẾP trên mô hình thật (không phải ước lượng) — ô nào che vào làm xác suất tụt mạnh
 * thì mô hình đang dựa vào vùng đó.
 */
import type { RgbaImage } from '@/core/image/preprocess';
import { computeLogits, softmax, type SoftmaxParams } from './softmax-regression';

/** Xám trung tính: sau chuẩn hóa v/127,5 − 1 gần bằng 0 → "không có thông tin". */
export const OCCLUSION_FILL = 128;
const OPAQUE = 255;

export interface PatchBox {
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

export interface OcclusionResult {
  /** Xác suất của lớp trên ảnh gốc (không che). */
  readonly baseProb: number;
  /** drops[i] = baseProb − xác suất khi che ô i. Dương = ô quan trọng cho lớp này. */
  readonly drops: Float64Array;
}

/** Các ô vuông của lưới gridSize×gridSize, thứ tự theo hàng. */
export function occlusionGrid(imageSize: number, gridSize: number): PatchBox[] {
  if (!(Number.isInteger(gridSize) && gridSize > 0) || imageSize % gridSize !== 0) {
    throw new RangeError(`Lưới ${gridSize}×${gridSize} không chia hết ảnh ${imageSize}px`);
  }
  const size = imageSize / gridSize;
  return Array.from({ length: gridSize * gridSize }, (_, i) => ({
    x: (i % gridSize) * size,
    y: Math.floor(i / gridSize) * size,
    size,
  }));
}

/** Trả về BẢN SAO của ảnh với một ô bị tô xám; ảnh gốc giữ nguyên. */
export function occludeImage(image: RgbaImage, box: PatchBox): RgbaImage {
  if (box.x < 0 || box.y < 0 || box.x + box.size > image.width || box.y + box.size > image.height) {
    throw new RangeError('Ô che nằm ngoài ảnh');
  }
  const data = new Uint8ClampedArray(image.data);
  for (let y = box.y; y < box.y + box.size; y++) {
    for (let x = box.x; x < box.x + box.size; x++) {
      data.set([OCCLUSION_FILL, OCCLUSION_FILL, OCCLUSION_FILL, OPAQUE], (y * image.width + x) * 4);
    }
  }
  return { width: image.width, height: image.height, data };
}

export function occlusionDrops(
  params: SoftmaxParams,
  baseVector: ArrayLike<number>,
  occludedVectors: readonly ArrayLike<number>[],
  classIndex: number,
): OcclusionResult {
  if (!(Number.isInteger(classIndex) && classIndex >= 0 && classIndex < params.numClasses)) {
    throw new RangeError(`Lớp không tồn tại: ${classIndex}`);
  }
  const prob = (v: ArrayLike<number>) => softmax(computeLogits(params, v))[classIndex]!;
  const baseProb = prob(baseVector);
  return { baseProb, drops: Float64Array.from(occludedVectors, (v) => baseProb - prob(v)) };
}
