import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FEATURE_DIM } from '@/core/ml/feature-model';
import type { EpochSnapshot, LabeledVectors, TrainOptions } from '@/core/ml/softmax-regression';
import { batchesPerEpoch, batchLosses } from '@/core/ml/train-step';
import { rowDelta, topActivating, updateNorms, weightNorms, weightRow } from '@/core/ml/weight-stats';
import type { ClassRecord, SampleRecord } from '@/storage/db';
import { ClassMarker } from '@/ui/ClassMarker';
import { ExactBadge } from '@/ui/ExactBadge';
import { useObjectUrl } from '../useObjectUrl';
import { LineChart } from './LineChart';
import { ClassBars, SignedStrip } from './step-visuals';

const NEIGHBORS = 3;

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

/** Bước 4: trọng số của tầng Dense sau mỗi epoch, phần thay đổi, ý nghĩa của một ô, và các số đo theo thời gian. */
export function WeightMap(props: WeightMapProps) {
  const { t } = useTranslation();
  const { snapshots, epoch, classes } = props;
  const [showDelta, setShowDelta] = useState(false);
  const [cell, setCell] = useState<number | null>(null);
  const current = snapshots[epoch]?.params;
  const previous = epoch > 0 ? snapshots[epoch - 1]?.params : undefined;
  const isDelta = showDelta && previous !== undefined;
  if (!current) return null;

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
      <div className="grid gap-3 md:grid-cols-2">
        {classes.slice(0, current.numClasses).map((cls, k) => (
          <figure key={cls.id} className="space-y-1">
            <figcaption className="text-xs font-medium"><ClassMarker index={k} className="mr-1" />{cls.name}</figcaption>
            <SignedStrip
              values={isDelta ? rowDelta(current, previous, k) : weightRow(current, k)}
              label={t(isDelta ? 'project.weightMap.deltaLabel' : 'project.weightMap.rowLabel', { cls: cls.name })}
              onPick={setCell}
              testId={`weight-row-${k}`}
            />
          </figure>
        ))}
      </div>
      <p className="text-xs text-muted">{t('project.weightMap.colorNote')}</p>
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
      <LineChart title={t('project.weightMap.normTitle')} series={[{ label: '‖W‖', color: '#0072B2', values: weightNorms(params) }]} maxX={maxX} markerX={epoch} />
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
