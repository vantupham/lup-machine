/**
 * Tệp WAV một kênh, số thực 32 bit (định dạng 3 = IEEE float).
 * Dùng số thực thay vì số nguyên 16 bit để mở lại dự án cho ra ĐÚNG từng mẫu âm thanh,
 * nhờ đó huấn luyện lại với cùng seed ra đúng kết quả cũ. Phần mềm như Audacity vẫn mở được.
 */
const HEADER_BYTES = 44;
const FORMAT_IEEE_FLOAT = 3;
const BITS_PER_SAMPLE = 32;

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}

function readAscii(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + 4));
}

export function encodeWavFloat32(samples: Float32Array, sampleRate: number): Uint8Array {
  const dataBytes = samples.length * 4;
  const out = new Uint8Array(HEADER_BYTES + dataBytes);
  const view = new DataView(out.buffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, FORMAT_IEEE_FLOAT, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, BITS_PER_SAMPLE, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i++) view.setFloat32(HEADER_BYTES + i * 4, samples[i] ?? 0, true);
  return out;
}

export interface WavExpectation {
  readonly sampleRate: number;
  /** Số mẫu bắt buộc (đoạn âm thanh của LUP Machine dài đúng 1 giây). */
  readonly length: number;
}

interface FormatChunk {
  readonly format: number;
  readonly channels: number;
  readonly sampleRate: number;
  readonly bits: number;
}

function readFormat(view: DataView, offset: number): FormatChunk {
  return {
    format: view.getUint16(offset, true),
    channels: view.getUint16(offset + 2, true),
    sampleRate: view.getUint32(offset + 4, true),
    bits: view.getUint16(offset + 14, true),
  };
}

function checkFormat(fmt: FormatChunk | null, expected: WavExpectation): void {
  if (!fmt) throw new RangeError('Tệp WAV thiếu khối định dạng');
  if (fmt.format !== FORMAT_IEEE_FLOAT || fmt.bits !== BITS_PER_SAMPLE || fmt.channels !== 1) {
    throw new RangeError('Tệp WAV phải là một kênh, số thực 32 bit');
  }
  if (fmt.sampleRate !== expected.sampleRate) throw new RangeError(`Tệp WAV phải có tần số ${expected.sampleRate} Hz`);
}

/** Đọc tệp WAV từ nguồn không tin cậy: kiểm tra định dạng, tần số, độ dài và từng giá trị. */
export function decodeWavFloat32(bytes: Uint8Array, expected: WavExpectation): Float32Array {
  if (bytes.length < HEADER_BYTES || readAscii(bytes, 0) !== 'RIFF' || readAscii(bytes, 8) !== 'WAVE') {
    throw new RangeError('Không phải tệp WAV');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let fmt: FormatChunk | null = null;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = readAscii(bytes, offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (body + size > bytes.length) break;
    if (id === 'fmt ' && size >= 16) fmt = readFormat(view, body);
    if (id === 'data') {
      checkFormat(fmt, expected);
      if (size !== expected.length * 4) throw new RangeError(`Tệp WAV sai độ dài: cần đúng ${expected.length} mẫu`);
      const out = new Float32Array(expected.length);
      for (let i = 0; i < out.length; i++) out[i] = view.getFloat32(body + i * 4, true);
      if (!out.every(Number.isFinite)) throw new RangeError('Tệp WAV có giá trị không hợp lệ');
      return out;
    }
    offset = body + size + (size % 2);
  }
  throw new RangeError('Tệp WAV thiếu khối dữ liệu');
}
