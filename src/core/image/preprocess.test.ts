import {
  centerCropBox,
  MODEL_INPUT_SIZE,
  normalizePixelValue,
  rgbaToModelInput,
  readPixel,
  type RgbaImage,
} from './preprocess';

function solidImage(width: number, height: number, rgba: readonly number[]): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set(rgba, i * 4);
  return { width, height, data };
}

describe('centerCropBox', () => {
  test('ảnh ngang: cắt hình vuông ở giữa theo chiều cao', () => {
    expect(centerCropBox(640, 480)).toEqual({ sx: 80, sy: 0, size: 480 });
  });
  test('ảnh dọc: cắt theo chiều rộng', () => {
    expect(centerCropBox(300, 500)).toEqual({ sx: 0, sy: 100, size: 300 });
  });
  test('ảnh vuông: giữ nguyên', () => {
    expect(centerCropBox(224, 224)).toEqual({ sx: 0, sy: 0, size: 224 });
  });
  test('từ chối kích thước không hợp lệ', () => {
    expect(() => centerCropBox(0, 10)).toThrow(RangeError);
    expect(() => centerCropBox(10, Number.NaN)).toThrow(RangeError);
  });
});

describe('normalizePixelValue', () => {
  test.each([
    [0, -1],
    [255, 1],
    [127.5, 0],
  ])('%s → %s', (input, expected) => {
    expect(normalizePixelValue(input)).toBeCloseTo(expected, 10);
  });
});

describe('rgbaToModelInput', () => {
  test('bỏ kênh alpha và chuẩn hóa về [-1, 1]', () => {
    const img = solidImage(2, 1, [0, 255, 51, 128]);
    const out = rgbaToModelInput(img);
    expect(out).toBeInstanceOf(Float32Array);
    expect(out).toHaveLength(2 * 1 * 3);
    expect(Array.from(out.slice(0, 3)).map((v) => +v.toFixed(4))).toEqual([-1, 1, -0.6]);
  });

  test('ảnh 224×224 tạo ra đúng 150.528 giá trị', () => {
    const img = solidImage(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, [10, 20, 30, 255]);
    expect(rgbaToModelInput(img)).toHaveLength(224 * 224 * 3);
  });

  test('từ chối dữ liệu sai kích thước', () => {
    expect(() =>
      rgbaToModelInput({ width: 2, height: 2, data: new Uint8ClampedArray(4) }),
    ).toThrow(RangeError);
  });
});

describe('readPixel', () => {
  test('đọc RGBA tại tọa độ (x, y)', () => {
    const data = new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 255, 7, 8, 9, 255, 10, 11, 12, 255]);
    const img: RgbaImage = { width: 2, height: 2, data };
    expect(readPixel(img, 1, 0)).toEqual({ r: 4, g: 5, b: 6, a: 255 });
    expect(readPixel(img, 0, 1)).toEqual({ r: 7, g: 8, b: 9, a: 255 });
  });
  test('báo lỗi khi tọa độ nằm ngoài ảnh', () => {
    const img = solidImage(2, 2, [0, 0, 0, 255]);
    expect(() => readPixel(img, 2, 0)).toThrow(RangeError);
    expect(() => readPixel(img, 0, -1)).toThrow(RangeError);
  });
});
