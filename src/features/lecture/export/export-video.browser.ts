import type { LectureScript } from '../lecture-script';
import type { LectureTimeline } from '../script-timeline';
import { renderFrame } from '../render/render-frame';
import type { PaintEnv } from '../render/paint-env';
import { EXPORT_FPS, frameCount, frameTime, KEY_FRAME_SECONDS, MP4_FORMAT, WEBM_FORMAT, type ExportFormat } from './export-plan';

export interface ExportRequest {
  readonly script: LectureScript;
  readonly timeline: LectureTimeline;
  readonly burnSubtitles: boolean;
  readonly env: PaintEnv;
  /** Tiến độ 0–1. */
  readonly onProgress: (fraction: number) => void;
  readonly signal: AbortSignal;
}

export interface ExportResult {
  readonly blob: Blob;
  readonly format: ExportFormat;
}

export class ExportUnsupportedError extends Error {
  constructor() {
    super('Trình duyệt không mã hóa được video');
    this.name = 'ExportUnsupportedError';
  }
}

/** Ghi theo thời gian thực mà tab bị ẩn: khung hình đứng yên, phải làm lại. */
export class ExportHiddenError extends Error {
  constructor() {
    super('Tab bị ẩn trong lúc ghi video');
    this.name = 'ExportHiddenError';
  }
}

function abortError(): DOMException {
  return new DOMException('Đã hủy xuất video', 'AbortError');
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortError();
}

/** Nhường luồng chính sau chừng này mili giây làm việc liên tục. */
const YIELD_EVERY_MS = 50;

/**
 * Nhường luồng chính để thanh tiến độ và nút Hủy còn phản hồi. Dùng MessageChannel thay cho setTimeout:
 * tab bị ẩn thì setTimeout bị hãm xuống 1 lần/giây (hoặc thưa hơn), còn message thì không.
 */
function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });
}

function createCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ExportUnsupportedError();
  return { canvas, ctx };
}

function drawer(request: ExportRequest, ctx: CanvasRenderingContext2D) {
  return (time: number) => renderFrame(ctx, { script: request.script, timeline: request.timeline, time, burnSubtitles: request.burnSubtitles }, request.env);
}

/** Định dạng mã hóa được bằng WebCodecs: ưu tiên MP4 (H.264), rồi WebM (VP9); null nếu không có. */
export async function pickWebCodecsFormat(width: number, height: number): Promise<ExportFormat | null> {
  if (typeof VideoEncoder === 'undefined') return null;
  const { canEncodeVideo } = await import('mediabunny');
  for (const format of [MP4_FORMAT, WEBM_FORMAT]) {
    if (await canEncodeVideo(format.codec, { width, height })) return format;
  }
  return null;
}

/**
 * Dựng video nhanh hơn thời gian thực: vẽ từng khung bằng đúng hàm của phần xem trước,
 * mã hóa bằng WebCodecs, đóng gói MP4/WebM bằng mediabunny. Tệp nằm trong bộ nhớ, không gửi đi đâu.
 */
export async function exportWithWebCodecs(request: ExportRequest, format: ExportFormat): Promise<ExportResult> {
  const { BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH, WebMOutputFormat } = await import('mediabunny');
  const { width, height } = request.env.layout.size;
  const { canvas, ctx } = createCanvas(width, height);
  const draw = drawer(request, ctx);
  const target = new BufferTarget();
  const output = new Output({ format: format.container === 'mp4' ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat(), target });
  const source = new CanvasSource(canvas, { codec: format.codec, quality: QUALITY_HIGH, keyFrameInterval: KEY_FRAME_SECONDS });
  output.addVideoTrack(source, { frameRate: EXPORT_FPS });
  try {
    await output.start();
    const total = frameCount(request.timeline.duration);
    let lastYield = performance.now();
    for (let i = 0; i < total; i++) {
      throwIfAborted(request.signal);
      const time = frameTime(i);
      draw(time);
      await source.add(time, 1 / EXPORT_FPS);
      if (performance.now() - lastYield >= YIELD_EVERY_MS) {
        request.onProgress(i / total);
        await yieldToUi();
        lastYield = performance.now();
      }
    }
    throwIfAborted(request.signal);
    await output.finalize();
    // Bấm Hủy đúng lúc đang đóng gói: vẫn coi là hủy.
    throwIfAborted(request.signal);
  } catch (error: unknown) {
    if (output.state !== 'finalized') await output.cancel().catch(() => undefined);
    throw error;
  }
  if (!target.buffer) throw new Error('Không nhận được dữ liệu video');
  request.onProgress(1);
  return { blob: new Blob([target.buffer], { type: format.mime }), format };
}

