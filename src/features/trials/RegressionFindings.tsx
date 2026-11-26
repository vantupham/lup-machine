import { useTranslation } from 'react-i18next';
import { SMALL_SET } from '@/core/ml/findings';
import { Lightbulb } from '@/ui/icons';

export interface RegressionRow {
  readonly rowNumber: number;
  readonly actual: number;
  readonly predicted: number;
}

/** Số dòng bị đoán lệch nhiều nhất được liệt kê. */
export const TOP_ERRORS = 3;

/** Những dòng Kiểm tra bị đoán lệch nhiều nhất, lệch lớn trước. */
export function largestErrors(rows: readonly RegressionRow[], count: number = TOP_ERRORS): RegressionRow[] {
  return [...rows].sort((a, b) => Math.abs(b.actual - b.predicted) - Math.abs(a.actual - a.predicted)).slice(0, count);
}

interface RegressionFindingsProps {
  readonly target: string;
  readonly rows: readonly RegressionRow[];
}

/** "Điểm đáng chú ý" cho bài toán hồi quy: những dòng bị đoán lệch nhiều nhất và cỡ tập Kiểm tra. */
export function RegressionFindings({ target, rows }: RegressionFindingsProps) {
  const { t, i18n } = useTranslation();
  if (rows.length === 0) return null;
  const fmt = (v: number) => v.toLocaleString(i18n.language, { maximumFractionDigits: 2 });
  const worst = largestErrors(rows);

  return (
    <section aria-labelledby="regression-findings-title" className="lab-card space-y-3 p-4" data-testid="regression-findings">
      <h3 id="regression-findings-title" className="flex flex-wrap items-baseline gap-2 font-semibold">
        <Lightbulb />
        {t('project.findings.title')}
        <span className="text-xs font-normal text-muted">{t('project.findings.on', { split: t('project.class.test') })}</span>
      </h3>
      <div className="space-y-1 border-l-4 border-primary pl-3 text-sm" data-testid="finding-largest-errors">
        <p>{t('sampleFindings.largestErrors', { count: worst.length, target })}</p>
        <ul className="font-mono text-xs">
          {worst.map((r) => (
            <li key={r.rowNumber}>
              {t('sampleFindings.errorRow', { row: r.rowNumber, actual: fmt(r.actual), predicted: fmt(r.predicted), diff: fmt(Math.abs(r.actual - r.predicted)) })}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">
          <span className="font-medium">{t('project.findings.why')}</span> {t('sampleFindings.whyLargestErrors')}
        </p>
      </div>
      {rows.length < SMALL_SET && (
        <div className="space-y-1 border-l-4 border-primary pl-3 text-sm" data-testid="finding-small-set">
          <p>{t('sampleFindings.smallSet', { total: rows.length, step: (100 / rows.length).toLocaleString(i18n.language, { maximumFractionDigits: 1 }) })}</p>
          <p className="text-xs text-muted">
            <span className="font-medium">{t('project.findings.why')}</span> {t('project.findings.whySmallSet')}
          </p>
        </div>
      )}
    </section>
  );
}
