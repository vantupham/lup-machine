import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { fitPca2, projectPca } from '@/core/ml/pca';
import type { ClassRecord, SampleRecord } from '@/storage/db';
import { useModeStore } from '@/ui/mode-store';
import { ExactBadge } from '@/ui/ExactBadge';
import { useObjectUrl } from '../useObjectUrl';
import { EmbeddingMap, type MapPoint } from './EmbeddingMap';
import { FeatureStrip } from './FeatureStrip';
import { nearestTrainSamples } from './lab-data';
import type { FeatureStatus } from './useFeatures';

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
}

export function RepresentSection(props: RepresentSectionProps) {
  const { t } = useTranslation();
  const mode = useModeStore((s) => s.mode);
  const { status, missingCount } = props;
  const isBusy = status.phase === 'loading-model' || status.phase === 'extracting';

  return (
    <section aria-labelledby="represent-title" className="space-y-4">
      <div>
        <h2 id="represent-title" className="text-2xl font-semibold">{t('project.represent.title')}</h2>
        <p className="max-w-3xl text-sm text-muted">{t(mode === 'expert' ? 'project.represent.leadExpert' : 'project.represent.leadExplore')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {missingCount > 0 ? (
          <button type="button" className="btn btn-primary" onClick={props.onExtract} disabled={isBusy}>
            {t('project.represent.extract', { count: missingCount })}
          </button>
        ) : (
          <p className="text-sm text-accent">✓ {t('project.represent.upToDate')}</p>
        )}
        {status.phase === 'loading-model' && <p role="status" className="text-sm">{t('project.represent.loadingModel')}</p>}
        {status.phase === 'extracting' && <p role="status" className="text-sm">{t('project.represent.extracting', status)}</p>}
        {status.phase === 'error' && <p role="alert" className="text-sm text-danger">{t('project.represent.error', { message: status.message })}</p>}
      </div>
      <MapAndDetail {...props} />
    </section>
  );
}

function MapAndDetail({ classes, samples, features, selected, onSelect, wrongIds }: RepresentSectionProps) {
  const { t, i18n } = useTranslation();
  const withFeatures = useMemo(() => samples.filter((s) => features.has(s.id)), [samples, features]);

  const projection = useMemo(() => {
    if (withFeatures.length < 2) return null;
    const model = fitPca2(withFeatures.map((s) => features.get(s.id)!));
    const points: MapPoint[] = withFeatures.map((sample) => {
      const [x, y] = projectPca(model, features.get(sample.id)!);
      return { sample, x, y };
    });
    return { points, ratio: model.explainedVarianceRatio };
  }, [withFeatures, features]);

  if (!projection) return <p className="text-sm text-muted">{t('project.represent.needTwo')}</p>;
  const pct = (v: number) => (v * 100).toLocaleString(i18n.language, { maximumFractionDigits: 1 });
  const kept = projection.ratio[0] + projection.ratio[1];

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <figure className="space-y-2">
        <figcaption className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{t('project.represent.mapTitle')}</span>
          <ExactBadge label={t('project.represent.mapExact')} hint={t('project.represent.mapExactHint')} />
        </figcaption>
        <p className="text-xs text-muted">{t('project.represent.mapLead')}</p>
        <EmbeddingMap
          points={projection.points}
          classes={classes}
          selectedId={selected?.id ?? null}
          wrongIds={wrongIds}
          onSelect={onSelect}
          axisLabels={[
            t('project.represent.axis', { n: 1, percent: pct(projection.ratio[0]) }),
            t('project.represent.axis', { n: 2, percent: pct(projection.ratio[1]) }),
          ]}
        />
        <p className="text-xs text-muted" data-testid="map-kept">{t('project.represent.mapKept', { percent: pct(kept) })}</p>
        {wrongIds.size > 0 && <p className="text-xs text-danger">◯ {t('project.represent.wrongLegend')}</p>}
      </figure>
      {selected && features.has(selected.id) && (
        <SelectedDetail sample={selected} classes={classes} samples={samples} features={features} onSelect={onSelect} />
      )}
    </div>
  );
}

interface SelectedDetailProps {
  readonly sample: SampleRecord;
  readonly classes: readonly ClassRecord[];
  readonly samples: readonly SampleRecord[];
  readonly features: ReadonlyMap<string, Float32Array>;
  readonly onSelect: (sample: SampleRecord) => void;
}

function SelectedDetail({ sample, classes, samples, features, onSelect }: SelectedDetailProps) {
  const { t, i18n } = useTranslation();
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
      <FeatureStrip vector={features.get(sample.id)!} />
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