const RECORDER_TYPES: readonly { readonly type: string; readonly format: ExportFormat }[] = [
  { type: 'video/mp4;codecs=avc1', format: MP4_FORMAT },
  { type: 'video/webm;codecs=vp9', format: WEBM_FORMAT },
  { type: 'video/webm', format: WEBM_FORMAT },
];

/** Trình duyệt không có WebCodecs: ghi canvas theo thời gian thực (mất đúng bằng độ dài video). */
export function canRecordRealtime(): boolean {
  return typeof MediaRecorder !== 'undefined' && RECORDER_TYPES.some((r) => MediaRecorder.isTypeSupported(r.type));
}

/** Chạy từng khung theo đồng hồ thật bằng requestAnimationFrame; tab bị ẩn thì dừng (khung sẽ đứng yên). */
function playRealtime(request: ExportRequest, draw: (time: number) => void, pushFrame: () => void): Promise<void> {
  const duration = request.timeline.duration;
  return new Promise<void>((resolve, reject) => {
    const startedAt = performance.now();
    let lastPercent = -1;
    let frame = 0;
    const onHidden = () => {
      if (document.visibilityState === 'hidden') finish(new ExportHiddenError());
    };
    const finish = (error?: unknown) => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onHidden);
      request.signal.removeEventListener('abort', onAbort);
      if (error) reject(error);
      else resolve();
    };
    const onAbort = () => finish(abortError());
    const tick = () => {
      const time = Math.min((performance.now() - startedAt) / 1000, duration);
      draw(time);
      pushFrame();
      const percent = Math.floor((time / duration) * 100);
      if (percent !== lastPercent) {
        lastPercent = percent;
        request.onProgress(time / duration);
      }
      // Vẽ khung cuối rồi chờ thêm một nhịp để bộ ghi kịp nhận nó.
      if (time >= duration) frame = requestAnimationFrame(() => finish());
      else frame = requestAnimationFrame(tick);
    };
    document.addEventListener('visibilitychange', onHidden);
    request.signal.addEventListener('abort', onAbort);
    if (request.signal.aborted) return onAbort();
    frame = requestAnimationFrame(tick);
  });
}

export async function exportRealtime(request: ExportRequest): Promise<ExportResult> {
  const choice = RECORDER_TYPES.find((r) => MediaRecorder.isTypeSupported(r.type));
  if (!choice) throw new ExportUnsupportedError();
  const { width, height } = request.env.layout.size;
  const { canvas, ctx } = createCanvas(width, height);
  const draw = drawer(request, ctx);
  draw(0);
  // captureStream(0) + requestFrame(): mỗi lần vẽ là một khung, kể cả cảnh đứng yên.
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as (MediaStreamTrack & { requestFrame?: () => void }) | undefined;
  const recorder = new MediaRecorder(stream, { mimeType: choice.type });
  const chunks: Blob[] = [];
  let recorderError: unknown = null;
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
    recorder.onerror = (e) => {
      recorderError = e;
      resolve();
    };
  });
  recorder.start(1000);
  try {
    await playRealtime(request, draw, () => track?.requestFrame?.());
  } finally {
    if (recorder.state !== 'inactive') {
      recorder.requestData();
      recorder.stop();
    }
    await stopped;
    stream.getTracks().forEach((t) => t.stop());
  }
  if (recorderError) throw new Error('Bộ ghi video báo lỗi');
  request.onProgress(1);
  return { blob: new Blob(chunks, { type: choice.format.mime }), format: choice.format };
}
