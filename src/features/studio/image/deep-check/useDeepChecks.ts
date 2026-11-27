import { useMemo, useRef, useState } from 'react';
import { averageHash, blockContrast, borderBrightness, luminance } from '@/core/data/image-stats';
import { compareBackgrounds, findNearDuplicates, isFlat } from '@/core/data/deep-checks';
import type { DataCheckImage } from '@/core/trace/data-check-trace';
import type { ClassRecord, SampleRecord, StoredImage } from '@/storage/db';
import { getErrorMessage } from '@/ui/error-message';
import { decodeStoredImage } from '../image-codec.browser';

/** Số đo của một ảnh (không phụ thuộc lớp hay tập, nên giữ được khi đổi lớp / chuyển tập). */
export interface ImageMeasure {
  readonly hash: Uint8Array;
  readonly contrast: number;
  readonly border: number;
  readonly firstPixel: readonly number[];
  readonly grayHead: readonly number[];
}

export type DeepCheckStatus =
  | { readonly phase: 'idle' }
  | { readonly phase: 'running'; readonly done: number; readonly total: number }
  | { readonly phase: 'error'; readonly message: string };

/** Cập nhật thanh tiến độ sau mỗi chừng này ảnh. */
const PROGRESS_EVERY = 8;

export async function measureImage(image: StoredImage): Promise<{ readonly size: number; readonly measure: ImageMeasure }> {
  const rgba = await decodeStoredImage(image);
  const gray = luminance(rgba.data, rgba.width);
  return {
    size: rgba.width,
    measure: {
      hash: averageHash(gray),
      contrast: blockContrast(gray),
      border: borderBrightness(gray),
      firstPixel: Array.from(rgba.data.slice(0, 3)),
      grayHead: Array.from(gray.values.slice(0, 3)),
    },
  };
}

/**
 * Soi kỹ từng ảnh ở bước 2: giải mã ảnh, đo dấu vân tay và độ sáng viền (chạy khi bấm nút, nhớ theo id ảnh).
 * Kết quả (ảnh gần trùng, lối tắt nền) tính lại ngay khi đổi lớp hay chuyển ảnh giữa hai tập, không cần đo lại.
 */
export function useDeepChecks(classes: readonly ClassRecord[], samples: readonly SampleRecord[]) {
  const [measures, setMeasures] = useState<ReadonlyMap<string, ImageMeasure>>(new Map());
  const [size, setSize] = useState(0);
  const [status, setStatus] = useState<DeepCheckStatus>({ phase: 'idle' });
  const isRunning = useRef(false);

  const missing = samples.filter((s) => !measures.has(s.id));

  const run = async () => {
    if (isRunning.current || missing.length === 0) return;
    isRunning.current = true;
    const next = new Map(measures);
    try {
      for (const [i, sample] of missing.entries()) {
        const result = await measureImage(sample.image);
        next.set(sample.id, result.measure);
        setSize(result.size);
        if ((i + 1) % PROGRESS_EVERY === 0 || i === missing.length - 1) {
          setMeasures(new Map(next));
          setStatus({ phase: 'running', done: i + 1, total: missing.length });
        }
      }
      setStatus({ phase: 'idle' });
    } catch (error: unknown) {
      setMeasures(new Map(next));
      setStatus({ phase: 'error', message: getErrorMessage(error) });
    } finally {
      isRunning.current = false;
    }
  };

  const result = useMemo(() => {
    const labelOf = new Map(classes.map((c, i) => [c.id, i]));
    const measured = samples.filter((s) => measures.has(s.id) && labelOf.has(s.classId));
    const images: DataCheckImage[] = measured.map((s) => ({ id: s.id, label: labelOf.get(s.classId)!, split: s.split, ...measures.get(s.id)! }));
    return {
      samples: measured,
      images,
      duplicates: findNearDuplicates(images),
      flatCount: images.filter((img) => isFlat(img)).length,
      backgrounds: compareBackgrounds(images, classes.length),
    };
  }, [classes, samples, measures]);

  return { ...result, size, status, missingCount: missing.length, hasMeasured: measures.size > 0, run };
}
