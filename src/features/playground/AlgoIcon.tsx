import { BrainCircuit, ChartLine, ChartScatter, GitFork, Target, TrendingDown, type IconComponent } from '@/ui/icons';
import type { PlaygroundAlgo } from './catalog';

const ICONS: Readonly<Record<PlaygroundAlgo, IconComponent>> = {
  knn: Target,
  'decision-tree': GitFork,
  'linear-regression': ChartLine,
  'gradient-descent': TrendingDown,
  'k-means': ChartScatter,
  'neural-network': BrainCircuit,
};

/** Icon của một thuật toán trên thẻ của trang Thuật toán. */
export function AlgoIcon({ algo }: { readonly algo: PlaygroundAlgo }) {
  const Icon = ICONS[algo];
  return <Icon className="size-8 text-primary" strokeWidth={1.75} />;
}
