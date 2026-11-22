import { useTranslation } from 'react-i18next';
import { classActivationMap, globalAveragePool } from '@/core/ml/explain';
import { SPATIAL_SHAPE } from '@/core/ml/feature-model';
import { computeLogits, type SoftmaxParams } from '@/core/ml/softmax-regression';
import type { SampleRecord } from '@/storage/db';
import { ExactBadge } from '@/ui/ExactBadge';
import { useModeStore } from '@/ui/mode-store';
import { useObjectUrl } from '../useObjectUrl';
import { GridOverlay } from './GridOverlay';
import { useSpatial } from './useSpatial';

interface CamHeatmapProps {
  readonly sample: SampleRecord;
  readonly params: SoftmaxParams;
  readonly classIndex: number;
}

/** Bản đồ CAM: lưới 7×7 phủ lên ảnh, đỏ = ủng hộ lớp đang chọn, xanh = chống lại. */
export function CamHeatmap({ sample, params, classIndex }: CamHeatmapProps) {
  const { t } = useTranslation();
  const state = useSpatial(sample);
  const url = useObjectUrl(sample.image);

  return (
    <figure className="space-y-2">
      <figcaption className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{t('project.explain.heatmapTitle')}</span>
        <ExactBadge kind="approximate" label={t('project.explain.heatmapBadge')} hint={t('project.explain.heatmapBadgeHint')} />
      </figcaption>
      {state.status === 'loading' && <p role="status" className="text-sm">{t('project.explain.loading')}</p>}
      {state.status === 'error' && <p role="alert" className="text-sm text-danger">{t('project.explain.error', { message: state.message })}</p>}
      {state.status === 'ready' && <CamOverlay url={url} spatial={state.spatial} params={params} classIndex={classIndex} />}
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

function CamOverlay({ url, spatial, params, classIndex }: OverlayProps) {
  const { t, i18n } = useTranslation();
  const mode = useModeStore((s) => s.mode);
  const map = classActivationMap(spatial, SPATIAL_SHAPE, params, classIndex);
  const mean = map.reduce((a, b) => a + b, 0) / map.length;
  const bias = params.bias[classIndex]!;
  const logit = computeLogits(params, globalAveragePool(spatial, SPATIAL_SHAPE))[classIndex]!;
  const fmt = (v: number) => v.toLocaleString(i18n.language, { maximumFractionDigits: 3 });

  return (
    <div className="space-y-1">
      <GridOverlay url={url} values={map} gridSize={SPATIAL_SHAPE.width} label={t('project.explain.heatmapTitle')} testId="cam-heatmap" />
      {mode === 'expert' && (
        <p className="font-mono text-xs text-muted" data-testid="cam-check">
          {t('project.explain.heatmapCheck', { mean: fmt(mean), bias: fmt(bias), sum: fmt(mean + bias), logit: fmt(logit) })}
        </p>
      )}
    </div>
  );
}
