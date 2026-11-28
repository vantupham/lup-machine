import { useEffect, useRef, useState } from 'react';
import { downloadBlob } from '@/ui/download';
import { getErrorMessage } from '@/ui/error-message';
import type { AspectRatio, LectureScript } from '../lecture-script';
import type { LectureTimeline } from '../script-timeline';
import type { PaintEnv } from '../render/paint-env';
import { megabytes, videoFileName, type VideoContainer } from './export-plan';
import type { ExportRequest, ExportResult } from './export-video.browser';

export type ExportState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'running'; readonly progress: number; readonly isRealtime: boolean }
  | { readonly phase: 'done'; readonly fileName: string; readonly sizeMb: number; readonly container: VideoContainer }
  | { readonly phase: 'error'; readonly message: string }
  | { readonly phase: 'hidden' }
  | { readonly phase: 'unsupported' };

export interface ExportJob {
  readonly projectName: string;
  readonly aspect: AspectRatio;
  readonly script: LectureScript;
  readonly timeline: LectureTimeline;
  readonly burnSubtitles: boolean;
  readonly env: PaintEnv;
}

type Exporter = typeof import('./export-video.browser');

/** Ưu tiên WebCodecs; không có, hoặc mã hóa hỏng giữa chừng, thì ghi theo thời gian thực nếu được. */
async function runExport(exporter: Exporter, job: ExportJob, signal: AbortSignal, report: (progress: number, isRealtime: boolean) => void): Promise<ExportResult | 'unsupported'> {
  const request = (isRealtime: boolean): ExportRequest => ({
    script: job.script,
    timeline: job.timeline,
    burnSubtitles: job.burnSubtitles,
    env: job.env,
    signal,
    onProgress: (progress) => report(progress, isRealtime),
  });
  const { width, height } = job.env.layout.size;
  const format = await exporter.pickWebCodecsFormat(width, height);
  if (format) {
    try {
      report(0, false);
      return await exporter.exportWithWebCodecs(request(false), format);
    } catch (error: unknown) {
      if (signal.aborted || !exporter.canRecordRealtime()) throw error;
      console.error('Mã hóa nhanh lỗi, chuyển sang ghi theo thời gian thực', error);
    }
  }
  if (!exporter.canRecordRealtime()) return 'unsupported';
  report(0, true);
  return exporter.exportRealtime(request(true));
}

/** Xuất video bài giảng thành tệp và tải về máy; có tiến độ, hủy được, tự hủy khi đóng bảng. */
export function useLectureExport() {
  const [state, setState] = useState<ExportState>({ phase: 'idle' });
  /** Thông báo kết quả chỉ đúng với đúng lựa chọn đã xuất: đổi khổ / mức chi tiết thì ẩn đi. */
  const [stateJob, setStateJob] = useState<ExportJob | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const start = async (job: ExportJob) => {
    if (controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setStateJob(job);
    setState({ phase: 'running', progress: 0, isRealtime: false });
    try {
      const exporter = await import('./export-video.browser');
      const result = await runExport(exporter, job, abort.signal, (progress, isRealtime) => {
        if (!abort.signal.aborted) setState({ phase: 'running', progress, isRealtime });
      });
      if (abort.signal.aborted) return setState({ phase: 'idle' });
      if (result === 'unsupported') return setState({ phase: 'unsupported' });
      const fileName = videoFileName(job.projectName, job.aspect, result.format.container);
      downloadBlob(fileName, result.blob);
      setState({ phase: 'done', fileName, sizeMb: megabytes(result.blob.size), container: result.format.container });
    } catch (error: unknown) {
      if (abort.signal.aborted) return setState({ phase: 'idle' });
      const name = error instanceof Error ? error.name : '';
      if (name === 'ExportUnsupportedError') return setState({ phase: 'unsupported' });
      if (name === 'ExportHiddenError') return setState({ phase: 'hidden' });
      console.error('Không xuất được video bài giảng', error);
      setState({ phase: 'error', message: getErrorMessage(error) });
    } finally {
      if (controller.current === abort) controller.current = null;
    }
  };

  const cancel = () => controller.current?.abort();

  return { state, stateJob, start, cancel };
}
