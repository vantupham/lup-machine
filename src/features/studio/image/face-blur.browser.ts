/**
 * Làm mờ (pixel hóa) khuôn mặt ngay trên khung ảnh 224×224 TRƯỚC KHI lưu: ảnh gốc chưa làm mờ không bao giờ được ghi vào máy.
 * Mô hình BlazeFace (0,2 MB, tự lưu trữ) chỉ được tải khi lần đầu cần dùng.
 */
import type { FaceBox } from '@/core/face/blazeface';
import type { RgbaImage } from '@/core/image/preprocess';
import { initBackend } from './tf-backend.browser';

const FACE_MODEL_ID = 'face-detection-short-1';

type DetectFaces = (image: RgbaImage) => Promise<FaceBox[]>;
let loading: Promise<DetectFaces> | null = null;

async function createDetector(): Promise<DetectFaces> {
  await initBackend();
  const [{ loadGraphModel }, { createFaceDetector }] = await Promise.all([import('@tensorflow/tfjs-converter'), import('@/core/face/blazeface')]);
  return createFaceDetector(await loadGraphModel(`${import.meta.env.BASE_URL}models/${FACE_MODEL_ID}/model.json`));
}

/** Mỗi phiên chỉ nạp một lần; lỗi mạng thì cho phép thử lại. */
function loadFaceDetector(): Promise<DetectFaces> {
  if (!loading) {
    loading = createDetector();
    loading.catch(() => {
      loading = null;
    });
  }
  return loading;
}

/** Tìm và pixel hóa khuôn mặt trên canvas; trả về số khuôn mặt đã làm mờ. Lỗi thì ném ra (người gọi không được lưu ảnh). */
export async function blurFacesOnCanvas(ctx: CanvasRenderingContext2D): Promise<number> {
  const { width, height } = ctx.canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const image: RgbaImage = { data: imageData.data, width, height };
  const [detect, { pixelateRegions }] = await Promise.all([loadFaceDetector(), import('@/core/face/pixelate')]);
  const faces = await detect(image);
  if (faces.length === 0) return 0;
  const blurred = pixelateRegions(image, faces);
  ctx.putImageData(new ImageData(new Uint8ClampedArray(blurred.data), width, height), 0, 0);
  return faces.length;
}
