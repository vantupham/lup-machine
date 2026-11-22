import { useTranslation } from 'react-i18next';
import { occlusionDrops } from '@/core/ml/occlusion';
import type { SoftmaxParams } from '@/core/ml/softmax-regression';
import type { SampleRecord } from '@/storage/db';
import { ExactBadge } from '@/ui/ExactBadge';
import { useObjectUrl } from '../useObjectUrl';
import { GridOverlay } from './GridOverlay';
import { OCCLUSION_GRID, useOcclusion } from './useOcclusion';

interface OcclusionMapProps {
  readonly sample: SampleRecord;
  readonly params: SoftmaxParams;
  readonly classIndex: number;
  readonly className: string;
}

/** "Che thử từng ô": phép đo trực tiếp xem vùng nào thật sự làm thay đổi câu trả lời của mô hình. */
export function OcclusionMap({ sample, params, classIndex, className }: OcclusionMapProps) {
  const { t } = useTranslation();
  const { state, run } = useOcclusion(sample);

  return (
    <figure className="space-y-2" data-testid="occlusion">
      <figcaption className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{t('project.occlusion.title')}</span>
        <ExactBadge label={t('project.occlusion.badge')} hint={t('project.occlusion.badgeHint')} />
      </figcaption>
      <p className="max-w-md text-xs text-muted">{t('project.occlusion.lead')}</p>
      {state.status !== 'ready' && (
        <button type="button" className="btn" onClick={run} disabled={state.status === 'running'}>
          {t('project.occlusion.run', { count: OCCLUSION_GRID * OCCLUSION_GRID })}
        </button>
      )}
      {state.status === 'running' && <p role="status" className="text-sm">{t('project.occlusion.running', state)}</p>}
      {state.status === 'error' && <p role="alert" className="text-sm text-danger">{t('project.occlusion.error', { message: state.message })}</p>}
      {state.status === 'ready' && (
        <OcclusionResultView sample={sample} params={params} classIndex={classIndex} className={className} base={state.base} occluded={state.occluded} />
      )}
    </figure>
  );
}

interface ResultProps extends OcclusionMapProps {
  readonly base: Float32Array;
  readonly occluded: readonly Float32Array[];
}

function OcclusionResultView({ sample, params, classIndex, className, base, occluded }: ResultProps) {
  const { t, i18n } = useTranslation();
  const url = useObjectUrl(sample.image);
  const { baseProb, drops } = occlusionDrops(params, base, occluded, classIndex);
  const strongest = drops.reduce((best, v, i) => (v > drops[best]! ? i : best), 0);
  const pct = (v: number) => `${(v * 100).toLocaleString(i18n.language, { maximumFractionDigits: 1 })}%`;

  return (
    <div className="space-y-1">
      <GridOverlay url={url} values={drops} gridSize={OCCLUSION_GRID} label={t('project.occlusion.title')} testId="occlusion-map" />
      <p className="text-xs text-muted">{t('project.occlusion.legend')}</p>
      <p className="font-mono text-xs" data-testid="occlusion-summary">
        {drops[strongest]! > 0
          ? t('project.occlusion.summary', {
              name: className,
              row: Math.floor(strongest / OCCLUSION_GRID) + 1,
              col: (strongest % OCCLUSION_GRID) + 1,
              from: pct(baseProb),
              to: pct(baseProb - drops[strongest]!),
            })
          : t('project.occlusion.noDrop', { name: className, prob: pct(baseProb) })}
      </p>
    </div>
  );
}
