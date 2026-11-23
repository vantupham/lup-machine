/**
 * Xử lý tín hiệu âm thanh minh bạch: FFT, cửa sổ Hann, bộ lọc mel, ảnh phổ mel (dB).
 * Khớp NumPy (numpy.fft.rfft) và librosa (filters.mel, feature.melspectrogram với center=False, power_to_db).
 */

/** Biến đổi Fourier nhanh (radix-2, tại chỗ) cho dãy độ dài lũy thừa của 2. */
function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j] as number, re[i] as number];
      [im[i], im[j]] = [im[j] as number, im[i] as number];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    for (let start = 0; start < n; start += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(angle * k);
        const wi = Math.sin(angle * k);
        const a = start + k;
        const b = a + len / 2;
        const xr = (re[b] as number) * wr - (im[b] as number) * wi;
        const xi = (re[b] as number) * wi + (im[b] as number) * wr;
        re[b] = (re[a] as number) - xr;
        im[b] = (im[a] as number) - xi;
        re[a] = (re[a] as number) + xr;
        im[a] = (im[a] as number) + xi;
      }
    }
  }
}

export interface Spectrum {
  readonly re: Float64Array;
  readonly im: Float64Array;
}

/** FFT của tín hiệu thực, trả về n/2 + 1 hệ số đầu (như numpy.fft.rfft). */
export function rfft(signal: ArrayLike<number>): Spectrum {
  const n = signal.length;
  if (n === 0 || (n & (n - 1)) !== 0) throw new RangeError(`Độ dài phải là lũy thừa của 2, nhận được ${n}`);
  const re = Float64Array.from(signal);
  const im = new Float64Array(n);
  fftInPlace(re, im);
  return { re: re.slice(0, n / 2 + 1), im: im.slice(0, n / 2 + 1) };
}

export function powerSpectrum(signal: ArrayLike<number>): Float64Array {
  const { re, im } = rfft(signal);
  return re.map((r, k) => r * r + (im[k] as number) ** 2);
}

/** Cửa sổ Hann "tuần hoàn" (scipy get_window('hann', N, fftbins=True)), đặt giữa khung nFft như librosa. */
export function hannWindow(winLength: number, nFft: number = winLength): Float64Array {
  const w = new Float64Array(nFft);
  const offset = Math.floor((nFft - winLength) / 2);
  for (let i = 0; i < winLength; i++) w[offset + i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / winLength);
  return w;
}

// Thang mel kiểu Slaney (mặc định của librosa): tuyến tính dưới 1000 Hz, logarit phía trên.
const F_SP = 200 / 3;
const MIN_LOG_HZ = 1000;
const MIN_LOG_MEL = MIN_LOG_HZ / F_SP;
const LOG_STEP = Math.log(6.4) / 27;

export function hzToMel(hz: number): number {
  return hz >= MIN_LOG_HZ ? MIN_LOG_MEL + Math.log(hz / MIN_LOG_HZ) / LOG_STEP : hz / F_SP;
}

export function melToHz(mel: number): number {
  return mel >= MIN_LOG_MEL ? MIN_LOG_HZ * Math.exp(LOG_STEP * (mel - MIN_LOG_MEL)) : F_SP * mel;
}

/**
 * Bộ lọc mel: nMels bộ lọc hình tam giác trên trục tần số, chuẩn hóa diện tích (norm="slaney").
 * weights[m][k] = trọng số của bin tần số k trong dải mel m.
 */
export function melFilterbank(sampleRate: number, nFft: number, nMels: number, fMin = 0, fMax = sampleRate / 2): Float64Array[] {
  const nBins = nFft / 2 + 1;
  const fftFreqs = Array.from({ length: nBins }, (_, k) => (k * sampleRate) / nFft);
  const melMin = hzToMel(fMin);
  const melMax = hzToMel(fMax);
  const melF = Array.from({ length: nMels + 2 }, (_, i) => melToHz(melMin + ((melMax - melMin) * i) / (nMels + 1)));
  return Array.from({ length: nMels }, (_, m) => {
    const lowerWidth = (melF[m + 1] as number) - (melF[m] as number);
    const upperWidth = (melF[m + 2] as number) - (melF[m + 1] as number);
    const norm = 2 / ((melF[m + 2] as number) - (melF[m] as number));
    return Float64Array.from(fftFreqs, (f) => {
      const lower = (f - (melF[m] as number)) / lowerWidth;
      const upper = ((melF[m + 2] as number) - f) / upperWidth;
      return Math.max(0, Math.min(lower, upper)) * norm;
    });
  });
}

export interface SpectrogramOptions {
  readonly sampleRate: number;
  readonly nFft: number;
  readonly winLength: number;
  readonly hopLength: number;
  readonly nMels: number;
}

export function frameCount(signalLength: number, nFft: number, hopLength: number): number {
  return signalLength < nFft ? 0 : 1 + Math.floor((signalLength - nFft) / hopLength);
}

/** Phổ công suất của khung thứ t (đã nhân cửa sổ). */
export function framePower(signal: ArrayLike<number>, t: number, window: Float64Array, hopLength: number): Float64Array {
  const frame = new Float64Array(window.length);
  for (let i = 0; i < window.length; i++) frame[i] = (signal[t * hopLength + i] as number) * (window[i] as number);
  return powerSpectrum(frame);
}

/** Ảnh phổ mel (công suất): mel[m][t]. Không đệm đầu cuối (center=False). */
export function melSpectrogram(signal: ArrayLike<number>, opts: SpectrogramOptions, filters?: Float64Array[]): Float64Array[] {
  const bank = filters ?? melFilterbank(opts.sampleRate, opts.nFft, opts.nMels);
  const window = hannWindow(opts.winLength, opts.nFft);
  const frames = frameCount(signal.length, opts.nFft, opts.hopLength);
  const out = bank.map(() => new Float64Array(frames));
  for (let t = 0; t < frames; t++) {
    const power = framePower(signal, t, window, opts.hopLength);
    bank.forEach((filter, m) => {
      let s = 0;
      for (let k = 0; k < filter.length; k++) s += (filter[k] as number) * (power[k] as number);
      out[m]![t] = s;
    });
  }
  return out;
}

/** Đổi công suất sang decibel: 10·log10(max(S, amin)) (librosa.power_to_db với ref=1, top_db=None). */
export function powerToDb(value: number, amin = 1e-10): number {
  return 10 * Math.log10(Math.max(value, amin));
}
