import { useCallback, useEffect, useMemo, useState } from 'react';
import { audioFeatures } from '@/core/audio/features';
import type { AudioClipRecord, ClassRecord, ProjectRecord } from '@/storage/db';
import { clipSamples } from '@/storage/repositories/audio-repository';
import { useAudioRepository, useDatasetRepository, useProjectRepository } from '@/storage/repository-context';

export type AudioProjectState =
  | { readonly status: 'loading' }
  | { readonly status: 'not-found' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly project: ProjectRecord; readonly classes: ClassRecord[]; readonly clips: AudioClipRecord[] };

/** Đặc trưng 160 số theo mã đoạn: nội dung một đoạn không bao giờ đổi nên tính một lần là đủ. */
const featureCache = new Map<string, Float32Array>();

function featuresOf(clip: AudioClipRecord): Float32Array {
  let f = featureCache.get(clip.id);
  if (!f) {
    f = audioFeatures(clipSamples(clip));
    featureCache.set(clip.id, f);
  }
  return f;
}

/** Tải dự án âm thanh kèm đặc trưng của mỗi đoạn. */
export function useAudioProject(projectId: string) {
  const projects = useProjectRepository();
  const dataset = useDatasetRepository();
  const audio = useAudioRepository();
  const [state, setState] = useState<AudioProjectState>({ status: 'loading' });

  const load = useCallback(async (): Promise<AudioProjectState> => {
    try {
      const project = await projects.findById(projectId);
      if (!project) return { status: 'not-found' };
      const [classes, clips] = await Promise.all([dataset.listClasses(projectId), audio.listClips(projectId)]);
      return { status: 'ready', project, classes, clips };
    } catch (error: unknown) {
      console.error('Không tải được dự án âm thanh', error);
      return { status: 'error' };
    }
  }, [projects, dataset, audio, projectId]);

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

  const clips = state.status === 'ready' ? state.clips : null;
  const features = useMemo(() => new Map((clips ?? []).map((clip) => [clip.id, featuresOf(clip)])), [clips]);

  return { state, reload, features, dataset, audio };
}
