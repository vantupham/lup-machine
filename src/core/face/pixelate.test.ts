import { expandRegion, pixelateRegions } from './pixelate';

function gradient(width: number, height: number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set([x * 10, y * 10, (x + y) % 256, 200], (y * width + x) * 4);
  return { width, height, data };
}

const pixelAt = (data: Uint8ClampedArray, width: number, x: number, y: number) => Array.from(data.subarray((y * width + x) * 4, (y * width + x) * 4 + 4));

describe('pixelateRegions', () => {
  test('mỗi ô trong vùng mang một màu trung bình; ngoài vùng và kênh alpha giữ nguyên; ảnh gốc không đổi', () => {
    const img = gradient(10, 10);
    const before = new Uint8ClampedArray(img.data);
    const out = pixelateRegions(img, [{ x: 2, y: 2, width: 4, height: 4 }], { margin: 0, blocks: 2 });
    expect(img.data).toEqual(before);
    // ô 2×2 đầu tiên: trung bình của x = 2..3, y = 2..3
    expect(pixelAt(out.data, 10, 2, 2)).toEqual([25, 25, 5, 200]);
    expect(pixelAt(out.data, 10, 3, 3)).toEqual(pixelAt(out.data, 10, 2, 2));
    expect(pixelAt(out.data, 10, 4, 2)).not.toEqual(pixelAt(out.data, 10, 2, 2));
    expect(pixelAt(out.data, 10, 0, 0)).toEqual(pixelAt(before, 10, 0, 0));
    expect(pixelAt(out.data, 10, 6, 6)).toEqual(pixelAt(before, 10, 6, 6));
  });

  test('vùng được nới rộng theo margin và cắt theo mép ảnh; vùng nằm ngoài ảnh bị bỏ qua', () => {
    expect(expandRegion({ x: 10, y: 10, width: 20, height: 20 }, 100, 100, 0.25)).toEqual({ x: 5, y: 5, width: 30, height: 30 });
    expect(expandRegion({ x: -5, y: 90, width: 20, height: 20 }, 100, 100, 0)).toEqual({ x: 0, y: 90, width: 15, height: 10 });
    expect(expandRegion({ x: 200, y: 200, width: 5, height: 5 }, 100, 100, 0)).toBeNull();
    const img = gradient(4, 4);
    expect(pixelateRegions(img, [{ x: 50, y: 50, width: 5, height: 5 }]).data).toEqual(img.data);
  });
});
