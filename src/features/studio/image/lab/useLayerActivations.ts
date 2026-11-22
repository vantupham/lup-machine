import { useCallback, useRef, useState } from 'react';
import type { ActivationTensor } from '@/core/ml/feature-maps';
import { FEATURE_MAP_LAYERS } from '@/core/ml/feature-model';
import type { SampleRecord } from '@/storage/db';
import { getErrorMessage } from '@/ui/error-message';
import { decodeStoredImage } from '../image-codec.browser';
import { loadFeatureExtractor } from '../feature-loader.browser';

export type LayersState =
  | { readonly status: 'idle' | 'loading' }
  | { readonly status: 'ready'; readonly layers: readonly ActivationTensor[] }
  | { readonly status: 'error'; readonly message: string };

const LAYER_NAMES = FEATURE_MAP_LAYERS.map((l) => l.name);

/** Kích hoạt các tầng CNN của một ảnh — một lượt chạy mô hình, chỉ khi người dùng mở trình xem. */
export function useLayerActivations(sample: SampleRecord): { state: LayersState; load: () => void } {
  const [state, setState] = useState<{ id: string; value: LayersState } | null>(null);
  const token = useRef(0);

  const load = useCallback(() => {
    const myToken = ++token.current;
    const update = (value: LayersState) => {
      if (token.current === myToken) setState({ id: sample.id, value });
    };
    update({ status: 'loading' });
    (async () => {
      const [extractor, image] = await Promise.all([loadFeatureExtractor(), decodeStoredImage(sample.image)]);
      return extractor.extractLayers(image, LAYER_NAMES);
    })().then(
      (layers) => update({ status: 'ready', layers }),
      (error: unknown) => update({ status: 'error', message: getErrorMessage(error) }),
    );
  }, [sample]);

  return { state: state?.id === sample.id ? state.value : { status: 'idle' }, load };
}
