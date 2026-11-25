import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { makeDataset2d, type Dataset2dKind, type Point2 } from '@/core/algorithms/datasets-2d';
import { knnClassify, knnGrid } from '@/core/algorithms/knn';
import { colorFor } from '@/features/studio/image/lab/class-style';
import { ClassPicker, ControlPanel, DatasetSelect, RangeField, SelectField } from '../controls';
import { Plot2d, RegionCells } from '../Plot2d';
import { ClassMarker } from '@/ui/ClassMarker';

const GRID_RESOLUTION = 30;
const DOMAIN = 1.2;
const POINTS = 45;
const SEED = 21;

type ClickMode = 'add' | 'probe';

interface LabeledPoints {
  readonly points: readonly Point2[];
  readonly labels: readonly number[];
  readonly numClasses: number;
}

function fromDataset(kind: Dataset2dKind): LabeledPoints {
  return makeDataset2d(kind, POINTS, 0.12, SEED);
}

export function KnnPlayground() {
  const { t } = useTranslation();
  const [kind, setKind] = useState<Dataset2dKind>('blobs');
  const [data, setData] = useState<LabeledPoints>(() => fromDataset('blobs'));
  const [k, setK] = useState(3);
  const [mode, setMode] = useState<ClickMode>('probe');
  const [addClass, setAddClass] = useState(0);
  const [query, setQuery] = useState<Point2 | null>([0.1, 0.1]);

  const region = useMemo(
    () =>
      data.points.length === 0
        ? []
        : knnGrid(data.points, data.labels, data.numClasses, k, {
            xMin: -DOMAIN, xMax: DOMAIN, yMin: -DOMAIN, yMax: DOMAIN, resolution: GRID_RESOLUTION,
          }),
    [data, k],
  );
  const result = useMemo(
    () => (query && data.points.length > 0 ? knnClassify(data.points, data.labels, data.numClasses, query, k) : null),
    [data, k, query],
  );
  const neighborSet = new Set(result?.neighbors.map((n) => n.index) ?? []);

  const changeKind = (next: Dataset2dKind) => {
    setKind(next);
    setData(fromDataset(next));
    setAddClass(0);
  };

  const handleClick = (x: number, y: number) => {
    if (mode === 'probe') {
      setQuery([x, y]);
      return;
    }
    setData((d) => ({ ...d, points: [...d.points, [x, y]], labels: [...d.labels, addClass] }));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        <Plot2d
          label={t('playground.knn.plotLabel', { k })}
          domain={DOMAIN}
          points={data.points.map(([x, y], i) => ({ x, y, label: data.labels[i] ?? 0, highlight: neighborSet.has(i) }))}
          onPlotClick={handleClick}
          background={() => <RegionCells labels={region} resolution={GRID_RESOLUTION} />}
          overlay={(s) =>
            query && result ? (
              <g data-testid="knn-query">
                {result.neighbors.map((n) => {
                  const p = data.points[n.index] as Point2;
                  return <line key={n.index} x1={s.sx(query[0])} y1={s.sy(query[1])} x2={s.sx(p[0])} y2={s.sy(p[1])} stroke="var(--color-ink)" strokeOpacity={0.45} strokeDasharray="3 2" />;
                })}
                <circle cx={s.sx(query[0])} cy={s.sy(query[1])} r={6} fill="var(--color-surface)" stroke="var(--color-ink)" strokeWidth={2} />
              </g>
            ) : null
          }
        />
        <p className="text-sm text-muted">{t(mode === 'probe' ? 'playground.knn.probeHint' : 'playground.common.addHint')}</p>
      </div>

      <div className="space-y-4">
        <ControlPanel>
          <DatasetSelect value={kind} onChange={changeKind} />
          <RangeField label={t('playground.knn.k')} value={k} min={1} max={25} onChange={setK} hint={t('playground.knn.kHint')} />
          <SelectField<ClickMode>
            label={t('playground.common.clickMode')}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'probe', label: t('playground.knn.modeProbe') },
              { value: 'add', label: t('playground.common.modeAdd') },
            ]}
          />
          {mode === 'add' && <ClassPicker numClasses={data.numClasses} value={addClass} onChange={setAddClass} />}
          <button type="button" className="btn btn-ghost text-sm" onClick={() => setData((d) => ({ ...d, points: [], labels: [] }))}>
            {t('playground.common.clear')}
          </button>
        </ControlPanel>

        <section aria-labelledby="knn-vote-title" className="lab-card p-4">
          <h2 id="knn-vote-title" className="font-semibold">{t('playground.knn.voteTitle')}</h2>
          {result ? (
            <>
              <ul className="mt-2 space-y-1" data-testid="knn-votes">
                {result.votes.map((v, c) => (
                  <li key={c} className="flex items-center gap-2 text-sm">
                    <ClassMarker index={c} />
                    <span className="w-16">{t('playground.common.className', { n: c + 1 })}</span>
                    <span className="h-2 rounded" style={{ width: `${(v / k) * 100}%`, backgroundColor: colorFor(c) }} />
                    <span className="font-mono" data-testid="vote-count">{v}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm" role="status">
                {t('playground.knn.verdict', { n: result.label + 1, votes: result.votes[result.label], k: result.neighbors.length })}
              </p>
              <p className="mt-1 text-xs text-muted">{t('playground.knn.tieRule')}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">{t('playground.knn.noQuery')}</p>
          )}
        </section>
      </div>
    </div>
  );
}
