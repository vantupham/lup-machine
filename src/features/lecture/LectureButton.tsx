import { lazy, Suspense, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClassRecord, SampleRecord } from '@/storage/db';
import { useImageLabContext } from '@/features/studio/image/lab/ImageLabContext';
import { Film } from '@/ui/icons';

const LecturePanel = lazy(() => import('./LecturePanel').then((m) => ({ default: m.LecturePanel })));

interface LectureButtonProps {
  readonly projectId: string;
  readonly projectName: string;
  readonly classes: readonly ClassRecord[];
  readonly samples: readonly SampleRecord[];
}

/** Nút mở "Video bài giảng" ở đầu trang dự án ảnh: chỉ bật khi đã huấn luyện ít nhất một lần. */
export function LectureButton({ projectId, projectName, classes, samples }: LectureButtonProps) {
  const { t } = useTranslation();
  const lab = useImageLabContext();
  const [isOpen, setIsOpen] = useState(false);
  const hasRun = lab.experiments.runs.length > 0;
  // Giữ nguyên hàm: Dialog chạy lại effect (trả focus) mỗi khi onClose đổi.
  const close = useCallback(() => setIsOpen(false), []);
  return (
    <>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={!hasRun}
        title={hasRun ? undefined : t('lecture.panel.openHint')}
        aria-describedby={hasRun ? undefined : 'lecture-open-hint'}
        onClick={() => setIsOpen(true)}
      >
        <Film /> {t('lecture.panel.open')}
      </button>
      {!hasRun && (
        <span id="lecture-open-hint" className="sr-only">
          {t('lecture.panel.openHint')}
        </span>
      )}
      {isOpen && (
        <Suspense fallback={null}>
          <LecturePanel projectId={projectId} projectName={projectName} classes={classes} samples={samples} onClose={close} />
        </Suspense>
      )}
    </>
  );
}
