import { useTranslation } from 'react-i18next';
import { Film } from '@/ui/icons';
import { useLectureExport, type ExportJob } from './useLectureExport';

interface ExportControlsProps {
  readonly job: ExportJob;
  /** Chưa sẵn sàng (đang làm mờ ảnh, đang soi kỹ): tạm khóa nút. */
  readonly isReady: boolean;
}

/** Trình đọc màn hình chỉ được báo theo từng nấc 10% (không đọc liên tục mỗi khung hình). */
const ANNOUNCE_STEP = 10;

/** Nút "Xuất video" với thanh tiến độ, nút Hủy và thông báo kết quả. */
export function ExportControls({ job, isReady }: ExportControlsProps) {
  const { t, i18n } = useTranslation();
  const { state, stateJob, start, cancel } = useLectureExport();
  const isRunning = state.phase === 'running';
  // Kết quả của lần xuất trước chỉ còn đúng khi chưa đổi lựa chọn nào.
  const isCurrent = isRunning || stateJob === job;
  const minutes = Math.max(1, Math.ceil(job.timeline.duration / 60));
  const percent = isRunning ? Math.floor(state.progress * 100) : 0;

  const message = (() => {
    if (!isCurrent) return null;
    switch (state.phase) {
      case 'running':
        return { isAlert: false, text: t('lecture.panel.exporting', { percent: Math.floor(percent / ANNOUNCE_STEP) * ANNOUNCE_STEP }) };
      case 'done':
        return { isAlert: false, text: t('lecture.panel.exportDone', { name: state.fileName, size: state.sizeMb.toLocaleString(i18n.language) }) };
      case 'error':
        return { isAlert: true, text: t('lecture.panel.exportError', { message: state.message }) };
      case 'hidden':
        return { isAlert: true, text: t('lecture.panel.exportHidden') };
      case 'unsupported':
        return { isAlert: true, text: t('lecture.panel.exportUnsupported') };
      default:
        return null;
    }
  })();

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" disabled={isRunning || !isReady} onClick={() => void start(job)}>
          <Film /> {t('lecture.panel.export')}
        </button>
        {isRunning && (
          <>
            <progress className="h-2 w-48" max={1} value={state.progress} aria-label={t('lecture.panel.progress')} aria-valuetext={`${percent}%`} />
            <span className="text-sm tabular-nums" aria-hidden="true">
              {percent}%
            </span>
            <button type="button" className="btn btn-ghost" onClick={cancel}>
              {t('lecture.panel.cancel')}
            </button>
          </>
        )}
      </div>
      {/* Vùng thông báo luôn có mặt, để trình đọc màn hình nhận ra mỗi lần chữ đổi. */}
      <p role="status" aria-live="polite" className={`text-sm ${message?.isAlert ? 'text-danger' : ''}`}>
        {message?.text}
      </p>
      <p className="text-sm text-muted">{t('lecture.panel.silentNote')}</p>
      {isRunning && state.isRealtime && <p className="text-sm text-muted">{t('lecture.panel.realtimeNote', { minutes })}</p>}
    </div>
  );
}
