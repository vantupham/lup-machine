import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FEATURE_DIM } from '@/core/ml/feature-model';
import { blockLabelKey, denseParams, featureMapLayerOf, MOBILENET_SUMMARY, type FrozenBlock, type LayerKind } from '@/core/ml/network-summary';
import { ExactBadge } from '@/ui/ExactBadge';
import { ArrowRight, Lock } from '@/ui/icons';
import { useModeStore } from '@/ui/mode-store';

/** Cạnh lớn nhất (px) của ô vuông minh họa kích thước không gian (224 × 224). */
const MAX_SQUARE = 22;
const LAYER_ORDER: readonly LayerKind[] = ['ZeroPadding2D', 'Conv2D', 'DepthwiseConv2D', 'BatchNormalization', 'ReLU', 'Add'];

type Selection = { readonly kind: 'frozen'; readonly block: FrozenBlock } | { readonly kind: 'dense' };

interface NetworkMapProps {
  readonly numClasses: number;
  readonly isTraining: boolean;
}

/** Ô vuông nhỏ dần theo kích thước không gian: ảnh 224 → 7 là "thu nhỏ dần, thêm kênh". */
function SizeSquare({ size }: { readonly size: number }) {
  const side = Math.max(3, (size / MOBILENET_SUMMARY.inputShape[0]) * MAX_SQUARE);
  return <span aria-hidden="true" className="inline-block rounded-[1px] bg-current opacity-50" style={{ width: side, height: side }} />;
}

/** Bước 4 (Studio ảnh): mạng gồm những khối nào, khối nào đóng băng, tầng nào đang học, bao nhiêu con số. */
export function NetworkMap({ numClasses, isTraining }: NetworkMapProps) {
  const { t, i18n } = useTranslation();
  const [selected, setSelected] = useState<Selection>({ kind: 'dense' });
  const fmt = (n: number) => n.toLocaleString(i18n.language);
  const shape = (s: readonly number[]) => s.join(' × ');
  const dense = denseParams(numClasses);
  const labelOf = (block: FrozenBlock) => {
    const { key, n } = blockLabelKey(block.id);
    return t(`project.network.blocks.${key}`, { n });
  };

  return (
    <figure className="space-y-3" data-testid="network-map">
      <figcaption className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{t('project.network.title')}</span>
        <ExactBadge label={t('playground.exact')} hint={t('project.network.exactHint')} />
      </figcaption>
      <p className="text-sm text-muted">
        {t('project.network.summary', {
          layers: MOBILENET_SUMMARY.totalLayers,
          frozen: fmt(MOBILENET_SUMMARY.totalParams),
          trainable: fmt(dense.total),
        })}
      </p>
      <ol className="flex flex-wrap items-center gap-1" aria-label={t('project.network.title')}>
        <li className="rounded border border-rule px-2 py-1 text-xs">
          <span className="block font-medium">{t('project.network.input')}</span>
          <span className="font-mono">{shape(MOBILENET_SUMMARY.inputShape)}</span>
        </li>
        {MOBILENET_SUMMARY.blocks.map((block) => {
          const isSelected = selected.kind === 'frozen' && selected.block.id === block.id;
          return (
            <li key={block.id}>
              <button
                type="button"
                aria-pressed={isSelected}
                aria-label={t('project.network.blockLabel', { name: labelOf(block), shape: shape(block.outShape) })}
                onClick={() => setSelected({ kind: 'frozen', block })}
                className={`flex h-14 w-16 flex-col items-center justify-between rounded border px-1 py-1 text-[10px] text-muted ${isSelected ? 'border-ink bg-surface' : 'border-rule bg-rule/30'}`}
              >
                <span className="flex items-center gap-0.5"><Lock className="h-2.5 w-2.5" />{labelOf(block)}</span>
                <SizeSquare size={block.outShape[0]} />
                <span className="font-mono">{block.outShape[0]}×{block.outShape[2]}</span>
              </button>
            </li>
          );
        })}
        <li aria-hidden="true" className="text-muted"><ArrowRight /></li>
        <li className="rounded border border-rule px-2 py-1 text-xs">
          <span className="block font-medium">{t('project.network.pool')}</span>
          <span className="font-mono">{fmt(FEATURE_DIM)}</span>
        </li>
        <li>
          <button
            type="button"
            aria-pressed={selected.kind === 'dense'}
            onClick={() => setSelected({ kind: 'dense' })}
            className={`rounded border-2 px-2 py-1 text-left text-xs ${selected.kind === 'dense' ? 'border-primary bg-primary/10' : 'border-primary/60'}`}
            data-testid="network-dense"
          >
            <span className="block font-semibold text-primary">{t(isTraining ? 'project.network.denseTraining' : 'project.network.dense')}</span>
            <span className="font-mono">{fmt(FEATURE_DIM)} → {numClasses}</span>
          </button>
        </li>
        <li className="rounded border border-rule px-2 py-1 text-xs">
          <span className="block font-medium">softmax</span>
          <span>{t('project.network.output', { count: numClasses })}</span>
        </li>
      </ol>
      {selected.kind === 'dense' ? (
        <DenseDetail numClasses={numClasses} />
      ) : (
        <BlockDetail block={selected.block} label={labelOf(selected.block)} />
      )}
    </figure>
  );
}

function DenseDetail({ numClasses }: { readonly numClasses: number }) {
  const { t, i18n } = useTranslation();
  const dense = denseParams(numClasses);
  const fmt = (n: number) => n.toLocaleString(i18n.language);
  return (
    <div className="space-y-1 rounded border border-primary/60 p-3 text-sm" data-testid="network-detail">
      <p className="font-semibold">{t('project.network.denseTitle')}</p>
      <p className="font-mono text-xs">logit[k] = W[k, 0]·x[0] + … + W[k, 1279]·x[1279] + b[k]</p>
      <p>{t('project.network.denseCount', { dim: fmt(FEATURE_DIM), k: numClasses, weights: fmt(dense.weights), bias: numClasses, total: fmt(dense.total) })}</p>
      <p className="text-xs text-muted">{t('project.network.denseNote')}</p>
    </div>
  );
}

function BlockDetail({ block, label }: { readonly block: FrozenBlock; readonly label: string }) {
  const { t, i18n } = useTranslation();
  const mode = useModeStore((s) => s.mode);
  const fmt = (n: number) => n.toLocaleString(i18n.language);
  const mapLayer = featureMapLayerOf(block);
  return (
    <div className="space-y-2 rounded border border-rule p-3 text-sm" data-testid="network-detail">
      <p className="font-semibold">
        <Lock className="mr-1" />
        {t('project.network.blockTitle', { name: label, shape: block.outShape.join(' × ') })}
      </p>
      <ul className="grid gap-1 text-xs sm:grid-cols-2">
        {LAYER_ORDER.filter((kind) => block.layers[kind]).map((kind) => (
          <li key={kind}>
            <span className="font-mono font-medium">{kind} × {block.layers[kind]}</span>: {t(`project.network.kinds.${kind}`)}
          </li>
        ))}
      </ul>
      <p className="text-xs">{t('project.network.blockParams', { params: fmt(block.params), stats: fmt(block.statParams) })}</p>
      <p className="text-xs text-muted">{t('project.network.frozenNote')}</p>
      {mapLayer && <p className="text-xs text-muted">{t('project.network.featureMapHint', { layer: mapLayer })}</p>}
      {mode === 'expert' && <p className="font-mono text-[10px] text-muted">{block.layerNames.join(' → ')}</p>}
    </div>
  );
}
