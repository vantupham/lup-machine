import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { nodeSamples, splitCandidates, type DecisionTree, type SplitCandidate } from '@/core/algorithms/decision-tree';
import { ClassMarker } from '@/ui/ClassMarker';
import { ExactBadge } from '@/ui/ExactBadge';
import { Pause, Play } from '@/ui/icons';
import { usePlayback } from '@/ui/usePlayback';
import { TreeDiagram } from './TreeDiagram';
import { NEGATIVE, POSITIVE } from '@/features/studio/image/lab/step-visuals';

export interface TreeGrowthProps {
  readonly tree: DecisionTree;
  /** Dữ liệu Huấn luyện (giá trị gốc) mà cây vừa học. */
  readonly xs: readonly (readonly number[])[];
  readonly ys: readonly number[];
  readonly featureNames: readonly string[];
  readonly classNames: readonly string[];
}

/** Bước 4 (cây quyết định): cây mọc từng nút theo đúng thứ tự máy dựng, và mọi ngưỡng máy đã thử ở một nút. */
export function TreeGrowth(props: TreeGrowthProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  return (
    <details className="rounded border border-rule p-3 text-sm" onToggle={(e) => setIsOpen(e.currentTarget.open)} data-testid="tree-growth">
      <summary className="cursor-pointer font-semibold">{t('growth.tree.title')}</summary>
      {isOpen && <TreeSteps {...props} />}
    </details>
  );
}

function TreeSteps({ tree, xs, ys, featureNames, classNames }: TreeGrowthProps) {
  const { t, i18n } = useTranslation();
  const [count, setCount] = useState(1);
  const shown = tree.nodes.slice(0, count);
  /** Nút đã tách và đã dựng con trái (trên sơ đồ là câu hỏi). */
  const isOpen = (id: number) => (tree.nodes[id]?.split?.left ?? Infinity) < count;
  const latestSplit = [...shown].reverse().find((n) => isOpen(n.id));
  const [picked, setPicked] = useState<number | null>(null);
  const focus = tree.nodes[picked !== null && isOpen(picked) ? picked : (latestSplit?.id ?? 0)]!;
  const fmt = (v: number, d = 3) => v.toLocaleString(i18n.language, { maximumFractionDigits: d });
  const winner = (counts: readonly number[]) => classNames[counts.indexOf(Math.max(...counts))];
  const playback = usePlayback({ value: count - 1, max: tree.nodes.length - 1, onChange: (v) => setCount(v + 1), stepMs: GROW_STEP_MS });

  return (
    <div className="mt-3 space-y-3">
      <p className="flex flex-wrap items-center gap-2 text-muted">
        {t('growth.tree.lead', { count: tree.nodes.length })}
        <ExactBadge label={t('playground.exact')} hint={t('growth.tree.exactHint')} />
      </p>
      <div className="flex items-end gap-3">
        <button type="button" className="btn btn-ghost" onClick={playback.toggle} aria-pressed={playback.isPlaying}>
          {playback.isPlaying ? <Pause /> : <Play />} {t(playback.isPlaying ? 'project.train.pause' : 'project.train.play')}
        </button>
        <label className="block flex-1">
          <span className="font-medium">{t('growth.tree.slider', { n: count, max: tree.nodes.length })}</span>
          <input type="range" min={1} max={tree.nodes.length} value={count} onChange={(e) => setCount(Number(e.target.value))} className="mt-1 block w-full" />
        </label>
      </div>
      <TreeDiagram tree={tree} count={count} featureNames={featureNames} classNames={classNames} focus={focus.id} onPick={setPicked} />
      <ul className="flex flex-wrap gap-3 text-xs" aria-label={t('growth.tree.legend')}>
        {classNames.map((name, k) => (
          <li key={name}><ClassMarker index={k} className="mr-1" />{name}</li>
        ))}
      </ul>
      <details className="text-xs">
        <summary className="cursor-pointer">{t('growth.tree.listTitle')}</summary>
        <ol className="space-y-0.5 font-mono text-xs" data-testid="tree-steps">
          {shown.map((node) => {
            const isOpenSplit = node.split && node.split.left < count;
            return (
              <li key={node.id} style={{ paddingLeft: `${node.depth * 1.25}rem` }}>
                <button type="button" disabled={!node.split} onClick={() => setPicked(node.id)} className={`text-left ${node.id === focus.id ? 'font-bold text-primary' : ''}`}>
                  {t('growth.tree.node', { id: node.id, samples: node.samples, impurity: fmt(node.impurity) })}{' '}
                  {node.split && isOpenSplit
                    ? t('growth.tree.split', { feature: featureNames[node.split.feature], threshold: fmt(node.split.threshold) })
                    : t('growth.tree.leaf', { cls: winner(node.counts) })}
                </button>
              </li>
            );
          })}
        </ol>
      </details>
      {focus.split && <ThresholdSearch tree={tree} nodeId={focus.id} xs={xs} ys={ys} featureNames={featureNames} />}
    </div>
  );
}

/** Phát: mỗi nút mới hiện sau chừng này (ms). */
const GROW_STEP_MS = 700;
const W = 320;
const H = 120;
const PAD = 8;

function ThresholdSearch({ tree, nodeId, xs, ys, featureNames }: { readonly tree: DecisionTree; readonly nodeId: number; readonly xs: TreeGrowthProps['xs']; readonly ys: readonly number[]; readonly featureNames: readonly string[] }) {
  const { t, i18n } = useTranslation();
  const node = tree.nodes[nodeId]!;
  const split = node.split!;
  const candidates = useMemo(
    () => splitCandidates(nodeSamples(tree, xs, nodeId), xs, ys, tree.numClasses, split.feature, tree.criterion),
    [tree, xs, ys, nodeId, split.feature],
  );
  if (candidates.length === 0) return null;
  const fmt = (v: number) => v.toLocaleString(i18n.language, { maximumFractionDigits: 3 });
  const lo = candidates[0]!.threshold;
  const hi = candidates.at(-1)!.threshold;
  const maxImp = Math.max(1e-12, ...candidates.map((c) => c.improvement));
  const px = (c: SplitCandidate) => PAD + ((c.threshold - lo) / Math.max(1e-12, hi - lo)) * (W - 2 * PAD);
  const py = (c: SplitCandidate) => H - PAD - (Math.max(0, c.improvement) / maxImp) * (H - 2 * PAD);
  const best = candidates.find((c) => c.threshold === split.threshold);
  return (
    <figure className="space-y-1" data-testid="threshold-search">
      <figcaption className="text-xs font-medium">{t('growth.tree.searchTitle', { id: nodeId, feature: featureNames[split.feature], count: candidates.length })}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-md rounded-sm border border-rule bg-paper" role="img" aria-label={t('growth.tree.searchLabel', { count: candidates.length })}>
        <polyline fill="none" stroke={POSITIVE} strokeWidth={1.5} points={candidates.map((c) => `${px(c)},${py(c)}`).join(' ')} />
        {best && <circle cx={px(best)} cy={py(best)} r={4} fill={NEGATIVE} />}
      </svg>
      <p className="text-xs">{t('growth.tree.searchNote', { threshold: fmt(split.threshold), improvement: fmt(best?.improvement ?? 0), lo: fmt(lo), hi: fmt(hi) })}</p>
    </figure>
  );
}
