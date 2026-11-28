import { EXPORT_FPS, frameCount, frameTime, megabytes, videoFileName } from './export-plan';

describe('export-plan', () => {
  test('số khung hình làm tròn lên, ít nhất 1', () => {
    expect(frameCount(2)).toBe(2 * EXPORT_FPS);
    expect(frameCount(2.01)).toBe(Math.ceil(2.01 * EXPORT_FPS));
    expect(frameCount(0)).toBe(1);
    expect(frameCount(Number.NaN)).toBe(1);
  });

  test('khung hình cuối không vượt quá độ dài video', () => {
    const duration = 104.5;
    const last = frameTime(frameCount(duration) - 1);
    expect(last).toBeLessThan(duration);
    expect(duration - last).toBeLessThanOrEqual(1 / EXPORT_FPS);
  });

  test('tên tệp theo tên dự án, khổ và định dạng', () => {
    expect(videoFileName('Bác sĩ lá đậu', '16:9', 'mp4')).toMatch(/-bai-giang-16x9\.mp4$/);
    expect(videoFileName('Bác sĩ lá đậu', '9:16', 'webm')).toMatch(/-bai-giang-9x16\.webm$/);
  });

  test('dung lượng MB một chữ số thập phân', () => {
    expect(megabytes(4_260_000)).toBe(4.3);
  });
});
