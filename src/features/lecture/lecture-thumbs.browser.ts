import type { ClassRecord, SampleRecord, StoredImage } from '@/storage/db';
import { blurFacesOnCanvas } from '@/features/studio/image/face-blur.browser';
import { createSquareCanvas } from '@/features/studio/image/image-codec.browser';

/** Bộ nhớ đệm theo danh sách ảnh đã chọn: mở lại bảng video không phải làm mờ lại. */
const cache = new Map<string, Map<number, HTMLCanvasElement[]>>();
const CACHE_LIMIT = 4;

export class LectureThumbsCancelled extends Error {
  constructor() {
    super('Đã đóng bảng video');
  }
}

/** Số ảnh thu nhỏ mỗi lớp trong cảnh Dữ liệu. */
export const THUMBS_PER_CLASS = 3;

async function blurredCanvas(image: StoredImage): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(new Blob([image.bytes], { type: image.mime }));
  try {
    const { canvas, ctx } = createSquareCanvas();
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    // Video có thể được chia sẻ: LUÔN làm mờ khuôn mặt, kể cả khi dự án tắt làm mờ lúc chụp.
    await blurFacesOnCanvas(ctx);
    return canvas;
  } finally {
    bitmap.close();
  }
}

/**
 * Ảnh thu nhỏ (ảnh Huấn luyện đầu tiên của mỗi lớp) đã làm mờ khuôn mặt.
 * Lỗi ở bất kỳ ảnh nào thì ném ra: người gọi phải bỏ hết ảnh chứ không được dùng ảnh chưa làm mờ.
 */
export async function loadLectureThumbs(
  classes: readonly ClassRecord[],
  samples: readonly SampleRecord[],
  isCancelled: () => boolean = () => false,
): Promise<Map<number, HTMLCanvasElement[]>> {
  const picked = classes.map((cls) => samples.filter((s) => s.classId === cls.id && s.split === 'train').slice(0, THUMBS_PER_CLASS));
  const key = picked.map((list) => list.map((s) => s.id).join(',')).join('|');
  const cached = cache.get(key);
  if (cached) return cached;
  const result = new Map<number, HTMLCanvasElement[]>();
  for (const [i, list] of picked.entries()) {
    const canvases: HTMLCanvasElement[] = [];
    for (const sample of list) {
      if (isCancelled()) throw new LectureThumbsCancelled();
      canvases.push(await blurredCanvas(sample.image));
    }
    result.set(i, canvases);
  }
  const oldest = cache.keys().next();
  if (cache.size >= CACHE_LIMIT && !oldest.done) cache.delete(oldest.value);
  cache.set(key, result);
  return result;
}
