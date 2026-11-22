import { useCallback, useEffect, useRef, useState } from 'react';
import {
  trainSoftmax,
  type EpochSnapshot,
  type LabeledVectors,
  type TrainOptions,
} from '@/core/ml/softmax-regression';

export type TrainingSpeed = 'normal' | 'slow' | 'step';
export type TrainingStatus = 'idle' | 'running' | 'waiting-step' | 'done';

/** Thời gian nghỉ giữa các epoch để mắt kịp theo dõi. */
const SPEED_DELAY_MS: Record<Exclude<TrainingSpeed, 'step'>, number> = { normal: 0, slow: 350 };

export interface TrainingData {
  readonly train: LabeledVectors;
  readonly test: LabeledVectors | null;
}

/** Điều khiển vòng huấn luyện: mỗi epoch là một bước của generator → chạy liên tục, chậm, hoặc từng bước. */
export function useTraining() {
  const [snapshots, setSnapshots] = useState<EpochSnapshot[]>([]);
  const [status, setStatus] = useState<TrainingStatus>('idle');
  const generatorRef = useRef<Generator<EpochSnapshot, void, void> | null>(null);
  const timerRef = useRef<number | null>(null);
  const speedRef = useRef<TrainingSpeed>('normal');

  const clearTimer = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const advance = useCallback((): boolean => {
    const next = generatorRef.current?.next();
    if (!next || next.done) {
      generatorRef.current = null;
      setStatus('done');
      return false;
    }
    setSnapshots((prev) => [...prev, next.value]);
    return true;
  }, []);

  const loop = useCallback(
    function tick() {
      if (!advance()) return;
      if (speedRef.current === 'step') {
        setStatus('waiting-step');
        return;
      }
      timerRef.current = window.setTimeout(tick, SPEED_DELAY_MS[speedRef.current]);
    },
    [advance],
  );

  const start = useCallback(
    (data: TrainingData, options: TrainOptions, speed: TrainingSpeed) => {
      clearTimer();
      speedRef.current = speed;
      generatorRef.current = trainSoftmax(data.train, data.test, options);
      setSnapshots([]);
      setStatus('running');
      timerRef.current = window.setTimeout(loop, 0);
    },
    [loop],
  );

  const step = useCallback(() => {
    if (status !== 'waiting-step') return;
    setStatus('running');
    loop();
  }, [loop, status]);

  const finish = useCallback(() => {
    clearTimer();
    speedRef.current = 'normal';
    setStatus('running');
    timerRef.current = window.setTimeout(loop, 0);
  }, [loop]);

  useEffect(() => clearTimer, []);

  return { snapshots, status, start, step, finish };
}
