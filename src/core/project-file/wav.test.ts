import { decodeWavFloat32, encodeWavFloat32 } from './wav';

describe('WAV số thực 32 bit', () => {
  test('mã hóa rồi giải mã cho lại đúng từng mẫu (không mất độ chính xác)', () => {
    const samples = new Float32Array([0, 0.5, -0.25, 1e-7, -1, 0.123456789]);
    const bytes = encodeWavFloat32(samples, 16_000);
    expect(bytes.length).toBe(44 + samples.length * 4);
    expect(new TextDecoder().decode(bytes.subarray(0, 4))).toBe('RIFF');
    expect(new TextDecoder().decode(bytes.subarray(8, 12))).toBe('WAVE');
    const decoded = decodeWavFloat32(bytes, { sampleRate: 16_000, length: samples.length });
    expect(Array.from(decoded)).toEqual(Array.from(samples));
  });

  test('bỏ qua các khối phụ (LIST) trước khối dữ liệu', () => {
    const plain = encodeWavFloat32(new Float32Array([0.5, -0.5]), 16_000);
    const list = new Uint8Array([...new TextEncoder().encode('LIST'), 4, 0, 0, 0, 1, 2, 3, 4]);
    const withList = new Uint8Array(plain.length + list.length);
    withList.set(plain.subarray(0, 36));
    withList.set(list, 36);
    withList.set(plain.subarray(36), 36 + list.length);
    new DataView(withList.buffer).setUint32(4, withList.length - 8, true);
    expect(Array.from(decodeWavFloat32(withList, { sampleRate: 16_000, length: 2 }))).toEqual([0.5, -0.5]);
  });

  test('từ chối tệp sai tần số lấy mẫu, sai độ dài, hoặc không phải WAV', () => {
    const bytes = encodeWavFloat32(new Float32Array(4), 44_100);
    expect(() => decodeWavFloat32(bytes, { sampleRate: 16_000, length: 4 })).toThrow(/tần số/);
    const ok = encodeWavFloat32(new Float32Array(4), 16_000);
    expect(() => decodeWavFloat32(ok, { sampleRate: 16_000, length: 5 })).toThrow(/độ dài/);
    expect(() => decodeWavFloat32(new Uint8Array(10), { sampleRate: 16_000, length: 4 })).toThrow(/WAV/);
  });

  test('từ chối WAV số nguyên 16 bit (không giữ được đúng giá trị)', () => {
    const bytes = encodeWavFloat32(new Float32Array(4), 16_000);
    const view = new DataView(bytes.buffer);
    view.setUint16(20, 1, true);
    expect(() => decodeWavFloat32(bytes, { sampleRate: 16_000, length: 4 })).toThrow(/số thực 32 bit/);
  });

  test('từ chối giá trị không hữu hạn', () => {
    const bytes = encodeWavFloat32(new Float32Array([0, Number.NaN]), 16_000);
    expect(() => decodeWavFloat32(bytes, { sampleRate: 16_000, length: 2 })).toThrow(/không hợp lệ/);
  });
});
