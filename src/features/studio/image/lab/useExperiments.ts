import { useCallback, useEffect, useState } from 'react';
import type { RunRecord } from '@/storage/db';
import type { NewRunInput } from '@/storage/repositories/experiment-repository';
import { useExperimentRepository } from '@/storage/repository-context';

/** Danh sách các lần huấn luyện đã lưu của dự án. `loaded` = đã đọc xong lần đầu. */
export function useExperiments(projectId: string) {
  const repo = useExperimentRepository();
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchRuns = useCallback(() => repo.listRuns(projectId), [repo, projectId]);

  useEffect(() => {
    let isActive = true;
    fetchRuns().then(
      (list) => {
        if (!isActive) return;
        setRuns(list);
        setLoaded(true);
      },
      (error: unknown) => {
        console.error('Không đọc được nhật ký thí nghiệm', error);
        if (isActive) setLoaded(true);
      },
    );
    return () => {
      isActive = false;
    };
  }, [fetchRuns]);

  const add = useCallback(
    async (input: NewRunInput) => {
      const saved = await repo.addRun(input);
      setRuns(await fetchRuns());
      return saved;
    },
    [repo, fetchRuns],
  );

  const remove = useCallback(
    async (id: string) => {
      await repo.deleteRun(id);
      setRuns(await fetchRuns());
    },
    [repo, fetchRuns],
  );

  return { runs, loaded, add, remove };
}
