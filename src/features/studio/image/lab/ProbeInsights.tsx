import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClassRecord, SampleRecord } from '@/storage/db';
import { ExactBadge } from '@/ui/ExactBadge';
import { useObjectUrl } from '../useObjectUrl';
import { pointBounds } from './boundary';
import { EmbeddingMap, type MapPoint } from './EmbeddingMap';
import { fitProbeMap, nearestTrainToVector, type Neighbor } from './probe';

const NEIGHBOR_COUNT = 3;

interface ProbeMapProps {
  readonly classes: readonly ClassRecord[];
  readonly samples: readonly SampleRecord[];
  readonly features: ReadonlyMap<string, Float32Array>;
  readonly vector: Float32Array;
  readonly predicted: number;
}

/** Bản đồ PCA của bước 3 (đứng yên) với dấu hoa thị của ảnh đang thử di chuyển trên đó. */
export function ProbeMap({ classes, samples, features, vector, predicted }: ProbeMapProps) {
  const { t, i18n } = useTranslation();
  const withFeatures = useMemo(() => samples.filter((s) => features.has(s.id)), [samples, features]);
  const map = useMemo(() => fitProbeMap(withFeatures.map((s) => features.get(s.id)!)), [withFeatures, features]);
  const points = useMemo<MapPoint[]>(
    () => (map ? withFeatures.map((sample, i) => ({ sample, x: map.points[i]![0], y: map.points[i]![1] })) : []),
    [map, withFeatures],
  );
  if (!map || vector.length !== features.get(withFeatures[0]!.id)?.length) return null;

  const [x, y] = map.project(vector);
  const b = pointBounds(points);
  const isOutside = x < b.minX || x > b.maxX || y < b.minY || y > b.maxY;
  const pct = (v: number) => (v * 100).toLocaleString(i18n.language, { maximumFractionDigits: 0 });
  const name = classes[predicted]?.name ?? '';

  return (
    <figure className="space-y-2">
      <figcaption className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{t('project.use.mapTitle')}</span>
        <ExactBadge label={t('project.represent.mapExact')} hint={t('project.represent.mapExactHint')} />
      </figcaption>
      <p className="max-w-xl text-xs text-muted">{t('project.use.mapLead')}</p>
      <EmbeddingMap
        points={points}
        classes={classes}
        selectedId={null}
        wrongIds={new Set()}
        axisLabels={[
          t('project.represent.axis', { n: 1, percent: pct(map.explainedVarianceRatio[0]) }),
          t('project.represent.axis', { n: 2, percent: pct(map.explainedVarianceRatio[1]) }),
        ]}
        probe={{ x, y, classIndex: predicted, label: t('project.use.probeLabel', { name }) }}
      />
      {isOutside && <p className="text-xs text-warning" data-testid="probe-outside">{t('project.use.mapOutside')}</p>}
    </figure>
  );
}

interface ProbeNeighborsProps {
  readonly classes: readonly ClassRecord[];
  readonly samples: readonly SampleRecord[];
  readonly features: ReadonlyMap<string, Float32Array>;
  readonly vector: Float32Array;
}

/** "Giải thích bằng ví dụ" cho ảnh mới: các ảnh Dạy có vector gần nó nhất. */
export function ProbeNeighbors({ classes, samples, features, vector }: ProbeNeighborsProps) {
  const { t } = useTranslation();
  const neighbors = useMemo(() => nearestTrainToVector(vector, samples, features, NEIGHBOR_COUNT), [vector, samples, features]);
  if (neighbors.length === 0) return null;
  const indexOf = new Map(classes.map((c, i) => [c.id, i]));

  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold" id="probe-neighbors-title">{t('project.use.neighbors')}</p>
      <p className="max-w-md text-xs text-muted">{t('project.use.neighborsLead')}</p>
      <ul className="flex gap-2" aria-labelledby="probe-neighbors-title">
        {neighbors.map((n) => (
          <NeighborThumb key={n.sample.id} neighbor={n} label={classes[indexOf.get(n.sample.classId) ?? 0]?.name ?? ''} />
        ))}
      </ul>
    </div>
  );
}

function NeighborThumb({ neighbor, label }: { neighbor: Neighbor; label: string }) {
  const { i18n } = useTranslation();
  const url = useObjectUrl(neighbor.sample.image);
  return (
    <li className="text-center text-xs">
      <img src={url} alt="" width={72} height={72} className="rounded-sm border border-rule" />
      <span className="block">{label}</span>
      <span className="font-mono text-muted">{neighbor.similarity.toLocaleString(i18n.language, { maximumFractionDigits: 2 })}</span>
    </li>
  );
}
