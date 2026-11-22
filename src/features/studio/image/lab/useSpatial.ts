import { useEffect, useState } from 'react';
import type { SampleRecord } from '@/storage/db';
import { getErrorMessage } from '@/ui/error-message';
import { decodeStoredImage } from '../image-codec.browser';
import { loadFeatureExtractor } from '../feature-loader.browser';

export type SpatialState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly spatial: Float32Array }
  | { readonly status: 'error'; readonly message: string };

/** Kích hoạt 7×7×1280 của một ảnh, tính khi cần (không lưu đệm vì nặng ~250 KB mỗi ảnh). */
export function useSpatial(sample: SampleRecord): SpatialState {
  const [state, setState] = useState<{ id: string; value: SpatialState } | null>(null);

  useEffect(() => {
    let isActive = true;
    (async () => {
      const [extractor, image] = await Promise.all([loadFeatureExtractor(), decodeStoredImage(sample.image)]);
      const [spatial] = await extractor.extractSpatial([image]);
      return spatial!;
    })().then(
      (spatial) => isActive && setState({ id: sample.id, value: { status: 'ready', spatial } }),
      (error: unknown) => isActive && setState({ id: sample.id, value: { status: 'error', message: getErrorMessage(error) } }),
    );
    return () => {
      isActive = false;
    };
  }, [sample]);

  return state?.id === sample.id ? state.value : { status: 'loading' };
}
