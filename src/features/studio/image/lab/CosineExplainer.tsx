import { useTranslation } from 'react-i18next';
import type { Neighbor } from '@/core/trace/represent-trace';
import { ExactBadge } from '@/ui/ExactBadge';
import { FeatureStrip } from './FeatureStrip';

interface CosineExplainerProps {
  readonly selected: Float32Array;
  readonly neighbor: Float32Array;
  readonly neighborName: string;
  readonly result: Neighbor;
}

/** Vì sao hai ảnh "giống nhau": hai dải 1280 số đặt cạnh nhau và phép tính cosine với số thật. */
export function CosineExplainer({ selected, neighbor, neighborName, result }: CosineExplainerProps) {
  const { t, i18n } = useTranslation();
  const fmt = (v: number, digits: number) => v.toLocaleString(i18n.language, { maximumFractionDigits: digits, minimumFractionDigits: digits });
  const normV = Math.sqrt(selected.reduce((s, x) => s + x * x, 0));
  const normN = result.norm / normV;
  return (
    <figure className="space-y-2 border-t border-rule pt-3" data-testid="cosine-explainer">
      <figcaption className="flex flex-wrap items-center gap-2 text-sm font-medium">
        {t('project.cosine.title', { name: neighborName })}
        <ExactBadge label={t('playground.exact')} hint={t('project.cosine.exactHint')} />
      </figcaption>
      <div className="grid gap-1">
        <FeatureStrip vector={selected} compact label={t('project.cosine.selected')} />
        <FeatureStrip vector={neighbor} compact label={t('project.cosine.neighbor')} />
      </div>
      <p className="font-mono text-xs" data-testid="cosine-formula">
        {t('project.cosine.formula', { dot: fmt(result.dot, 2), na: fmt(normV, 2), nb: fmt(normN, 2), sim: fmt(result.similarity, 2) })}
      </p>
      <p className="text-xs text-muted">{t('project.cosine.note')}</p>
    </figure>
  );
}
