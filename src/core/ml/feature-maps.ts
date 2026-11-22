/**
 * Bản đồ đặc trưng (feature map) của các tầng CNN: mỗi kênh là một "bộ lọc" phản ứng mạnh (sáng)
 * ở những vùng có mẫu hình nó nhận ra. Các hàm thuần, hiển thị đúng con số mạng tính ra.
 */

/** Kích hoạt của một tầng cho MỘT ảnh, bố cục HWC (giống TensorFlow.js). */
export interface ActivationTensor {
  readonly layer: string;
  readonly height: number;
  readonly width: number;
  readonly channels: number;
  readonly data: Float32Array;
}

const GRAY_MAX = 255;

function assertShape(t: ActivationTensor): void {
  if (t.data.length !== t.height * t.width * t.channels) {
    throw new RangeError(`Kích hoạt tầng ${t.layer} sai kích thước`);
  }
}

/** Một kênh thành ảnh H×W (theo hàng). */
export function channelPlane(t: ActivationTensor, channel: number): Float32Array {
  assertShape(t);
  if (!(Number.isInteger(channel) && channel >= 0 && channel < t.channels)) {
    throw new RangeError(`Kênh ${channel} không tồn tại ở tầng ${t.layer}`);
  }
  return Float32Array.from({ length: t.height * t.width }, (_, cell) => t.data[cell * t.channels + channel]!);
}

/** n kênh có kích hoạt trung bình lớn nhất (bằng nhau thì giữ thứ tự kênh). */
export function strongestChannels(t: ActivationTensor, n: number): number[] {
  assertShape(t);
  const sums = new Float64Array(t.channels);
  for (let i = 0; i < t.data.length; i++) sums[i % t.channels]! += t.data[i]!;
  return Array.from({ length: t.channels }, (_, c) => c)
    .sort((a, b) => sums[b]! - sums[a]! || a - b)
    .slice(0, n);
}

/** Chuẩn hóa min–max về thang xám RGBA: đen = yếu nhất, trắng = mạnh nhất trong kênh này. */
export function planeToGrayRgba(plane: Float32Array): Uint8ClampedArray {
  let min = Infinity;
  let max = -Infinity;
  for (const v of plane) {
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  const range = max - min;
  const rgba = new Uint8ClampedArray(plane.length * 4);
  plane.forEach((v, i) => {
    const g = range > 0 ? Math.round(((v - min) / range) * GRAY_MAX) : 0;
    rgba.set([g, g, g, GRAY_MAX], i * 4);
  });
  return rgba;
}
