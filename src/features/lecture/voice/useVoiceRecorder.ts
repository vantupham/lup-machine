import { useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '@/ui/error-message';
import { LECTURE_VOICE_MAX_SECONDS } from '@/storage/repositories/lecture-voice-repository';
import { decodeVoice } from './voice-audio.browser';

export interface RecordedVoice {
  readonly audio: ArrayBuffer;
  readonly mime: string;
  readonly duration: number;
}

/** Bối cảnh chốt lúc BẮT ĐẦU thu (cảnh, mức chi tiết, lời): đổi lựa chọn giữa chừng không làm lưu nhầm chỗ. */
export interface RecordingTarget {
  readonly sceneId: string;
}

export type RecorderState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'starting'; readonly sceneId: string }
  | { readonly phase: 'recording'; readonly sceneId: string; readonly elapsed: number }
  | { readonly phase: 'saving'; readonly sceneId: string }
  | { readonly phase: 'error'; readonly sceneId: string; readonly kind: 'denied' | 'missing' | 'failed'; readonly message: string };

/** Định dạng ghi âm theo thứ tự ưu tiên: Opus (nhẹ, Chrome/Firefox), rồi AAC (Safari). */
const AUDIO_TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'] as const;
/** Dừng cứng trước giới hạn lưu trữ một giây (đồng hồ có thể trễ khi tab bị ẩn). */
const HARD_STOP_SECONDS = LECTURE_VOICE_MAX_SECONDS - 1;

function pickAudioType(): string {
  return AUDIO_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

function errorKind(error: unknown): 'denied' | 'missing' | 'failed' {
  if (!(error instanceof DOMException)) return 'failed';
  if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return 'denied';
  if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') return 'missing';
  return 'failed';
}

interface Session {
  readonly recorder: MediaRecorder;
  readonly stream: MediaStream;
  readonly timers: readonly number[];
}

/**
 * Thu giọng từng cảnh bằng micro. Mỗi lúc chỉ một lượt thu; micro tắt ngay khi dừng, khi lỗi
 * hoặc khi đóng bảng (đóng bảng giữa chừng thì bỏ bản đang thu). Âm thanh chỉ nằm trên máy.
 */
export function useVoiceRecorder<T extends RecordingTarget>(onRecorded: (target: T, voice: RecordedVoice) => Promise<void>) {
  const [state, setState] = useState<RecorderState>({ phase: 'idle' });
  const session = useRef<Session | null>(null);
  /** Đang chờ quyền micro: chặn bấm Thu lần hai trước khi getUserMedia trả về. */
  const isStarting = useRef(false);
  const isMounted = useRef(true);
  const onRecordedRef = useRef(onRecorded);
  useEffect(() => {
    onRecordedRef.current = onRecorded;
  }, [onRecorded]);

  const release = (current: Session) => {
    current.timers.forEach((id) => window.clearTimeout(id));
    current.stream.getTracks().forEach((track) => track.stop());
    if (session.current === current) session.current = null;
  };

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      const current = session.current;
      if (!current) return;
      // Đóng bảng giữa chừng: bỏ bản đang thu, không lưu.
      current.recorder.onstop = null;
      current.recorder.ondataavailable = null;
      if (current.recorder.state !== 'inactive') current.recorder.stop();
      release(current);
    };
  }, []);

  const finish = async (target: T, chunks: Blob[], mime: string) => {
    if (!isMounted.current) return;
    setState({ phase: 'saving', sceneId: target.sceneId });
    try {
      const audio = await new Blob(chunks, { type: mime }).arrayBuffer();
      const decoded = await decodeVoice(audio);
      const duration = Math.min(decoded.duration, LECTURE_VOICE_MAX_SECONDS);
      await onRecordedRef.current(target, { audio, mime: mime.split(';')[0] || 'audio/webm', duration });
      if (isMounted.current) setState({ phase: 'idle' });
    } catch (error: unknown) {
      if (isMounted.current) setState({ phase: 'error', sceneId: target.sceneId, kind: 'failed', message: getErrorMessage(error) });
    }
  };

  const start = async (target: T) => {
    if (session.current || isStarting.current) return;
    isStarting.current = true;
    setState({ phase: 'starting', sceneId: target.sceneId });
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (!isMounted.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const type = pickAudioType();
      const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      const startedAt = performance.now();
      const tick = window.setInterval(() => {
        if (isMounted.current) setState({ phase: 'recording', sceneId: target.sceneId, elapsed: (performance.now() - startedAt) / 1000 });
      }, 250);
      const hardStop = window.setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, HARD_STOP_SECONDS * 1000);
      const current: Session = { recorder, stream, timers: [tick, hardStop] };
      recorder.onstop = () => {
        window.clearInterval(tick);
        release(current);
        void finish(target, chunks, recorder.mimeType || type || 'audio/webm');
      };
      session.current = current;
      recorder.start();
      setState({ phase: 'recording', sceneId: target.sceneId, elapsed: 0 });
    } catch (error: unknown) {
      // Lỗi sau khi đã mở micro (ví dụ không tạo được bộ ghi): tắt micro ngay.
      stream?.getTracks().forEach((track) => track.stop());
      if (isMounted.current) setState({ phase: 'error', sceneId: target.sceneId, kind: errorKind(error), message: getErrorMessage(error) });
    } finally {
      isStarting.current = false;
    }
  };

  const stop = () => {
    const recorder = session.current?.recorder;
    if (recorder?.state === 'recording') recorder.stop();
  };

  return { state, start, stop };
}
