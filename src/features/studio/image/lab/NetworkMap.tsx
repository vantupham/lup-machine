import { useMemo, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FEATURE_DIM } from '@/core/ml/feature-model';
import { blockLabelKey, denseParams, featureMapLayerOf, MOBILENET_SUMMARY, type FrozenBlock, type LayerKind } from '@/core/ml/network-summary';
import type { StoredImage } from '@/storage/db';
import { ExactBadge } from '@/ui/ExactBadge';
import { Lock } from '@/ui/icons';
import { useModeStore } from '@/ui/mode-store';
import { useObjectUrl } from '../useObjectUrl';
import { colorFor } from './class-style';
import { funnelLayout, FUNNEL_HEIGHT, INPUT_BOX, type FunnelLayout, type Slab } from './network-funnel';

const LAYER_ORDER: readonly LayerKind[] = ['ZeroPadding2D', 'Conv2D', 'DepthwiseConv2D', 'BatchNormalization', 'ReLU', 'Add'];
/** Số chấm tượng trưng cho 1280 số sau lớp trung bình. */
const POOL_DOTS = 9;
const POOL_DOT_GAP = 13;
const CLASS_RADIUS = 9;
const MAX_CLASS_NAME = 16;
const LABEL_Y = FUNNEL_HEIGHT - 8;
const BRACKET_Y = 14;

type Selection = { readonly kind: 'frozen'; readonly block: FrozenBlock } | { readonly kind: 'dense' };

interface NetworkMapProps {
  readonly classNames: readonly string[];
  readonly isTraining: boolean;
  /** Một ảnh Huấn luyện của dự án, vẽ ở đầu vào (không có thì vẽ ô trống). */
  readonly inputImage?: StoredImage | undefined;
}

/** Enter / Space trên phần tử SVG có role="button" (SVG không tự có hành vi của nút). */
function onActivate(action: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    action();
  };
}

function shortName(name: string): string {
  return name.length > MAX_CLASS_NAME ? `${name.slice(0, MAX_CLASS_NAME - 1)}…` : name;
}

/** Bước 4 (Studio ảnh): phễu MobileNetV2 (đóng băng) thu ảnh 224 × 224 thành 1280 số, rồi tầng Dense đang học nối tới các lớp. */
export function NetworkMap({ classNames, isTraining, inputImage }: NetworkMapProps) {
  const { t, i18n } = useTranslation();
  const [selected, setSelected] = useState<Selection>({ kind: 'dense' });
  const layout = useMemo(() => funnelLayout(MOBILENET_SUMMARY.blocks), []);
  const fmt = (n: number) => n.toLocaleString(i18n.language);
  const numClasses = classNames.length;
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
          trainable: fmt(denseParams(numClasses).total),
        })}
      </p>
      <div className="overflow-x-auto rounded border border-rule bg-surface">
        <svg viewBox={`0 0 ${layout.width} ${FUNNEL_HEIGHT}`} className="block h-auto w-full min-w-[820px]" role="group" aria-label={t('project.network.title')}>
          <defs>
            <marker id="network-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0 L8 4 L0 8 Z" className="fill-muted" />
            </marker>
          </defs>
          <InputPlane image={inputImage} centerY={layout.centerY} />
          <path d={`M${INPUT_BOX.x + INPUT_BOX.size + 6} ${layout.centerY} H${layout.frozen.x0 - 4}`} className="stroke-muted" strokeOpacity={0.6} markerEnd="url(#network-arrow)" />
          <FrozenBracket layout={layout} label={t('project.network.frozen', { count: fmt(MOBILENET_SUMMARY.totalParams) })} />
          {layout.stages.map((stage) => (
            <g key={stage.size}>
              {stage.slabs.map((slab) => {
                const isSelected = selected.kind === 'frozen' && selected.block.id === slab.block.id;
                const label = t('project.network.blockLabel', { name: labelOf(slab.block), shape: slab.block.outShape.join(' × ') });
                return <SlabShape key={slab.block.id} slab={slab} label={label} isSelected={isSelected} onSelect={() => setSelected({ kind: 'frozen', block: slab.block })} />;
              })}
              <text x={(stage.x0 + stage.x1) / 2} y={LABEL_Y - 14} textAnchor="middle" className="fill-ink font-mono text-[11px]">
                {stage.size} × {stage.size}
              </text>
              <text x={(stage.x0 + stage.x1) / 2} y={LABEL_Y} textAnchor="middle" className="fill-muted text-[10px]">
                {t('project.network.stageBlocks', { count: stage.slabs.length })}
              </text>
            </g>
          ))}
          <DenseFan
            layout={layout}
            classNames={classNames}
            isTraining={isTraining}
            isSelected={selected.kind === 'dense'}
            onSelect={() => setSelected({ kind: 'dense' })}
          />
        </svg>
      </div>
      <p className="text-xs text-muted">
        {t('project.network.legend')}
        <span className="sm:hidden"> {t('project.network.scrollHint')}</span>
      </p>
      {selected.kind === 'dense' ? (
        <DenseDetail numClasses={numClasses} />
      ) : (
        <BlockDetail block={selected.block} label={labelOf(selected.block)} />
      )}
    </figure>
  );
}

