/**
 * Đọc kích thước THẬT ghi trong phần đầu tệp ảnh (không giải mã ảnh).
 * Dùng để đối chiếu với kích thước khai báo trong tệp dự án: một ảnh nhỏ vài trăm byte
 * có thể khai báo 60000×60000 điểm ảnh và làm treo trình duyệt khi giải mã ("bom giải nén ảnh").
 */
export interface ImageSize {
  readonly width: number;
  readonly height: number;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function pngSize(bytes: Uint8Array, view: DataView): ImageSize | null {
  if (bytes.length < 24 || !PNG_SIGNATURE.every((b, i) => bytes[i] === b)) return null;
  if (String.fromCharCode(...bytes.subarray(12, 16)) !== 'IHDR') return null;
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** Các khối SOF0–SOF15 mang kích thước ảnh; C4 (DHT), C8 (JPG), CC (DAC) không phải SOF. */
function isStartOfFrame(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

function jpegSize(bytes: Uint8Array, view: DataView): ImageSize | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xd9 || marker === 0xda) return null;
    const length = view.getUint16(offset + 2);
    if (length < 2) return null;
    if (isStartOfFrame(marker)) {
      if (offset + 9 > bytes.length) return null;
      return { width: view.getUint16(offset + 7), height: view.getUint16(offset + 5) };
    }
    offset += 2 + length;
  }
  return null;
}

export function imageDimensions(bytes: Uint8Array, mime: 'image/jpeg' | 'image/png'): ImageSize | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return mime === 'image/png' ? pngSize(bytes, view) : jpegSize(bytes, view);
}
