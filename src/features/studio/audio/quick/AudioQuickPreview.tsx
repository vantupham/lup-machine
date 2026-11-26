import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { audioFeatures, fitClip } from '@/core/audio/features';
import { encodeVector, predictVector, type TrainedVectorModel, type VectorData } from '@/core/ml/vector-classifier';
import { ProbaBars } from '@/features/studio/quick/ProbaBars';
import { getErrorMessage } from '@/ui/error-message';
import { Mic, Play, Upload } from '@/ui/icons';
import { decodeAudioFile, isAudioSupported, playClip, recordClip } from '../audio-io.browser';
import { RECORD_SECONDS } from '../useAudioData';

interface AudioQuickPreviewProps {
  readonly model: TrainedVectorModel | null;
  readonly data: VectorData | null;
}

/** Cột 3: thu 1 giây hoặc chọn một tệp để thử mô hình. Âm thanh thử không được lưu. */
export function AudioQuickPreview({ model, data }: AudioQuickPreviewProps) {
  const { t } = useTranslation();
  if (!model || !data) return <p className="text-sm text-muted">{t('project.quick.needModel')}</p>;
  return <PreviewLab model={model} data={data} />;
}

function PreviewLab({ model, data }: { readonly model: TrainedVectorModel; readonly data: VectorData }) {
  const { t } = useTranslation();
  const [signal, setSignal] = useState<Float32Array | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Mỗi lần thử mới tăng số này; kết quả của lần cũ về muộn bị bỏ qua. */
  const request = useRef(0);

  const take = async (get: () => Promise<Float32Array>) => {
    const mine = ++request.current;
    setIsBusy(true);
    setError(null);
    try {
      const next = fitClip(await get());
      if (mine === request.current) setSignal(next);
    } catch (err: unknown) {
      if (mine === request.current) setError(t('project.quick.previewError', { message: getErrorMessage(err) }));
    } finally {
      if (mine === request.current) setIsBusy(false);
    }
  };

  const prediction = signal ? predictVector(model, encodeVector(data, audioFeatures(signal))) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-ghost px-2.5 py-1 text-sm"
          disabled={isBusy || !isAudioSupported()}
          onClick={() => void take(async () => (await recordClip(RECORD_SECONDS)).result)}
        >
          <Mic /> {isBusy ? t('audio.data.recording') : t('audio.quick.tryRecord')}
        </button>
        <label className="btn btn-ghost cursor-pointer px-2.5 py-1 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary">
          <Upload /> {t('audio.quick.tryFileShort')}
          <input
            type="file"
            accept="audio/*,.wav,.mp3,.ogg,.m4a,.webm"
            aria-label={t('audio.quick.tryFile')}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]; // lấy tệp TRƯỚC khi xóa giá trị ô chọn tệp
              e.target.value = '';
              if (file) void take(() => decodeAudioFile(file));
            }}
          />
        </label>
        {signal && (
          <button type="button" className="btn btn-ghost px-2.5 py-1 text-sm" onClick={() => playClip(signal)}>
            <Play /> {t('audio.quick.play')}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {prediction && <ProbaBars classNames={data.classNames} probabilities={prediction.proba} />}
    </div>
  );
}
