import { useEffect, useState } from 'react';
import { getErrorMessage } from '@/ui/error-message';

/** Seed cố định: cùng dữ liệu → cùng bản đồ UMAP trên mọi máy, giáo viên và học sinh nhìn thấy như nhau. */
export const UMAP_SEED = 42;

export type UmapState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly coords: readonly [number, number][] }
  | { readonly status: 'error'; readonly message: string };

/**
 * Tính bản đồ UMAP khi được bật (vectors khác null). umap-js được tải động
 * để không làm nặng trang đầu; kết quả gắn với đúng mảng vector đã dùng để tính.
 */
export function useUmap(vectors: readonly Float32Array[] | null): UmapState | null {
  const [result, setResult] = useState<{ input: readonly Float32Array[]; value: UmapState } | null>(null);

  useEffect(() => {
    if (!vectors) return;
    let isActive = true;
    import('@/core/ml/umap')
      .then(({ fitUmap2 }) => fitUmap2(vectors, UMAP_SEED))
      .then(
        (coords) => isActive && setResult({ input: vectors, value: { status: 'ready', coords } }),
        (error: unknown) => isActive && setResult({ input: vectors, value: { status: 'error', message: getErrorMessage(error) } }),
      );
    return () => {
      isActive = false;
    };
  }, [vectors]);

  if (!vectors) return null;
  return result?.input === vectors ? result.value : { status: 'loading' };
}
