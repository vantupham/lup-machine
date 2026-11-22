/**
 * Tiền xử lý ảnh cho MobileNetV2: cắt vuông giữa → 224×224 → chuẩn hóa về [-1, 1].
 * Các hàm thuần, không phụ thuộc DOM, để Kính hiển vi hiển thị đúng con số mô hình nhận được.
 */

export const MODEL_INPUT_SIZE = 224;
const CHANNELS_RGBA = 4;
const CHANNELS_RGB = 3;
const HALF_MAX_PIXEL = 127.5;

export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

export interface CropBox {
  readonly sx: number;
  readonly sy: number;
  readonly size: number;
}

export interface Pixel {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

function assertPositiveSize(width: number, height: number): void {
  if (!(width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height))) {
    throw new RangeError(`Kích thước ảnh không hợp lệ: ${width}×${height}`);
  }
}

/** Hình vuông lớn nhất nằm chính giữa ảnh. */
export function centerCropBox(width: number, height: number): CropBox {
  assertPositiveSize(width, height);
  const size = Math.min(width, height);
  return { sx: Math.floor((width - size) / 2), sy: Math.floor((height - size) / 2), size };
}

/** [0, 255] → [-1, 1], đúng công thức tiền xử lý của MobileNetV2. */
export function normalizePixelValue(value: number): number {
  return value / HALF_MAX_PIXEL - 1;
}

/** RGBA (Uint8) → mảng RGB đã chuẩn hóa (Float32), thứ tự hàng → cột → kênh. */
export function rgbaToModelInput(image: RgbaImage): Float32Array {
  const pixelCount = image.width * image.height;
  if (image.data.length !== pixelCount * CHANNELS_RGBA) {
    throw new RangeError(
      `Dữ liệu ảnh có ${image.data.length} giá trị, cần ${pixelCount * CHANNELS_RGBA}`,
    );
  }
  const out = new Float32Array(pixelCount * CHANNELS_RGB);
  for (let i = 0; i < pixelCount; i++) {
    for (let c = 0; c < CHANNELS_RGB; c++) {
      out[i * CHANNELS_RGB + c] = normalizePixelValue(image.data[i * CHANNELS_RGBA + c] as number);
    }
  }
  return out;
}

export function readPixel(image: RgbaImage, x: number, y: number): Pixel {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) {
    throw new RangeError(`Tọa độ (${x}, ${y}) nằm ngoài ảnh ${image.width}×${image.height}`);
  }
  const i = (y * image.width + x) * CHANNELS_RGBA;
  const d = image.data;
  return { r: d[i] as number, g: d[i + 1] as number, b: d[i + 2] as number, a: d[i + 3] as number };
}
