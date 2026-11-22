import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { channelPlane, planeToGrayRgba, strongestChannels, type ActivationTensor } from '@/core/ml/feature-maps';
import { FEATURE_MAP_LAYERS } from '@/core/ml/feature-model';
import type { SampleRecord } from '@/storage/db';
import { ExactBadge } from '@/ui/ExactBadge';
import { useObjectUrl } from '../useObjectUrl';
import { useLayerActivations } from './useLayerActivations';

const SHOWN_CHANNELS = 8;

/** Mở bên trong mạng CNN: mỗi ô là một kênh (bộ lọc), sáng = kênh đó phản ứng mạnh ở vùng ấy. */
export function FeatureMapViewer({ sample }: { readonly sample: SampleRecord }) {
  const { t } = useTranslation();
  const { state, load } = useLayerActivations(sample);
  const [layerIndex, setLayerIndex] = useState(0);

  return (
    <section className="space-y-2 border-t border-rule pt-3" aria-labelledby="fmap-title" data-testid="feature-maps">
      <div className="flex flex-wrap items-center gap-2">
        <h4 id="fmap-title" className="font-semibold">{t('project.featureMaps.title')}</h4>
        <ExactBadge label={t('project.featureMaps.badge')} hint={t('project.featureMaps.badgeHint')} />
      </div>
      <p className="text-xs text-muted">{t('project.featureMaps.lead')}</p>
      {(state.status === 'idle' || state.status === 'loading') && (
        <button type="button" className="btn" onClick={load} disabled={state.status === 'loading'}>
          {t(state.status === 'loading' ? 'project.featureMaps.loading' : 'project.featureMaps.open')}
        </button>
      )}
      {state.status === 'error' && <p role="alert" className="text-sm text-danger">{t('project.featureMaps.error', { message: state.message })}</p>}
      {state.status === 'ready' && (
        <>
          <div className="flex flex-wrap gap-1 text-xs" role="group" aria-label={t('project.featureMaps.layers')}>
            {FEATURE_MAP_LAYERS.map((l, i) => (
              <button
                key={l.name}
                type="button"
                aria-pressed={i === layerIndex}
                onClick={() => setLayerIndex(i)}
                className={`rounded px-2 py-0.5 ${i === layerIndex ? 'bg-ink text-paper' : 'border border-rule'}`}
              >
                {t('project.featureMaps.layerButton', { n: i + 1 })}
              </button>
            ))}
          </div>
          {state.layers[layerIndex] && <LayerView sample={sample} tensor={state.layers[layerIndex]} depth={FEATURE_MAP_LAYERS[layerIndex]!.depth} />}
        </>
      )}
    </section>
  );
}

interface LayerViewProps {
  readonly sample: SampleRecord;
  readonly tensor: ActivationTensor;
  readonly depth: string;
}

function LayerView({ sample, tensor, depth }: LayerViewProps) {
  const { t, i18n } = useTranslation();
  const url = useObjectUrl(sample.image);
  // Ghi nhớ theo tầng để canvas không phải vẽ lại mỗi lần giao diện cập nhật.
  const planes = useMemo(
    () => strongestChannels(tensor, SHOWN_CHANNELS).map((c) => ({ c, plane: channelPlane(tensor, c) })),
    [tensor],
  );
  const fmt = (v: number) => v.toLocaleString(i18n.language, { maximumFractionDigits: 2 });

  return (
    <div className="space-y-2">
      <p className="font-mono text-xs" data-testid="fmap-shape">
        {t('project.featureMaps.shape', { layer: tensor.layer, h: tensor.height, w: tensor.width, c: tensor.channels, shown: planes.length })}
      </p>
      <p className="text-xs text-muted">{t(`project.featureMaps.depth.${depth}`)}</p>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        <li className="text-center text-[10px]">
          <img src={url} alt="" width={64} height={64} className="w-full rounded-sm border border-rule" />
          <span>{t('project.featureMaps.input')}</span>
        </li>
        {planes.map(({ c, plane }) => {
          return (
            <li key={c} className="text-center text-[10px]" data-testid="fmap-channel">
              <ChannelCanvas plane={plane} width={tensor.width} height={tensor.height} label={t('project.featureMaps.channel', { k: c })} />
              <span className="font-mono">#{c} · max {fmt(Math.max(...plane))}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface ChannelCanvasProps {
  readonly plane: Float32Array;
  readonly width: number;
  readonly height: number;
  readonly label: string;
}

function ChannelCanvas({ plane, width, height, label }: ChannelCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return; // môi trường không có canvas (kiểm thử jsdom)
    ctx.putImageData(new ImageData(planeToGrayRgba(plane) as Uint8ClampedArray<ArrayBuffer>, width, height), 0, 0);
  }, [plane, width, height]);
  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      role="img"
      aria-label={label}
      className="w-full rounded-sm border border-rule bg-ink"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
