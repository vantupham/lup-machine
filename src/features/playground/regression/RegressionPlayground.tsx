import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { makeRegressionData } from '@/core/algorithms/datasets-2d';
import { fitLineByGradientDescent } from '@/core/algorithms/gradient-descent';
import { fitLinearRegression, meanSquaredError } from '@/core/algorithms/linear-regression';
import { ControlPanel, RangeField, Stat } from '../controls';
import { Plot2d, type PlotScale } from '../Plot2d';

const DOMAIN = 2;
const GD_LEARNING_RATE = 0.3;

interface Line {
  readonly w: number;
  readonly b: number;
}

function LineAndResiduals({ s, xs, ys, line, color, showSquares }: {
  readonly s: PlotScale;
  readonly xs: readonly number[];
  readonly ys: readonly number[];
  readonly line: Line;
  readonly color: string;
  readonly showSquares: boolean;
}) {
  return (
    <g>
      {showSquares &&
        xs.map((x, i) => {
          const y = ys[i] as number;
          const yHat = line.w * x + line.b;
          const side = Math.abs(s.sy(y) - s.sy(yHat));
          return (
            <rect
              key={i}
              x={s.sx(x)}
              y={Math.min(s.sy(y), s.sy(yHat))}
              width={side}
              height={side}
              fill={color}
              fillOpacity={0.12}
              stroke={color}
              strokeOpacity={0.4}
            />
          );
        })}
      {xs.map((x, i) => (
        <line key={`r${i}`} x1={s.sx(x)} x2={s.sx(x)} y1={s.sy(ys[i] as number)} y2={s.sy(line.w * x + line.b)} stroke={color} strokeOpacity={0.6} />
      ))}
      <line x1={s.sx(-DOMAIN)} x2={s.sx(DOMAIN)} y1={s.sy(line.w * -DOMAIN + line.b)} y2={s.sy(line.w * DOMAIN + line.b)} stroke={color} strokeWidth={2.5} />
    </g>
  );
}

export function RegressionPlayground() {
  const { t } = useTranslation();
  const [noise, setNoise] = useState(0.3);
  const [data, setData] = useState(() => makeRegressionData(16, 1.2, 0.3, 0.3, 41));
  const [line, setLine] = useState<Line>({ w: 0, b: 0 });
  const [showMachine, setShowMachine] = useState(false);
  const [showSquares, setShowSquares] = useState(true);

  const userMse = data.xs.length === 0 ? 0 : meanSquaredError(data.ys, data.xs.map((x) => line.w * x + line.b));
  const machine = useMemo(() => {
    if (data.xs.length < 2) return null;
    const model = fitLinearRegression(data.xs.map((x) => [x]), data.ys);
    const fitted = { w: model.weights[0] ?? 0, b: model.intercept };
    return { line: fitted, mse: meanSquaredError(data.ys, data.xs.map((x) => fitted.w * x + fitted.b)) };
  }, [data]);

  const regenerate = (nextNoise: number) => {
    setNoise(nextNoise);
    setData(makeRegressionData(16, 1.2, 0.3, nextNoise, 41));
  };

  const gdStep = () => {
    if (data.xs.length === 0) return;
    const next = fitLineByGradientDescent(data.xs, data.ys, GD_LEARNING_RATE, 1, line)[1];
    if (next) setLine({ w: next.w, b: next.b });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        <Plot2d
          label={t('playground.regression.plotLabel')}
          domain={DOMAIN}
          points={data.xs.map((x, i) => ({ x, y: data.ys[i] ?? 0, label: 0 }))}
          onPlotClick={(x, y) => setData((d) => ({ xs: [...d.xs, x], ys: [...d.ys, y] }))}
          background={(s) => (
            <>
              {showMachine && machine && <LineAndResiduals s={s} xs={[]} ys={[]} line={machine.line} color="var(--color-accent)" showSquares={false} />}
              <LineAndResiduals s={s} xs={data.xs} ys={data.ys} line={line} color="var(--color-warning)" showSquares={showSquares} />
            </>
          )}
        />
        <p className="text-sm text-muted">{t('playground.regression.clickHint')}</p>
      </div>

      <div className="space-y-4">
        <ControlPanel>
          <p className="font-mono text-sm" data-testid="user-line">ŷ = {line.w.toFixed(2)}·x {line.b < 0 ? '−' : '+'} {Math.abs(line.b).toFixed(2)}</p>
          <RangeField label={t('playground.regression.slope')} value={line.w} min={-3} max={3} step={0.01} onChange={(w) => setLine((l) => ({ ...l, w }))} format={(v) => v.toFixed(2)} />
          <RangeField label={t('playground.regression.intercept')} value={line.b} min={-2} max={2} step={0.01} onChange={(b) => setLine((l) => ({ ...l, b }))} format={(v) => v.toFixed(2)} />
          <button type="button" className="btn btn-ghost text-sm" onClick={gdStep}>{t('playground.regression.gdStep', { lr: GD_LEARNING_RATE })}</button>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showSquares} onChange={(e) => setShowSquares(e.target.checked)} />
            {t('playground.regression.showSquares')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showMachine} onChange={(e) => setShowMachine(e.target.checked)} />
            {t('playground.regression.showMachine')}
          </label>
          <RangeField label={t('playground.common.noise')} value={noise} min={0} max={1} step={0.05} onChange={regenerate} format={(v) => v.toFixed(2)} />
          <button type="button" className="btn btn-ghost text-sm" onClick={() => setData({ xs: [], ys: [] })}>{t('playground.common.clear')}</button>
        </ControlPanel>

        <dl className="grid grid-cols-2 gap-3">
          <Stat label={t('playground.regression.userMse')} value={userMse.toFixed(4)} />
          {showMachine && machine && <Stat label={t('playground.regression.machineMse')} value={machine.mse.toFixed(4)} />}
        </dl>
        {showMachine && machine && (
          <p className="text-sm" data-testid="machine-line">
            {t('playground.regression.machineLine', { w: machine.line.w.toFixed(3), b: machine.line.b.toFixed(3) })}
          </p>
        )}
        <p className="text-xs text-muted">{t('playground.regression.mseHint')}</p>
      </div>
    </div>
  );
}