function InputPlane({ image, centerY }: { readonly image: StoredImage | undefined; readonly centerY: number }) {
  const { t } = useTranslation();
  const { x, size } = INPUT_BOX;
  const y = centerY - size / 2;
  return (
    <g>
      <rect x={x} y={y} width={size} height={size} rx={4} className="fill-rule/40 stroke-rule" />
      {image && <InputImage image={image} x={x} y={y} size={size} />}
      <text x={x + size / 2} y={LABEL_Y - 14} textAnchor="middle" className="fill-ink font-mono text-[11px]">
        {MOBILENET_SUMMARY.inputShape.join(' × ')}
      </text>
      <text x={x + size / 2} y={LABEL_Y} textAnchor="middle" className="fill-muted text-[10px]">
        {t('project.network.input')}
      </text>
    </g>
  );
}

function InputImage({ image, x, y, size }: { readonly image: StoredImage; readonly x: number; readonly y: number; readonly size: number }) {
  const url = useObjectUrl(image);
  return (
    <>
      <clipPath id="network-input-clip">
        <rect x={x} y={y} width={size} height={size} rx={4} />
      </clipPath>
      <image href={url} x={x} y={y} width={size} height={size} preserveAspectRatio="xMidYMid slice" clipPath="url(#network-input-clip)" data-testid="network-input-image" />
    </>
  );
}

function FrozenBracket({ layout, label }: { readonly layout: FunnelLayout; readonly label: string }) {
  const { x0, x1 } = layout.frozen;
  const mid = (x0 + x1) / 2;
  return (
    <g className="text-muted" data-testid="network-frozen">
      <path d={`M${x0} ${BRACKET_Y + 8} V${BRACKET_Y + 2} H${x1} V${BRACKET_Y + 8}`} fill="none" stroke="currentColor" strokeOpacity={0.6} />
      <rect x={mid - 80} y={BRACKET_Y - 8} width={160} height={18} className="fill-surface" />
      <Lock x={mid - 74} y={BRACKET_Y - 5} width={12} height={12} aria-hidden="true" />
      <text x={mid + 8} y={BRACKET_Y + 5} textAnchor="middle" className="fill-muted text-[11px]">
        {label}
      </text>
    </g>
  );
}

/** Một khối: mặt trước, mặt trên, mặt bên (đậm dần) cho cảm giác khối hộp; bấm để xem chi tiết. */
function SlabShape({ slab, label, isSelected, onSelect }: { readonly slab: Slab; readonly label: string; readonly isSelected: boolean; readonly onSelect: () => void }) {
  const { x, y, w, h, depth: d } = slab;
  return (
    <g
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={label}
      onClick={onSelect}
      onKeyDown={onActivate(onSelect)}
      className={`network-slab cursor-pointer outline-none ${isSelected ? 'text-primary' : 'text-muted'}`}
    >
      <title>{label}</title>
      <path d={`M${x} ${y} L${x + d} ${y - d} H${x + w + d} L${x + w} ${y} Z`} fill="currentColor" fillOpacity={isSelected ? 0.55 : 0.28} />
      <path d={`M${x + w} ${y} L${x + w + d} ${y - d} V${y + h - d} L${x + w} ${y + h} Z`} fill="currentColor" fillOpacity={isSelected ? 0.75 : 0.4} />
      <rect x={x} y={y} width={w} height={h} fill="currentColor" fillOpacity={isSelected ? 0.4 : 0.16} stroke="currentColor" strokeOpacity={0.55} strokeWidth={isSelected ? 1.5 : 0.75} />
    </g>
  );
}

