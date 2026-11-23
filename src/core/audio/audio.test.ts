import reference from '../../../tests/fixtures/audio-reference.json';
import { fitLogisticRegression, predictLogistic } from '@/core/algorithms/logistic-regression';
import { AUDIO, audioFeatures, FEATURE_LENGTH, fitClip, FRAME_COUNT, logMelSpectrogram, melBandCenters, poolFeatures, segmentBounds } from './features';
import { hannWindow, hzToMel, melFilterbank, melSpectrogram, melToHz, powerToDb, rfft } from './spectral';
import { SOUND_KINDS, soundDataset, synthesizeSound } from './synthetic-sounds';

const signal = Float32Array.from(reference.signal);

function relClose(a: number, b: number, rel: number, abs = 1e-9) {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(Math.max(abs, rel * Math.abs(b)));
}

describe('đối chiếu NumPy / librosa', () => {
  test('FFT khớp numpy.fft.rfft', () => {
    const { re, im } = rfft(signal.slice(reference.frameStart, reference.frameStart + AUDIO.nFft));
    re.forEach((v, k) => expect(v).toBeCloseTo(reference.rfftRe[k]!, 8));
    im.forEach((v, k) => expect(v).toBeCloseTo(reference.rfftIm[k]!, 8));
  });

  test('cửa sổ Hann (tuần hoàn, đặt giữa khung 512) khớp librosa', () => {
    hannWindow(AUDIO.winLength, AUDIO.nFft).forEach((v, i) => expect(v).toBeCloseTo(reference.window[i]!, 12));
  });

  test('thang mel Slaney và bộ lọc mel khớp librosa.filters.mel', () => {
    const melMax = hzToMel(AUDIO.sampleRate / 2);
    reference.melFrequencies.forEach((hz, i) => relClose(melToHz((melMax * i) / (AUDIO.nMels + 1)), hz, 1e-12));
    const bank = melFilterbank(AUDIO.sampleRate, AUDIO.nFft, AUDIO.nMels);
    bank.forEach((row, m) => row.forEach((v, k) => expect(v).toBeCloseTo(reference.melFilters[m]![k]!, 12)));
  });

  test('ảnh phổ mel và đổi sang dB khớp librosa (97 khung)', () => {
    const mel = melSpectrogram(signal, AUDIO);
    expect(mel[0]).toHaveLength(FRAME_COUNT);
    expect(FRAME_COUNT).toBe(reference.melSpectrogram[0]!.length);
    mel.forEach((row, m) => row.forEach((v, t) => relClose(v, reference.melSpectrogram[m]![t]!, 1e-9)));
    mel.forEach((row, m) => row.forEach((v, t) => expect(powerToDb(v)).toBeCloseTo(reference.melDb[m]![t]!, 8)));
  });
});

describe('FFT – tính chất', () => {
  test('sóng sin đúng một bin cho đỉnh tại bin đó', () => {
    const n = 64;
    const x = Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 5 * i) / n));
    const { re, im } = rfft(x);
    const mag = re.map((r, k) => Math.hypot(r, im[k]!));
    expect(mag.indexOf(Math.max(...mag))).toBe(5);
    expect(mag[5]).toBeCloseTo(n / 2, 9);
  });

  test('báo lỗi khi độ dài không phải lũy thừa của 2', () => {
    expect(() => rfft([1, 2, 3])).toThrow(RangeError);
    expect(() => rfft([])).toThrow(RangeError);
  });
});

describe('đặc trưng 160 con số', () => {
  test('cắt / đệm về đúng 1 giây, bắt đầu ngay trước chỗ có âm thanh', () => {
    const short = new Float32Array(8000).fill(0.5);
    expect(fitClip(short)).toHaveLength(AUDIO.clipSamples);
    const late = new Float32Array(60_000);
    late.fill(0.9, 30_000, 31_000);
    expect(fitClip(late).findIndex((v) => v > 0)).toBe(1_600); // 0,1 giây trước điểm bắt đầu
    // âm thanh sát cuối: đoạn 1 giây không thể vượt quá cuối tín hiệu
    const end = new Float32Array(40_000);
    end.fill(0.9, 30_000, 31_000);
    expect(fitClip(end).findIndex((v) => v > 0)).toBe(30_000 - 24_000);
    expect(fitClip(new Float32Array(20_000))).toHaveLength(AUDIO.clipSamples);
  });

  test('gộp theo 4 đoạn thời gian: đúng thứ tự [đoạn][dải] và là trung bình các khung', () => {
    expect(segmentBounds(97, 4)).toEqual([0, 24, 49, 73, 97]);
    const db = logMelSpectrogram(fitClip(signal));
    const f = poolFeatures(db);
    expect(f).toHaveLength(FEATURE_LENGTH);
    const manual = db[7]!.slice(24, 49).reduce((a, b) => a + b, 0) / 25;
    expect(f[1 * AUDIO.nMels + 7]).toBeCloseTo(manual, 4);
  });

  test('tâm các dải mel tăng dần từ thấp lên cao', () => {
    const centers = melBandCenters();
    expect(centers).toHaveLength(AUDIO.nMels);
    for (let i = 1; i < centers.length; i++) expect(centers[i]).toBeGreaterThanOrEqual(centers[i - 1]!);
  });
});

describe('âm thanh tổng hợp', () => {
  test('tái lập theo seed; không bao giờ bị rè; còi có năng lượng ở dải cao hơn trống', () => {
    expect(synthesizeSound('bell', 3)).toEqual(synthesizeSound('bell', 3));
    for (const s of soundDataset(1)) expect(Math.max(...Array.from(s.signal, Math.abs))).toBeLessThanOrEqual(0.9 + 1e-6);
    const centers = melBandCenters();
    const peakBand = (kind: (typeof SOUND_KINDS)[number]) => {
      const db = logMelSpectrogram(fitClip(synthesizeSound(kind, 5)));
      const energy = db.map((row) => Math.max(...row));
      return centers[energy.indexOf(Math.max(...energy))]!;
    };
    expect(peakBand('whistle')).toBeGreaterThan(1200);
    expect(peakBand('drum')).toBeLessThan(300);
  });

  test('hồi quy logistic trên 160 đặc trưng phân biệt được 3 loại âm thanh mới', () => {
    const train = soundDataset(1);
    const test = soundDataset(2);
    const xs = train.map((s) => Array.from(audioFeatures(fitClip(s.signal))));
    const mean = xs[0]!.map((_, j) => xs.reduce((a, x) => a + x[j]!, 0) / xs.length);
    const sd = xs[0]!.map((_, j) => Math.sqrt(xs.reduce((a, x) => a + (x[j]! - mean[j]!) ** 2, 0) / xs.length) || 1);
    const scale = (x: number[]) => x.map((v, j) => (v - mean[j]!) / sd[j]!);
    const model = fitLogisticRegression(xs.map(scale), train.map((s) => SOUND_KINDS.indexOf(s.kind)), 3);
    const correct = test.filter((s) => predictLogistic(model, scale(Array.from(audioFeatures(fitClip(s.signal))))) === SOUND_KINDS.indexOf(s.kind)).length;
    expect(correct / test.length).toBeGreaterThanOrEqual(0.9);
  }, 30_000);
});
