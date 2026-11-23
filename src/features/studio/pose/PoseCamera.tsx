import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PoseKind } from '@/core/pose/features';
import { grabFrame, handGuideBox, loadDetector, type PoseDetection } from './pose-io.browser';
import { Skeleton } from './Skeleton';

/** Khoảng nghỉ giữa hai lần nhận dạng (khoảng 8 lần mỗi giây là đủ mượt mà không làm nóng máy). */
const DETECT_INTERVAL_MS = 120;

type CameraState = 'starting' | 'loading-model' | 'ready' | 'denied' | 'unavailable' | 'model-error';

interface PoseCameraProps {
  readonly kind: PoseKind;
  /** Gọi sau mỗi lần nhận dạng xong một khung hình. */
  readonly onDetection: (detection: PoseDetection) => void;
  readonly jointValues?: readonly number[] | null;
}

/** Camera trước (lật như gương) + khung xương vẽ đè; với bàn tay có ô hướng dẫn ở giữa. */
export function PoseCamera({ kind, onDetection, jointValues }: PoseCameraProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectionRef = useRef(onDetection);
  const [state, setState] = useState<CameraState>('starting');
  const [latest, setLatest] = useState<PoseDetection | null>(null);

  useEffect(() => {
    onDetectionRef.current = onDetection;
  }, [onDetection]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let isActive = true;
    let timer = 0;
    const run = async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setState('unavailable');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      } catch (error: unknown) {
        if (isActive) setState(error instanceof DOMException && error.name === 'NotAllowedError' ? 'denied' : 'unavailable');
        return;
      }
      if (!isActive || !videoRef.current) return;
      videoRef.current.srcObject = stream;
      await Promise.resolve(videoRef.current.play()).catch(() => undefined);
      setState('loading-model');
      let detect;
      try {
        detect = await loadDetector(kind);
      } catch (error: unknown) {
        console.error('Không nạp được mô hình tư thế', error);
        if (isActive) setState('model-error');
        return;
      }
      if (!isActive) return;
      setState('ready');
      const loop = async () => {
        const video = videoRef.current;
        const frame = video ? grabFrame(video, true) : null;
        if (frame && isActive) {
          const detection = await detect(frame, kind === 'hand' ? handGuideBox(frame.width, frame.height) : undefined);
          if (!isActive) return;
          setLatest(detection);
          onDetectionRef.current(detection);
        }
        if (isActive) timer = window.setTimeout(() => void loop(), DETECT_INTERVAL_MS);
      };
      void loop();
    };
    void run();
    return () => {
      isActive = false;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop()); // tắt camera ngay khi rời đi
    };
  }, [kind]);

  const box = latest?.box ?? null;
  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded border border-rule bg-ink">
        <video ref={videoRef} muted playsInline className="block h-auto w-full -scale-x-100" aria-label={t('pose.camera.video')} />
        {latest && (
          <div className="pointer-events-none absolute inset-0">
            <Skeleton kind={kind} keypoints={latest.keypoints} width={latest.width} height={latest.height} label={t('pose.camera.overlay')} jointValues={jointValues ?? null} className="h-full w-full" color="#56B4E9" testId="camera-skeleton">
              {box && <rect x={box.x} y={box.y} width={box.size} height={box.size} fill="none" stroke="#ffffff" strokeWidth={3} strokeDasharray="12 8" />}
            </Skeleton>
          </div>
        )}
      </div>
      <p className="text-xs text-muted" role="status" data-testid="camera-state">
        {state === 'ready' && latest
          ? t(kind === 'hand' ? 'pose.camera.handScore' : 'pose.camera.bodyScore', { score: Math.round(latest.score * 100) })
          : t(`pose.camera.state.${state}`)}
      </p>
    </div>
  );
}
