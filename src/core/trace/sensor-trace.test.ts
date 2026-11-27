import { poolFeatures } from '@/core/audio/features';
import { poseFeatures } from '@/core/pose/features';
import ref from './sensor.reference.json';
import { AUDIO_POOL_PROGRAM, POSE_FEATURES_PROGRAM, traceAudioPool, tracePoseFeatures } from './sensor-trace';
import type { TraceStep } from './trace-value';

const all = (gen: Generator<TraceStep, unknown, void>) => [...(gen as Iterable<TraceStep>)];
const outputs = (steps: readonly TraceStep[]) => steps.flatMap((s) => (s.output ? [s.output] : []));
const keypointsOf = (rows: readonly (readonly number[])[]) => rows.map(([x, y, score]) => ({ x: x!, y: y!, score: score! }));

describe('pose_features.py khớp bản Python và đặc trưng của trang', () => {
  test.each([
    ['body', ref.body],
    ['hand', ref.hand],
  ] as const)('%s: cùng dòng in; giá trị in trùng poseFeatures', (kind, c) => {
    const keypoints = keypointsOf(c.keypoints);
    const steps = all(tracePoseFeatures({ kind, keypoints, names: c.names }));
    expect(outputs(steps)).toEqual(c.output);
    for (const s of steps) expect(POSE_FEATURES_PROGRAM.lines[s.line]).toBeDefined();
    const features = poseFeatures(kind, keypoints)!;
    expect(c.output[2]).toContain(`(${features[4]!.toFixed(2)}, ${features[5]!.toFixed(2)})`);
  });

  test('không đủ vai / hông tin cậy: dừng sau phần đầu vào (trang cũng không chuẩn hóa được)', () => {
    const keypoints = keypointsOf(ref.body.keypoints).map((k, i) => (i === 5 ? { ...k, score: 0.1 } : k));
    expect(all(tracePoseFeatures({ kind: 'body', keypoints, names: ref.body.names }))).toHaveLength(1);
  });
});

describe('audio_pool.py khớp bản Python và đặc trưng của trang', () => {
  const db = ref.audio.db.map((row) => Float64Array.from(row));

  test('cùng dòng in (ranh giới 48,5 làm tròn thành 49 như trình duyệt)', () => {
    const steps = all(traceAudioPool({ db, segments: 4 }));
    expect(outputs(steps)).toEqual(ref.audio.output);
    for (const s of steps) expect(AUDIO_POOL_PROGRAM.lines[s.line]).toBeDefined();
    expect(ref.audio.output[1]).toContain('khung 24 đến 48');
  });

  test('160 số giống poolFeatures của trang', () => {
    const pooled = poolFeatures(db);
    expect(ref.audio.output[2]).toContain(`${pooled[80]!.toFixed(1)} dB`);
  });
});
