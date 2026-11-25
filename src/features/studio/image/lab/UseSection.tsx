/** Bước 6 Sử dụng của Studio ảnh: thử mô hình với ảnh MỚI từ webcam hoặc tệp, kèm giải thích. Ảnh thử không được lưu. */
import { useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { SoftmaxParams } from '@/core/ml/softmax-regression';
import type { ClassRecord, SampleRecord, StoredImage } from '@/storage/db';
import { getErrorMessage } from '@/ui/error-message';
import { ACCEPTED_IMAGE_TYPES, validateImageFile } from '../image-file';
import { fileToStoredImage } from '../image-codec.browser';
import { useObjectUrl } from '../useObjectUrl';
import { analyzeImage } from './analyze-image';
import type { ImageSubject } from './image-subject';
import { LiveCamera } from './LiveCamera';
import { PredictionExplainer } from './PredictionExplainer';
import { predictProbe } from './probe';
import { ProbeMap, ProbeNeighbors } from './ProbeInsights';
import { ProbeResult } from './ProbeResult';
import { Camera, ImageUp, Lock, Pause, Play } from '@/ui/icons';
import { StepNumber } from '@/ui/StepNumber';
import { StepNotebook } from '@/features/notebook/StepNotebook';

type Source = 'none' | 'webcam' | 'upload';

interface Probe {
  readonly subject: ImageSubject;
  readonly vector: Float32Array;
}

interface UseSectionProps {
  readonly classes: readonly ClassRecord[];
  readonly samples: readonly SampleRecord[];
  readonly features: ReadonlyMap<string, Float32Array>;
  /** Mô hình đang hiển thị (cùng epoch với bước 5); null khi chưa huấn luyện. */
  readonly params: SoftmaxParams | null;
  readonly epoch: number | null;
}

export function UseSection({ classes, samples, features, params, epoch }: UseSectionProps) {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="use-title" className="space-y-4">
      <h2 id="use-title" className="flex items-center gap-3 text-2xl font-semibold"><StepNumber n={6} />{t('project.use.title')}</h2>
      <p className="max-w-3xl text-sm text-muted">{t('project.use.lead')}</p>
      {params === null ? (
        <p className="text-sm text-muted">{t('project.use.needModel')}</p>
      ) : (
        <ProbeLab classes={classes} samples={samples} features={features} params={params} epoch={epoch} />
      )}
      <StepNotebook step="use" />
    </section>
  );
}

interface ProbeLabProps extends Omit<UseSectionProps, 'params'> {
  readonly params: SoftmaxParams;
}

