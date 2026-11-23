import { useCallback, useEffect, useState } from 'react';
import type { PoseKind } from '@/core/pose/features';
import type { ClassRecord, PoseSampleRecord, ProjectRecord } from '@/storage/db';
import { useDatasetRepository, usePoseRepository, useProjectRepository } from '@/storage/repository-context';
import { safeStorage } from '@/ui/safe-storage';

export type PoseProjectState =
  | { readonly status: 'loading' }
  | { readonly status: 'not-found' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly project: ProjectRecord; readonly classes: ClassRecord[]; readonly poses: PoseSampleRecord[] };

const kindKey = (projectId: string) => `lup.poseKind.${projectId}`;

/** Tải dự án tư thế. Loại (cơ thể / bàn tay) lấy theo các mẫu đã có; chưa có mẫu thì theo lựa chọn đã ghi nhớ. */
export function usePoseProject(projectId: string) {
  const projects = useProjectRepository();
  const dataset = useDatasetRepository();
  const poses = usePoseRepository();
  const [state, setState] = useState<PoseProjectState>({ status: 'loading' });
  const [chosenKind, setChosenKind] = useState<PoseKind>(() => (safeStorage.get(kindKey(projectId)) === 'hand' ? 'hand' : 'body'));

  const load = useCallback(async (): Promise<PoseProjectState> => {
    try {
      const project = await projects.findById(projectId);
      if (!project) return { status: 'not-found' };
      const [classes, list] = await Promise.all([dataset.listClasses(projectId), poses.listPoses(projectId)]);
      return { status: 'ready', project, classes, poses: list };
    } catch (error: unknown) {
      console.error('Không tải được dự án tư thế', error);
      return { status: 'error' };
    }
  }, [projects, dataset, poses, projectId]);

  useEffect(() => {
    let isActive = true;
    void load().then((next) => {
      if (isActive) setState(next);
    });
    return () => {
      isActive = false;
    };
  }, [load]);

  const reload = useCallback(async () => setState(await load()), [load]);
  const kind: PoseKind = state.status === 'ready' && state.poses[0] ? state.poses[0].kind : chosenKind;
  const setKind = useCallback(
    (next: PoseKind) => {
      safeStorage.set(kindKey(projectId), next);
      setChosenKind(next);
    },
    [projectId],
  );
  return { state, reload, dataset, poses, kind, setKind, kindLocked: state.status === 'ready' && state.poses.length > 0 };
}
