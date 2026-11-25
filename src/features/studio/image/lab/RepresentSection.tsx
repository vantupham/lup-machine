import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fitPca2, projectPca } from '@/core/ml/pca';
import type { SoftmaxParams } from '@/core/ml/softmax-regression';
import type { ClassRecord, SampleRecord } from '@/storage/db';
import { useModeStore } from '@/ui/mode-store';
import { ExactBadge } from '@/ui/ExactBadge';
import { ImageCreditLine } from '@/ui/ImageCreditLine';
import { useObjectUrl } from '../useObjectUrl';
import { EmbeddingMap, type MapPoint } from './EmbeddingMap';
import { FeatureStrip } from './FeatureStrip';
import { nearestTrainSamples } from './lab-data';
import type { FeatureStatus } from './useFeatures';
import { pointBounds, trainBoundary } from './boundary';
import { PredictionExplainer } from './PredictionExplainer';
import { FeatureMapViewer } from './FeatureMapViewer';
import { UMAP_SEED, useUmap } from './useUmap';
import { UMAP_MIN_POINTS } from '@/core/ml/umap-limits';
import { Check, Circle } from '@/ui/icons';
import { StepNumber } from '@/ui/StepNumber';

const NEIGHBOR_COUNT = 3;

interface RepresentSectionProps {
  readonly classes: readonly ClassRecord[];
  readonly samples: readonly SampleRecord[];
  readonly features: ReadonlyMap<string, Float32Array>;
  readonly missingCount: number;
  readonly status: FeatureStatus;
  readonly onExtract: () => void;
  readonly selected: SampleRecord | null;
  readonly onSelect: (sample: SampleRecord) => void;
  readonly wrongIds: ReadonlySet<string>;
  /** Mô hình chính ở epoch đang xem (null nếu chưa huấn luyện). */
  readonly params: SoftmaxParams | null;
  readonly mainTrainAccuracy: number | null;
}

