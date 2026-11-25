import { useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { SoftmaxParams } from '@/core/ml/softmax-regression';
import type { ClassRecord, StoredImage } from '@/storage/db';
import { getErrorMessage } from '@/ui/error-message';
import { ACCEPTED_IMAGE_TYPES, validateImageFile } from '../image-file';
import { fileToStoredImage } from '../image-codec.browser';
import { analyzeImage } from '../lab/analyze-image';
import { LiveCamera } from '../lab/LiveCamera';
import { predictProbe } from '../lab/probe';
import type { ImageLab } from '../lab/useImageLab';
import { Camera, ImageUp, Pause } from '@/ui/icons';
import { ClassMarker } from '@/ui/ClassMarker';

interface QuickPreviewProps {
  readonly classes: readonly ClassRecord[];
  readonly lab: ImageLab;
  /** Hộp chụp ảnh đang dùng webcam: tạm tắt xem thử (nhiều máy không mở được một camera hai lần). */
  readonly isCameraBusy: boolean;
}

/** Cột 3: thử mô hình ngay với webcam hoặc một tệp ảnh. Ảnh thử không được lưu. */
export function QuickPreview({ classes, lab, isCameraBusy }: QuickPreviewProps) {
  const { t } = useTranslation();
  const params = lab.snapshot?.params ?? null;
  if (!params) return <p className="text-sm text-muted">{t('project.quick.needModel')}</p>;
  return <PreviewLab classes={classes} params={params} isCameraBusy={isCameraBusy} />;
}

interface PredictionProps {
  readonly classes: readonly ClassRecord[];
  readonly params: SoftmaxParams;
}

function PreviewLab({ classes, params, isCameraBusy }: PredictionProps & { readonly isCameraBusy: boolean }) {
  const { t } = useTranslation();
  const [isLive, setIsLive] = useState(false);
  const [vector, setVector] = useState<Float32Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Mỗi hành động mới tăng số này; kết quả của hành động cũ về muộn bị bỏ qua. */
  const request = useRef(0);

  const show = async (image: StoredImage, isCurrent: () => boolean) => {
    const next = await analyzeImage(image);
    if (!isCurrent()) return;
    setVector(next);
    setError(null);
  };

  const onUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; // lấy tệp TRƯỚC khi xóa giá trị ô chọn tệp
    e.target.value = '';
    if (!file) return;
    const rejected = validateImageFile(file);
    if (rejected) return setError(t('project.use.rejected', { reason: t(`project.upload.reasons.${rejected}`) }));
    const mine = ++request.current;
    setIsLive(false);
    try {
      await show(await fileToStoredImage(file), () => mine === request.current);
    } catch (err: unknown) {
      console.error('Không thử được ảnh', err);
      setError(t('project.quick.previewError', { message: getErrorMessage(err) }));
    }
  };

  const toggleLive = () => {
    request.current++;
    setIsLive((on) => !on);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost px-2.5 py-1 text-sm" onClick={toggleLive}>
          {isLive ? <Pause /> : <Camera />}
          {isLive ? t('project.quick.liveStop') : t('project.quick.liveStart')}
        </button>
        <label className="btn btn-ghost cursor-pointer px-2.5 py-1 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary">
          <ImageUp /> {t('project.quick.tryFileShort')}
          <input type="file" accept={ACCEPTED_IMAGE_TYPES.join(',')} aria-label={t('project.quick.tryFile')} className="sr-only" onChange={(e) => void onUpload(e)} />
        </label>
      </div>
      {isLive && isCameraBusy && <p className="text-sm text-muted">{t('project.quick.cameraBusy')}</p>}
      {isLive && !isCameraBusy && (
        <LiveCamera
          isPaused={false}
          onFrame={show}
          onError={(err) => setError(t('project.quick.previewError', { message: getErrorMessage(err) }))}
        />
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {vector && <Prediction classes={classes} params={params} vector={vector} />}
    </div>
  );
}

function Prediction({ classes, params, vector }: PredictionProps & { readonly vector: Float32Array }) {
  const { t } = useTranslation();
  const { probabilities } = predictProbe(params, vector);
  const rows = classes
    .map((cls, i) => ({ cls, index: i, percent: Math.round((probabilities[i] ?? 0) * 100) }))
    .sort((a, b) => b.percent - a.percent);

  return (
    <ul aria-label={t('project.quick.resultLabel')} className="space-y-2">
      {rows.map(({ cls, index, percent }, rank) => (
        <li key={cls.id} className="text-sm">
          <div className="flex justify-between gap-2">
            <span className={rank === 0 ? 'font-semibold' : ''}>
              <ClassMarker index={index} className="mr-1.5" />
              {cls.name}
            </span>
            <span className="font-mono">{percent}%</span>
          </div>
          <div aria-hidden="true" className="mt-1 h-2.5 overflow-hidden rounded-full bg-rule/70">
            <div className={`h-full rounded-full ${rank === 0 ? 'bg-primary' : 'bg-muted/60'}`} style={{ width: `${percent}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
