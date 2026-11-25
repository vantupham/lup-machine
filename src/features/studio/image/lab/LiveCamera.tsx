import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { StoredImage } from '@/storage/db';
import { videoFrameToStoredImage } from '../image-codec.browser';
import { useCamera } from '../useCamera';

/** Khoảng 4 lần nhận dạng mỗi giây: đủ "trực tiếp" mà máy phòng tin học yếu vẫn theo kịp. */
export const LIVE_INTERVAL_MS = 250;

interface LiveCameraProps {
  /** Dừng hình: giữ nguyên khung cuối, không chụp thêm. */
  readonly isPaused: boolean;
  /** Xử lý một khung hình; chỉ chạy khung tiếp theo khi khung này xong (không chạy chồng). */
  readonly onFrame: (image: StoredImage, isCurrent: () => boolean) => Promise<void>;
  readonly onError: (error: unknown) => void;
}

/** Webcam nhận dạng liên tục. Khung hình KHÔNG được làm mờ hay lưu: chỉ đưa qua mô hình rồi bỏ. */
export function LiveCamera({ isPaused, onFrame, onError }: LiveCameraProps) {
  const { t } = useTranslation();
  const { videoRef, state } = useCamera();
  const handlers = useRef({ onFrame, onError });
  useEffect(() => {
    handlers.current = { onFrame, onError };
  });

  // Dừng hình thì dừng cả video, để hình trên màn đúng là khung đang được giải thích.
  useEffect(() => {
    const video = videoRef.current;
    if (state !== 'ready' || !video) return;
    if (isPaused) video.pause();
    else void Promise.resolve(video.play()).catch(() => undefined);
  }, [state, isPaused, videoRef]);

  useEffect(() => {
    if (state !== 'ready' || isPaused) return;
    let isActive = true;
    let timer: number | undefined;
    const isCurrent = () => isActive;
    const loop = async () => {
      const video = videoRef.current;
      // Ngay sau khi bật, video có thể chưa có kích thước: chờ nhịp sau thay vì báo lỗi.
      if (video?.videoWidth) {
        try {
          await handlers.current.onFrame(await videoFrameToStoredImage(video), isCurrent);
        } catch (error: unknown) {
          if (isActive) handlers.current.onError(error);
        }
      }
      if (isActive) timer = window.setTimeout(() => void loop(), LIVE_INTERVAL_MS);
    };
    void loop();
    return () => {
      isActive = false;
      window.clearTimeout(timer);
    };
  }, [state, isPaused, videoRef]);

  return (
    <div className="relative aspect-square w-full max-w-sm overflow-hidden rounded border border-rule bg-black">
      {/* Lật ngang như gương; mô hình nhận đúng ô vuông giữa đã lật (giống lúc thu dữ liệu). */}
      <video ref={videoRef} muted playsInline className={`h-full w-full -scale-x-100 object-cover ${isPaused ? 'opacity-60' : ''}`} />
      {state !== 'ready' && (
        <p role={state === 'starting' ? 'status' : 'alert'} className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-white">
          {t(`project.webcam.${state}`)}
        </p>
      )}
      {state === 'ready' && (
        <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-0.5 font-mono text-xs text-white" aria-hidden="true">
          {isPaused ? '⏸' : '● LIVE'}
        </span>
      )}
    </div>
  );
}
