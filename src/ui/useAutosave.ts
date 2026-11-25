import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage } from './error-message';

/** Gõ xong ngần này mili-giây thì tự lưu (rời ô thì gọi flush để lưu ngay). */
export const AUTOSAVE_DELAY_MS = 800;

export type AutosaveState = { readonly kind: 'idle' | 'saving' | 'saved' } | { readonly kind: 'error'; readonly message: string };

/**
 * Tự lưu một ô chữ: `schedule` sau mỗi lần gõ, `flush` khi rời ô. Rời trang khi còn chữ chưa lưu
 * thì lưu nốt. `save` nên giữ nguyên giữa các lần vẽ (useCallback) để không lưu thừa.
 */
export function useAutosave(save: (text: string) => Promise<void>, delayMs: number = AUTOSAVE_DELAY_MS) {
  const [state, setState] = useState<AutosaveState>({ kind: 'idle' });
  const pending = useRef<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const isMounted = useRef(true);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const value = pending.current;
    if (value === null) return;
    pending.current = null;
    if (isMounted.current) setState({ kind: 'saving' });
    try {
      await save(value);
      if (isMounted.current && pending.current === null) setState({ kind: 'saved' });
    } catch (error: unknown) {
      console.error('Không tự lưu được', error);
      if (isMounted.current) setState({ kind: 'error', message: getErrorMessage(error) });
    }
  }, [save]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      void flush();
    };
  }, [flush]);

  const schedule = useCallback(
    (text: string) => {
      pending.current = text;
      setState({ kind: 'idle' });
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), delayMs);
    },
    [flush, delayMs],
  );

  return { state, schedule, flush };
}
