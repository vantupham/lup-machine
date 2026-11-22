import { useCallback, useEffect, useMemo, useState } from 'react';
import { FEATURE_MODEL_ID } from '@/core/ml/feature-model';
import type { SampleRecord } from '@/storage/db';
import { useDatasetRepository } from '@/storage/repository-context';
import { getErrorMessage } from '@/ui/error-message';
import { decodeStoredImage } from '../image-codec.browser';
import { loadFeatureExtractor } from '../feature-loader.browser';

export type FeatureStatus =
  | { readonly phase: 'idle' }
  | { readonly phase: 'loading-model' }
  | { readonly phase: 'extracting'; readonly done: number; readonly total: number }
  | { readonly phase: 'error'; readonly message: string };

/** Vector đặc trưng của các ảnh trong dự án: đọc từ cache, trích thêm phần còn thiếu khi được yêu cầu. */
export function useFeatures(projectId: string, samples: readonly SampleRecord[]) {
  const dataset = useDatasetRepository();
  const [features, setFeatures] = useState<ReadonlyMap<string, Float32Array>>(new Map());
  const [status, setStatus] = useState<FeatureStatus>({ phase: 'idle' });

  useEffect(() => {
    let isActive = true;
    dataset.listFeatures(projectId, FEATURE_MODEL_ID).then(
      (cached) => isActive && setFeatures(cached),
      (error: unknown) => isActive && setStatus({ phase: 'error', message: getErrorMessage(error) }),
    );
    return () => {
      isActive = false;
    };
  }, [dataset, projectId]);

  const missing = useMemo(() => samples.filter((s) => !features.has(s.id)), [samples, features]);

  const extractMissing = useCallback(async () => {
    if (missing.length === 0) return;
    try {
      setStatus({ phase: 'loading-model' });
      const extractor = await loadFeatureExtractor();
      setStatus({ phase: 'extracting', done: 0, total: missing.length });
      const images = await Promise.all(missing.map((s) => decodeStoredImage(s.image)));
      const vectors = await extractor.extract(images, (done) =>
        setStatus({ phase: 'extracting', done, total: missing.length }),
      );
      const items = missing.map((s, i) => ({ sampleId: s.id, vector: vectors[i]! }));
      await dataset.putFeatures(projectId, FEATURE_MODEL_ID, items);
      setFeatures((prev) => new Map([...prev, ...items.map((it) => [it.sampleId, it.vector] as const)]));
      setStatus({ phase: 'idle' });
    } catch (error: unknown) {
      console.error('Không trích được đặc trưng', error);
      setStatus({ phase: 'error', message: getErrorMessage(error) });
    }
  }, [dataset, missing, projectId]);

  return { features, missingCount: missing.length, status, extractMissing };
}
