import '@tensorflow/tfjs-backend-cpu';
import { loadGraphModel } from '@tensorflow/tfjs-converter';
import type { RgbaImage } from '@/core/image/preprocess';
import { cropImage, modelFromDisk, photo } from '../../../tests/setup/model-fixtures';
import { createFaceDetector, decodeBoxes, generateAnchors, iou, nonMaxSuppression, OFFSETS, type FaceBox } from './blazeface';
import { pixelateRegions } from './pixelate';

describe('anchor và giải mã', () => {
  test('896 anchor: lưới 16×16 × 2 rồi lưới 8×8 × 6, tâm ô lệch 0,5', () => {
    const anchors = generateAnchors();
    expect(anchors).toHaveLength(896);
    expect(anchors[0]).toEqual({ x: 0.5 / 16, y: 0.5 / 16 });
    expect(anchors[1]).toEqual(anchors[0]);
    expect(anchors[512]).toEqual({ x: 0.5 / 8, y: 0.5 / 8 });
    expect(anchors[517]).toEqual(anchors[512]);
    expect(anchors[518]).toEqual({ x: 1.5 / 8, y: 0.5 / 8 });
  });

  test('giải mã một anchor: điểm ở đầu, tọa độ theo pixel của ô 128 tính từ tâm anchor', () => {
    const raw = new Float32Array(896 * 17).fill(-10);
    const o = 512 * 17; // anchor đầu tiên của lưới 8×8, tâm (1/16, 1/16)
    raw[o + OFFSETS.score] = 3;
    raw[o + OFFSETS.cx] = 16;
    raw[o + OFFSETS.cy] = 0;
    raw[o + OFFSETS.width] = 32;
    raw[o + OFFSETS.height] = 32;
    const boxes = decodeBoxes(raw);
    expect(boxes).toHaveLength(1);
    const box = boxes[0]!;
    expect(box.x).toBeCloseTo(0.0625 + 0.125 - 0.125);
    expect(box.y).toBeCloseTo(0.0625 - 0.125);
    expect(box.width).toBeCloseTo(0.25);
    expect(box.score).toBeCloseTo(1 / (1 + Math.exp(-3)));
  });

  test('lọc trùng: giữ khung tin cậy cao nhất trong cụm chồng lên nhau', () => {
    const a = { x: 0, y: 0, width: 1, height: 1, score: 0.9 };
    const b = { x: 0.1, y: 0, width: 1, height: 1, score: 0.8 };
    const c = { x: 5, y: 5, width: 1, height: 1, score: 0.7 };
    expect(iou(a, b)).toBeCloseTo(0.9 / 1.1);
    expect(nonMaxSuppression([b, c, a])).toEqual([a, c]);
  });
});

// Ảnh thật phạm vi công cộng (tests/fixtures/photos/README.md); mũi người ở khoảng (138, 86) theo MoveNet.
describe('BlazeFace trên ảnh thật', () => {
  const full = photo('person-standing', 320, 438);
  const NOSE = { x: 138, y: 86 };
  let detect: (image: RgbaImage) => Promise<FaceBox[]>;

  beforeAll(async () => {
    detect = createFaceDetector(await loadGraphModel(modelFromDisk('face-detection-short-1')));
  }, 60_000);

  test.each([
    [58, 6, 160],
    [78, 26, 120],
    [98, 41, 80],
  ])('ảnh cắt quanh đầu (%i, %i, cạnh %i): đúng một khuôn mặt, khung bao trọn mũi', async (x0, y0, size) => {
    const faces = await detect(cropImage(full, x0, y0, size, size));
    expect(faces).toHaveLength(1);
    const f = faces[0]!;
    expect(f.score).toBeGreaterThan(0.8);
    expect(x0 + f.x).toBeLessThan(NOSE.x);
    expect(x0 + f.x + f.width).toBeGreaterThan(NOSE.x);
    expect(y0 + f.y).toBeLessThan(NOSE.y);
    expect(y0 + f.y + f.height).toBeGreaterThan(NOSE.y);
    expect(f.width).toBeGreaterThan(20);
    expect(f.width).toBeLessThan(45);
  });

  test('ô trắng và ảnh bàn tay: không có khuôn mặt', async () => {
    expect(await detect({ width: 128, height: 128, data: new Uint8ClampedArray(128 * 128 * 4).fill(255) })).toEqual([]);
    expect(await detect(photo('open-hand', 240, 320))).toEqual([]);
  });

  test('giới hạn đã biết: khuôn mặt quá nhỏ trong ảnh (người đứng xa, mặt ~7% chiều cao) không được phát hiện', async () => {
    expect(await detect(full)).toEqual([]);
  });

  test('sau khi pixel hóa vùng khuôn mặt, mô hình không còn thấy khuôn mặt', async () => {
    const image = cropImage(full, 78, 26, 120, 120);
    const faces = await detect(image);
    expect(faces).toHaveLength(1);
    expect(await detect(pixelateRegions(image, faces))).toEqual([]);
  });
});
