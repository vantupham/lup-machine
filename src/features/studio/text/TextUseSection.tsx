import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { explainText, highlightSpans, type TextData, type TrainedText } from '@/core/text/text-model';
import { colorFor } from '@/features/studio/image/lab/class-style';
import { SelectField } from '@/features/playground/controls';
import { ExactBadge } from '@/ui/ExactBadge';
import { ClassMarker } from '@/ui/ClassMarker';
import { TextPredictCode } from './TextCodePanels';

const MAX_ROWS = 10;

export function TextUseSection({ trained, data }: { readonly trained: TrainedText; readonly data: TextData }) {
  const { t } = useTranslation();
  const inputId = useId();
  const [text, setText] = useState(() => data.test.texts[0] ?? data.train.texts[0] ?? '');
  const [explainFor, setExplainFor] = useState<'predicted' | string>('predicted');
  const predictedEx = explainText(trained, data, text);
  const c = explainFor === 'predicted' ? predictedEx.predicted : Number(explainFor);
  const ex = c === predictedEx.predicted ? predictedEx : explainText(trained, data, text, c);
  const spans = highlightSpans(trained, data, text, c);
  const maxAbs = Math.max(1e-9, ...spans.map((s) => Math.abs(s.value ?? 0)));
  const hasWords = ex.contributions.length > 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <label htmlFor={inputId} className="text-sm font-medium">{t('text.use.input')}</label>
          <textarea id={inputId} rows={3} value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded border border-rule bg-paper p-2" />
          <p className="text-lg" data-testid="text-prediction">
            <ClassMarker index={predictedEx.predicted} className="mr-1" />
            {t('tabular.use.predictedClass', { cls: data.classNames[predictedEx.predicted] })}
          </p>
          <ul className="space-y-1">
            {predictedEx.proba.map((p, k) => (
              <li key={k} className="grid grid-cols-[8rem_1fr_3.5rem] items-center gap-2 text-xs">
                <span>{data.classNames[k]}</span>
                <span className="h-2 rounded" style={{ width: `${p * 100}%`, backgroundColor: colorFor(k) }} />
                <span className="text-right font-mono">{(p * 100).toFixed(1)}%</span>
              </li>
            ))}
          </ul>
          {!hasWords && <p className="text-sm text-warning">{t('text.use.noKnownWords')}</p>}
        </div>

        <section aria-labelledby="text-why-title" className="lab-card space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="text-why-title" className="font-semibold">{t('text.use.whyTitle')}</h3>
            <ExactBadge label={t('playground.exact')} hint={t('text.use.whyHint')} />
          </div>
          <SelectField
            label={t('text.use.explainFor')}
            value={explainFor}
            onChange={setExplainFor}
            options={[
              { value: 'predicted', label: t('text.use.predictedOption', { cls: data.classNames[predictedEx.predicted] }) },
              ...data.classNames.map((name, k) => ({ value: String(k), label: name })),
            ]}
          />
          <p className="rounded border border-rule bg-paper p-3 text-lg leading-relaxed" data-testid="text-highlight">
            {spans.map((s, i) =>
              s.value === null ? (
                <span key={i}>{s.text}</span>
              ) : (
                <mark
                  key={i}
                  title={s.value.toFixed(3)}
                  data-value={s.value.toFixed(4)}
                  className="rounded px-0.5 text-ink"
                  style={{
                    // độ đậm theo độ lớn đóng góp, tối đa 45% để chữ vẫn đọc rõ
                    background: `color-mix(in srgb, ${s.value >= 0 ? 'var(--color-accent)' : 'var(--color-danger)'} ${Math.round((Math.abs(s.value) / maxAbs) * 45)}%, transparent)`,
                  }}
                >
                  {s.text}
                </mark>
              ),
            )}
          </p>
          <p className="text-xs text-muted">{t('text.use.colorLegend', { cls: data.classNames[c] })}</p>
          <table className="w-full text-sm">
            <caption className="mb-1 text-left text-sm font-medium">{t('text.use.tableCaption', { cls: data.classNames[c] })}</caption>
            <tbody className="font-mono text-xs">
              <tr className="border-b border-rule">
                <th scope="row" className="py-1 text-left font-sans font-normal text-muted">{t(trained.kind === 'naive-bayes' ? 'text.use.baseNb' : 'text.use.baseLogistic')}</th>
                <td className="py-1 text-right">{ex.base.toFixed(3)}</td>
              </tr>
              {ex.contributions.slice(0, MAX_ROWS).map((term) => (
                <tr key={term.term}>
                  <th scope="row" className="py-0.5 text-left font-medium">{term.term}</th>
                  <td className={`py-0.5 text-right ${term.value >= 0 ? 'text-accent' : 'text-danger'}`}>{term.value >= 0 ? '+' : '−'}{Math.abs(term.value).toFixed(3)}</td>
                </tr>
              ))}
              {ex.contributions.length > MAX_ROWS && (
                <tr>
                  <th scope="row" className="py-0.5 text-left font-sans font-normal text-muted">{t('text.use.otherTerms', { n: ex.contributions.length - MAX_ROWS })}</th>
                  <td className="py-0.5 text-right">{ex.contributions.slice(MAX_ROWS).reduce((s, x) => s + x.value, 0).toFixed(3)}</td>
                </tr>
              )}
              <tr className="border-t border-ink font-semibold">
                <th scope="row" className="py-1 text-left font-sans">{t('text.use.total')}</th>
                <td className="py-1 text-right" data-testid="text-total">{ex.total.toFixed(3)}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-muted">{t(trained.kind === 'logistic' && trained.model.numClasses === 2 ? 'text.use.totalHintBinary' : 'text.use.totalHint')}</p>
          {ex.unknownTerms.length > 0 && <p className="text-xs text-warning">{t('text.represent.unknown', { words: ex.unknownTerms.join(', ') })}</p>}
        </section>
      </div>
    <TextPredictCode data={data} trained={trained} sentence={text} />
    </div>
  );
}
