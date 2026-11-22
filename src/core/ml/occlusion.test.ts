import { createRng } from '@/core/random/seeded-rng';
import type { RgbaImage } from '@/core/image/preprocess';
import { computeLogits, initParams, softmax, type SoftmaxParams } from './softmax-regression';
import { OCCLUSION_FILL, occludeImage, occlusionDrops, occlusionGrid } from './occlusion';

function image(size: number, value: number): RgbaImage {
  const data = new Uint8ClampedArray(size * size * 4).fill(value);
  return { width: size, height: size, data };
}

function params(seed: number): SoftmaxParams {
  return initParams(3, 2, createRng(seed));
}

describe('occlusionGrid', () => {
  test('chia ảnh thành lưới ô vuông theo thứ tự hàng (trái → phải, trên → dưới)', () => {
    const boxes = occlusionGrid(224, 7);
    expect(boxes).toHaveLength(49);
    expect(boxes[0]).toEqual({ x: 0, y: 0, size: 32 });
    expect(boxes[1]).toEqual({ x: 32, y: 0, size: 32 });
    expect(boxes[7]).toEqual({ x: 0, y: 32, size: 32 });
    expect(boxes[48]).toEqual({ x: 192, y: 192, size: 32 });
  });

  test('từ chối lưới không chia hết kích thước ảnh', () => {
    expect(() => occlusionGrid(224, 5)).toThrow(RangeError);
    expect(() => occlusionGrid(224, 0)).toThrow(RangeError);
  });
});

describe('occludeImage', () => {
  test('tô xám đúng một ô, giữ nguyên phần còn lại và không sửa ảnh gốc', () => {
    const original = image(4, 200);
    const covered = occludeImage(original, { x: 2, y: 0, size: 2 });
    const px = (img: RgbaImage, x: number, y: number) => Array.from(img.data.slice((y * 4 + x) * 4, (y * 4 + x) * 4 + 4));
    expect(px(covered, 2, 0)).toEqual([OCCLUSION_FILL, OCCLUSION_FILL, OCCLUSION_FILL, 255]);
    expect(px(covered, 3, 1)).toEqual([OCCLUSION_FILL, OCCLUSION_FILL, OCCLUSION_FILL, 255]);
    expect(px(covered, 1, 0)).toEqual([200, 200, 200, 200]);
    expect(px(covered, 2, 2)).toEqual([200, 200, 200, 200]);
    expect(original.data.every((v) => v === 200)).toBe(true);
  });

  test('từ chối ô nằm ngoài ảnh', () => {
    expect(() => occludeImage(image(4, 0), { x: 3, y: 0, size: 2 })).toThrow(RangeError);
  });
});

describe('occlusionDrops', () => {
  test('độ giảm = xác suất ảnh gốc − xác suất khi che ô đó (phép đo trực tiếp)', () => {
    const p = params(1);
    const base = Float32Array.from([1, 0, 2]);
    const occluded = [Float32Array.from([0, 0, 0]), Float32Array.from([1, 0, 2]), Float32Array.from([3, 1, -1])];
    const result = occlusionDrops(p, base, occluded, 1);
    const prob = (v: Float32Array) => softmax(computeLogits(p, v))[1]!;
    expect(result.baseProb).toBeCloseTo(prob(base), 12);
    expect(result.drops).toHaveLength(3);
    occluded.forEach((v, i) => expect(result.drops[i]).toBeCloseTo(prob(base) - prob(v), 12));
    expect(result.drops[1]).toBe(0); // che mà vector không đổi → không ảnh hưởng
  });

  test('từ chối lớp không tồn tại', () => {
    expect(() => occlusionDrops(params(2), new Float32Array(3), [], 5)).toThrow(RangeError);
  });
});
