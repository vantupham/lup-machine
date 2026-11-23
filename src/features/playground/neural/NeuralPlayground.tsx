import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { makeDataset2d, type Dataset2dKind } from '@/core/algorithms/datasets-2d';
import { accuracyOf, gradientStep, initMlp, type Activation, type Mlp } from '@/core/algorithms/mlp';
import { createRng } from '@/core/random/seeded-rng';
import { LineChart } from '@/features/studio/image/lab/LineChart';
import { ControlPanel, DatasetSelect, formatPercent, RangeField, SelectField, Stat, useInterval } from '../controls';
import { Plot2d, RegionCells } from '../Plot2d';
import { hiddenNeuronMaps, regionMap, squareGrid } from './neural-view';

const DOMAIN = 1.2;
const POINTS = 160;
const REGION_RESOLUTION = 30;
const NEURON_RESOLUTION = 14;
const STEPS_PER_TICK = 5;
const TICK_MS = 60;
const MAX_HISTORY = 400;

interface TrainingState {
  readonly net: Mlp;
  readonly epoch: number;
  readonly losses: readonly number[];
}

function NeuronMap({ values, title }: { readonly values: readonly number[]; readonly title: string }) {
  const maxAbs = Math.max(1e-9, ...values.map(Math.abs));
  const cell = 60 / NEURON_RESOLUTION;
  return (
    <figure className="text-center">
      <svg viewBox="0 0 60 60" className="h-16 w-16 rounded border border-rule" role="img" aria-label={title}>
        {values.map((v, i) => (
          <rect
            key={i}
            x={(i % NEURON_RESOLUTION) * cell}
            y={60 - (Math.floor(i / NEURON_RESOLUTION) + 1) * cell}
            width={cell + 0.3}
            height={cell + 0.3}
            fill={v >= 0 ? '#D55E00' : '#0072B2'}
            fillOpacity={Math.abs(v) / maxAbs}
          />
        ))}
      </svg>
      <figcaption className="font-mono text-[10px] text-muted">{title}</figcaption>
    </figure>
  );
}

