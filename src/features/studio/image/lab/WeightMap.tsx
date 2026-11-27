import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FEATURE_DIM } from '@/core/ml/feature-model';
import type { EpochSnapshot, LabeledVectors, SoftmaxParams, TrainOptions } from '@/core/ml/softmax-regression';
import { batchesPerEpoch, batchLosses } from '@/core/ml/train-step';
import { classContributions, maxAbs, rankOrder, rowDelta, topActivating, topScoring, updateNorms, weightNorms, weightRow } from '@/core/ml/weight-stats';
import type { ClassRecord, SampleRecord } from '@/storage/db';
import { ClassMarker } from '@/ui/ClassMarker';
import { ExactBadge } from '@/ui/ExactBadge';
import { useModeStore } from '@/ui/mode-store';
import { useObjectUrl } from '../useObjectUrl';
import { LineChart } from './LineChart';
import { colorFor } from './class-style';
import { ClassBars, NEGATIVE, POSITIVE } from './step-visuals';
import { WeightProfile } from './WeightProfile';

const NEIGHBORS = 3;
/** Số đặc trưng cộng điểm nhiều nhất hiện cho mỗi lớp. */
const TOP_FEATURES = 6;
/** Số ảnh được chấm điểm cao nhất hiện cho mỗi lớp. */
const PROTOTYPES = 3;

export interface WeightMapProps {
  readonly snapshots: readonly EpochSnapshot[];
  /** Epoch đang xem (thanh trượt phát lại). */
  readonly epoch: number;
  readonly classes: readonly ClassRecord[];
  readonly train: LabeledVectors;
  readonly test: LabeledVectors | null;
  /** Ảnh Huấn luyện, cùng thứ tự với `train`. */
  readonly samples: readonly SampleRecord[];
  readonly options: TrainOptions;
  readonly isTraining: boolean;
}

/** Bước 4: tầng Dense đọc theo nghĩa: đặc trưng nào cộng điểm cho lớp, ảnh nào được chấm cao, hình dạng 1280 trọng số qua từng epoch. */
export function WeightMap(props: WeightMapProps) {
  const { t } = useTranslation();
  const mode = useModeStore((s) => s.mode);
  const { snapshots, epoch, classes } = props;
  const [showDelta, setShowDelta] = useState(false);
  const [cell, setCell] = useState<number | null>(null);
  const current = snapshots[epoch]?.params;
  const previous = epoch > 0 ? snapshots[epoch - 1]?.params : undefined;
  const final = snapshots.at(-1)?.params;
  if (!current || !final) return null;

  return (
    <section aria-labelledby="weight-map-title" className="space-y-3 rounded border border-rule p-3" data-testid="weight-map">
      <h3 id="weight-map-title" className="flex flex-wrap items-center gap-2 font-semibold">
        {t('project.weightMap.title', { epoch })}
        <ExactBadge label={t('playground.exact')} hint={t('project.weightMap.exactHint')} />
      </h3>
      <p className="text-sm text-muted">{t('project.weightMap.lead')}</p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={showDelta} disabled={epoch === 0} onChange={(e) => setShowDelta(e.target.checked)} />
        {t('project.weightMap.delta')}
      </label>
      <div className={`grid gap-3 md:grid-cols-2 ${current.numClasses > 2 ? 'xl:grid-cols-3' : ''}`}>
        {classes.slice(0, current.numClasses).map((cls, k) => (
          <ClassWeights
            key={cls.id}
            k={k}
            name={cls.name}
            current={current}
            previous={showDelta ? previous : undefined}
            final={final}
            train={props.train}
            samples={props.samples}
            selected={cell}
            onPick={setCell}
          />
        ))}
      </div>
      <p className="text-xs text-muted">{t('project.weightMap.colorNote')}</p>
      {mode === 'expert' && (
        <label className="flex items-center gap-2 text-sm">
          {t('project.weightMap.cell', { max: FEATURE_DIM - 1 })}
          <input
            type="number"
            min={0}
            max={FEATURE_DIM - 1}
            value={cell ?? ''}
            onChange={(e) => setCell(e.target.value === '' ? null : Math.max(0, Math.min(FEATURE_DIM - 1, Math.round(Number(e.target.value)))))}
            className="w-24 rounded border border-rule bg-paper px-2 py-1 font-mono"
          />
        </label>
      )}
      {cell !== null && <CellDetail {...props} cell={cell} />}
      <NormCharts snapshots={snapshots} epoch={epoch} />
      {!props.isTraining && (
        <details className="text-sm">
          <summary className="cursor-pointer">{t('project.weightMap.batchLossTitle')}</summary>
          <BatchLossChart train={props.train} test={props.test} options={props.options} />
        </details>
      )}
    </section>
  );
}

