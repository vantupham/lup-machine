import i18n from '@/i18n';
import { decimalToWords } from '@/core/lecture/vi-number-words';
import { lectureFormat } from './lecture-format';

const vi = lectureFormat(i18n.getFixedT('vi'), 'vi');
const en = lectureFormat(i18n.getFixedT('en'), 'en');

describe('lectureFormat', () => {
  test('số lớn: hiển thị có dấu tách nghìn theo ngôn ngữ, lời đọc không nhầm thành số thập phân', () => {
    expect(vi.count(410208)).toEqual({ display: '410.208', spoken: 'bốn trăm mười nghìn hai trăm linh tám' });
    expect(en.count(410208)).toEqual({ display: '410,208', spoken: '410,208' });
  });

  test('phần trăm và số thập phân', () => {
    expect(vi.percent(0.7222)).toEqual({ display: '72,2%', spoken: 'bảy mươi hai phẩy hai phần trăm' });
    expect(vi.percent(0.5, 0)).toEqual({ display: '50%', spoken: 'năm mươi phần trăm' });
    expect(vi.decimal(0.001, 6)).toEqual({ display: '0,001', spoken: 'không phẩy không không một' });
    expect(vi.points(0.228)).toEqual({ display: '22,8', spoken: 'hai mươi hai phẩy tám' });
  });

  test('chữ hiển thị và lời đọc luôn cùng một số sau khi làm tròn', () => {
    for (const [value, digits] of [
      [1.005, 2],
      [2.675, 2],
      [72.25, 1],
      [100, 0],
      [0.1 + 0.2, 2],
    ] as const) {
      const { display, spoken } = vi.decimal(value, digits);
      expect(spoken).toBe(decimalToWords(display.replaceAll('.', '')));
    }
    expect(vi.count(100)).toEqual({ display: '100', spoken: 'một trăm' });
  });

  test('số không hữu hạn (sai số bùng nổ) không làm hỏng kịch bản', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = vi.decimal(value, 2);
      expect(result.display).toBe(result.spoken);
      expect(result.display).not.toMatch(/NaN|Infinity|\d/);
    }
  });

  test('danh sách nối bằng "và" / "and"', () => {
    expect(vi.list(['A', 'B', 'C'])).toBe('A, B và C');
    expect(en.list(['A', 'B'])).toBe('A and B');
  });

  test('chữ số đứng riêng trong tên lớp được đọc thành chữ, chữ số trong tên riêng giữ nguyên', () => {
    const line = vi.line('lecture.image.data.perClass', { name: 'Lớp 1', train: vi.count(24), test: vi.count(6) });
    expect(line.display).toBe('Lớp 1: 24 ảnh huấn luyện, 6 ảnh kiểm tra.');
    expect(line.spoken).toBe('Lớp một: hai mươi tư ảnh huấn luyện, sáu ảnh kiểm tra.');
    const model = vi.line('lecture.image.network.size', { model: vi.term('MobileNetV2', 'MobileNet V hai'), layers: vi.count(155), params: vi.count(410208) });
    expect(model.display).toContain('MobileNetV2 có 155 tầng');
    expect(model.spoken).toContain('MobileNet V hai có một trăm năm mươi lăm tầng');
  });
});
