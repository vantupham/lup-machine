import { useEffect, useRef, useState } from 'react';

interface PlaybackOptions {
  readonly value: number;
  readonly max: number;
  readonly onChange: (value: number) => void;
  /** Thời gian giữa hai bước (ms). */
  readonly stepMs: number;
}

/** Nút Phát / Dừng cho một thanh trượt 0…max: mỗi `stepMs` tăng 1, tới max thì dừng; đang ở max mà bấm Phát thì chạy lại từ 0. */
export function usePlayback({ value, max, onChange, stepMs }: PlaybackOptions): { readonly isPlaying: boolean; readonly toggle: () => void } {
  const [isPlaying, setIsPlaying] = useState(false);
  const latest = useRef({ value, max, onChange });
  useEffect(() => {
    latest.current = { value, max, onChange };
  });

  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(() => {
      const { value: v, max: m, onChange: change } = latest.current;
      if (v >= m) {
        setIsPlaying(false);
        return;
      }
      // Ghi ngay vào ref: hai nhịp liền nhau trước khi React vẽ lại vẫn tăng đúng.
      latest.current = { ...latest.current, value: v + 1 };
      change(v + 1);
    }, stepMs);
    return () => window.clearInterval(id);
  }, [isPlaying, stepMs]);

  const toggle = () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    if (value >= max) onChange(0);
    setIsPlaying(true);
  };
  return { isPlaying, toggle };
}
