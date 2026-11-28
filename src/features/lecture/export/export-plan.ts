import { fileSlug } from '@/core/file-name';
import type { AspectRatio } from '../lecture-script';

/** Số khung hình mỗi giây của video xuất ra (hình chủ yếu tĩnh, hoạt cảnh chậm: 30 là đủ mượt). */
export const EXPORT_FPS = 30;
/** Một khung hình chìa khoá mỗi chừng này giây: tua video vẫn nhanh. */
export const KEY_FRAME_SECONDS = 2;
/** Báo tiến độ và nhường giao diện sau mỗi chừng này khung hình. */
export const PROGRESS_EVERY_FRAMES = 15;

export type VideoContainer = 'mp4' | 'webm';

export interface ExportFormat {
  readonly container: VideoContainer;
  /** Mã của mediabunny: 'avc' (H.264) cho MP4, 'vp9' cho WebM. */
  readonly codec: 'avc' | 'vp9';
  readonly mime: string;
}

export const MP4_FORMAT: ExportFormat = { container: 'mp4', codec: 'avc', mime: 'video/mp4' };
export const WEBM_FORMAT: ExportFormat = { container: 'webm', codec: 'vp9', mime: 'video/webm' };

/** Số khung hình cho một video dài `duration` giây (ít nhất 1). */
export function frameCount(duration: number, fps = EXPORT_FPS): number {
  if (!Number.isFinite(duration) || duration <= 0) return 1;
  return Math.max(1, Math.ceil(duration * fps));
}

/** Thời điểm (giây) của khung hình thứ `index`. */
export function frameTime(index: number, fps = EXPORT_FPS): number {
  return index / fps;
}

export function videoFileName(projectName: string, aspect: AspectRatio, container: VideoContainer): string {
  return `${fileSlug(projectName)}-bai-giang-${aspect === '16:9' ? '16x9' : '9x16'}.${container}`;
}

/** Dung lượng theo MB, một chữ số thập phân (hiển thị cho người dùng). */
export function megabytes(bytes: number): number {
  return Math.round((bytes / 1e6) * 10) / 10;
}
