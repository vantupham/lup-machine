/**
 * Nạp MoveNet / Hand Landmark tự lưu trữ (public/models) và chạy trên khung hình camera hoặc ảnh tải lên.
 * Khung hình chỉ nằm trong bộ nhớ trong lúc tính; chỉ tọa độ khớp được giữ lại.
 */
import type { Keypoint, SquareBox } from '@/core/pose/detectors';
import type { PoseKind } from '@/core/pose/features';
import type { RgbaImage } from '@/core/image/preprocess';
import { initBackend } from '../image/tf-backend.browser';

export interface PoseDetection {
  readonly keypoints: Keypoint[];
  /** Bàn tay: xác suất có bàn tay trong khung; cơ thể: độ tin cậy trung bình. */
  readonly score: number;
  readonly width: number;
  readonly height: number;
  /** Ô vuông mô hình bàn tay nhìn vào (để vẽ khung hướng dẫn). */
  readonly box: SquareBox | null;
}

/** Phát hiện khớp; với bàn tay, `box` là ô cần nhìn (mặc định: cả ảnh). */
export type Detector = (image: RgbaImage, box?: SquareBox) => Promise<PoseDetection>;

const MODEL_IDS: Record<PoseKind, string> = { body: 'movenet-lightning-4', hand: 'hand-landmark-lite-1' };
const loading = new Map<PoseKind, Promise<Detector>>();

/** Khung hướng dẫn đặt bàn tay khi dùng camera: ô vuông ở giữa, cạnh bằng 70% cạnh ngắn của khung hình. */
export function handGuideBox(width: number, height: number): SquareBox {
  const size = Math.round(Math.min(width, height) * 0.7);
  return { x: Math.round((width - size) / 2), y: Math.round((height - size) / 2), size };
}

async function createDetector(kind: PoseKind): Promise<Detector> {
  await initBackend();
  const detectors = await import('@/core/pose/detectors');
  const model = await detectors.loadPoseModel(`${import.meta.env.BASE_URL}models/${MODEL_IDS[kind]}/model.json`);
  if (kind === 'body') {
    const detect = detectors.createBodyDetector(model);
    return async (image) => {
      const keypoints = await detect(image);
      return { keypoints, score: keypoints.reduce((s, k) => s + k.score, 0) / keypoints.length, width: image.width, height: image.height, box: null };
    };
  }
  const detect = detectors.createHandDetector(model);
  return async (image, box) => {
    const square = box ?? detectors.letterboxBox(image.width, image.height);
    const r = await detect(image, square);
    return { keypoints: r.keypoints, score: r.handScore, width: image.width, height: image.height, box: square };
  };
}

/** Mỗi mô hình chỉ nạp một lần cho cả phiên làm việc. */
export function loadDetector(kind: PoseKind): Promise<Detector> {
  let detector = loading.get(kind);
  if (!detector) {
    detector = createDetector(kind);
    detector.catch(() => loading.delete(kind)); // lỗi mạng: cho phép thử lại
    loading.set(kind, detector);
  }
  return detector;
}

const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;

/** Đọc điểm ảnh của khung hình video hoặc ảnh. Camera trước được lật ngang như gương để học sinh dễ tạo dáng. */
export function grabFrame(source: HTMLVideoElement | HTMLImageElement, mirror: boolean): RgbaImage | null {
  const width = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
  const height = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
  if (!canvas || !width || !height) return null;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.save();
  if (mirror) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, 0, 0, width, height);
  ctx.restore();
  const { data } = ctx.getImageData(0, 0, width, height);
  return { width, height, data };
}

/** Giới hạn cạnh dài của ảnh tải lên để máy yếu không bị chậm. */
const MAX_UPLOAD_SIDE = 1280;

export async function imageFromFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (Math.max(img.naturalWidth, img.naturalHeight) <= MAX_UPLOAD_SIDE) return img;
    const scale = MAX_UPLOAD_SIDE / Math.max(img.naturalWidth, img.naturalHeight);
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
    const small = new Image();
    small.src = c.toDataURL('image/png');
    await small.decode();
    return small;
  } finally {
    URL.revokeObjectURL(url);
  }
}
