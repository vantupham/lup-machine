/**
 * Vết chạy các chương trình Python của Studio tư thế (`pose_features.py`: chuẩn hóa tọa độ khớp) và
 * Studio âm thanh (`audio_pool.py`: ảnh phổ mel → 160 số). Dùng đúng phép tính của trang
 * (src/core/pose/features.ts, src/core/audio/features.ts), nên vector trùng vector mô hình đang dùng.
 */
import { segmentBounds } from '@/core/audio/features';
import type { Keypoint } from '@/core/pose/detectors';
import { MIN_KEYPOINT_SCORE, normalizationFrame, type PoseKind } from '@/core/pose/features';
import { createProgram, lineOf, type PythonProgram } from './program';
import { pythonFixed, pythonStringList } from './python-format';
import { array, scalar, text, type TraceStep } from './trace-value';
import poseSource from './python/pose_features.py?raw';
import audioSource from './python/audio_pool.py?raw';

export const POSE_FEATURES_PROGRAM = createProgram('pose_features.py', poseSource);
export const AUDIO_POOL_PROGRAM = createProgram('audio_pool.py', audioSource);

const step = (line: number, changed: TraceStep['changed'] = {}, output?: string): TraceStep =>
  output === undefined ? { line, changed, epoch: 0 } : { line, changed, epoch: 0, output };

const linesOf = <K extends string>(program: PythonProgram, anchors: Record<K, string>) =>
  Object.fromEntries(Object.entries<string>(anchors).map(([k, a]) => [k, lineOf(program, a)])) as Record<K, number>;

// ── Tư thế ───────────────────────────────────────────────────────────────────────

const POSE = linesOf(POSE_FEATURES_PROGRAM, {
  inputs: '# Đầu vào',
  ifBody: 'if KIND == "body"',
  bodyCenter: 'cx, cy = (keypoints[11]',
  bodyUnit: 'ux, uy = (keypoints[5]',
  handCenter: 'cx, cy = keypoints[0]',
  handUnit: 'ux, uy = keypoints[9]',
  scale: 'scale = math.hypot(',
  init: 'features = []',
  loop: 'for (x, y, score), name in zip(',
  ifScore: 'if score >= MIN_SCORE',
  seen: 'features += [(x - cx)',
  missing: 'features += [0.0, 0.0]',
  print: 'print(f"{name}',
});

/** `else:` xuất hiện hai lần (khối KIND và khối score): lấy lần đầu cho KIND, lần sau cho score. */
const ELSE_LINES = POSE_FEATURES_PROGRAM.lines.flatMap((l, i) => (l.trim() === 'else:' ? [i] : []));

export interface PoseFeaturesInput {
  readonly kind: PoseKind;
  readonly keypoints: readonly Keypoint[];
  readonly names: readonly string[];
}

