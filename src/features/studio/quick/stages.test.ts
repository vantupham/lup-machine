import { act, renderHook } from '@testing-library/react';
import { stageStates } from './stage-states';
import { usePacedStages } from './usePacedStages';

describe('stageStates', () => {
  test('chặng trước xong, chặng đang chạy, chặng sau chưa tới', () => {
    expect(stageStates(4, 1, null)).toEqual(['done', 'active', 'pending', 'pending']);
  });

  test('current = số chặng: tất cả đã xong', () => {
    expect(stageStates(3, 3, null)).toEqual(['done', 'done', 'done']);
  });

  test('lỗi ở một chặng: chặng trước xong, chặng lỗi đánh dấu lỗi, chặng sau chưa tới', () => {
    expect(stageStates(4, 4, 2)).toEqual(['done', 'done', 'error', 'pending']);
  });
});

describe('usePacedStages', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test('chạy lần lượt từng chặng, mỗi chặng dừng một nhịp rồi xong', async () => {
    const calls: number[] = [];
    const { result } = renderHook(() => usePacedStages(100));
    let done: Promise<void> = Promise.resolve();
    act(() => {
      done = result.current.start([() => calls.push(0), () => calls.push(1)]);
    });
    expect(result.current.run).toEqual({ phase: 'running', current: 0 });
    expect(calls).toEqual([0]);
    await act(async () => vi.advanceTimersByTimeAsync(100));
    expect(result.current.run).toEqual({ phase: 'running', current: 1 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
      await done;
    });
    expect(calls).toEqual([0, 1]);
    expect(result.current.run).toEqual({ phase: 'done' });
  });

  test('việc của một chặng ném lỗi: dừng lại và báo lỗi đúng chặng đó', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const after = vi.fn();
    const { result } = renderHook(() => usePacedStages(100));
    await act(async () => {
      const done = result.current.start([
        () => undefined,
        () => {
          throw new Error('hỏng');
        },
        after,
      ]);
      await vi.advanceTimersByTimeAsync(100);
      await done;
    });
    expect(result.current.run).toEqual({ phase: 'error', failedAt: 1, message: 'hỏng' });
    expect(after).not.toHaveBeenCalled();
    vi.mocked(console.error).mockRestore();
  });
});
