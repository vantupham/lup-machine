import { useMemo, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { DecisionTree, TreeNode } from '@/core/algorithms/decision-tree';
import { colorFor } from '@/features/studio/image/lab/class-style';
import { treeLayout, type PlacedNode } from './tree-layout';

const COL_W = 168;
const ROW_H = 96;
const BOX_W = 156;
const BOX_H = 60;
const PAD = 10;
const MAX_TEXT = 14;
const BAR_H = 8;

interface TreeDiagramProps {
  readonly tree: DecisionTree;
  /** Số nút đã dựng (theo thanh trượt). */
  readonly count: number;
  readonly featureNames: readonly string[];
  readonly classNames: readonly string[];
  /** Nút đang soi (xem các ngưỡng đã thử). */
  readonly focus: number;
  readonly onPick: (id: number) => void;
}

function clip(text: string): string {
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text;
}

/** Sơ đồ nút–nhánh của cây đang mọc: mỗi nút là một hộp có câu hỏi (hoặc lớp đoán) và thanh tỉ lệ lớp. */
export function TreeDiagram({ tree, count, featureNames, classNames, focus, onPick }: TreeDiagramProps) {
  const { t, i18n } = useTranslation();
  const layout = useMemo(() => treeLayout(tree, count), [tree, count]);
  const fmt = (v: number) => v.toLocaleString(i18n.language, { maximumFractionDigits: 2 });
  const width = Math.max(1, layout.columns) * COL_W + 2 * PAD;
  const height = Math.max(1, layout.rows) * ROW_H - (ROW_H - BOX_H) + 2 * PAD;
  const cx = (n: PlacedNode) => PAD + n.col * COL_W + COL_W / 2;
  const top = (n: PlacedNode) => PAD + n.row * ROW_H;
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));
  const question = (node: TreeNode) => `${clip(featureNames[node.split!.feature] ?? '')} ≤ ${fmt(node.split!.threshold)}`;
  const winner = (node: TreeNode) => classNames[node.counts.indexOf(Math.max(...node.counts))] ?? '';

  return (
    <div className="overflow-x-auto rounded border border-rule bg-surface">
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block max-w-none" role="group" aria-label={t('growth.tree.diagramLabel', { count })} data-testid="tree-diagram">
        {layout.edges.map((e) => {
          const a = byId.get(e.from)!;
          const b = byId.get(e.to)!;
          const x1 = cx(a);
          const y1 = top(a) + BOX_H;
          const x2 = cx(b);
          const y2 = top(b);
          const midY = (y1 + y2) / 2;
          return (
            <g key={`${e.from}-${e.to}`} className="text-muted">
              <path d={`M${x1} ${y1} C${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`} fill="none" stroke="currentColor" strokeOpacity={0.7} strokeDasharray={e.isPending ? '4 4' : undefined} />
              <text x={(x1 + x2) / 2 + (e.isLeft ? -6 : 6)} y={midY - 2} textAnchor={e.isLeft ? 'end' : 'start'} className="fill-muted text-[11px]">
                {t(e.isLeft ? 'growth.tree.yes' : 'growth.tree.no')}
              </text>
            </g>
          );
        })}
        {layout.nodes.map((placed) => {
          const node = tree.nodes[placed.id]!;
          const x = cx(placed) - BOX_W / 2;
          const y = top(placed);
          if (placed.isPending) {
            return (
              <g key={placed.id}>
                <rect x={x} y={y} width={BOX_W} height={BOX_H} rx={6} fill="none" className="stroke-rule" strokeDasharray="4 4" />
                <text x={x + BOX_W / 2} y={y + BOX_H / 2} textAnchor="middle" dominantBaseline="middle" className="fill-muted text-[11px]">
                  {t('growth.tree.pending')}
                </text>
              </g>
            );
          }
          const text = placed.isOpenSplit ? question(node) : `→ ${clip(winner(node))}`;
          const isFocus = placed.isOpenSplit && placed.id === focus;
          const isNewest = placed.id === count - 1;
          const select = () => onPick(placed.id);
          const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            select();
          };
          const interactive = placed.isOpenSplit
            ? { role: 'button', tabIndex: 0, 'aria-pressed': isFocus, onClick: select, onKeyDown: onKey, className: 'network-slab cursor-pointer outline-none' }
            : { role: 'img' };
          return (
            <g key={placed.id} {...interactive} aria-label={t('growth.tree.nodeLabel', { id: node.id, text, samples: node.samples })}>
              <rect
                x={x}
                y={y}
                width={BOX_W}
                height={BOX_H}
                rx={6}
                className={isFocus ? 'fill-primary/10 stroke-primary' : 'fill-surface stroke-rule'}
                strokeWidth={isFocus || isNewest ? 2 : 1}
                strokeDasharray={isNewest && !isFocus ? '6 3' : undefined}
              />
              <text x={x + 8} y={y + 18} className={`${placed.isOpenSplit ? 'fill-ink font-mono text-[11px]' : 'fill-ink text-[12px] font-semibold'}`}>
                {text}
              </text>
              <text x={x + 8} y={y + 34} className="fill-muted text-[10px]">
                {t('growth.tree.rows', { id: node.id, n: node.samples })}
              </text>
              <ClassStack x={x + 8} y={y + BOX_H - BAR_H - 8} width={BOX_W - 16} counts={node.counts} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Thanh chia theo tỉ lệ lớp trong nút: nút càng "thuần" thì càng một màu. */
function ClassStack({ x, y, width, counts }: { readonly x: number; readonly y: number; readonly width: number; readonly counts: readonly number[] }) {
  const total = Math.max(1, counts.reduce((a, b) => a + b, 0));
  const starts = counts.map((_, k) => counts.slice(0, k).reduce((a, b) => a + b, 0));
  return (
    <g>
      {counts.map((c, k) => (
        <rect key={k} x={x + (starts[k]! / total) * width} y={y} width={(c / total) * width} height={BAR_H} fill={colorFor(k)} />
      ))}
    </g>
  );
}
