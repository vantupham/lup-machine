/**
 * Đọc tệp âm thanh và thu âm bằng micro trong trình duyệt, rồi đưa về 16 kHz, một kênh.
 * Tệp chỉ dùng phần nằm ngoài kiểm thử đơn vị (jsdom không có Web Audio); được kiểm tra bằng E2E.
 */
import { AUDIO } from '@/core/audio/features';

type AudioContextCtor = typeof AudioContext;

function audioContextClass(): AudioContextCtor | null {
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export function isAudioSupported(): boolean {
  return audioContextClass() !== null && typeof OfflineAudioContext !== 'undefined';
}

/** Trộn mọi kênh về một kênh và đổi tần số lấy mẫu về 16 kHz bằng OfflineAudioContext. */
async function resample(buffer: AudioBuffer): Promise<Float32Array> {
  const length = Math.max(1, Math.ceil(buffer.duration * AUDIO.sampleRate));
  const offline = new OfflineAudioContext(1, length, AUDIO.sampleRate);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice();
}

/** Giới hạn độ dài tệp tải lên để máy yếu không bị treo. */
export const MAX_FILE_SECONDS = 30;

export async function decodeAudioFile(file: Blob): Promise<Float32Array> {
  const Ctor = audioContextClass();
  if (!Ctor) throw new Error('Trình duyệt không hỗ trợ Web Audio');
  const ctx = new Ctor();
  try {
    const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
    if (buffer.duration > MAX_FILE_SECONDS) throw new RangeError(`Tệp dài quá ${MAX_FILE_SECONDS} giây`);
    return await resample(buffer);
  } finally {
    void ctx.close();
  }
}

export interface Recording {
  /** Dừng sớm (nếu cần) và trả về âm thanh 16 kHz. */
  readonly result: Promise<Float32Array>;
  /** Bộ phân tích FFT của trình duyệt để vẽ phổ trực tiếp (minh họa, không dùng cho mô hình). */
  readonly analyser: AnalyserNode;
  readonly cancel: () => void;
}

/** Thu âm trong `seconds` giây. Âm thanh thu được không gửi đi đâu. */
export async function recordClip(seconds: number): Promise<Recording> {
  const Ctor = audioContextClass();
  if (!Ctor || !navigator.mediaDevices?.getUserMedia) throw new Error('Trình duyệt không hỗ trợ thu âm');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  const ctx = new Ctor();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  // ScriptProcessorNode cũ nhưng chạy được ở mọi trình duyệt mà không cần tệp worklet riêng
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  const target = Math.ceil(seconds * ctx.sampleRate);
  let collected = 0;
  let cancelled = false;

  const stop = () => {
    processor.disconnect();
    source.disconnect();
    stream.getTracks().forEach((t) => t.stop());
  };

  const result = new Promise<Float32Array>((resolve, reject) => {
    processor.onaudioprocess = (event) => {
      if (cancelled || collected >= target) return;
      const data = event.inputBuffer.getChannelData(0);
      chunks.push(data.slice(0, Math.min(data.length, target - collected)));
      collected += data.length;
      if (collected >= target) {
        stop();
        const merged = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset);
          offset += c.length;
        }
        const buffer = ctx.createBuffer(1, merged.length, ctx.sampleRate);
        buffer.copyToChannel(merged, 0);
        resample(buffer).then(resolve, reject).finally(() => void ctx.close());
      }
    };
  });

  source.connect(analyser);
  source.connect(processor);
  processor.connect(ctx.destination);
  return {
    result,
    analyser,
    cancel: () => {
      cancelled = true;
      stop();
      void ctx.close();
    },
  };
}

/** Phát lại một đoạn 16 kHz qua loa. */
export function playClip(samples: Float32Array): void {
  const Ctor = audioContextClass();
  if (!Ctor) return;
  const ctx = new Ctor();
  const buffer = ctx.createBuffer(1, samples.length, AUDIO.sampleRate);
  buffer.copyToChannel(Float32Array.from(samples), 0);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.onended = () => void ctx.close();
  source.start();
}
