import { audioFeatures, AUDIO, fitClip } from './features';
import {
  vectorRelativeScore,
  contributionMap,
  evaluateVectors,
  importanceMap,
  predictVector,
  prepareVectors,
  encodeVector,
  trainVectorModel,
  type VectorData,
  type VectorExample,
} from '@/core/ml/vector-classifier';
import { SOUND_KINDS, soundDataset } from './synthetic-sounds';

const examples: VectorExample[] = soundDataset(1).map((s, i) => ({
  id: `c${i}`,
  label: SOUND_KINDS.indexOf(s.kind),
  features: audioFeatures(fitClip(s.signal)),
}));

function prepared(): VectorData {
  const r = prepareVectors(examples, ['chuông', 'còi', 'trống'], { testRatio: 0.25, seed: 4 });
  if (!r.ok) throw new Error(r.error.code);
  return r.data;
}

const data = prepared();

describe('prepareVectors', () => {
  test('chia phân tầng, chuẩn hóa theo tập Dạy (trung bình 0, độ lệch chuẩn 1)', () => {
    expect(data.train.ys.length + data.test.ys.length).toBe(48);
    expect(new Set(data.test.ys)).toEqual(new Set([0, 1, 2]));
    const col = data.train.xs.map((x) => x[17]!);
    const m = col.reduce((a, b) => a + b, 0) / col.length;
    expect(m).toBeCloseTo(0, 9);
    expect(Math.sqrt(col.reduce((s, v) => s + (v - m) ** 2, 0) / col.length)).toBeCloseTo(1, 9);
  });

  test('báo lỗi khi quá ít đoạn hoặc chỉ một lớp', () => {
    expect(prepareVectors(examples.slice(0, 3), ['a'], { testRatio: 0.2, seed: 1 })).toMatchObject({ ok: false, error: { code: 'too-few-samples' } });
    expect(prepareVectors(examples.slice(0, 10), ['a'], { testRatio: 0.2, seed: 1 })).toMatchObject({ ok: false, error: { code: 'single-class' } });
  });
});

describe.each(['logistic', 'knn'] as const)('mô hình %s', (kind) => {
  const trained = trainVectorModel(data, { kind, c: 1, k: 3 });

  test('nhận ra âm thanh mới của 3 loại (≥ 80% tập Kiểm tra và âm thanh mới)', () => {
    const ev = evaluateVectors(trained, data);
    expect(ev.testAccuracy).toBeGreaterThanOrEqual(0.8);
    const fresh = soundDataset(7).filter((_, i) => i % 4 === 0);
    const correct = fresh.filter((s) => predictVector(trained, encodeVector(data, audioFeatures(fitClip(s.signal)))).label === SOUND_KINDS.indexOf(s.kind));
    expect(correct.length / fresh.length).toBeGreaterThanOrEqual(0.8);
  });
});

describe('bản đồ vùng phổ (hồi quy logistic)', () => {
  const trained = trainVectorModel(data, { kind: 'logistic', c: 1, k: 3 });

  test('đóng góp của 160 ô cộng với phần cố định đúng bằng điểm của lớp', () => {
    if (trained.kind !== 'logistic') throw new Error('sai loại');
    const x = data.test.xs[0]!;
    for (let c = 0; c < 3; c++) {
      const map = contributionMap(trained, x, c)!;
      expect(map.cells).toHaveLength(AUDIO.nMels * AUDIO.timeSegments);
      expect(map.total).toBeCloseTo(vectorRelativeScore(trained.model, x, c), 9);
    }
  });

  test('còi: các dải tần cao có trọng số dương lớn hơn dải thấp', () => {
    const w = importanceMap(trained, 1)!;
    const band = (m: number) => [0, 1, 2, 3].reduce((s, seg) => s + w[seg * AUDIO.nMels + m]!, 0);
    const high = [30, 31, 32, 33].reduce((s, m) => s + band(m), 0);
    const low = [0, 1, 2, 3].reduce((s, m) => s + band(m), 0);
    expect(high).toBeGreaterThan(low);
  });

  test('k-NN không có bản đồ trọng số', () => {
    const knn = trainVectorModel(data, { kind: 'knn', c: 1, k: 3 });
    expect(importanceMap(knn, 0)).toBeNull();
    expect(contributionMap(knn, data.test.xs[0]!, 0)).toBeNull();
    expect(predictVector(knn, { raw: data.test.raw[0]!, scaled: data.test.xs[0]! }).neighbors).toHaveLength(3);
  });
});
