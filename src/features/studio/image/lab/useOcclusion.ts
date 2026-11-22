import { useCallback, useRef, useState } from 'react';
import { MODEL_INPUT_SIZE } from '@/core/image/preprocess';
import { occludeImage, occlusionGrid } from '@/core/ml/occlusion';
import type { SampleRecord } from '@/storage/db';
import { getErrorMessage } from '@/ui/error-message';
import { decodeStoredImage } from '../image-codec.browser';
import { loadFeatureExtractor } from '../feature-loader.browser';

/** Lưới che 7×7 — cùng độ phân giải với bản đồ CAM để học sinh so sánh hai cách. */
export const OCCLUSION_GRID = 7;
const RUNS = OCCLUSION_GRID * OCCLUSION_GRID + 1; // ảnh gốc + 49 ảnh bị che

export type OcclusionState =
  | { readonly status: 'idle' }
  | { readonly status: 'running'; readonly done: number; readonly total: number }
  | { readonly status: 'ready'; readonly base: Float32Array; readonly occluded: readonly Float32Array[] }
  | { readonly status: 'error'; readonly message: string };

/** Che lần lượt từng ô rồi trích đặc trưng lại — chỉ chạy khi người dùng bấm (50 lượt chạy mô hình). */
export function useOcclusion(sample: SampleRecord): { state: OcclusionState; run: () => void } {
  const [state, setState] = useState<{ id: string; value: OcclusionState } | null>(null);
  const token = useRef(0);

  const run = useCallback(() => {
    const myToken = ++token.current;
    const update = (value: OcclusionState) => {
      if (token.current === myToken) setState({ id: sample.id, value });
    };
    update({ status: 'running', done: 0, total: RUNS });
    (async () => {
      const [extractor, image] = await Promise.all([loadFeatureExtractor(), decodeStoredImage(sample.image)]);
      const images = [image, ...occlusionGrid(MODEL_INPUT_SIZE, OCCLUSION_GRID).map((box) => occludeImage(image, box))];
      return extractor.extract(images, (done) => update({ status: 'running', done, total: RUNS }));
    })().then(
      ([base, ...occluded]) => update({ status: 'ready', base: base!, occluded }),
      (error: unknown) => update({ status: 'error', message: getErrorMessage(error) }),
    );
  }, [sample]);

  return { state: state?.id === sample.id ? state.value : { status: 'idle' }, run };
}
