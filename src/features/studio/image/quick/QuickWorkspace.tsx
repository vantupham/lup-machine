import { useTranslation } from 'react-i18next';
import type { ClassRecord, SampleRecord } from '@/storage/db';
import { useImageLabContext } from '../lab/ImageLabContext';
import { QuickLayout } from '@/features/studio/quick/QuickLayout';
import { QuickClasses } from './QuickClasses';
import { QuickPreview } from './QuickPreview';
import { QuickTrain } from './QuickTrain';

interface QuickWorkspaceProps {
  readonly classes: readonly ClassRecord[];
  readonly samples: readonly SampleRecord[];
  readonly samplesByClass: ReadonlyMap<string, readonly SampleRecord[]>;
  readonly onWebcam: (cls: ClassRecord) => void;
  readonly onUpload: (cls: ClassRecord, files: readonly File[]) => void;
  readonly onAddClass: () => void;
  /** Đổi tên lớp; trả về false nếu lỗi (ô sửa vẫn mở). */
  readonly onRename: (cls: ClassRecord, name: string) => Promise<boolean>;
  /** Hộp chụp ảnh webcam đang mở. */
  readonly isCapturing: boolean;
}

/**
 * Chế độ Khám phá: cả quy trình trên một màn hình như Teachable Machine (thu ảnh → học → thử).
 * Dùng chung mô hình với các bước "mở nắp" bên dưới, nên làm nhanh xong vẫn mở nắp xem được.
 */
export function QuickWorkspace({ classes, samples, samplesByClass, onWebcam, onUpload, onAddClass, onRename, isCapturing }: QuickWorkspaceProps) {
  const { t } = useTranslation();
  const lab = useImageLabContext();
  return (
    <QuickLayout
      lead={t('project.quick.lead')}
      columns={[t('project.quick.columns.data'), t('project.quick.columns.train'), t('project.quick.columns.preview')]}
    >
      <QuickClasses classes={classes} samplesByClass={samplesByClass} onWebcam={onWebcam} onUpload={onUpload} onAddClass={onAddClass} onRename={onRename} />
      <QuickTrain classes={classes} samples={samples} lab={lab} />
      <QuickPreview classes={classes} lab={lab} isCameraBusy={isCapturing} />
    </QuickLayout>
  );
}