interface ClassWeightsProps {
  readonly k: number;
  readonly name: string;
  readonly current: SoftmaxParams;
  /** Có thì vẽ phần thay đổi so với epoch trước thay cho trọng số. */
  readonly previous: SoftmaxParams | undefined;
  readonly final: SoftmaxParams;
  readonly train: LabeledVectors;
  readonly samples: readonly SampleRecord[];
  readonly selected: number | null;
  readonly onPick: (index: number) => void;
}

/** Một lớp: đặc trưng cộng điểm nhiều nhất (kèm ảnh bật mạnh nó), ảnh được chấm cao nhất, hình dạng 1280 trọng số. */
function ClassWeights({ k, name, current, previous, final, train, samples, selected, onPick }: ClassWeightsProps) {
  const { t, i18n } = useTranslation();
  const finalRow = useMemo(() => weightRow(final, k), [final, k]);
  const order = useMemo(() => rankOrder(finalRow), [finalRow]);
  const values = useMemo(() => (previous ? rowDelta(current, previous, k) : weightRow(current, k)), [current, previous, k]);
  const scale = useMemo(() => maxAbs(previous ? values : finalRow), [previous, values, finalRow]);
  const top = useMemo(() => classContributions(current, train, k, TOP_FEATURES), [current, train, k]);
  const prototypes = useMemo(() => topScoring(current, train.xs, k, PROTOTYPES), [current, train, k]);
  const maxValue = Math.max(1e-12, ...top.map((c) => Math.abs(c.value)));
  const fmt = (v: number, d = 2) => v.toLocaleString(i18n.language, { minimumFractionDigits: d, maximumFractionDigits: d });

  return (
    <article className="space-y-3 rounded border border-rule bg-surface p-3" style={{ borderTopColor: colorFor(k), borderTopWidth: 3 }} aria-label={name} data-testid={`weight-class-${k}`}>
      <h4 className="text-sm font-semibold"><ClassMarker index={k} className="mr-1" />{name}</h4>
      <div>
        <p className="mb-1 text-xs text-muted">{t('project.weightMap.topFeatures')}</p>
        <ul className="space-y-1">
          {top.map((c) => (
            <li key={c.index}>
              <button
                type="button"
                onClick={() => onPick(c.index)}
                aria-pressed={selected === c.index}
                aria-label={t('project.weightMap.featureLabel', { j: c.index, value: fmt(c.value), cls: name })}
                className={`grid w-full grid-cols-[2rem_3.5rem_1fr_3.5rem] items-center gap-2 rounded px-1 text-left text-xs hover:bg-rule/30 ${selected === c.index ? 'bg-primary/10' : ''}`}
              >
                <FeatureThumb sample={samples[topActivating(train.xs, c.index, 1)[0]!]} />
                <span className="font-mono">#{c.index}</span>
                <span aria-hidden="true" className="relative h-2.5 rounded-sm bg-rule/40">
                  <span className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${(Math.abs(c.value) / maxValue) * 100}%`, backgroundColor: c.value >= 0 ? POSITIVE : NEGATIVE }} />
                </span>
                <span className="text-right font-mono">{fmt(c.value)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="mb-1 text-xs text-muted">{t('project.weightMap.prototypes', { cls: name })}</p>
        <ul className="flex gap-2">
          {prototypes.map((p) => (
            <CellThumb key={p.index} sample={samples[p.index]!} caption={fmt(p.score, 1)} />
          ))}
        </ul>
      </div>
      <p className="-mb-2 text-xs text-muted">{t('project.weightMap.profileCaption')}</p>
      <WeightProfile
        values={values}
        order={order}
        scale={scale}
        onPick={onPick}
        label={t(previous ? 'project.weightMap.deltaLabel' : 'project.weightMap.rowLabel', { cls: name })}
        testId={`weight-row-${k}`}
      />
    </article>
  );
}

function FeatureThumb({ sample }: { readonly sample: SampleRecord | undefined }) {
  if (!sample) return <span className="h-8 w-8" />;
  return <SampleImage sample={sample} size={32} />;
}

function SampleImage({ sample, size }: { readonly sample: SampleRecord; readonly size: number }) {
  const url = useObjectUrl(sample.image);
  return <img src={url} alt="" width={size} height={size} className="rounded-sm border border-rule object-cover" style={{ width: size, height: size }} />;
}

function CellDetail({ snapshots, epoch, classes, train, samples, cell }: WeightMapProps & { readonly cell: number }) {
  const { t, i18n } = useTranslation();
  const params = snapshots[epoch]!.params;
  const weights = Float64Array.from({ length: params.numClasses }, (_, k) => params.weights[k * params.dim + cell]!);
  const top = topActivating(train.xs, cell, NEIGHBORS);
  const fmt = (v: number) => v.toLocaleString(i18n.language, { maximumFractionDigits: 3 });
  return (
    <div className="space-y-2 rounded border border-rule p-3" data-testid="weight-cell">
      <p className="text-sm font-medium">{t('project.weightMap.cellTitle', { j: cell })}</p>
      <ClassBars classNames={classes.map((c) => c.name)} values={weights} signed highlight={-1} />
      <p className="text-xs">{t('project.weightMap.topImages', { j: cell })}</p>
      <ul className="flex gap-2">
        {top.map((i) => (
          <CellThumb key={i} sample={samples[i]!} caption={`x[${cell}] = ${fmt(train.xs[i]![cell]!)}`} />
        ))}
      </ul>
      <p className="text-xs text-muted">{t('project.weightMap.cellNote')}</p>
    </div>
  );
}

function CellThumb({ sample, caption }: { readonly sample: SampleRecord; readonly caption: string }) {
  const url = useObjectUrl(sample.image);
  return (
    <li className="text-center text-xs">
      <img src={url} alt="" width={64} height={64} className="h-16 w-16 rounded-sm border border-rule object-cover" />
      <span className="font-mono">{caption}</span>
    </li>
  );
}

function NormCharts({ snapshots, epoch }: { readonly snapshots: readonly EpochSnapshot[]; readonly epoch: number }) {
  const { t } = useTranslation();
  const params = useMemo(() => snapshots.map((s) => s.params), [snapshots]);
  const maxX = snapshots.at(-1)?.epoch ?? 0;
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <LineChart title={t('project.weightMap.normTitle')} series={[{ label: '‖W‖', color: '#0072B2', values: weightNorms(params) }]} maxX={maxX} markerX={epoch} fitY />
      <LineChart title={t('project.weightMap.updateTitle')} series={[{ label: '‖ΔW‖', color: '#D55E00', values: updateNorms(params) }]} maxX={maxX} markerX={epoch} />
    </div>
  );
}

/** Tính lại cả lần huấn luyện để lấy loss từng lô: chỉ khi mở mục này. */
function BatchLossChart({ train, test, options }: { readonly train: LabeledVectors; readonly test: LabeledVectors | null; readonly options: TrainOptions }) {
  const { t } = useTranslation();
  const losses = useMemo(() => batchLosses(train, test, options), [train, test, options]);
  const perEpoch = batchesPerEpoch(train.xs.length, options.batchSize);
  return (
    <div className="mt-2 max-w-xl" data-testid="batch-loss">
      <LineChart
        title={t('project.weightMap.batchLossChart', { perEpoch })}
        series={[{ label: 'loss', color: '#0072B2', values: losses }]}
        maxX={losses.length}
        markerX={null}
        xAxisLabel={t('project.weightMap.batchAxis', { n: losses.length })}
      />
      <p className="text-xs text-muted">{t('project.weightMap.batchLossNote')}</p>
    </div>
  );
}