interface DenseFanProps {
  readonly layout: FunnelLayout;
  readonly classNames: readonly string[];
  readonly isTraining: boolean;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
}

/** 1280 số (vẽ bằng vài chấm) nối tới từng lớp: chính là các trọng số của tầng Dense. */
function DenseFan({ layout, classNames, isTraining, isSelected, onSelect }: DenseFanProps) {
  const { t, i18n } = useTranslation();
  const { centerY } = layout;
  const poolX = layout.pool.x;
  const outX = layout.output.x;
  const dots = Array.from({ length: POOL_DOTS }, (_, i) => centerY + (i - (POOL_DOTS - 1) / 2) * POOL_DOT_GAP);
  const classY = layout.classY(classNames.length);
  const top = Math.min(dots[0]!, classY[0] ?? centerY) - 34;
  const bottom = Math.max(dots.at(-1)!, classY.at(-1) ?? centerY) + 18;
  const lastStage = layout.stages.at(-1);
  const arrowFrom = (lastStage?.x1 ?? layout.frozen.x1) + 6;

  return (
    <>
      <path d={`M${arrowFrom} ${centerY} H${poolX - 10}`} className="stroke-muted" strokeOpacity={0.6} markerEnd="url(#network-arrow)" />
      <g
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        onClick={onSelect}
        onKeyDown={onActivate(onSelect)}
        className="network-slab cursor-pointer outline-none"
        data-testid="network-dense"
      >
        <rect x={poolX - 14} y={top} width={outX - poolX + 28} height={bottom - top} rx={8} className={isSelected ? 'fill-primary/10 stroke-primary' : 'fill-transparent stroke-primary/50'} strokeWidth={isSelected ? 2 : 1} />
        <text x={(poolX + outX) / 2} y={top + 16} textAnchor="middle" className="fill-primary text-[12px] font-semibold">
          {t(isTraining ? 'project.network.denseTraining' : 'project.network.dense')}
        </text>
        <g data-testid="network-links" className={isTraining ? 'network-flow' : undefined}>
          {dots.flatMap((dy, i) =>
            classY.map((cy, k) => <line key={`${i}-${k}`} x1={poolX} y1={dy} x2={outX - CLASS_RADIUS} y2={cy} stroke={colorFor(k)} strokeOpacity={0.35} strokeWidth={1} />),
          )}
        </g>
        {dots.map((dy, i) => (
          <circle key={i} cx={poolX} cy={dy} r={i === Math.floor(POOL_DOTS / 2) ? 1.5 : 3.5} className="fill-ink/70" />
        ))}
        <text x={(poolX + outX) / 2} y={bottom - 6} textAnchor="middle" className="fill-muted font-mono text-[10px]">
          {FEATURE_DIM.toLocaleString(i18n.language)} → {classNames.length}
        </text>
      </g>
      <text x={poolX} y={LABEL_Y - 14} textAnchor="middle" className="fill-ink font-mono text-[11px]">
        {FEATURE_DIM.toLocaleString(i18n.language)}
      </text>
      <text x={poolX} y={LABEL_Y} textAnchor="middle" className="fill-muted text-[10px]">
        {t('project.network.pool')}
      </text>
      {classY.map((cy, k) => (
        <g key={k}>
          <title>{classNames[k]}</title>
          <circle cx={outX} cy={cy} r={CLASS_RADIUS} fill={colorFor(k)} />
          <text x={outX + CLASS_RADIUS + 6} y={cy} dominantBaseline="middle" className="fill-ink text-[12px]" data-testid="network-class">
            {shortName(classNames[k] ?? '')}
          </text>
        </g>
      ))}
      <text x={outX} y={LABEL_Y} textAnchor="middle" className="fill-muted text-[10px]">
        {t('project.network.output', { count: classNames.length })}
      </text>
    </>
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
