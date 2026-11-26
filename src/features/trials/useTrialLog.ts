import { useCallback, useEffect, useState } from 'react';
import type { TrialRecord } from '@/storage/db';
import type { NewTrialInput } from '@/storage/schemas/trial';
import { useTrialRepository } from '@/storage/repository-context';

/** '' → null (không đoán); số từ 0 đến 100 → 0–1; còn lại → undefined (không hợp lệ). */
export function parseGuessPercent(text: string): number | null | undefined {
  if (text.trim() === '') return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value / 100 : undefined;
}

/**
 * Nhật ký thí nghiệm của một dự án huấn luyện tức thì, kèm ô "đoán trước" điểm Kiểm tra.
 * `record` lưu lần chạy vừa huấn luyện (gắn điểm đoán nếu có) và đánh dấu nó là lần đang xem.
 */
export function useTrialLog(projectId: string) {
  const repo = useTrialRepository();
  const [trials, setTrials] = useState<TrialRecord[]>([]);
  const [guessText, setGuessText] = useState('');
  const [shownNumber, setShownNumber] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(() => repo.list(projectId).then(setTrials), [repo, projectId]);

  useEffect(() => {
    let isActive = true;
    repo.list(projectId).then(
      (list) => isActive && setTrials(list),
      (err: unknown) => {
        console.error('Không đọc được nhật ký thí nghiệm', projectId, err);
        if (isActive) setError(err);
      },
    );
    return () => {
      isActive = false;
    };
  }, [repo, projectId]);

  const guess = parseGuessPercent(guessText);

  const record = useCallback(
    async (input: Omit<NewTrialInput, 'guess'>, canGuess: boolean) => {
      const withGuess = canGuess && typeof guess === 'number' ? { ...input, guess } : input;
      setGuessText('');
      // Đang lưu lần mới: không để thẻ kết quả của lần trước hiện cạnh mô hình mới.
      setShownNumber(null);
      try {
        const saved = await repo.add(projectId, withGuess);
        setShownNumber(saved.number);
        setError(null);
        await refresh();
        return saved;
      } catch (err: unknown) {
        console.error('Không lưu được lần chạy vào nhật ký', projectId, err);
        setError(err);
        return null;
      }
    },
    [repo, projectId, guess, refresh],
  );

  const setConclusion = useCallback(
    async (id: string, text: string) => {
      await repo.setConclusion(id, text);
      await refresh();
    },
    [repo, refresh],
  );

  return { trials, guessText, setGuessText, guess, shownNumber, error, record, setConclusion };
}

export type TrialLog = ReturnType<typeof useTrialLog>;