export function NeuralPlayground() {
  const { t } = useTranslation();
  const [kind, setKind] = useState<Dataset2dKind>('circles');
  const [layerCount, setLayerCount] = useState(1);
  const [neurons, setNeurons] = useState(4);
  const [activation, setActivation] = useState<Activation>('tanh');
  const [learningRate, setLearningRate] = useState(0.8);
  const [seed, setSeed] = useState(1);
  const [running, setRunning] = useState(false);

  const data = useMemo(() => makeDataset2d(kind, POINTS, 0.08, 61), [kind]);
  const sizes = useMemo(() => [2, ...Array<number>(layerCount).fill(neurons), data.numClasses], [layerCount, neurons, data.numClasses]);
  const freshState = (): TrainingState => ({ net: initMlp(sizes, activation, createRng(seed)), epoch: 0, losses: [] });
  const structureKey = `${sizes.join('-')}|${activation}|${seed}|${kind}`;
  const [state, setState] = useState<{ key: string; training: TrainingState }>(() => ({ key: structureKey, training: freshState() }));
  // cấu trúc mạng đổi → khởi tạo lại (tính ngay trong lúc render, không cần effect)
  const training = state.key === structureKey ? state.training : freshState();
  if (state.key !== structureKey) setState({ key: structureKey, training });

  const trainTick = () => {
    let { net } = training;
    let loss = 0;
    for (let i = 0; i < STEPS_PER_TICK; i++) {
      const result = gradientStep(net, data.points, data.labels, learningRate);
      net = result.net;
      loss = result.loss;
    }
    setState({
      key: structureKey,
      training: { net, epoch: training.epoch + STEPS_PER_TICK, losses: [...training.losses, loss].slice(-MAX_HISTORY) },
    });
  };
  useInterval(trainTick, running ? TICK_MS : null);

  const region = useMemo(() => regionMap(training.net, squareGrid(DOMAIN, REGION_RESOLUTION)), [training.net]);
  const neuronMaps = useMemo(() => hiddenNeuronMaps(training.net, squareGrid(DOMAIN, NEURON_RESOLUTION)), [training.net]);
  const accuracy = accuracyOf(training.net, data.points, data.labels);
  const lastLoss = training.losses.at(-1);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <Plot2d
          label={t('playground.neural.plotLabel')}
          domain={DOMAIN}
          points={data.points.map(([x, y], i) => ({ x, y, label: data.labels[i] ?? 0 }))}
          background={() => (
            <RegionCells labels={region.labels} resolution={REGION_RESOLUTION} opacity={region.confidence.map((c) => (c - 0.4) * 0.5)} />
          )}
        />
        <section aria-labelledby="neurons-title" className="lab-card p-4">
          <h2 id="neurons-title" className="font-semibold">{t('playground.neural.neuronsTitle')}</h2>
          <p className="mb-3 text-xs text-muted">{t('playground.neural.neuronsHint')}</p>
          <div className="space-y-3" data-testid="neuron-maps">
            {neuronMaps.map((layer, l) => (
              <div key={l}>
                <p className="mb-1 text-xs font-medium">{t('playground.neural.layerName', { n: l + 1 })}</p>
                <div className="flex flex-wrap gap-2">
                  {layer.map((values, j) => (
                    <NeuronMap key={j} values={values} title={t('playground.neural.neuronName', { layer: l + 1, n: j + 1 })} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="space-y-4">
        <ControlPanel>
          <DatasetSelect value={kind} onChange={(k) => { setKind(k); setRunning(false); }} />
          <RangeField label={t('playground.neural.layers')} value={layerCount} min={1} max={2} onChange={setLayerCount} />
          <RangeField label={t('playground.neural.neurons')} value={neurons} min={1} max={8} onChange={setNeurons} />
          <SelectField<Activation>
            label={t('playground.neural.activation')}
            value={activation}
            onChange={setActivation}
            options={[
              { value: 'tanh', label: 'tanh' },
              { value: 'relu', label: 'ReLU' },
              { value: 'logistic', label: 'sigmoid' },
            ]}
          />
          <RangeField label={t('playground.gradient.learningRate')} value={learningRate} min={0.01} max={2} step={0.01} onChange={setLearningRate} format={(v) => v.toFixed(2)} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost text-sm" onClick={() => { setSeed((s) => s + 1); setRunning(false); }}>{t('playground.neural.reinit')}</button>
            <button type="button" className="btn btn-ghost text-sm" disabled={running} onClick={trainTick}>{t('playground.neural.stepN', { n: STEPS_PER_TICK })}</button>
            <button type="button" className="btn btn-primary text-sm" onClick={() => setRunning((r) => !r)}>
              {running ? t('playground.common.pause') : t('playground.neural.train')}
            </button>
          </div>
          <p className="font-mono text-xs text-muted">{t('playground.neural.architecture', { sizes: sizes.join(' → ') })}</p>
        </ControlPanel>

        <dl className="grid grid-cols-3 gap-3">
          <Stat label={t('playground.neural.epoch')} value={String(training.epoch)} />
          <Stat label="loss" value={lastLoss === undefined ? '—' : lastLoss.toFixed(3)} />
          <Stat label={t('playground.common.trainAccuracy')} value={formatPercent(accuracy)} />
        </dl>

        <div className="lab-card p-4">
          <LineChart
            title={t('playground.neural.lossChart')}
            maxX={Math.max(1, training.losses.length - 1)}
            markerX={null}
            xAxisLabel={t('playground.neural.lossAxis', { n: training.epoch })}
            series={[{ label: 'cross-entropy', color: 'var(--color-warning)', values: training.losses }]}
          />
        </div>
        <p className="text-xs text-muted">{t('playground.neural.fullBatchNote')}</p>
      </div>
    </div>
  );
}