export function RepresentSection(props: RepresentSectionProps) {
  const { t } = useTranslation();
  const mode = useModeStore((s) => s.mode);
  const { status, missingCount } = props;
  const isBusy = status.phase === 'loading-model' || status.phase === 'extracting';

  return (
    <section aria-labelledby="represent-title" className="space-y-4">
      <div>
        <h2 id="represent-title" className="flex items-center gap-3 text-2xl font-semibold"><StepNumber n={3} />{t('project.represent.title')}</h2>
        <p className="max-w-3xl text-sm text-muted">{t(mode === 'expert' ? 'project.represent.leadExpert' : 'project.represent.leadExplore')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {missingCount > 0 ? (
          <button type="button" className="btn btn-primary" onClick={props.onExtract} disabled={isBusy}>
            {t('project.represent.extract', { count: missingCount })}
          </button>
        ) : (
          <p className="text-sm text-accent"><Check /> {t('project.represent.upToDate')}</p>
        )}
        {status.phase === 'loading-model' && <p role="status" className="text-sm">{t('project.represent.loadingModel')}</p>}
        {status.phase === 'extracting' && <p role="status" className="text-sm">{t('project.represent.extracting', status)}</p>}
        {status.phase === 'error' && <p role="alert" className="text-sm text-danger">{t('project.represent.error', { message: status.message })}</p>}
      </div>
      <MapAndDetail {...props} />
    </section>
  );
}

type MapMethod = 'pca' | 'umap';

function MapAndDetail({ classes, samples, features, selected, onSelect, wrongIds, params, mainTrainAccuracy }: RepresentSectionProps) {
  const { t, i18n } = useTranslation();
  const [showBoundary, setShowBoundary] = useState(false);
  const [method, setMethod] = useState<MapMethod>('pca');
  const withFeatures = useMemo(() => samples.filter((s) => features.has(s.id)), [samples, features]);
  const vectors = useMemo(() => withFeatures.map((s) => features.get(s.id)!), [withFeatures, features]);

  const projection = useMemo(() => {
    if (vectors.length < 2) return null;
    const model = fitPca2(vectors);
    const points: MapPoint[] = withFeatures.map((sample, i) => {
      const [x, y] = projectPca(model, vectors[i]!);
      return { sample, x, y };
    });
    return { points, ratio: model.explainedVarianceRatio };
  }, [withFeatures, vectors]);

  const canUmap = vectors.length >= UMAP_MIN_POINTS;
  const isUmap = method === 'umap' && canUmap;
  const umap = useUmap(isUmap ? vectors : null);
  const umapPoints = useMemo<MapPoint[] | null>(
    () => (umap?.status === 'ready' ? withFeatures.map((sample, i) => ({ sample, x: umap.coords[i]![0], y: umap.coords[i]![1] })) : null),
    [umap, withFeatures],
  );

  const boundary = useMemo(() => {
    if (!showBoundary || !projection || isUmap) return null;
    const labelOf = new Map(classes.map((c, i) => [c.id, i]));
    const trainPoints = projection.points
      .filter((p) => p.sample.split === 'train' && labelOf.has(p.sample.classId))
      .map((p) => ({ x: p.x, y: p.y, label: labelOf.get(p.sample.classId)! }));
    return trainBoundary(trainPoints, pointBounds(projection.points));
  }, [showBoundary, projection, classes, isUmap]);

  if (!projection) return <p className="text-sm text-muted">{t('project.represent.needTwo')}</p>;
  const pct = (v: number) => (v * 100).toLocaleString(i18n.language, { maximumFractionDigits: 1 });
  const kept = projection.ratio[0] + projection.ratio[1];

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <figure className="space-y-2">
        <figcaption className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{t('project.represent.mapTitle')}</span>
          <MethodSwitch method={isUmap ? 'umap' : 'pca'} canUmap={canUmap} onChange={setMethod} />
          {isUmap ? (
            <ExactBadge kind="approximate" label={t('project.umap.badge')} hint={t('project.umap.badgeHint')} />
          ) : (
            <ExactBadge label={t('project.represent.mapExact')} hint={t('project.represent.mapExactHint')} />
          )}
        </figcaption>
        <p className="text-xs text-muted">{t(isUmap ? 'project.umap.lead' : 'project.represent.mapLead')}</p>
        {!canUmap && <p className="text-xs text-muted">{t('project.umap.needMore', { count: UMAP_MIN_POINTS })}</p>}
        {isUmap && umap?.status === 'loading' && <p role="status" className="text-sm">{t('project.umap.loading')}</p>}
        {isUmap && umap?.status === 'error' && <p role="alert" className="text-sm text-danger">{t('project.umap.error', { message: umap.message })}</p>}
        {(!isUmap || umapPoints) && (
          <EmbeddingMap
            points={isUmap ? umapPoints! : projection.points}
            classes={classes}
            selectedId={selected?.id ?? null}
            wrongIds={wrongIds}
            onSelect={onSelect}
            grid={boundary?.grid ?? null}
            axisLabels={
              isUmap
                ? [t('project.umap.axis', { n: 1 }), t('project.umap.axis', { n: 2 })]
                : [t('project.represent.axis', { n: 1, percent: pct(projection.ratio[0]) }), t('project.represent.axis', { n: 2, percent: pct(projection.ratio[1]) })]
            }
          />
        )}
        {isUmap ? (
          <p className="text-xs text-muted" data-testid="umap-note">{t('project.umap.note', { seed: UMAP_SEED })}</p>
        ) : (
          <p className="text-xs text-muted" data-testid="map-kept">{t('project.represent.mapKept', { percent: pct(kept) })}</p>
        )}
        {wrongIds.size > 0 && <p className="text-xs text-danger"><Circle strokeWidth={3} /> {t('project.represent.wrongLegend')}</p>}
        {!isUmap && (
          <BoundaryControls
            checked={showBoundary}
            onChange={setShowBoundary}
            acc2d={boundary ? pct(boundary.trainAccuracy) : null}
            accFull={mainTrainAccuracy === null ? null : pct(mainTrainAccuracy)}
            unavailable={showBoundary && boundary === null}
          />
        )}
      </figure>
      {selected && features.has(selected.id) && (
        <SelectedDetail sample={selected} classes={classes} samples={samples} features={features} onSelect={onSelect} params={params} />
      )}
    </div>
  );
}

