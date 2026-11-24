/**
 * Bộ chuyển đổi ảnh dùng canvas của trình duyệt (không chạy được trong jsdom → kiểm thử bằng E2E).
 * Ảnh được cắt vuông giữa và thu về 224×224 NGAY KHI THU THẬP, lưu dạng JPEG.
 * Ảnh lưu chính là ảnh mô hình nhận → Kính hiển vi hiển thị đúng dữ liệu thật.
 */
import { centerCropBox, MODEL_INPUT_SIZE, type RgbaImage } from '@/core/image/preprocess';
import type { StoredImage } from '@/storage/db';
import { blurFacesOnCanvas } from './face-blur.browser';
import { FaceBlurError } from './face-blur-error';

const JPEG_QUALITY = 0.92;

async function blurOrFail(ctx: CanvasRenderingContext2D, onFaces?: (count: number) => void): Promise<void> {
  let count: number;
  try {
    count = await blurFacesOnCanvas(ctx);
  } catch (error: unknown) {
    throw new FaceBlurError('Không làm mờ được khuôn mặt', { cause: error });
  }
  onFaces?.(count);
}
const STORED_MIME = 'image/jpeg';

export function createSquareCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = MODEL_INPUT_SIZE;
  canvas.height = MODEL_INPUT_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ canvas 2D');
  return { canvas, ctx };
}

export async function canvasToStoredImage(canvas: HTMLCanvasElement): Promise<StoredImage> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, STORED_MIME, JPEG_QUALITY),
  );
  if (!blob) throw new Error('Không mã hóa được ảnh');
  return {
    bytes: await blob.arrayBuffer(),
    mime: STORED_MIME,
    width: MODEL_INPUT_SIZE,
    height: MODEL_INPUT_SIZE,
  };
}

function drawCropped(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  width: number,
  height: number,
  mirror: boolean,
): void {
  const { sx, sy, size } = centerCropBox(width, height);
  ctx.save();
  if (mirror) {
    ctx.translate(MODEL_INPUT_SIZE, 0);
    ctx.scale(-1, 1);
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, sx, sy, size, size, 0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  ctx.restore();
}

export interface CaptureOptions {
  /** Làm mờ khuôn mặt trên khung 224×224 trước khi mã hóa; không làm mờ được thì ném lỗi (không lưu ảnh gốc). */
  readonly blurFaces?: boolean;
  /** Được gọi với số khuôn mặt đã làm mờ trong ảnh này (0: không thấy khuôn mặt nào). */
  readonly onFaces?: (count: number) => void;
}

export async function fileToStoredImage(file: Blob, options: CaptureOptions = {}): Promise<StoredImage> {
  const bitmap = await createImageBitmap(file);
  try {
    const { canvas, ctx } = createSquareCanvas();
    drawCropped(ctx, bitmap, bitmap.width, bitmap.height, false);
    if (options.blurFaces) await blurOrFail(ctx, options.onFaces);
    return await canvasToStoredImage(canvas);
  } finally {
    bitmap.close();
  }
}

/** Chụp một khung hình webcam. Lật ngang để khớp với hình gương người dùng nhìn thấy. */
export async function videoFrameToStoredImage(video: HTMLVideoElement, options: CaptureOptions = {}): Promise<StoredImage> {
  if (!video.videoWidth || !video.videoHeight) throw new Error('Webcam chưa sẵn sàng');
  const { canvas, ctx } = createSquareCanvas();
  drawCropped(ctx, video, video.videoWidth, video.videoHeight, true);
  if (options.blurFaces) await blurOrFail(ctx, options.onFaces);
  return canvasToStoredImage(canvas);
}

/** Giải mã ảnh đã lưu thành các giá trị RGBA để soi từng điểm ảnh. */
export async function decodeStoredImage(image: StoredImage): Promise<RgbaImage> {
  const bitmap = await createImageBitmap(new Blob([image.bytes], { type: image.mime }));
  try {
    const { ctx } = createSquareCanvas();
    ctx.drawImage(bitmap, 0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
    const { data, width, height } = ctx.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
    return { data, width, height };
  } finally {
    bitmap.close();
  }
}
