import { useTranslation } from 'react-i18next';
import { NEGATIVE, POSITIVE } from '@/features/studio/image/lab/step-visuals';

/** Số từ mỗi phía (kéo về lớp / đẩy khỏi lớp). */
const WORDS_PER_SIDE = 8;
const MIN_FONT = 11;
const FONT_RANGE = 11;

interface WordWeightsProps {
  readonly weights: readonly number[];
  readonly terms: readonly string[];
  readonly label: string;
}

/** Trọng số TF-IDF đọc thành chữ: từ kéo về lớp (xanh) và từ đẩy khỏi lớp (cam); trọng số càng lớn chữ càng to. */
export function WordWeights({ weights, terms, label }: WordWeightsProps) {
  const { t, i18n } = useTranslation();
  const ranked = weights.map((w, j) => ({ w, j }));
  const towards = [...ranked].filter((e) => e.w > 0).sort((a, b) => b.w - a.w || a.j - b.j).slice(0, WORDS_PER_SIDE);
  const away = [...ranked].filter((e) => e.w < 0).sort((a, b) => a.w - b.w || a.j - b.j).slice(0, WORDS_PER_SIDE);
  const max = Math.max(1e-12, ...[...towards, ...away].map((e) => Math.abs(e.w)));
  const fmt = (v: number) => v.toLocaleString(i18n.language, { maximumFractionDigits: 3 });
  const chips = (list: typeof towards, color: string) =>
    list.map(({ w, j }) => (
      <li key={j} title={`${terms[j]}: ${fmt(w)}`} className="rounded px-1.5 py-0.5 leading-tight" style={{ color, fontSize: MIN_FONT + (Math.abs(w) / max) * FONT_RANGE, backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}>
        {terms[j]}
      </li>
    ));
  return (
    <figure className="space-y-1" aria-label={label} data-testid="word-weights">
      <p className="text-xs text-muted">{t('growth.logistic.wordsTowards')}</p>
      <ul className="flex flex-wrap items-baseline gap-1">{chips(towards, POSITIVE)}</ul>
      <p className="text-xs text-muted">{t('growth.logistic.wordsAway')}</p>
      <ul className="flex flex-wrap items-baseline gap-1">{chips(away, NEGATIVE)}</ul>
    </figure>
  );
}
