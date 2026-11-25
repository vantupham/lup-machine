import { useTranslation } from 'react-i18next';
import type { ClassRecord, SampleRecord } from '@/storage/db';
import { DEFAULT_TRAIN_OPTIONS } from '../lab/TrainSection';
import type { ImageLab } from '../lab/useImageLab';

/** Cần ít nhất chừng này lớp có ảnh Dạy mới huấn luyện được (khớp với lab-data). */
const MIN_CLASSES_WITH_IMAGES = 2;

interface QuickTrainProps {
  readonly classes: readonly ClassRecord[];
  readonly samples: readonly SampleRecord[];
  readonly lab: ImageLab;
}

/** Cột ②: một nút làm hết (biến ảnh thành vector → huấn luyện 50 lượt), kèm đường "mở nắp" xuống bước ④. */
export function QuickTrain({ classes, samples, lab }: QuickTrainProps) {
  const { t } = useTranslation();
  const ids = new Set(classes.map((c) => c.id));
  const classesWithImages = new Set(samples.filter((s) => s.split === 'train' && ids.has(s.classId)).map((s) => s.classId)).size;
  const isReady = classesWithImages >= MIN_CLASSES_WITH_IMAGES;
  const isExtracting = lab.status.phase === 'loading-model' || lab.status.phase === 'extracting';
  const isBusy = isExtracting || lab.isTraining;

  return (
    <div className="space-y-3">
      <button
        type="button"
        className="btn btn-primary w-full justify-center py-3 text-base"
        disabled={!isReady || isBusy}
        onClick={() => void lab.trainQuick()}
      >
        {t('project.quick.train')}
      </button>
      {!isReady && <p className="text-sm text-warning">{t('project.quick.needClasses')}</p>}
      <div className="min-h-10 text-sm">
        <p aria-live="polite">
          <TrainProgress lab={lab} />
        </p>
        {lab.isTraining && (
          <p aria-hidden="true" className="font-mono text-xs text-muted">
            {t('project.quick.epochCounter', { epoch: lab.snapshots.length, total: lab.lastOptions?.epochs ?? DEFAULT_TRAIN_OPTIONS.epochs })}
          </p>
        )}
      </div>
      <p className="text-xs text-muted">{t('project.quick.defaults', { epochs: DEFAULT_TRAIN_OPTIONS.epochs })}</p>
      <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => revealHeading('train-title')}>
        {t('project.quick.openLid')} <span aria-hidden="true">↓</span>
      </button>
    </div>
  );
}

function TrainProgress({ lab }: { readonly lab: ImageLab }) {
  const { t } = useTranslation();
  const { status, isTraining, isStale, snapshot, notice } = lab;
  if (status.phase === 'loading-model') return <>{t('project.quick.loadingModel')}</>;
  if (status.phase === 'extracting') return <>{t('project.quick.extracting', { done: status.done, total: status.total })}</>;
  if (status.phase === 'error') return <span className="text-danger">{t('project.quick.error', { message: status.message })}</span>;
  if (notice?.kind === 'error') return <span className="text-danger">{notice.text}</span>;
  if (isStale) return <span className="text-warning">{t('project.quick.stale')}</span>;
  if (isTraining) return <>{t('project.quick.training')}</>;
  if (snapshot) return <span className="font-medium text-accent">{t('project.quick.done', { percent: Math.round(snapshot.train.accuracy * 100) })}</span>;
  return null;
}

/** Cuộn tới tiêu đề một phần bên dưới (chừa chỗ cho thanh các bước) và đưa con trỏ vào đó. */
export function revealHeading(id: string): void {
  const heading = document.getElementById(id);
  if (!heading) return;
  const section = heading.closest('section') ?? heading;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const stickyBar = document.querySelector<HTMLElement>('nav[data-step-bar]')?.offsetHeight ?? 0;
  window.scrollTo({ top: section.getBoundingClientRect().top + window.scrollY - stickyBar - 12, behavior: reduceMotion ? 'auto' : 'smooth' });
  heading.setAttribute('tabindex', '-1');
  heading.focus({ preventScroll: true });
}
