import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import type { RgbaImage } from '@/core/image/preprocess';
import { evaluateVectors, prepareVectors, trainVectorModel } from '@/core/ml/vector-classifier';
import { BODY_KEYPOINTS, createBodyDetector, createHandDetector, HAND_KEYPOINTS, letterboxBox, loadPoseModel } from './detectors';
import { MIN_KEYPOINT_SCORE, normalizationFrame, packKeypoints, perJoint, poseFeatures, unpackKeypoints } from './features';
import { BODY_POSES, HAND_POSES, poseDataset, synthesizePose } from './synthetic-poses';

function modelFromDisk(id: string): tf.io.IOHandler {
  const dir = join(process.cwd(), 'public', 'models', id);
  const manifest = JSON.parse(readFileSync(join(dir, 'model.json'), 'utf8'));
  const buf = Buffer.concat(manifest.weightsManifest[0].paths.map((p: string) => readFileSync(join(dir, p))));
  return tf.io.fromMemory({
    modelTopology: manifest.modelTopology,
    weightSpecs: manifest.weightsManifest[0].weights,
    weightData: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    format: manifest.format,
    signature: manifest.signature,
  });
}

function photo(name: string, width: number, height: number): RgbaImage {
  const raw = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'photos', `${name}.rgb`));
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([raw[i * 3]!, raw[i * 3 + 1]!, raw[i * 3 + 2]!, 255], i * 4);
  return { width, height, data };
}

const idx = (name: string) => (BODY_KEYPOINTS as readonly string[]).indexOf(name);

describe('MoveNet trên ảnh thật (người đứng, phạm vi công cộng)', () => {
  let keypoints: Awaited<ReturnType<ReturnType<typeof createBodyDetector>>>;
  beforeAll(async () => {
    await tf.setBackend('cpu');
    keypoints = await createBodyDetector(await loadPoseModel(modelFromDisk('movenet-lightning-4')))(photo('person-standing', 320, 438));
  }, 60_000);

  test('17 khớp, tọa độ theo pixel của ảnh gốc, thứ tự từ đầu xuống chân', () => {
    expect(keypoints).toHaveLength(17);
    const y = (n: string) => keypoints[idx(n)]!.y;
    expect(y('nose')).toBeLessThan(y('leftShoulder'));
    expect(y('leftShoulder')).toBeLessThan(y('leftHip'));
    expect(y('leftHip')).toBeLessThan(y('leftKnee'));
    expect(y('leftKnee')).toBeLessThan(y('leftAnkle'));
    for (const k of keypoints) {
      expect(k.x).toBeGreaterThanOrEqual(0);
      expect(k.x).toBeLessThanOrEqual(320);
    }
  });

  test('người quay mặt về máy ảnh: khớp bên phải người nằm bên trái ảnh', () => {
    expect(keypoints[idx('rightShoulder')]!.x).toBeLessThan(keypoints[idx('leftShoulder')]!.x);
    expect(keypoints[idx('rightHip')]!.x).toBeLessThan(keypoints[idx('leftHip')]!.x);
  });

  test('vị trí khớp khớp với ảnh: mũi ở khoảng (138, 86), đủ tin cậy để chuẩn hóa', () => {
    const nose = keypoints[idx('nose')]!;
    expect(Math.hypot(nose.x - 138, nose.y - 86)).toBeLessThan(15);
    expect(poseFeatures('body', keypoints)).toHaveLength(34);
  });
});

describe('Hand Landmark trên ảnh thật (CC BY-SA 4.0)', () => {
  test('nhận ra có bàn tay; cổ tay ở dưới, đầu ngón giữa ở trên; ô trống thì xác suất thấp', async () => {
    await tf.setBackend('cpu');
    const detect = createHandDetector(await loadPoseModel(modelFromDisk('hand-landmark-lite-1')));
    const image = photo('open-hand', 240, 320);
    const { keypoints, handScore } = await detect(image, letterboxBox(240, 320));
    expect(keypoints).toHaveLength(21);
    expect(handScore).toBeGreaterThan(0.8);
    const wrist = keypoints[0]!;
    const middleTip = keypoints[(HAND_KEYPOINTS as readonly string[]).indexOf('middleTip')]!;
    expect(wrist.y).toBeGreaterThan(middleTip.y + 80);
    expect(Math.abs(wrist.x - 125)).toBeLessThan(40); // cổ tay ở giữa ảnh theo chiều ngang
    const blank: RgbaImage = { width: 100, height: 100, data: new Uint8ClampedArray(100 * 100 * 4).fill(200) };
    expect((await detect(blank, letterboxBox(100, 100))).handScore).toBeLessThan(0.1);
  }, 60_000);
});

