import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { classActivationMap, globalAveragePool } from '@/core/ml/explain';
import { SPATIAL_SHAPE } from '@/core/ml/feature-model';
import { computeLogits, type SoftmaxParams } from '@/core/ml/softmax-regression';
import type { ClassRecord, SampleRecord } from '@/storage/db';
import { ExactBadge } from '@/ui/ExactBadge';
import { useModeStore } from '@/ui/mode-store';
import { useObjectUrl } from '../useObjectUrl';
import { markerFor } from './class-style';
import { useSpatial } from './useSpatial';

const SIZE = 224;

interface CamHeatmapProps {
  readonly sample: SampleRecord;
  readonly classes: readonly ClassRecord[];
  readonly params: SoftmaxParams;
  readonly defaultClass: number;
}

/** Bản đồ CAM: lưới 7×7 phủ lên ảnh, đỏ = ủng hộ lớp đang chọn, xanh = chống lại. */
export function CamHeatmap({ sample, classes, params, defaultClass }: CamHeatmapProps) {
  const { t } = useTranslation();
  const state = useSpatial(sample);
  const [chosen, setChosen] = useState<number | null>(null);
  const classIndex = chosen ?? defaultClass;
  const url = useObjectUrl(sample.image);

  return (
    <figure className="space-y-2">
      <figcaption className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{t('project.explain.heatmapTitle')}</span>
        <ExactBadge kind="approximate" label={t('project.explain.heatmapBadge')} hint={t('project.explain.heatmapBadgeHint')} />
      </figcaption>
      <div className="flex flex-wrap items-center gap-1 text-sm" role="group" aria-label={t('project.explain.heatmapFor')}>
        <span className="text-xs text-muted">{t('project.explain.heatmapFor')}:</span>
        {classes.slice(0, params.numClasses).map((c, i) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={i === classIndex}
            onClick={() => setChosen(i)}
            className={`rounded px-2 py-0.5 ${i === classIndex ? 'bg-ink text-paper' : 'border border-rule'}`}
          >
            {markerFor(i)} {c.name}
          </button>
        ))}
      </div>
      {state.status === 'loading' && <p role="status" className="text-sm">{t('project.explain.loading')}</p>}
      {state.status === 'error' && <p role="alert" className="text-sm text-danger">{t('project.explain.error', { message: state.message })}</p>}
      {state.status === 'ready' && <HeatmapOverlay url={url} spatial={state.spatial} params={params} classIndex={classIndex} />}
      <p className="text-xs text-muted">{t('project.explain.heatmapLegend')}</p>
      <details className="text-xs">
        <summary className="cursor-pointer">ⓘ {t('project.explain.heatmapHowTitle')}</summary>
        <p className="mt-1 leading-relaxed text-muted">{t('project.explain.heatmapHowBody')}</p>
      </details>
    </figure>
  );
}

interface OverlayProps {
  readonly url: string;
  readonly spatial: Float32Array;
  readonly params: SoftmaxParams;
  readonly classIndex: number;
}

function HeatmapOverlay({ url, spatial, params, classIndex }: OverlayProps) {
  const { t, i18n } = useTranslation();
  const mode = useModeStore((s) => s.mode);
  const map = classActivationMap(spatial, SPATIAL_SHAPE, params, classIndex);
  const maxAbs = Math.max(1e-9, ...Array.from(map, Math.abs));
  const cell = SIZE / SPATIAL_SHAPE.width;
  const mean = map.reduce((a, b) => a + b, 0) / map.length;
  const bias = params.bias[classIndex]!;
  const logit = computeLogits(params, globalAveragePool(spatial, SPATIAL_SHAPE))[classIndex]!;
  const fmt = (v: number) => v.toLocaleString(i18n.language, { maximumFractionDigits: 3 });

  return (
    <div className="space-y-1">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-auto w-full max-w-70 rounded-sm border border-rule" role="img" aria-label={t('project.explain.heatmapTitle')} data-testid="cam-heatmap">
        {/* Ảnh nền thang xám để màu đỏ / xanh của bản đồ luôn dễ phân biệt, bất kể ảnh gốc màu gì. */}
        <image href={url} width={SIZE} height={SIZE} style={{ filter: 'grayscale(1)' }} opacity={0.85} />
        {Array.from(map, (v, i) => (
          <rect
            key={i}
            x={(i % SPATIAL_SHAPE.width) * cell}
            y={Math.floor(i / SPATIAL_SHAPE.width) * cell}
            width={cell}
            height={cell}
            fill={v >= 0 ? '#D7263D' : '#1B65D4'}
            fillOpacity={(0.65 * Math.abs(v)) / maxAbs}
            data-value={v}
          />
        ))}
        {Array.from({ length: SPATIAL_SHAPE.width - 1 }, (_, i) => (
          <g key={`grid-${i}`} stroke="#ffffff" strokeOpacity={0.5} strokeWidth={0.5}>
            <line x1={(i + 1) * cell} y1={0} x2={(i + 1) * cell} y2={SIZE} />
            <line x1={0} y1={(i + 1) * cell} x2={SIZE} y2={(i + 1) * cell} />
          </g>
        ))}
      </svg>
      {mode === 'expert' && (
        <p className="font-mono text-xs text-muted" data-testid="cam-check">
          {t('project.explain.heatmapCheck', { mean: fmt(mean), bias: fmt(bias), sum: fmt(mean + bias), logit: fmt(logit) })}
        </p>
      )}
    </div>
  );
}
