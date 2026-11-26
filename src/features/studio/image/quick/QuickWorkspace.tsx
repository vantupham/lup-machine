import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClassRecord, SampleRecord } from '@/storage/db';
import { useImageLabContext } from '../lab/ImageLabContext';
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
    <section aria-labelledby="quick-title" className="space-y-4">
      <div>
        <h2 id="quick-title" className="font-display text-2xl font-bold">{t('project.quick.title')}</h2>
        <p className="max-w-3xl text-sm text-muted">{t('project.quick.lead')}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr_1fr]">
        <Column title={t('project.quick.columns.data')}>
          <QuickClasses classes={classes} samplesByClass={samplesByClass} onWebcam={onWebcam} onUpload={onUpload} onAddClass={onAddClass} onRename={onRename} />
        </Column>
        <Column title={t('project.quick.columns.train')}>
          <QuickTrain classes={classes} samples={samples} lab={lab} />
        </Column>
        <Column title={t('project.quick.columns.preview')}>
          <QuickPreview classes={classes} lab={lab} isCameraBusy={isCapturing} />
        </Column>
      </div>
    </section>
  );
}

function Column({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <div className="lab-card relative h-fit space-y-3 p-4">
      <h3 className="font-display text-lg font-bold">{title}</h3>
      {children}
    </div>
  );
}
