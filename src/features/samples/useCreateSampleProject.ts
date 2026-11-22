import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { generateDataset, SAMPLE_DATASETS, type SampleDatasetId } from '@/core/datasets/synthetic';
import { useDatasetRepository, useProjectRepository } from '@/storage/repository-context';
import { renderShape } from './render-shape.browser';

export type CreateState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'rendering'; readonly id: SampleDatasetId; readonly done: number; readonly total: number }
  | { readonly phase: 'error'; readonly message: string };

/** Tạo một dự án từ bộ dữ liệu mẫu: lớp + ảnh vẽ sẵn + ngăn Dạy/Kiểm tra định sẵn. Trả về id dự án. */
export function useCreateSampleProject() {
  const { t } = useTranslation();
  const projects = useProjectRepository();
  const dataset = useDatasetRepository();
  const [state, setState] = useState<CreateState>({ phase: 'idle' });

  const create = async (id: SampleDatasetId): Promise<string | null> => {
    const def = SAMPLE_DATASETS.find((d) => d.id === id);
    if (!def) return null;
    const samples = generateDataset(def);
    try {
      setState({ phase: 'rendering', id, done: 0, total: samples.length });
      const project = await projects.create({ name: t(`samples.items.${id}.title`), projectType: 'image' });
      const classIds = new Map<string, string>();
      for (const key of def.classKeys) {
        classIds.set(key, (await dataset.addClass(project.id, t(`samples.classes.${key}`))).id);
      }
      const images = [];
      for (const [i, s] of samples.entries()) {
        images.push({ projectId: project.id, classId: classIds.get(s.classKey)!, split: s.split, source: 'dataset' as const, image: await renderShape(s.shape) });
        if (i % 8 === 7) setState({ phase: 'rendering', id, done: i + 1, total: samples.length });
      }
      await dataset.addSamples(images);
      setState({ phase: 'idle' });
      return project.id;
    } catch (error: unknown) {
      console.error('Không tạo được dự án mẫu', error);
      setState({ phase: 'error', message: error instanceof Error ? error.message : String(error) });
      return null;
    }
  };

  return { state, create };
}
