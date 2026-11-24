import { PRESENTATION_SCALES, presentationScale, readScaleIndex } from './presentation-store';

describe('cỡ chữ trình chiếu đã lưu', () => {
  afterEach(() => window.localStorage.clear());

  test('chưa lưu thì dùng cỡ mặc định 125%', () => {
    expect(presentationScale(readScaleIndex())).toBe(1.25);
  });

  test('đọc đúng cỡ đã lưu; giá trị hỏng hoặc ngoài khoảng thì dùng mặc định', () => {
    window.localStorage.setItem('lup.presentationScale', '0');
    expect(readScaleIndex()).toBe(0);
    for (const bad of ['', 'abc', '-1', '1.5', String(PRESENTATION_SCALES.length)]) {
      window.localStorage.setItem('lup.presentationScale', bad);
      expect(readScaleIndex()).toBe(1);
    }
  });
});
