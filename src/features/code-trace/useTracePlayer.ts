import { useCallback, useEffect, useRef, useState } from 'react';
import type { TraceStep } from '@/core/trace/softmax-trace';
import type { TraceValue } from '@/core/trace/trace-value';

export type TraceSpeed = 'slow' | 'medium' | 'fast';
export const TRACE_SPEEDS: readonly TraceSpeed[] = ['slow', 'medium', 'fast'];
/** Thời gian giữa hai dòng khi bấm Chạy. */
export const SPEED_DELAY_MS: Record<TraceSpeed, number> = { slow: 900, medium: 300, fast: 40 };
/** Màn hình chỉ giữ chừng này dòng in gần nhất. */
export const MAX_OUTPUT_LINES = 200;
/** Chặn vòng lặp "chạy đến hết epoch" nếu vết không bao giờ in (phòng lỗi). */
const MAX_STEPS_PER_JUMP = 100_000;

export type TraceFactory = () => Generator<TraceStep, unknown, void>;

export interface PlayerState {
  readonly step: TraceStep | null;
  /** Giá trị hiện tại của mọi biến, theo thứ tự xuất hiện. */
  readonly vars: readonly (readonly [string, TraceValue])[];
  readonly changed: readonly string[];
  readonly output: readonly string[];
  readonly isFinished: boolean;
}

export const INITIAL_STATE: PlayerState = { step: null, vars: [], changed: [], output: [], isFinished: false };

/** Áp một bước vào trạng thái (trả về bản mới, không sửa bản cũ). */
export function applyStep(state: PlayerState, step: TraceStep): PlayerState {
  const changed = Object.keys(step.changed);
  const updated = state.vars.map(([name, value]): readonly [string, TraceValue] => [name, step.changed[name] ?? value]);
  const known = new Set(state.vars.map(([name]) => name));
  const added = changed.filter((name) => !known.has(name)).map((name): readonly [string, TraceValue] => [name, step.changed[name]!]);
  const output = step.output === undefined ? state.output : [...state.output, step.output].slice(-MAX_OUTPUT_LINES);
  return { step, vars: [...updated, ...added], changed, output, isFinished: false };
}

/**
 * Điều khiển việc phát lại vết chạy: từng dòng, chạy liên tục theo tốc độ, chạy đến khi in (hết epoch), về đầu.
 * Vết là generator lười: chỉ tính dòng tiếp theo khi cần. Lần huấn luyện mới thì nơi dùng đổi `key` để bắt đầu lại.
 */
export function useTracePlayer(create: TraceFactory) {
  const [state, setState] = useState<PlayerState>(INITIAL_STATE);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<TraceSpeed>('medium');
  const generatorRef = useRef<Generator<TraceStep, unknown, void> | null>(null);
  /** Bản sao trạng thái để lấy bước tiếp theo NGOÀI hàm cập nhật của React (generator không được chạy hai lần). */
  const stateRef = useRef<PlayerState>(INITIAL_STATE);

  const commit = useCallback((next: PlayerState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const advance = useCallback(
    (untilOutput: boolean) => {
      if (stateRef.current.isFinished) return;
      generatorRef.current ??= create();
      const gen = generatorRef.current;
      let next = stateRef.current;
      for (let i = 0; i < MAX_STEPS_PER_JUMP; i++) {
        const result = gen.next();
        if (result.done) {
          next = { ...next, changed: [], isFinished: true };
          break;
        }
        next = applyStep(next, result.value);
        if (!untilOutput || result.value.output !== undefined) break;
      }
      commit(next);
    },
    [create, commit],
  );

  const reset = useCallback(() => {
    generatorRef.current = null;
    setIsPlaying(false);
    commit(INITIAL_STATE);
  }, [commit]);

  useEffect(() => {
    if (!isPlaying || state.isFinished) return;
    const timer = window.setTimeout(() => advance(false), SPEED_DELAY_MS[speed]);
    return () => window.clearTimeout(timer);
  }, [isPlaying, state, speed, advance]);

  return {
    state,
    isPlaying: isPlaying && !state.isFinished,
    speed,
    setSpeed,
    stepOnce: () => advance(false),
    runToOutput: () => advance(true),
    play: () => setIsPlaying(true),
    pause: () => setIsPlaying(false),
    reset,
  };
}
