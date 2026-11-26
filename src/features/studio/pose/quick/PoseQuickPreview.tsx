import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { encodeVector, predictVector, type TrainedVectorModel, type VectorData } from '@/core/ml/vector-classifier';
import { poseFeatures, type PoseKind } from '@/core/pose/features';
import { ProbaBars } from '@/features/studio/quick/ProbaBars';
import { getErrorMessage } from '@/ui/error-message';
import { Camera, ImageUp, Pause } from '@/ui/icons';
import { grabFrame, imageFromFile, loadDetector, type PoseDetection } from '../pose-io.browser';
import { Skeleton } from '../Skeleton';
import type { CameraHost } from '../usePoseData';

interface PoseQuickPreviewProps {
  readonly kind: PoseKind;
  readonly model: TrainedVectorModel | null;
  readonly data: VectorData | null;
  /** Camera đang mở ở đâu (cột 3 dùng chung camera của cột 1). */
  readonly camera: CameraHost | null;
  readonly setCamera: (host: CameraHost | null) => void;
  /** Khung xương mới nhất từ camera của khối làm nhanh. */
  readonly liveDetection: PoseDetection | null;
}

/** Cột 3: đoán trực tiếp từ camera của cột 1, hoặc thử một ảnh. Ảnh thử không được lưu. */
export function PoseQuickPreview(props: PoseQuickPreviewProps) {
  const { t } = useTranslation();
  if (!props.model || !props.data) return <p className="text-sm text-muted">{t('project.quick.needModel')}</p>;
  return <PreviewLab {...props} model={props.model} data={props.data} />;
}

function PreviewLab({ kind, model, data, camera, setCamera, liveDetection }: PoseQuickPreviewProps & { readonly model: TrainedVectorModel; readonly data: VectorData }) {
  const { t } = useTranslation();
  const [fileDetection, setFileDetection] = useState<PoseDetection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isLive = camera === 'quick';
  const detection = isLive ? liveDetection : fileDetection;
  const features = detection ? poseFeatures(kind, detection.keypoints) : null;
  const prediction = features ? predictVector(model, encodeVector(data, features)) : null;

  const upload = async (file: File) => {
    setError(null);
    setCamera(null);
    try {
      const frame = grabFrame(await imageFromFile(file), false);
      if (!frame) throw new Error(t('pose.use.badImage'));
      setFileDetection(await (await loadDetector(kind))(frame));
    } catch (err: unknown) {
      setError(t('project.quick.previewError', { message: getErrorMessage(err) }));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost px-2.5 py-1 text-sm" onClick={() => setCamera(isLive ? null : 'quick')}>
          {isLive ? <Pause /> : <Camera />}
          {isLive ? t('pose.quick.tryLiveStop') : t('pose.quick.tryLive')}
        </button>
        <label className="btn btn-ghost cursor-pointer px-2.5 py-1 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary">
          <ImageUp /> {t('pose.quick.tryFileShort')}
          <input
            type="file"
            accept="image/*"
            aria-label={t('pose.quick.tryFile')}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]; // lấy tệp TRƯỚC khi xóa giá trị ô chọn tệp
              e.target.value = '';
              if (file) void upload(file);
            }}
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {!isLive && fileDetection && (
        <Skeleton kind={kind} keypoints={fileDetection.keypoints} width={fileDetection.width} height={fileDetection.height} label={t('pose.camera.overlay')} className="max-h-40" />
      )}
      {detection && !features && <p className="text-sm text-warning">{t('pose.quick.noPose')}</p>}
      {prediction && <ProbaBars classNames={data.classNames} probabilities={prediction.proba} />}
    </div>
  );
}
