/**
 * Biến một đoạn âm thanh thành 160 con số cho mô hình:
 *   đoạn 1 giây, 16 kHz → ảnh phổ mel 40 dải × 97 khung (dB) → trung bình theo 4 đoạn thời gian.
 * Mỗi con số có nghĩa rõ ràng: "độ to trung bình của dải tần m trong phần tư thứ s của đoạn âm thanh".
 */
import { frameCount, melFilterbank, melSpectrogram, powerToDb, type SpectrogramOptions } from './spectral';

export const AUDIO = {
  sampleRate: 16_000,
  clipSamples: 16_000,
  nFft: 512,
  winLength: 400, // 25 ms
  hopLength: 160, // 10 ms
  nMels: 40,
  timeSegments: 4,
} as const;

export const SPECTROGRAM_OPTIONS: SpectrogramOptions = AUDIO;
export const FRAME_COUNT = frameCount(AUDIO.clipSamples, AUDIO.nFft, AUDIO.hopLength);
export const FEATURE_LENGTH = AUDIO.nMels * AUDIO.timeSegments;

/** Âm lượng (biên độ) nhỏ hơn tỉ lệ này so với đỉnh coi là im lặng khi tìm điểm bắt đầu. */
const ONSET_RATIO = 0.1;
/** Giữ lại một chút trước điểm bắt đầu để không cắt mất phần đầu âm thanh. */
const PRE_ROLL_SAMPLES = 1_600; // 0,1 giây

let cachedFilters: Float64Array[] | null = null;
export function audioFilters(): Float64Array[] {
  cachedFilters ??= melFilterbank(AUDIO.sampleRate, AUDIO.nFft, AUDIO.nMels);
  return cachedFilters;
}

/**
 * Lấy đúng 1 giây: bắt đầu ngay trước chỗ âm thanh đủ lớn đầu tiên; thiếu thì đệm im lặng phía sau.
 */
export function fitClip(signal: Float32Array): Float32Array {
  let peak = 0;
  for (const v of signal) peak = Math.max(peak, Math.abs(v));
  const onset = peak === 0 ? 0 : signal.findIndex((v) => Math.abs(v) >= peak * ONSET_RATIO);
  const start = Math.max(0, Math.min(onset - PRE_ROLL_SAMPLES, signal.length - AUDIO.clipSamples));
  const out = new Float32Array(AUDIO.clipSamples);
  out.set(signal.subarray(start, start + AUDIO.clipSamples));
  return out;
}

/** Ảnh phổ mel theo dB: db[dải][khung]. */
export function logMelSpectrogram(clip: Float32Array): Float64Array[] {
  return melSpectrogram(clip, SPECTROGRAM_OPTIONS, audioFilters()).map((row) => row.map((v) => powerToDb(v)));
}

/** Ranh giới các đoạn thời gian: đoạn s gồm các khung [bounds[s], bounds[s+1]). */
export function segmentBounds(frames: number = FRAME_COUNT, segments: number = AUDIO.timeSegments): number[] {
  return Array.from({ length: segments + 1 }, (_, s) => Math.round((s * frames) / segments));
}

/** 160 con số: thứ tự [đoạn thời gian][dải mel] — feature[s * 40 + m]. */
export function poolFeatures(db: readonly Float64Array[]): Float32Array {
  const bounds = segmentBounds(db[0]?.length ?? 0);
  const out = new Float32Array(db.length * AUDIO.timeSegments);
  for (let s = 0; s < AUDIO.timeSegments; s++) {
    const from = bounds[s] as number;
    const to = bounds[s + 1] as number;
    db.forEach((row, m) => {
      let sum = 0;
      for (let t = from; t < to; t++) sum += row[t] as number;
      out[s * db.length + m] = sum / Math.max(1, to - from);
    });
  }
  return out;
}

export function audioFeatures(clip: Float32Array): Float32Array {
  return poolFeatures(logMelSpectrogram(clip));
}

/** Tần số trung tâm (Hz) gần đúng của mỗi dải mel, để ghi nhãn trục dọc. */
export function melBandCenters(): number[] {
  return audioFilters().map((f) => {
    let best = 0;
    f.forEach((v, k) => {
      if (v > (f[best] as number)) best = k;
    });
    return (best * AUDIO.sampleRate) / AUDIO.nFft;
  });
}
