import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { encodeText, type TextData } from '@/core/text/text-model';
import { colorFor } from '@/features/studio/image/lab/class-style';
import { ExactBadge } from '@/ui/ExactBadge';
import { VectorizeCode } from './TextCodePanels';

/** Số từ hay gặp nhất hiển thị cho mỗi lớp. */
const TOP_WORDS = 8;

interface TextRepresentSectionProps {
  readonly data: TextData;
  readonly maxN: 1 | 2;
  readonly onMaxNChange: (maxN: 1 | 2) => void;
}

function frequentWords(data: TextData): { label: string; words: { term: string; count: number }[] }[] {
  return data.classNames.map((label, c) => {
    const counts = new Map<string, number>();
    data.train.texts.forEach((text, i) => {
      if (data.train.y[i] !== c) return;
      for (const term of encodeText(data, text).terms) if (!term.includes(' ')) counts.set(term, (counts.get(term) ?? 0) + 1);
    });
    const words = [...counts.entries()].map(([term, count]) => ({ term, count })).sort((a, b) => b.count - a.count || a.term.localeCompare(b.term, 'vi'));
    return { label, words: words.slice(0, TOP_WORDS) };
  });
}

export function TextRepresentSection({ data, maxN, onMaxNChange }: TextRepresentSectionProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const [sentence, setSentence] = useState(() => data.train.texts[0] ?? '');
  const encoded = useMemo(() => encodeText(data, sentence), [data, sentence]);
  const rows = data.vocab.terms
    .map((term, j) => ({ term, count: encoded.counts[j] as number, idf: data.idf[j] as number, tfidf: encoded.tfidf[j] as number }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.tfidf - a.tfidf);
  const unknown = [...new Set(encoded.terms.filter((term) => !data.vocab.index.has(term)))];
  const frequent = useMemo(() => frequentWords(data), [data]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{t('text.represent.title')}</h3>
            <ExactBadge label={t('playground.exact')} hint={t('text.represent.exactHint')} />
          </div>
          <fieldset>
            <legend className="text-sm font-medium">{t('text.represent.ngram')}</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {([1, 2] as const).map((n) => (
                <label key={n} className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-1.5 text-sm ${maxN === n ? 'border-primary' : 'border-rule'}`}>
                  <input type="radio" name="text-ngram" checked={maxN === n} onChange={() => onMaxNChange(n)} />
                  {t(`text.represent.ngram${n}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor={inputId} className="text-sm font-medium">{t('text.represent.sentence')}</label>
            <textarea id={inputId} rows={2} value={sentence} onChange={(e) => setSentence(e.target.value)} className="mt-1 w-full rounded border border-rule bg-paper p-2" />
          </div>
          <div>
            <p className="text-sm font-medium">{t('text.represent.tokens', { n: encoded.terms.length })}</p>
            <ul className="mt-1 flex flex-wrap gap-1" data-testid="text-tokens">
              {encoded.terms.map((term, i) => (
                <li key={i} className={`rounded border px-1.5 py-0.5 font-mono text-xs ${data.vocab.index.has(term) ? 'border-rule bg-surface' : 'border-dashed border-warning text-warning'}`}>{term}</li>
              ))}
            </ul>
            {unknown.length > 0 && <p className="mt-1 text-xs text-warning">{t('text.represent.unknown', { words: unknown.join(', ') })}</p>}
          </div>
          <p className="text-sm text-muted" data-testid="vector-size">
            {t('text.represent.vectorSize', { nonzero: rows.length, total: data.vocab.terms.length })}
          </p>
        </div>

        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="tfidf-table">
              <caption className="mb-1 text-left text-sm font-medium">{t('text.represent.tableCaption')}</caption>
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th scope="col" className="py-1 pr-2">{t('text.represent.term')}</th>
                  <th scope="col" className="py-1 pr-2">{t('text.represent.count')}</th>
                  <th scope="col" className="py-1 pr-2">idf</th>
                  <th scope="col" className="py-1">TF-IDF</th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                {rows.map((r) => (
                  <tr key={r.term} className="border-t border-rule">
                    <th scope="row" className="py-1 pr-2 text-left font-medium">{r.term}</th>
                    <td className="py-1 pr-2">{r.count}</td>
                    <td className="py-1 pr-2">{r.idf.toFixed(3)}</td>
                    <td className="py-1">{r.tfidf.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-xs text-muted">{t('text.represent.tfidfHint', { n: data.vocab.numDocuments })}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium">{t('text.represent.frequentTitle')}</h4>
            <ul className="mt-1 space-y-1 text-xs">
              {frequent.map((f, c) => (
                <li key={f.label}>
                  <span className="font-semibold" style={{ color: colorFor(c) }}>{f.label}:</span>{' '}
                  <span className="font-mono">{f.words.map((w) => `${w.term} (${w.count})`).join(' · ')}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-muted">{t('text.represent.frequentHint')}</p>
          </div>
        </div>
      </div>
    <VectorizeCode data={data} sentence={sentence} />
    </div>
  );
}
