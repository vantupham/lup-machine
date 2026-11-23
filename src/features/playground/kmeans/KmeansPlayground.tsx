import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { makeDataset2d, type Dataset2dKind } from '@/core/algorithms/datasets-2d';
import { kmeansPlusPlus, runKmeans } from '@/core/algorithms/kmeans';
import { createRng } from '@/core/random/seeded-rng';
import { colorFor, markerFor } from '@/features/studio/image/lab/class-style';
import { ControlPanel, DatasetSelect, RangeField, useInterval } from '../controls';
import { Plot2d } from '../Plot2d';
import { buildFrames } from './kmeans-view';

const DOMAIN = 1.2;
const POINTS = 120;
const MAX_ITER = 50;
const RUN_DELAY_MS = 700;

export function KmeansPlayground() {
  const { t } = useTranslation();
  const [kind, setKind] = useState<Dataset2dKind>('blobs');
  const [k, setK] = useState(3);
  const [seed, setSeed] = useState(1);
  const [frameIndex, setFrameIndex] = useState(0);
  const [running, setRunning] = useState(false);

  const data = useMemo(() => makeDataset2d(kind, POINTS, 0.12, 51), [kind]);
  const frames = useMemo(() => {
    const init = kmeansPlusPlus(data.points, k, createRng(seed));
    return buildFrames(runKmeans(data.points, init, MAX_ITER));
  }, [data, k, seed]);
  const lastIndex = frames.length - 1;
  const index = Math.min(frameIndex, lastIndex);
  const frame = frames[index]!;

  useInterval(() => {
    const next = Math.min(index + 1, lastIndex);
    setFrameIndex(next);
    if (next >= lastIndex) setRunning(false);
  }, running ? RUN_DELAY_MS : null);

  const restart = () => {
    setFrameIndex(0);
    setRunning(false);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        <Plot2d
          label={t('playground.kmeans.plotLabel', { k })}
          domain={DOMAIN}
          points={data.points.map(([x, y], i) => ({ x, y, label: frame.labels ? (frame.labels[i] ?? null) : null }))}
          overlay={(s) => (
            <g data-testid="kmeans-centers">
              {frame.previousCenters?.map((c, j) => {
                const n = frame.centers[j]!;
                return <line key={`a${j}`} x1={s.sx(c[0]!)} y1={s.sy(c[1]!)} x2={s.sx(n[0]!)} y2={s.sy(n[1]!)} stroke="var(--color-ink)" strokeWidth={1.5} strokeDasharray="4 2" />;
              })}
              {frame.centers.map((c, j) => (
                <g key={j}>
                  <circle cx={s.sx(c[0]!)} cy={s.sy(c[1]!)} r={11} fill="var(--color-surface)" stroke={colorFor(j)} strokeWidth={3} />
                  <text x={s.sx(c[0]!)} y={s.sy(c[1]!)} textAnchor="middle" dominantBaseline="central" fontSize={11} fill={colorFor(j)}>{markerFor(j)}</text>
                </g>
              ))}
            </g>
          )}
        />
        <p className="text-sm text-muted">{t('playground.kmeans.unsupervisedNote')}</p>
      </div>

      <div className="space-y-4">
        <ControlPanel>
          <DatasetSelect value={kind} onChange={(next) => { setKind(next); restart(); }} />
          <RangeField label={t('playground.kmeans.k')} value={k} min={2} max={6} onChange={(v) => { setK(v); restart(); }} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost text-sm" onClick={() => { setSeed((v) => v + 1); restart(); }}>{t('playground.kmeans.newInit')}</button>
            <button type="button" className="btn btn-ghost text-sm" onClick={restart}>{t('playground.common.reset')}</button>
            <button type="button" className="btn btn-ghost text-sm" disabled={index >= lastIndex} onClick={() => setFrameIndex(index + 1)}>{t('playground.common.step')}</button>
            <button type="button" className="btn btn-primary text-sm" disabled={index >= lastIndex && !running} onClick={() => setRunning((r) => !r)}>
              {running ? t('playground.common.pause') : t('playground.common.run')}
            </button>
          </div>
          <p className="text-xs text-muted">{t('playground.kmeans.initNote', { seed })}</p>
        </ControlPanel>

        <section aria-labelledby="kmeans-phase-title" className="lab-card p-4">
          <h2 id="kmeans-phase-title" className="font-semibold">{t('playground.kmeans.iteration', { n: frame.iteration })}</h2>
          <p className="mt-2 text-sm" role="status" data-testid="kmeans-phase">{t(`playground.kmeans.phases.${frame.phase}`)}</p>
          {frame.inertia !== null && (
            <p className="mt-2 font-mono text-sm">{t('playground.kmeans.inertia', { value: frame.inertia.toFixed(3) })}</p>
          )}
          {frame.converged && <p className="mt-2 text-sm font-semibold text-accent">{t('playground.kmeans.converged')}</p>}
        </section>
        <p className="text-xs text-muted">{t('playground.kmeans.inertiaHint')}</p>
      </div>
    </div>
  );
}
