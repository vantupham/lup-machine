/**
 * Số đo đơn giản trên điểm ảnh, dùng để soi dữ liệu trước khi học (bước 2):
 * ảnh xám, "dấu vân tay" 16 × 16 (tìm ảnh gần trùng) và độ sáng viền (thường là nền).
 * Giống hệt các hàm cùng tên trong src/core/trace/python/lup_helpers.py (có số đối chiếu).
 */

/** Số ô mỗi cạnh của dấu vân tay: 16 × 16 = 256 bit. */
export const HASH_GRID = 16;
export const HASH_BITS = HASH_GRID * HASH_GRID;
/** Viền dày 1/14 cạnh ảnh: ảnh 224 thì 16 điểm. */
const BORDER_DIVISOR = 14;

export interface GrayImage {
  readonly size: number;
  /** size × size độ sáng 0–255, theo hàng. */
  readonly values: Float64Array;
}

/** Ảnh RGBA vuông thành ảnh xám (0,299 R + 0,587 G + 0,114 B). */
export function luminance(rgba: ArrayLike<number>, size: number): GrayImage {
  if (rgba.length !== size * size * 4) throw new RangeError('Ảnh phải vuông, mỗi điểm 4 số RGBA');
  const values = new Float64Array(size * size);
  for (let i = 0; i < values.length; i++) {
    values[i] = (rgba[i * 4] as number) * 0.299 + (rgba[i * 4 + 1] as number) * 0.587 + (rgba[i * 4 + 2] as number) * 0.114;
  }
  return { size, values };
}

/** Độ sáng trung bình từng ô của lưới n × n (theo hàng). */
export function blockMeans(gray: GrayImage, n = HASH_GRID): Float64Array {
  const block = Math.floor(gray.size / n);
  if (block === 0 || block * n !== gray.size) throw new RangeError(`Cạnh ảnh phải chia hết cho ${n}`);
  const means = new Float64Array(n * n);
  for (let y = 0; y < gray.size; y++) {
    for (let x = 0; x < gray.size; x++) means[Math.floor(y / block) * n + Math.floor(x / block)]! += gray.values[y * gray.size + x]!;
  }
  return means.map((v) => v / (block * block));
}

/** Dấu vân tay: ô nào sáng hơn trung bình các ô thì là 1. */
export function averageHash(gray: GrayImage, n = HASH_GRID): Uint8Array {
  const means = blockMeans(gray, n);
  const mean = means.reduce((a, b) => a + b, 0) / means.length;
  return Uint8Array.from(means, (v) => (v > mean ? 1 : 0));
}

/** Độ tương phản: độ lệch chuẩn độ sáng các ô n × n. Gần 0 là ảnh gần như một màu. */
export function blockContrast(gray: GrayImage, n = HASH_GRID): number {
  const means = blockMeans(gray, n);
  const mean = means.reduce((a, b) => a + b, 0) / means.length;
  return Math.sqrt(means.reduce((s, v) => s + (v - mean) ** 2, 0) / means.length);
}

export function hammingDistance(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length) throw new RangeError('Hai dấu vân tay phải cùng độ dài');
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
  return diff;
}

/** Độ sáng trung bình của viền ảnh. */
export function borderBrightness(gray: GrayImage): number {
  const width = Math.floor(gray.size / BORDER_DIVISOR);
  let sum = 0;
  let count = 0;
  for (let y = 0; y < gray.size; y++) {
    for (let x = 0; x < gray.size; x++) {
      const inside = y >= width && y < gray.size - width && x >= width && x < gray.size - width;
      if (inside) continue;
      sum += gray.values[y * gray.size + x]!;
      count++;
    }
  }
  return sum / count;
}
