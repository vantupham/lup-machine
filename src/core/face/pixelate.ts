import type { RgbaImage } from '@/core/image/preprocess';

/**
 * Làm mờ khuôn mặt bằng cách PIXEL HÓA: chia vùng thành ô lớn, mỗi ô tô một màu trung bình.
 * Khác với làm mờ Gauss (có thể khôi phục một phần), pixel hóa với ô đủ lớn làm mất hẳn chi tiết.
 */
export interface Region {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PixelateOptions {
  /** Nới rộng mỗi phía theo tỉ lệ kích thước khung (khung mô hình thường sát mặt, bỏ sót tóc, tai). */
  readonly margin?: number;
  /** Số ô theo cạnh dài của vùng: càng ít ô càng mờ. */
  readonly blocks?: number;
}

export const DEFAULT_MARGIN = 0.25;
export const DEFAULT_BLOCKS = 6;

/** Vùng sẽ bị pixel hóa: nới rộng theo margin, cắt theo mép ảnh, làm tròn ra số nguyên. */
export function expandRegion(region: Region, width: number, height: number, margin = DEFAULT_MARGIN): Region | null {
  const x0 = Math.max(0, Math.floor(region.x - region.width * margin));
  const y0 = Math.max(0, Math.floor(region.y - region.height * margin));
  const x1 = Math.min(width, Math.ceil(region.x + region.width * (1 + margin)));
  const y1 = Math.min(height, Math.ceil(region.y + region.height * (1 + margin)));
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null;
}

/** Trả về ảnh MỚI đã pixel hóa các vùng; ảnh gốc giữ nguyên. Kênh alpha không đổi. */
export function pixelateRegions(image: RgbaImage, regions: readonly Region[], options: PixelateOptions = {}): RgbaImage {
  const { margin = DEFAULT_MARGIN, blocks = DEFAULT_BLOCKS } = options;
  const data = new Uint8ClampedArray(image.data);
  for (const raw of regions) {
    const region = expandRegion(raw, image.width, image.height, margin);
    if (!region) continue;
    const block = Math.max(2, Math.ceil(Math.max(region.width, region.height) / blocks));
    for (let by = region.y; by < region.y + region.height; by += block) {
      for (let bx = region.x; bx < region.x + region.width; bx += block) {
        const ex = Math.min(bx + block, region.x + region.width);
        const ey = Math.min(by + block, region.y + region.height);
        const sum = [0, 0, 0];
        for (let y = by; y < ey; y++) {
          for (let x = bx; x < ex; x++) {
            const i = (y * image.width + x) * 4;
            sum[0]! += data[i] as number;
            sum[1]! += data[i + 1] as number;
            sum[2]! += data[i + 2] as number;
          }
        }
        const n = (ex - bx) * (ey - by);
        for (let y = by; y < ey; y++) {
          for (let x = bx; x < ex; x++) {
            const i = (y * image.width + x) * 4;
            data[i] = Math.round(sum[0]! / n);
            data[i + 1] = Math.round(sum[1]! / n);
            data[i + 2] = Math.round(sum[2]! / n);
          }
        }
      }
    }
  }
  return { data, width: image.width, height: image.height };
}
