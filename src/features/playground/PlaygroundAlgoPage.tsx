import type { ComponentType } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExactBadge } from '@/ui/ExactBadge';
import { NotFoundPage } from '@/app/pages/NotFoundPage';
import { isPlaygroundAlgo, type PlaygroundAlgo } from './catalog';
import { KnnPlayground } from './knn/KnnPlayground';
import { TreePlayground } from './tree/TreePlayground';
import { RegressionPlayground } from './regression/RegressionPlayground';
import { GradientPlayground } from './gradient/GradientPlayground';
import { KmeansPlayground } from './kmeans/KmeansPlayground';
import { NeuralPlayground } from './neural/NeuralPlayground';
import { BackLink } from '@/ui/BackLink';

const PLAYGROUNDS: Readonly<Record<PlaygroundAlgo, ComponentType>> = {
  knn: KnnPlayground,
  'decision-tree': TreePlayground,
  'linear-regression': RegressionPlayground,
  'gradient-descent': GradientPlayground,
  'k-means': KmeansPlayground,
  'neural-network': NeuralPlayground,
};

export function PlaygroundAlgoPage() {
  const { t } = useTranslation();
  const { algo } = useParams();
  if (!isPlaygroundAlgo(algo)) return <NotFoundPage />;
  const Playground = PLAYGROUNDS[algo];

  return (
    <div className="space-y-6">
      <BackLink to="/playground">{t('playground.back')}</BackLink>
      <header className="max-w-3xl space-y-2">
        <h1 className="font-display text-3xl font-bold">{t(`playground.algos.${algo}.name`)}</h1>
        <p className="text-muted">{t(`playground.algos.${algo}.intro`)}</p>
        <ExactBadge label={t('playground.exact')} hint={t(`playground.algos.${algo}.exactHint`)} />
      </header>
      <Playground />
    </div>
  );
}
