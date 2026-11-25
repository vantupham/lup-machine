import { useEffect, useRef, useState, type RefObject } from 'react';

export type CameraState = 'starting' | 'ready' | 'denied' | 'unavailable';

/** Bật webcam vào thẻ <video> khi component hiện ra và TẮT HẲN camera khi component đóng. */
export function useCamera(): { videoRef: RefObject<HTMLVideoElement | null>; state: CameraState } {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<CameraState>('starting');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let isActive = true;
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setState('unavailable');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
        if (!isActive) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
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

  return { videoRef, state };
}
