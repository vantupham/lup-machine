import { checkAudioQuality, peakAmplitude } from './audio-quality';

const clips = (label: string, n: number, peak = 0.5) => Array.from({ length: n }, () => ({ label, peak }));

describe('checkAudioQuality', () => {
  test('dữ liệu tốt: không có vấn đề', () => {
    expect(checkAudioQuality([...clips('chuông', 6), ...clips('trống', 6)], ['chuông', 'trống'])).toEqual([]);
  });

  test('đoạn im lặng, đoạn bị rè, lớp ít đoạn, mất cân bằng', () => {
    const issues = checkAudioQuality(
      [...clips('chuông', 10), ...clips('trống', 3), { label: 'chuông', peak: 0.001 }, { label: 'trống', peak: 1 }],
      ['chuông', 'trống', 'còi'],
    );
    expect(issues).toEqual([
      { kind: 'silent', count: 1 },
      { kind: 'clipped', count: 1 },
      { kind: 'few-clips', label: 'trống', count: 4 },
      { kind: 'few-clips', label: 'còi', count: 0 },
      { kind: 'imbalance', smallest: 'trống', smallestCount: 4, largest: 'chuông', largestCount: 11 },
    ]);
  });

  test('biên độ đỉnh là giá trị tuyệt đối lớn nhất', () => {
    expect(peakAmplitude([0.1, -0.7, 0.3])).toBe(0.7);
    expect(peakAmplitude([])).toBe(0);
  });
});
