import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClassRecord, Split, StoredImage } from '@/storage/db';
import { MAX_SAMPLES_PER_CLASS } from '@/storage/repositories/dataset-repository';
import { useDatasetRepository } from '@/storage/repository-context';
import { getErrorMessage } from '@/ui/error-message';
import { planUpload, type ImageFileError } from './image-file';
import { fileToStoredImage } from './image-codec.browser';
import { FaceBlurError } from './face-blur-error';
import { faceBlurSummary } from './face-blur-message';

type RejectReason = ImageFileError | 'too-many' | 'decode' | 'blur';
type Notify = (text: string, kind: 'info' | 'error') => void;

/** Xử lý tải nhiều ảnh: kiểm tra → chuyển về 224×224 → lưu theo lô; báo tệp bị bỏ qua và lý do. */
export function useImageUpload(projectId: string, notify: Notify, reload: () => Promise<void>, blurFaces = false) {
  const { t } = useTranslation();
  const dataset = useDatasetRepository();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const upload = async (cls: ClassRecord, files: File[], split: Split, existing: number) => {
    const room = Math.max(0, MAX_SAMPLES_PER_CLASS - existing);
    const plan = planUpload(files);
    const reasons: RejectReason[] = plan.rejected.map((r) => r.reason);
    const toProcess = plan.accepted.slice(0, room);
    reasons.push(...plan.accepted.slice(room).map((): RejectReason => 'too-many'));

    const images: StoredImage[] = [];
    let faces = 0;
    setProgress({ done: 0, total: toProcess.length });
    for (const [i, file] of toProcess.entries()) {
      // Nhường luồng giao diện giữa các ảnh (phát hiện khuôn mặt chạy trên luồng chính).
      if (blurFaces && i > 0) await new Promise((resolve) => window.setTimeout(resolve, 0));
      try {
        images.push(await fileToStoredImage(file, { blurFaces, onFaces: (n) => (faces += n) }));
      } catch (error: unknown) {
        reasons.push(error instanceof FaceBlurError ? 'blur' : 'decode');
      }
      setProgress({ done: i + 1, total: toProcess.length });
    }
    setProgress(null);

    try {
      if (images.length > 0) {
        await dataset.addSamples(images.map((image) => ({ projectId, classId: cls.id, split, source: 'upload' as const, image })));
      }
      const blurNote = blurFaces ? faceBlurSummary(t, faces, images.length) : '';
      notify([summarize(images.length, cls.name, split, reasons), blurNote].filter(Boolean).join(' '), reasons.length > 0 && images.length === 0 ? 'error' : 'info');
    } catch (error: unknown) {
      notify(t('project.data.actionError', { message: getErrorMessage(error) }), 'error');
    } finally {
      await reload();
    }
  };

  const summarize = (added: number, name: string, split: Split, reasons: readonly RejectReason[]) => {
    const parts = added > 0 ? [t('project.upload.added', { count: added, name, split: t(`project.class.${split}`) })] : [];
    if (reasons.length > 0) {
      const unique = [...new Set(reasons)].map((r) => t(`project.upload.reasons.${r}`)).join(', ');
      parts.push(t('project.upload.skipped', { count: reasons.length, reasons: unique }));
    }
    return parts.join(' ');
  };

  return { upload, progress };
}