function MethodSwitch({ method, canUmap, onChange }: { method: MapMethod; canUmap: boolean; onChange: (m: MapMethod) => void }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex overflow-hidden rounded border border-rule text-xs" role="group" aria-label={t('project.umap.switch')}>
      {(['pca', 'umap'] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={method === m}
          disabled={m === 'umap' && !canUmap}
          onClick={() => onChange(m)}
          className={`px-2 py-0.5 disabled:opacity-40 ${method === m ? 'bg-ink text-paper' : ''}`}
        >
          {m.toUpperCase()}
        </button>
      ))}
    </span>
  );
}

interface SelectedDetailProps {
  readonly sample: SampleRecord;
  readonly classes: readonly ClassRecord[];
  readonly samples: readonly SampleRecord[];
  readonly features: ReadonlyMap<string, Float32Array>;
  readonly onSelect: (sample: SampleRecord) => void;
  readonly params: SoftmaxParams | null;
}

function SelectedDetail({ sample, classes, samples, features, onSelect, params }: SelectedDetailProps) {
  const { t, i18n } = useTranslation();
  const mode = useModeStore((s) => s.mode);
  const url = useObjectUrl(sample.image);
  const nameOf = (id: string) => classes.find((c) => c.id === id)?.name ?? '';
  const neighbors = nearestTrainSamples(sample.id, samples, features, NEIGHBOR_COUNT);

  return (
    <div className="lab-card space-y-4 p-4" data-testid="selected-detail">
      <div className="flex items-center gap-3">
        <img src={url} alt="" width={72} height={72} className="rounded-sm border border-rule" />
        <p className="text-sm font-medium">
          {t('project.represent.selected', { name: nameOf(sample.classId), split: t(`project.class.${sample.split}`) })}
        </p>
      </div>
      {sample.credit && <ImageCreditLine credit={sample.credit} />}
      <FeatureStrip vector={features.get(sample.id)!} />
      {mode === 'expert' && <FeatureMapViewer sample={sample} />}
      {neighbors.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-medium">{t('project.represent.neighbors')}</p>
          <ul className="flex gap-2">
            {neighbors.map((n) => (
              <NeighborThumb
                key={n.sample.id}
                sample={n.sample}
                caption={`${nameOf(n.sample.classId)} · ${n.similarity.toLocaleString(i18n.language, { maximumFractionDigits: 2 })}`}
                onSelect={onSelect}
              />
            ))}
          </ul>
        </div>
      )}
      {params && params.dim === features.get(sample.id)!.length ? (
        <PredictionExplainer sample={sample} vector={features.get(sample.id)!} classes={classes} params={params} />
      ) : (
        <p className="border-t border-rule pt-3 text-xs text-muted">{t('project.explain.needModel')}</p>
      )}
    </div>
  );
}

interface BoundaryControlsProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly acc2d: string | null;
  readonly accFull: string | null;
  readonly unavailable: boolean;
}

function BoundaryControls({ checked, onChange, acc2d, accFull, unavailable }: BoundaryControlsProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1 text-xs">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        {t('project.boundary.toggle')}
        {checked && acc2d !== null && <ExactBadge label={t('project.boundary.badge')} hint={t('project.boundary.badgeHint')} />}
      </label>
      {unavailable && <p className="text-warning">{t('project.boundary.needClasses')}</p>}
      {acc2d !== null && (
        <p className="text-muted" data-testid="boundary-note">
          {accFull === null ? t('project.boundary.noteNoMain', { acc2d }) : t('project.boundary.note', { acc2d, accFull })}
        </p>
      )}
    </div>
  );
}

function NeighborThumb({ sample, caption, onSelect }: { sample: SampleRecord; caption: string; onSelect: (s: SampleRecord) => void }) {
  const url = useObjectUrl(sample.image);
  return (
    <li>
      <button type="button" onClick={() => onSelect(sample)} className="block text-center text-xs">
        <img src={url} alt="" width={64} height={64} className="rounded-sm border border-rule" />
        <span className="font-mono">{caption}</span>
      </button>
    </li>
  );
}
