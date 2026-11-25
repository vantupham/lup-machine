import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

type FeatureMap = ReadonlyMap<string, Float32Array>;

/** Vector đặc trưng của các ảnh trong dự án: đọc từ cache, trích thêm phần còn thiếu khi được yêu cầu. */
export function useFeatures(projectId: string, samples: readonly SampleRecord[]) {
  const dataset = useDatasetRepository();
  const [features, setFeatures] = useState<FeatureMap>(new Map());
  const [status, setStatus] = useState<FeatureStatus>({ phase: 'idle' });
  /** Bảng vector mới nhất (không chờ React vẽ lại), để các lần ghi luôn GỘP chứ không đè lên nhau. */
  const latest = useRef<FeatureMap>(features);
  /** Lần trích đang chạy: bấm lần nữa (bước 3 hay "Huấn luyện nhanh") thì dùng chung, không trích hai lần. */
  const inFlight = useRef<Promise<FeatureMap | null> | null>(null);
  const samplesRef = useRef(samples);
  useEffect(() => {
    samplesRef.current = samples;
  }, [samples]);

  const merge = useCallback((entries: Iterable<readonly [string, Float32Array]>, preferExisting: boolean) => {
    const incoming = new Map(entries);
    const next = preferExisting ? new Map([...incoming, ...latest.current]) : new Map([...latest.current, ...incoming]);
    latest.current = next;
    setFeatures(next);
    return next;
  }, []);

  useEffect(() => {
    let isActive = true;
    dataset.listFeatures(projectId, FEATURE_MODEL_ID).then(
      // Cache về muộn hơn một lần trích vừa xong: giữ vector vừa trích, chỉ bổ sung phần còn thiếu.
      (cached) => isActive && merge(cached, true),
      (error: unknown) => isActive && setStatus({ phase: 'error', message: getErrorMessage(error) }),
    );
    return () => {
      isActive = false;
    };
  }, [dataset, projectId, merge]);

  const missing = useMemo(() => samples.filter((s) => !features.has(s.id)), [samples, features]);

  /** Trích vector cho ảnh còn thiếu. Trả về bảng vector đầy đủ sau khi xong, hoặc null nếu lỗi. */
  const extractMissing = useCallback((): Promise<FeatureMap | null> => {
    if (inFlight.current) return inFlight.current;
    const todo = samplesRef.current.filter((s) => !latest.current.has(s.id));
    if (todo.length === 0) return Promise.resolve(latest.current);
    const job = (async () => {
      try {
        setStatus({ phase: 'loading-model' });
        const extractor = await loadFeatureExtractor();
        setStatus({ phase: 'extracting', done: 0, total: todo.length });
        const images = await Promise.all(todo.map((s) => decodeStoredImage(s.image)));
        const vectors = await extractor.extract(images, (done) => setStatus({ phase: 'extracting', done, total: todo.length }));
        const items = todo.map((s, i) => ({ sampleId: s.id, vector: vectors[i]! }));
        await dataset.putFeatures(projectId, FEATURE_MODEL_ID, items);
        setStatus({ phase: 'idle' });
        return merge(items.map((it) => [it.sampleId, it.vector] as const), false);
      } catch (error: unknown) {
        console.error('Không trích được đặc trưng', error);
        setStatus({ phase: 'error', message: getErrorMessage(error) });
        return null;
      } finally {
        inFlight.current = null;
      }
    })();
    inFlight.current = job;
    return job;
  }, [dataset, projectId, merge]);

  return { features, missingCount: missing.length, status, extractMissing };
}
