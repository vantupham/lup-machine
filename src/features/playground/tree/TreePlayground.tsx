import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fitTree, type Criterion } from '@/core/algorithms/decision-tree';
import { makeDataset2d, type Dataset2dKind } from '@/core/algorithms/datasets-2d';
import { gridCellCenter } from '@/core/algorithms/knn';
import { LineChart } from '@/features/studio/image/lab/LineChart';
import { ControlPanel, DatasetSelect, formatPercent, RangeField, SelectField, Stat } from '../controls';
import { Plot2d, RegionCells } from '../Plot2d';
import { TreeDiagram } from './TreeDiagram';
import { accuracyOpened, growthOrder, predictOpened, scoresByDepth } from './tree-view';

const GRID_RESOLUTION = 40;
const DOMAIN = 1.2;
const POINTS = 120;
const CHART_DEPTH = 10;
const FEATURE_NAMES = ['x₁', 'x₂'] as const;

export function TreePlayground() {
  const { t } = useTranslation();
  const [kind, setKind] = useState<Dataset2dKind>('moons');
  const [noise, setNoise] = useState(0.15);
  const [maxDepth, setMaxDepth] = useState(4);
  const [criterion, setCriterion] = useState<Criterion>('gini');
  const [shown, setShown] = useState<number | null>(null);

  const train = useMemo(() => makeDataset2d(kind, POINTS, noise, 31), [kind, noise]);
  const test = useMemo(() => makeDataset2d(kind, POINTS, noise, 1031), [kind, noise]);
  const tree = useMemo(
    () => fitTree(train.points, train.labels, train.numClasses, { criterion, maxDepth }),
    [train, criterion, maxDepth],
  );
  const order = useMemo(() => growthOrder(tree), [tree]);
  const visibleCount = shown === null ? order.length : Math.min(shown, order.length);
  const opened = useMemo(() => new Set(order.slice(0, visibleCount)), [order, visibleCount]);
  const latest = visibleCount > 0 ? (order[visibleCount - 1] ?? null) : null;

  const region = useMemo(() => {
    const spec = { xMin: -DOMAIN, xMax: DOMAIN, yMin: -DOMAIN, yMax: DOMAIN, resolution: GRID_RESOLUTION };
    return Array.from({ length: GRID_RESOLUTION * GRID_RESOLUTION }, (_, i) =>
      predictOpened(tree, gridCellCenter(spec, i % GRID_RESOLUTION, Math.floor(i / GRID_RESOLUTION)), opened),
    );
  }, [tree, opened]);

  const depthScores = useMemo(
    () => scoresByDepth({ xs: train.points, ys: train.labels }, { xs: test.points, ys: test.labels }, train.numClasses, criterion, CHART_DEPTH),
    [train, test, criterion],
  );

  const resetGrowth = () => setShown(null);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <Plot2d
          label={t('playground.tree.plotLabel')}
          domain={DOMAIN}
          points={train.points.map(([x, y], i) => ({ x, y, label: train.labels[i] ?? 0 }))}
          background={() => <RegionCells labels={region} resolution={GRID_RESOLUTION} opacity={0.25} />}
        />
        <section aria-labelledby="tree-diagram-title" className="lab-card p-4">
          <h2 id="tree-diagram-title" className="mb-2 font-semibold">{t('playground.tree.diagramTitle')}</h2>
          <TreeDiagram tree={tree} opened={opened} latest={shown === null ? null : latest} featureNames={FEATURE_NAMES} />
        </section>
      </div>

      <div className="space-y-4">
        <ControlPanel>
          <DatasetSelect value={kind} onChange={(k) => { setKind(k); resetGrowth(); }} />
          <RangeField label={t('playground.common.noise')} value={noise} min={0} max={0.4} step={0.01} onChange={(v) => { setNoise(v); resetGrowth(); }} format={(v) => v.toFixed(2)} />
          <RangeField label={t('playground.tree.maxDepth')} value={maxDepth} min={1} max={CHART_DEPTH} onChange={(v) => { setMaxDepth(v); resetGrowth(); }} />
          <SelectField<Criterion>
            label={t('playground.tree.criterion')}
            value={criterion}
            onChange={(c) => { setCriterion(c); resetGrowth(); }}
            options={[
              { value: 'gini', label: t('playground.tree.gini') },
              { value: 'entropy', label: t('playground.tree.entropy') },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost text-sm" onClick={() => setShown(0)}>{t('playground.tree.restart')}</button>
            <button
              type="button"
              className="btn btn-primary text-sm"
              disabled={visibleCount >= order.length}
              onClick={() => setShown(visibleCount + 1)}
            >
              {t('playground.tree.grow')}
            </button>
          </div>
          <p className="text-xs text-muted" role="status">{t('playground.tree.growStatus', { shown: visibleCount, total: order.length })}</p>
        </ControlPanel>

        <dl className="grid grid-cols-2 gap-3">
          <Stat label={t('playground.common.trainAccuracy')} value={formatPercent(accuracyOpened(tree, train.points, train.labels, opened))} />
          <Stat label={t('playground.common.testAccuracy')} value={formatPercent(accuracyOpened(tree, test.points, test.labels, opened))} />
        </dl>

        <div className="lab-card p-4">
          <LineChart
            title={t('playground.tree.depthChart')}
            maxX={CHART_DEPTH}
            yMax={1}
            markerX={maxDepth}
            xAxisLabel={t('playground.tree.depthAxis', { n: CHART_DEPTH })}
            series={[
              { label: t('playground.common.trainAccuracy'), color: 'var(--color-primary)', values: [null, ...depthScores.map((s) => s.train)] },
              { label: t('playground.common.testAccuracy'), color: 'var(--color-warning)', dashed: true, values: [null, ...depthScores.map((s) => s.test)] },
            ]}
          />
          <p className="mt-2 text-xs text-muted">{t('playground.tree.overfitHint')}</p>
        </div>
      </div>
    </div>
  );
}
