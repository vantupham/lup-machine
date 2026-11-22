import { useTranslation } from 'react-i18next';
import type { WorksheetRecord } from '@/content/lessons';

/** Dòng kẻ chấm để học sinh viết tay. */
export function WriteLines({ count }: { readonly count: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-8 border-b border-dotted border-ink/50" />
      ))}
    </div>
  );
}

const cellClass = 'h-9 border border-ink/60 px-2';
/** Số liệu mẫu ở bản giáo viên: chữ nghiêng để phân biệt với nhãn in sẵn. */
const answerClass = 'font-mono italic';

interface TableProps {
  readonly title: string;
  readonly columns: readonly string[];
  readonly rows: readonly string[];
  readonly answers: readonly (readonly string[])[] | null;
}

function RecordTable({ title, columns, rows, answers }: TableProps) {
  return (
    <table className="w-full border-collapse text-sm" aria-label={title}>
      <caption className="mb-1 text-left font-medium">{title}</caption>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c} scope="col" className={`${cellClass} bg-ink/5 text-left`}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r}>
            <th scope="row" className={`${cellClass} text-left font-mono font-normal`}>{r}</th>
            {columns.slice(1).map((c, j) => (
              <td key={c} className={`${cellClass} ${answerClass}`}>{answers?.[i]?.[j] ?? ''}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface ConfusionProps {
  readonly title: string;
  readonly classNames: readonly string[];
  readonly answers: readonly (readonly number[])[] | null;
}

function RecordConfusion({ title, classNames, answers }: ConfusionProps) {
  const { t } = useTranslation();
  return (
    <table className="border-collapse text-sm" aria-label={title}>
      <caption className="mb-1 text-left font-medium">{title}</caption>
      <thead>
        <tr>
          <th scope="col" className={`${cellClass} text-left text-xs font-normal`}>{t('worksheet.actualPredicted')}</th>
          {classNames.map((c) => <th key={c} scope="col" className={`${cellClass} bg-ink/5`}>{c}</th>)}
        </tr>
      </thead>
      <tbody>
        {classNames.map((r, i) => (
          <tr key={r}>
            <th scope="row" className={`${cellClass} bg-ink/5 text-left`}>{r}</th>
            {classNames.map((c, j) => (
              <td key={c} className={`${cellClass} w-20 text-center ${answerClass} ${i === j ? 'font-bold' : ''}`}>
                {answers?.[i]?.[j] ?? ''}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface RecordBlockProps {
  readonly record: WorksheetRecord;
  readonly classNames: readonly string[];
  /** Bản giáo viên: điền số liệu mẫu đã kiểm chứng (nếu bài có khai báo). */
  readonly showAnswers: boolean;
}

/** Một khung ghi kết quả trên phiếu, theo loại khai báo trong bài học. */
export function RecordBlock({ record, classNames, showAnswers }: RecordBlockProps) {
  switch (record.kind) {
    case 'table':
      return <RecordTable title={record.title} columns={record.columns} rows={record.rows} answers={showAnswers ? (record.answers ?? null) : null} />;
    case 'confusion':
      return <RecordConfusion title={record.title} classNames={classNames} answers={showAnswers ? (record.answers ?? null) : null} />;
    case 'fields':
      return (
        <div className="text-sm">
          <p className="font-medium">{record.title}</p>
          {record.fields.map((f, i) => (
            <p key={f} className="mt-2 flex items-end gap-2">
              <span>{f}</span>
              {showAnswers && record.answers?.[i] !== undefined ? (
                <span className="italic">{record.answers[i]}</span>
              ) : (
                <span aria-hidden="true" className="h-6 flex-1 border-b border-dotted border-ink/50" />
              )}
            </p>
          ))}
        </div>
      );
    case 'lines':
      return (
        <div className="text-sm">
          <p className="font-medium">{record.title}</p>
          {showAnswers && record.answer ? <p className="mt-1 italic leading-relaxed">{record.answer}</p> : <WriteLines count={record.lines} />}
        </div>
      );
  }
}
