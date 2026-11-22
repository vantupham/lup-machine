import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StoredImage } from '@/storage/db';
import { Dialog } from '@/ui/Dialog';

/** Chụp liên tục khoảng 6–7 ảnh mỗi giây khi giữ nút. */
const BURST_INTERVAL_MS = 150;

type CameraState = 'starting' | 'ready' | 'denied' | 'unavailable';

interface WebcamCaptureProps {
  readonly title: string;
  readonly remaining: number;
  readonly captureFrame: (video: HTMLVideoElement) => Promise<StoredImage>;
  readonly onDone: (images: StoredImage[]) => void;
}

export function WebcamCapture({ title, remaining, captureFrame, onDone }: WebcamCaptureProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const capturedRef = useRef<StoredImage[]>([]);
  const timerRef = useRef<number | null>(null);
  const [state, setState] = useState<CameraState>('starting');
  const [count, setCount] = useState(0);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let isActive = true;
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setState('unavailable');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
        if (!isActive) return;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // play() có thể trả về undefined (trình duyệt cũ) hoặc bị từ chối do chính sách tự phát.
          await Promise.resolve(videoRef.current.play()).catch(() => undefined);
        }
        setState('ready');
      } catch (error: unknown) {
        if (isActive) setState(error instanceof DOMException && error.name === 'NotAllowedError' ? 'denied' : 'unavailable');
      }
    };
    void start();
    return () => {
      isActive = false;
      stream?.getTracks().forEach((track) => track.stop()); // tắt camera ngay khi đóng
    };
  }, []);

  const snap = useCallback(async () => {
    const video = videoRef.current;
    if (!video || capturedRef.current.length >= remaining) return;
    try {
      capturedRef.current = [...capturedRef.current, await captureFrame(video)];
      setCount(capturedRef.current.length);
    } catch (error: unknown) {
      console.warn('Không chụp được khung hình', error);
    }
  }, [captureFrame, remaining]);

  const stopBurst = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const startBurst = () => {
    stopBurst();
    void snap();
    timerRef.current = window.setInterval(() => void snap(), BURST_INTERVAL_MS);
  };

  useEffect(() => stopBurst, [stopBurst]);

  const finish = useCallback(() => {
    stopBurst();
    onDone(capturedRef.current);
  }, [onDone, stopBurst]);

  const isFull = count >= remaining;

  return (
    <Dialog title={title} closeLabel={t('project.webcam.done')} onClose={finish}>
      <div className="grid gap-4 md:grid-cols-[auto_1fr]">
        <div className="relative aspect-square w-full max-w-sm overflow-hidden rounded border border-rule bg-black">
          {/* Lật ngang như gương; phần ngoài ô vuông giữa sẽ bị cắt khi lưu. */}
          <video ref={videoRef} muted playsInline className="h-full w-full -scale-x-100 object-cover" />
          {state !== 'ready' && (
            <p role={state === 'starting' ? 'status' : 'alert'} className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-white">
              {t(`project.webcam.${state}`)}
            </p>
          )}
        </div>
        <div className="space-y-3">
          <p className="font-mono text-2xl" role="status" aria-live="polite">
            {t('project.webcam.captured', { count })}
          </p>
          {isFull && <p className="text-sm text-warning">{t('project.webcam.full', { max: count })}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary select-none"
              disabled={state !== 'ready' || isFull}
              onPointerDown={startBurst}
              onPointerUp={stopBurst}
              onPointerLeave={stopBurst}
              onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && startBurst()}
              onKeyUp={stopBurst}
            >
              ● {t('project.webcam.hold')}
            </button>
            <button type="button" className="btn btn-ghost" disabled={state !== 'ready' || isFull} onClick={() => void snap()}>
              {t('project.webcam.snap')}
            </button>
          </div>
          <p className="text-xs text-muted">🔒 {t('project.webcam.privacy')}</p>
        </div>
      </div>
    </Dialog>
  );
}
