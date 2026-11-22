import { useCallback, useEffect, useState } from 'react';
import type { ClassRecord, ProjectRecord, SampleRecord } from '@/storage/db';
import { useDatasetRepository, useProjectRepository } from '@/storage/repository-context';

export type ProjectData =
  | { readonly status: 'loading' }
  | { readonly status: 'not-found' }
  | { readonly status: 'error' }
  | {
      readonly status: 'ready';
      readonly project: ProjectRecord;
      readonly classes: ClassRecord[];
      readonly samples: SampleRecord[];
    };

/** Tải dự án, các lớp và ảnh; trả về hàm reload để gọi sau mỗi thay đổi. */
export function useProjectData(projectId: string): { data: ProjectData; reload: () => Promise<void> } {
  const projects = useProjectRepository();
  const dataset = useDatasetRepository();
  const [data, setData] = useState<ProjectData>({ status: 'loading' });

  const load = useCallback(async (): Promise<ProjectData> => {
    try {
      const project = await projects.findById(projectId);
      if (!project) return { status: 'not-found' };
      const [classes, samples] = await Promise.all([
        dataset.listClasses(projectId),
        dataset.listSamples(projectId),
      ]);
      return { status: 'ready', project, classes, samples };
    } catch (error: unknown) {
      console.error('Không tải được dữ liệu dự án', error);
      return { status: 'error' };
    }
  }, [projects, dataset, projectId]);

  useEffect(() => {
    let isActive = true;
    void load().then((next) => {
      if (isActive) setData(next);
    });
    return () => {
      isActive = false;
    };
  }, [load]);

  const reload = useCallback(async () => setData(await load()), [load]);
  return { data, reload };
}
