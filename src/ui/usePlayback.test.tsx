import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { usePlayback } from './usePlayback';

function usePlayer(start: number, max: number) {
  const [value, setValue] = useState(start);
  const playback = usePlayback({ value, max, onChange: setValue, stepMs: 100 });
  return { value, ...playback };
}

describe('usePlayback', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test('Phát: tăng từng bước tới max rồi tự dừng', () => {
    const { result } = renderHook(() => usePlayer(1, 3));
    act(() => result.current.toggle());
    expect(result.current.isPlaying).toBe(true);
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.value).toBe(2);
    act(() => vi.advanceTimersByTime(300));
    expect(result.current.value).toBe(3);
    expect(result.current.isPlaying).toBe(false);
  });

  test('đang ở cuối mà bấm Phát thì chạy lại từ 0; bấm lần nữa thì dừng', () => {
    const { result } = renderHook(() => usePlayer(5, 5));
    act(() => result.current.toggle());
    expect(result.current.value).toBe(0);
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.value).toBe(2);
    act(() => result.current.toggle());
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.value).toBe(2);
    expect(result.current.isPlaying).toBe(false);
  });
});