describe('đặc trưng tư thế', () => {
  const sample = synthesizePose('body', 'arms-out', 3).keypoints;

  test('không đổi khi người dịch chuyển hoặc đứng gần / xa máy ảnh', () => {
    const moved = sample.map((k) => ({ ...k, x: k.x * 1.7 + 40, y: k.y * 1.7 - 25 }));
    const a = poseFeatures('body', sample)!;
    const b = poseFeatures('body', moved)!;
    a.forEach((v, i) => expect(b[i]).toBeCloseTo(v, 9));
  });

  test('gốc ở giữa hông, vai cách hông đúng 1 đơn vị', () => {
    const f = poseFeatures('body', sample)!;
    const hips = [(f[22]! + f[24]!) / 2, (f[23]! + f[25]!) / 2];
    const shoulders = [(f[10]! + f[12]!) / 2, (f[11]! + f[13]!) / 2];
    expect(hips[0]).toBeCloseTo(0, 9);
    expect(Math.hypot(shoulders[0]! - hips[0]!, shoulders[1]! - hips[1]!)).toBeCloseTo(1, 9);
  });

  test('khớp không thấy rõ được đặt về 0; thiếu vai / hông thì không chuẩn hóa được', () => {
    const hiddenAnkle = sample.map((k, i) => (i === 16 ? { ...k, score: MIN_KEYPOINT_SCORE / 2 } : k));
    expect(poseFeatures('body', hiddenAnkle)!.slice(32)).toEqual([0, 0]);
    expect(poseFeatures('body', sample.map((k, i) => (i === 11 ? { ...k, score: 0 } : k)))).toBeNull();
    expect(normalizationFrame('hand', synthesizePose('hand', 'open', 1).keypoints.map((k) => ({ ...k, score: 0 })))).toBeNull();
    expect(poseFeatures('body', sample.slice(0, 5))).toBeNull();
  });

  test('đóng gói / mở gói tọa độ và gộp theo khớp', () => {
    expect(unpackKeypoints(packKeypoints(sample))).toEqual(sample);
    expect(perJoint([1, 2, 3, 4])).toEqual([3, 7]);
  });
});

describe('tư thế giả lập', () => {
  test.each([['body', BODY_POSES.length], ['hand', HAND_POSES.length]] as const)('%s: phân biệt được các tư thế mới (≥ 90%)', (kind, numClasses) => {
    const poses = kind === 'body' ? BODY_POSES : HAND_POSES;
    const toExamples = (seed: number) =>
      poseDataset(kind, seed).map((p, i) => ({ id: `${seed}-${i}`, label: (poses as readonly string[]).indexOf(p.pose), features: poseFeatures(kind, p.keypoints)! }));
    const prepared = prepareVectors([...toExamples(1), ...toExamples(2)], poses, { testRatio: 0.3, seed: 1 });
    if (!prepared.ok) throw new Error(prepared.error.code);
    for (const model of ['logistic', 'knn'] as const) {
      const ev = evaluateVectors(trainVectorModel(prepared.data, { kind: model, c: 1, k: 3 }), prepared.data);
      expect(ev.testAccuracy).toBeGreaterThanOrEqual(0.9);
    }
    expect(prepared.data.classNames).toHaveLength(numClasses);
  });

  test('tái lập theo seed; đôi khi cổ chân ra ngoài khung (độ tin cậy thấp)', () => {
    expect(synthesizePose('hand', 'fist', 5)).toEqual(synthesizePose('hand', 'fist', 5));
    const hidden = poseDataset('body').filter((p) => p.keypoints[15]!.score < MIN_KEYPOINT_SCORE);
    expect(hidden.length).toBeGreaterThan(0);
    expect(poseDataset('body').every((p) => poseFeatures('body', p.keypoints) !== null)).toBe(true);
  });
});
