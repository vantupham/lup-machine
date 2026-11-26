import { useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '@/ui/error-message';

/**
 * Mỗi chặng dừng chừng này rồi mới sang chặng sau. Ở Studio âm thanh / tư thế máy học gần như tức thì,
 * nên nhịp chậm là cố ý: học sinh kịp đọc từng chặng và con số của nó.
 */
export const STAGE_PAUSE_MS = 500;

export type PacedRun =
  | { readonly phase: 'idle' }
  | { readonly phase: 'running'; readonly current: number }
  | { readonly phase: 'done' }
  | { readonly phase: 'error'; readonly failedAt: number; readonly message: string };

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/**
 * Chạy lần lượt các chặng: chặng i làm việc của nó (`actions[i]`) rồi dừng STAGE_PAUSE_MS.
 * Việc của một chặng ném lỗi thì dừng lại và đánh dấu lỗi đúng chặng đó.
 */
export function usePacedStages(pauseMs: number = STAGE_PAUSE_MS) {
  const [run, setRun] = useState<PacedRun>({ phase: 'idle' });
  /** Mỗi lần chạy mới (hoặc rời trang) tăng số này: lần chạy cũ đang chờ thì thôi. */
  const generation = useRef(0);
  useEffect(() => () => void generation.current++, []);

  const start = async (actions: ReadonlyArray<() => void>) => {
    const mine = ++generation.current;
    for (const [i, action] of actions.entries()) {
      if (mine !== generation.current) return;
      setRun({ phase: 'running', current: i });
      try {
        action();
      } catch (error: unknown) {
        console.error('Chặng huấn luyện nhanh lỗi', error);
        setRun({ phase: 'error', failedAt: i, message: getErrorMessage(error) });
        return;
      }
      await wait(pauseMs);
    }
    if (mine === generation.current) setRun({ phase: 'done' });
  };

  return { run, isRunning: run.phase === 'running', start };
}