function ProbeLab({ classes, samples, features, params, epoch }: ProbeLabProps) {
  const { t } = useTranslation();
  const [source, setSource] = useState<Source>('none');
  const [isPaused, setIsPaused] = useState(false);
  const [probe, setProbe] = useState<Probe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const counter = useRef(0);
  /** Mỗi hành động mới (tải ảnh, bật / tắt camera) tăng số này; kết quả của hành động cũ về muộn bị bỏ qua. */
  const request = useRef(0);

  const nextSubject = (image: StoredImage): ImageSubject => ({ id: `probe-${++counter.current}`, image });

  const onFrame = async (image: StoredImage, isCurrent: () => boolean) => {
    const vector = await analyzeImage(image);
    if (!isCurrent()) return; // đã dừng hình hoặc tắt camera: giữ nguyên khung đang hiện
    setProbe({ subject: nextSubject(image), vector });
    setError(null);
  };

  const onUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; // lấy tệp TRƯỚC khi xóa giá trị ô chọn tệp
    e.target.value = '';
    if (!file) return;
    const rejected = validateImageFile(file);
    if (rejected) return setError(t('project.use.rejected', { reason: t(`project.upload.reasons.${rejected}`) }));
    const myRequest = ++request.current;
    const isCurrent = () => request.current === myRequest;
    setSource('upload');
    setIsBusy(true);
    setError(null);
    try {
      const image = await fileToStoredImage(file); // không làm mờ vì ảnh thử không bao giờ được lưu
      const vector = await analyzeImage(image);
      if (isCurrent()) setProbe({ subject: nextSubject(image), vector });
    } catch (err: unknown) {
      console.error('Không phân tích được ảnh thử', err);
      if (isCurrent()) {
        setProbe(null);
        setError(t('project.use.badImage'));
      }
    } finally {
      if (isCurrent()) setIsBusy(false);
    }
  };

  const switchTo = (next: Source) => {
    request.current += 1;
    setSource(next);
    setIsPaused(false);
    setIsBusy(false);
    setProbe(null);
    setError(null);
  };

  let prediction = null;
  let mismatch: string | null = null;
  if (probe) {
    try {
      prediction = predictProbe(params, probe.vector);
    } catch (err: unknown) {
      mismatch = getErrorMessage(err);
    }
  }
  const isStill = source === 'upload' || (source === 'webcam' && isPaused);

  return (
    <div className="space-y-6">
      {epoch !== null && <p className="text-xs text-muted">{t('project.use.atEpoch', { epoch })}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {source === 'webcam' ? (
          <>
            <button type="button" className="btn btn-primary" onClick={() => setIsPaused((p) => !p)} disabled={!probe && !isPaused}>
              {isPaused ? <Play /> : <Pause />}
              {t(isPaused ? 'project.use.resume' : 'project.use.freeze')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => switchTo('none')}>
              {t('project.use.stopCamera')}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => switchTo('webcam')}>
            <Camera />
            {t('project.use.startCamera')}
          </button>
        )}
        <label className="btn btn-ghost cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-primary">
          <ImageUp />
          {t('project.use.upload')}
          <input
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            className="sr-only"
            aria-label={t('project.use.uploadLabel')}
            onChange={(e) => void onUpload(e)}
          />
        </label>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {mismatch && <p role="alert" className="text-sm text-danger">{t('project.use.frameError', { message: mismatch })}</p>}

      <div className="grid gap-6 md:grid-cols-[minmax(0,24rem)_1fr]">
        <div className="space-y-2">
          {source === 'webcam' && (
            <LiveCamera
              isPaused={isPaused}
              onFrame={onFrame}
              onError={(err) => setError(t('project.use.frameError', { message: getErrorMessage(err) }))}
            />
          )}
          {source === 'upload' && probe && <StillImage subject={probe.subject} />}
          {source === 'webcam' && !isPaused && <p className="text-xs text-muted">{t('project.use.liveHint')}</p>}
          <p className="text-xs text-muted"><Lock /> {t('project.use.privacy')}</p>
        </div>
        <div className="space-y-4">
          {isBusy && <p role="status" className="text-sm">{t('project.use.analyzing')}</p>}
          {source !== 'none' && !probe && !isBusy && !error && <p role="status" className="text-sm">{t('project.use.analyzing')}</p>}
          {source === 'none' && <p className="text-sm text-muted">{t('project.use.empty')}</p>}
          {probe && prediction && (
            <>
              <ProbeResult prediction={prediction} classes={classes} />
              <ProbeMap classes={classes} samples={samples} features={features} vector={probe.vector} predicted={prediction.predicted} />
            </>
          )}
        </div>
      </div>

      {isStill && probe && prediction && (
        <div className="space-y-4">
          <ProbeNeighbors classes={classes} samples={samples} features={features} vector={probe.vector} />
          <PredictionExplainer sample={probe.subject} vector={probe.vector} classes={classes} params={params} showProbabilities={false} />
        </div>
      )}
    </div>
  );
}

function StillImage({ subject }: { subject: ImageSubject }) {
  const { t } = useTranslation();
  const url = useObjectUrl(subject.image);
  return <img src={url} alt={t('project.use.stillAlt')} width={224} height={224} className="aspect-square w-full max-w-sm rounded border border-rule" />;
}