export function* tracePoseFeatures({ kind, keypoints, names }: PoseFeaturesInput): Generator<TraceStep, void, void> {
  yield step(POSE.inputs, {
    keypoints: text(`${keypoints.length} khớp, ví dụ (${pythonFixed(keypoints[0]?.x ?? 0, 0)}, ${pythonFixed(keypoints[0]?.y ?? 0, 0)}, ${pythonFixed(keypoints[0]?.score ?? 0, 2)})`),
    KIND: text(`'${kind}'`),
    NAMES: text(pythonStringList(names)),
    MIN_SCORE: scalar(MIN_KEYPOINT_SCORE),
  });
  const frame = normalizationFrame(kind, keypoints);
  if (!frame) return;
  yield step(POSE.ifBody);
  const unitIndex = kind === 'body' ? null : 9;
  const unit =
    unitIndex === null
      ? { x: (keypoints[5]!.x + keypoints[6]!.x) / 2, y: (keypoints[5]!.y + keypoints[6]!.y) / 2 }
      : { x: keypoints[unitIndex]!.x, y: keypoints[unitIndex]!.y };
  if (kind === 'body') {
    yield step(POSE.bodyCenter, { cx: scalar(frame.cx), cy: scalar(frame.cy) });
    yield step(POSE.bodyUnit, { ux: scalar(unit.x), uy: scalar(unit.y) });
  } else {
    yield step(ELSE_LINES[0]!);
    yield step(POSE.handCenter, { cx: scalar(frame.cx), cy: scalar(frame.cy) });
    yield step(POSE.handUnit, { ux: scalar(unit.x), uy: scalar(unit.y) });
  }
  yield step(POSE.scale, { scale: scalar(frame.scale) });
  const features: number[] = [];
  yield step(POSE.init, { features: text('[]') });
  for (const [i, k] of keypoints.entries()) {
    yield step(POSE.loop, { x: scalar(k.x), y: scalar(k.y), score: scalar(k.score), name: text(`'${names[i]}'`) });
    yield step(POSE.ifScore);
    if (k.score >= MIN_KEYPOINT_SCORE) {
      features.push((k.x - frame.cx) / frame.scale, (k.y - frame.cy) / frame.scale);
      yield step(POSE.seen, { features: array(features.slice(-2), { shape: [features.length], view: 'features[-2:]', size: 2 }) });
    } else {
      features.push(0, 0);
      yield step(ELSE_LINES[1]!);
      yield step(POSE.missing, { features: array([0, 0], { shape: [features.length], view: 'features[-2:]', size: 2 }) });
    }
    yield step(POSE.print, {}, `${names[i]}: (${pythonFixed(k.x, 0)}, ${pythonFixed(k.y, 0)}) → (${pythonFixed(features.at(-2)!, 2)}, ${pythonFixed(features.at(-1)!, 2)})`);
  }
}

// ── Âm thanh ─────────────────────────────────────────────────────────────────────

const AUDIO = linesOf(AUDIO_POOL_PROGRAM, {
  inputs: '# Đầu vào',
  shape: 'bands, frames = db.shape',
  bounds: 'bounds = [int(',
  init: 'features = np.zeros(',
  loop: 'for s in range(SEGMENTS)',
  part: 'part = db[:, bounds[s]',
  mean: 'features[s * bands:(s + 1) * bands] = part.mean(',
  print: 'print(f"phần {s + 1}',
});

export interface AudioPoolInput {
  /** Ảnh phổ mel (dB): db[dải][khung]. */
  readonly db: readonly ArrayLike<number>[];
  readonly segments: number;
}

export function* traceAudioPool({ db, segments }: AudioPoolInput): Generator<TraceStep, void, void> {
  const bands = db.length;
  const frames = db[0]?.length ?? 0;
  yield step(AUDIO.inputs, { db: array(db[0] ?? [], { shape: [bands, frames], view: 'db[0, :3]' }), SEGMENTS: scalar(segments, true) });
  yield step(AUDIO.shape, { bands: scalar(bands, true), frames: scalar(frames, true) });
  const bounds = segmentBounds(frames, segments);
  yield step(AUDIO.bounds, { bounds: array(bounds, { shape: [bounds.length], isInt: true, size: bounds.length }) });
  const features = new Array<number>(segments * bands).fill(0);
  yield step(AUDIO.init, { features: array(features, { shape: [features.length] }) });
  for (let s = 0; s < segments; s++) {
    yield step(AUDIO.loop, { s: scalar(s, true) });
    const from = bounds[s]!;
    const to = bounds[s + 1]!;
    yield step(AUDIO.part, { part: array(Array.from(db[0] ?? []).slice(from, to), { shape: [bands, to - from], view: 'part[0, :3]' }) });
    db.forEach((row, m) => {
      let sum = 0;
      for (let t = from; t < to; t++) sum += row[t] as number;
      features[s * bands + m] = sum / Math.max(1, to - from);
    });
    yield step(AUDIO.mean, { features: array(features.slice(s * bands, (s + 1) * bands), { shape: [features.length], view: `features[${s * bands}:]` }) });
    yield step(AUDIO.print, {}, `phần ${s + 1}: khung ${from} đến ${to - 1}, dải thấp nhất ${pythonFixed(features[s * bands]!, 1)} dB`);
  }
}
