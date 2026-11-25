import { useTranslation } from 'react-i18next';
import type { DecisionTree, TreeNode } from '@/core/algorithms/decision-tree';
import { colorFor } from '@/features/studio/image/lab/class-style';
import { ChevronRight } from '@/ui/icons';
import { ClassMarker } from '@/ui/ClassMarker';

interface TreeDiagramProps {
  readonly tree: DecisionTree;
  readonly opened: ReadonlySet<number>;
  /** Nút vừa mở ở bước gần nhất (tô nổi bật). */
  readonly latest: number | null;
  readonly featureNames: readonly string[];
}

function CountsBar({ node }: { readonly node: TreeNode }) {
  return (
    <span className="inline-flex h-2 w-20 overflow-hidden rounded bg-rule" aria-hidden="true">
      {node.counts.map((c, k) => (
        <span key={k} style={{ width: `${(c / node.samples) * 100}%`, backgroundColor: colorFor(k) }} />
      ))}
    </span>
  );
}

function NodeView({ tree, id, opened, latest, featureNames, branch }: TreeDiagramProps & { readonly id: number; readonly branch: string | null }) {
  const { t } = useTranslation();
  const node = tree.nodes[id] as TreeNode;
  const isOpen = node.split !== null && opened.has(id);
  const majority = node.counts.reduce((best, c, k) => (c > (node.counts[best] as number) ? k : best), 0);

  return (
    <li className="relative pl-4 before:absolute before:top-0 before:left-0 before:h-full before:border-l before:border-rule">
      <div
        className={`my-1 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded border px-2 py-1 text-sm ${id === latest ? 'border-primary bg-highlight/40' : 'border-rule bg-surface'}`}
      >
        {branch && <span className="inline-flex items-center font-mono text-xs text-muted">{branch}<ChevronRight /></span>}
        {isOpen && node.split ? (
          <span className="font-mono font-semibold">
            {featureNames[node.split.feature]} ≤ {node.split.threshold.toFixed(3)}?
          </span>
        ) : (
          <span className="font-semibold">
            <ClassMarker index={majority} className="mr-1" />
            {t('playground.common.className', { n: majority + 1 })}
          </span>
        )}
        <CountsBar node={node} />
        <span className="font-mono text-xs text-muted">
          {t('playground.tree.nodeStats', { samples: node.samples, impurity: node.impurity.toFixed(3), counts: node.counts.join(' / ') })}
        </span>
      </div>
      {isOpen && node.split && (
        <ul>
          <NodeView tree={tree} id={node.split.left} opened={opened} latest={latest} featureNames={featureNames} branch={t('playground.tree.yes')} />
          <NodeView tree={tree} id={node.split.right} opened={opened} latest={latest} featureNames={featureNames} branch={t('playground.tree.no')} />
        </ul>
      )}
    </li>
  );
}

/** Cây vẽ thành danh sách lồng nhau: mỗi nút là một câu hỏi "đặc trưng ≤ ngưỡng?". */
export function TreeDiagram(props: TreeDiagramProps) {
  const { t } = useTranslation();
  return (
    <ul aria-label={t('playground.tree.diagramLabel')} className="overflow-x-auto" data-testid="tree-diagram">
      <NodeView {...props} id={0} branch={null} />
    </ul>
  );
}
