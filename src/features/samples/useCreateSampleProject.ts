import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parsePhotoManifest, PHOTO_DATASETS, type PhotoDatasetId } from '@/core/datasets/photo';
import { generateDataset, SAMPLE_DATASETS, type SampleDatasetId } from '@/core/datasets/synthetic';
import { MODEL_INPUT_SIZE } from '@/core/image/preprocess';
import type { NewSampleInput } from '@/storage/repositories/dataset-repository';
import { useDatasetRepository, useProjectRepository } from '@/storage/repository-context';
import { renderShape } from './render-shape.browser';

export type AnyDatasetId = SampleDatasetId | PhotoDatasetId;

export type CreateState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'rendering'; readonly id: AnyDatasetId; readonly done: number; readonly total: number }
  | { readonly phase: 'error'; readonly message: string };

const PROGRESS_EVERY = 8;
const JPEG_MAGIC = [0xff, 0xd8] as const;

export function photoDatasetUrl(id: PhotoDatasetId, file: string): string {
  return `${import.meta.env.BASE_URL}datasets/${id}/${file}`;
}

async function fetchOk(url: string): Promise<Response> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Không tải được ${url} (${response.status})`);
  return response;
}

/** Tạo một dự án từ bộ dữ liệu mẫu (hình vẽ tổng hợp hoặc ảnh thật có giấy phép mở). Trả về id dự án. */
export function useCreateSampleProject() {
  const { t } = useTranslation();
  const projects = useProjectRepository();
  const dataset = useDatasetRepository();
  const [state, setState] = useState<CreateState>({ phase: 'idle' });

  const createProject = async (id: AnyDatasetId, classKeys: readonly string[]) => {
    const project = await projects.create({ name: t(`samples.items.${id}.title`), projectType: 'image' });
    const classIds = new Map<string, string>();
    for (const key of classKeys) classIds.set(key, (await dataset.addClass(project.id, t(`samples.classes.${key}`))).id);
    return { projectId: project.id, classIds };
  };

  const createSynthetic = async (id: SampleDatasetId): Promise<string | null> => {
    const def = SAMPLE_DATASETS.find((d) => d.id === id);
    if (!def) return null;
    const samples = generateDataset(def);
    setState({ phase: 'rendering', id, done: 0, total: samples.length });
    const { projectId, classIds } = await createProject(id, def.classKeys);
    const images: NewSampleInput[] = [];
    for (const [i, s] of samples.entries()) {
      images.push({ projectId, classId: classIds.get(s.classKey)!, split: s.split, source: 'dataset', image: await renderShape(s.shape) });
      if (i % PROGRESS_EVERY === PROGRESS_EVERY - 1) setState({ phase: 'rendering', id, done: i + 1, total: samples.length });
    }
    await dataset.addSamples(images);
    return projectId;
  };

  const createPhoto = async (id: PhotoDatasetId): Promise<string | null> => {
    const def = PHOTO_DATASETS.find((d) => d.id === id);
    if (!def) return null;
    const manifest = parsePhotoManifest(await (await fetchOk(photoDatasetUrl(id, 'manifest.json'))).json(), id);
    setState({ phase: 'rendering', id, done: 0, total: manifest.images.length });
    // Tải hết ảnh TRƯỚC khi tạo dự án: mất mạng giữa chừng thì không để lại dự án dở dang.
    const loaded: { bytes: ArrayBuffer; image: (typeof manifest.images)[number] }[] = [];
    for (const [i, image] of manifest.images.entries()) {
      const bytes = await (await fetchOk(photoDatasetUrl(id, image.file))).arrayBuffer();
      const head = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
      if (head[0] !== JPEG_MAGIC[0] || head[1] !== JPEG_MAGIC[1]) throw new Error(`${image.file} không phải ảnh JPEG`);
      loaded.push({ bytes, image });
      if (i % PROGRESS_EVERY === PROGRESS_EVERY - 1) setState({ phase: 'rendering', id, done: i + 1, total: manifest.images.length });
    }
    const { projectId, classIds } = await createProject(id, def.classKeys);
    await dataset.addSamples(
      loaded.map(({ bytes, image }) => ({
        projectId,
        classId: classIds.get(image.class)!,
        split: image.split,
        source: 'dataset' as const,
        image: { bytes, mime: 'image/jpeg', width: MODEL_INPUT_SIZE, height: MODEL_INPUT_SIZE },
        credit: image.credit,
      })),
    );
    return projectId;
  };

  const create = async (id: AnyDatasetId): Promise<string | null> => {
    try {
      const isPhoto = PHOTO_DATASETS.some((d) => d.id === id);
      const projectId = isPhoto ? await createPhoto(id as PhotoDatasetId) : await createSynthetic(id as SampleDatasetId);
      setState({ phase: 'idle' });
      return projectId;
    } catch (error: unknown) {
      console.error('Không tạo được dự án mẫu', error);
      setState({ phase: 'error', message: error instanceof Error ? error.message : String(error) });
      return null;
    }
  };

  return { state, create };
}
