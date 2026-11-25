import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { runGradientDescent, SURFACE_IDS, SURFACES, type SurfaceId } from '@/core/algorithms/gradient-descent';
import { LineChart } from '@/features/studio/image/lab/LineChart';
import { ControlPanel, RangeField, SelectField, useInterval } from '../controls';
import { PLOT_SIZE, Plot2d } from '../Plot2d';
import { X } from '@/ui/icons';

const HEAT_RESOLUTION = 40;
const MAX_STEPS = 60;
const RUN_DELAY_MS = 180;

/** Ô màu cho bản đồ đồng mức: càng đậm càng thấp (loss nhỏ). Dùng log để thấy rõ vùng đáy. */
function heatValues(surfaceId: SurfaceId): number[] {
  const s = SURFACES[surfaceId];
  const values: number[] = [];
  for (let row = 0; row < HEAT_RESOLUTION; row++) {
    for (let col = 0; col < HEAT_RESOLUTION; col++) {
      const x = -s.range + ((col + 0.5) / HEAT_RESOLUTION) * 2 * s.range;
      const y = -s.range + ((row + 0.5) / HEAT_RESOLUTION) * 2 * s.range;
      values.push(s.f(x, y));
    }
  }
  const min = Math.min(...values);
  const logs = values.map((v) => Math.log1p(v - min));
  const max = Math.max(...logs);
  return logs.map((v) => 1 - v / max);
}

export function GradientPlayground() {
  const { t } = useTranslation();
  const [surfaceId, setSurfaceId] = useState<SurfaceId>('bowl');
  const [learningRate, setLearningRate] = useState(0.1);
  const [start, setStart] = useState<[number, number]>([1.6, 1.2]);
  const [stepIndex, setStepIndex] = useState(0);
  const [running, setRunning] = useState(false);

  const surface = SURFACES[surfaceId];
  const run = useMemo(() => runGradientDescent(surface, start, learningRate, MAX_STEPS), [surface, start, learningRate]);
  const heat = useMemo(() => heatValues(surfaceId), [surfaceId]);
  const lastIndex = run.steps.length - 1;
  const index = Math.min(stepIndex, lastIndex);
  const current = run.steps[index]!;
  const [gx, gy] = surface.grad(current.x, current.y);
  const visible = run.steps.slice(0, index + 1);
  // η quá lớn: viên bi lên cao hơn điểm xuất phát, hoặc văng hẳn ra ngoài
  const isClimbing = (index > 0 && current.loss > run.steps[0]!.loss) || (run.diverged && index === lastIndex);

  useInterval(() => {
    const next = Math.min(index + 1, lastIndex);
    setStepIndex(next);
    if (next >= lastIndex) setRunning(false);
  }, running ? RUN_DELAY_MS : null);

  const restart = () => {
    setStepIndex(0);
    setRunning(false);
  };

  const cell = PLOT_SIZE / HEAT_RESOLUTION;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-3">
        <Plot2d
          label={t('playground.gradient.plotLabel', { formula: surface.formula })}
          domain={surface.range}
          points={[]}
          onPlotClick={(x, y) => {
            setStart([x, y]);
            restart();
          }}
          background={() => (
            <g aria-hidden="true">
              {heat.map((v, i) => (
                <rect
                  key={i}
                  x={(i % HEAT_RESOLUTION) * cell}
                  y={PLOT_SIZE - (Math.floor(i / HEAT_RESOLUTION) + 1) * cell}
                  width={cell + 0.5}
                  height={cell + 0.5}
                  fill="var(--color-primary)"
                  fillOpacity={0.05 + v * 0.5}
                />
              ))}
            </g>
          )}
          overlay={(s) => (
            <g data-testid="gd-path">
              <polyline
                points={visible.map((p) => `${s.sx(p.x)},${s.sy(p.y)}`).join(' ')}
                fill="none"
                stroke="var(--color-warning)"
                strokeWidth={2}
              />
              {visible.map((p, i) => (
                <circle key={i} cx={s.sx(p.x)} cy={s.sy(p.y)} r={i === index ? 6 : 2.5} fill={i === index ? 'var(--color-warning)' : 'var(--color-ink)'} />
              ))}
              <X x={s.sx(surface.minimum[0]) - 8} y={s.sy(surface.minimum[1]) - 8} width={16} height={16} strokeWidth={3} className="chart-marker text-accent" />
            </g>
          )}
        />
        <p className="text-sm text-muted">{t('playground.gradient.clickHint')}</p>
      </div>

      <div className="space-y-4">
        <ControlPanel>
          <SelectField<SurfaceId>
            label={t('playground.gradient.surface')}
            value={surfaceId}
            onChange={(id) => { setSurfaceId(id); restart(); }}
            options={SURFACE_IDS.map((id) => ({ value: id, label: `${t(`playground.gradient.surfaces.${id}`)} — ${SURFACES[id].formula}` }))}
          />
          <RangeField
            label={t('playground.gradient.learningRate')}
            value={learningRate}
            min={0.01}
            max={1.1}
            step={0.01}
            onChange={(v) => { setLearningRate(v); restart(); }}
            format={(v) => v.toFixed(2)}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost text-sm" onClick={restart}>{t('playground.common.reset')}</button>
            <button type="button" className="btn btn-ghost text-sm" disabled={index >= lastIndex} onClick={() => setStepIndex(index + 1)}>{t('playground.common.step')}</button>
            <button type="button" className="btn btn-primary text-sm" disabled={index >= lastIndex && !running} onClick={() => setRunning((r) => !r)}>
              {running ? t('playground.common.pause') : t('playground.common.run')}
            </button>
          </div>
        </ControlPanel>

        <section aria-labelledby="gd-step-title" className="lab-card p-4 font-mono text-sm">
          <h2 id="gd-step-title" className="mb-2 font-sans font-semibold">{t('playground.gradient.stepTitle', { n: index })}</h2>
          <p>(x, y) = ({current.x.toFixed(3)}, {current.y.toFixed(3)})</p>
          <p>f = {current.loss.toFixed(4)}</p>
          <p>∇f = ({gx.toFixed(3)}, {gy.toFixed(3)})</p>
          <p className="mt-2 text-xs text-muted">
            {t('playground.gradient.updateRule', {
              lr: learningRate.toFixed(2),
              nx: (current.x - learningRate * gx).toFixed(3),
              ny: (current.y - learningRate * gy).toFixed(3),
            })}
          </p>
          {isClimbing && (
            <p role="alert" className="mt-2 font-sans text-danger">{t('playground.gradient.diverged')}</p>
          )}
        </section>

        <div className="lab-card p-4">
          <LineChart
            title={t('playground.gradient.lossChart')}
            maxX={Math.max(1, lastIndex)}
            markerX={index}
            xAxisLabel={t('playground.gradient.stepAxis', { n: lastIndex })}
            series={[{
              label: t('playground.gradient.lossSeries'),
              color: 'var(--color-warning)',
              // trừ đi giá trị nhỏ nhất để trục luôn bắt đầu từ 0 (mặt "hai hố" có f âm)
              values: run.steps.map((p) => p.loss - surface.f(...surface.minimum)),
            }]}
          />
        </div>
        <p className="text-xs text-muted">{t('playground.gradient.viewNote')}</p>
      </div>
    </div>
  );
}
