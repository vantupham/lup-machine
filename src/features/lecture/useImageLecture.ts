import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClassRecord, SampleRecord } from '@/storage/db';
import type { ModelCardFields } from '@/storage/schemas/model-card';
import { useRepositories } from '@/storage/repository-context';
import { useDeepChecks } from '@/features/studio/image/deep-check/useDeepChecks';
import { useImageLabContext } from '@/features/studio/image/lab/ImageLabContext';
import { buildImageLecture } from './build-image-script';
import { imageLectureInput } from './image-lecture-input';
import type { LectureLevel } from './lecture-script';
import { LectureThumbsCancelled, loadLectureThumbs } from './lecture-thumbs.browser';

export interface LectureOptions {
  readonly level: LectureLevel;
  readonly includeStudentWriting: boolean;
}

type Thumbs = { readonly phase: 'loading' } | { readonly phase: 'ready'; readonly map: ReadonlyMap<number, readonly CanvasImageSource[]> } | { readonly phase: 'error' };

const EMPTY_THUMBS: ReadonlyMap<number, readonly CanvasImageSource[]> = new Map();

/** Ảnh thu nhỏ đã làm mờ mặt, tải một lần khi mở bảng video. */
function useThumbs(classes: readonly ClassRecord[], samples: readonly SampleRecord[]): Thumbs {
  const [thumbs, setThumbs] = useState<Thumbs>({ phase: 'loading' });
  useEffect(() => {
    let isActive = true;
    loadLectureThumbs(classes, samples, () => !isActive).then(
      (map) => isActive && setThumbs({ phase: 'ready', map }),
      (error: unknown) => {
        if (error instanceof LectureThumbsCancelled) return;
        console.error('Không làm mờ được ảnh cho video', error);
        if (isActive) setThumbs({ phase: 'error' });
      },
    );
    return () => {
      isActive = false;
    };
    // Chỉ tải khi mở bảng: dữ liệu không đổi trong lúc bảng đang mở (hộp thoại che trang).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return thumbs;
}

function useModelCard(projectId: string): ModelCardFields | null {
  const repos = useRepositories();
  const [card, setCard] = useState<ModelCardFields | null>(null);
  useEffect(() => {
    let isActive = true;
    repos.modelCards.get(projectId).then(
      (found) => isActive && setCard(found),
      (error: unknown) => console.error('Không đọc được thẻ mô hình', error),
    );
    return () => {
      isActive = false;
    };
  }, [repos, projectId]);
  return card;
}

/** Dựng kịch bản bài giảng từ trạng thái thật của trang dự án ảnh (mô hình đang mở, nhật ký, soi kỹ). */
export function useImageLecture(projectId: string, projectName: string, classes: readonly ClassRecord[], samples: readonly SampleRecord[], options: LectureOptions) {
  const { t, i18n } = useTranslation();
  const lab = useImageLabContext();
  const deep = useDeepChecks(classes, samples);
  const modelCard = useModelCard(projectId);
  const thumbs = useThumbs(classes, samples);

  useEffect(() => {
    void deep.run();
    // Soi kỹ một lần khi mở bảng.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDeepReady = deep.status.phase === 'idle' && deep.hasMeasured && deep.missingCount === 0;
  const lastEpoch = lab.snapshots.at(-1)?.epoch ?? null;
  const input = useMemo(
    () =>
      imageLectureInput({
        projectName,
        classes,
        samples,
        runs: lab.experiments.runs,
        current: {
          runNumber: lab.currentRunNumber,
          fingerprint: lab.fingerprint,
          isStale: lab.isStale,
          isTraining: lab.isTraining,
          isFinalEpoch: lab.shownEpoch !== null && lab.shownEpoch === lastEpoch,
          predictions: lab.predictions,
        },
        deepCheck: isDeepReady ? { duplicates: deep.duplicates, backgrounds: deep.backgrounds } : null,
        modelCard,
        level: options.level,
        includeStudentWriting: options.includeStudentWriting,
      }),
    [projectName, classes, samples, lab.experiments.runs, lab.currentRunNumber, lab.fingerprint, lab.isStale, lab.isTraining, lab.shownEpoch, lastEpoch, lab.predictions, isDeepReady, deep.duplicates, deep.backgrounds, modelCard, options.level, options.includeStudentWriting],
  );
  const script = useMemo(() => buildImageLecture(t, i18n.language, input), [t, i18n.language, input]);

  return {
    script,
    hasEvaluation: input.evaluation !== null,
    deepStatus: deep.status,
    deepError: deep.status.phase === 'error' ? deep.status.message : null,
    thumbs: thumbs.phase === 'ready' ? thumbs.map : EMPTY_THUMBS,
    thumbsFailed: thumbs.phase === 'error',
    thumbsPhase: thumbs.phase,
  };
}
