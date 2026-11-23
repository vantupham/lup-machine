import { useId, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { CSV_LIMITS, parseCsv, type CsvResult, type ParsedTable } from '@/core/tabular/csv';
import type { ColumnSummary } from '@/core/tabular/columns';
import type { SaveTableInput, StoredTable } from '@/storage/repositories/table-repository';
import { getErrorMessage } from '@/ui/error-message';
import { findTabularSample, TABULAR_SAMPLES } from './tabular-samples';

const PREVIEW_ROWS = 8;

interface DataSectionProps {
  readonly table: StoredTable | null;
  readonly parsed: ParsedTable | null;
  readonly columns: readonly ColumnSummary[];
  readonly onSave: (input: Omit<SaveTableInput, 'projectId'>) => Promise<void>;
}

export function csvErrorKey(result: Extract<CsvResult, { ok: false }>): [string, Record<string, string | number>] {
  return [`tabular.csvErrors.${result.error}`, { line: result.line ?? 0, detail: result.detail ?? '', maxRows: CSV_LIMITS.maxRows, maxColumns: CSV_LIMITS.maxColumns }];
}

function DataLoader({ onSave }: Pick<DataSectionProps, 'onSave'>) {
  const { t } = useTranslation();
  const pasteId = useId();
  const [pasted, setPasted] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (csv: string, fileName: string, sampleId: string | null) => {
    const result = parseCsv(csv);
    if (!result.ok) {
      const [key, params] = csvErrorKey(result);
      setError(t(key, params));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave({ csv, fileName, sampleId });
    } catch (err: unknown) {
      setError(t('tabular.saveError', { message: getErrorMessage(err) }));
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > CSV_LIMITS.maxChars) {
      setError(t('tabular.csvErrors.too-large'));
      return;
    }
    await save(await file.text(), file.name, null);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lab-card space-y-2 p-4">
        <h3 className="font-semibold">{t('tabular.data.samplesTitle')}</h3>
        {TABULAR_SAMPLES.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={busy}
            className="btn btn-ghost w-full justify-between text-left text-sm"
            onClick={async () => save(await s.load(), s.fileName, s.id)}
          >
            <span>{t(`tabular.samples.${s.id}.name`)}</span>
            <span className="font-mono text-xs text-muted">{t('tabular.data.rowCount', { n: s.rows })}</span>
          </button>
        ))}
      </div>
      <div className="lab-card space-y-2 p-4">
        <h3 className="font-semibold">{t('tabular.data.uploadTitle')}</h3>
        <label className="btn btn-primary cursor-pointer text-sm">
          {t('tabular.data.chooseFile')}
          <input type="file" accept=".csv,.tsv,.txt,text/csv" className="sr-only" onChange={handleFile} disabled={busy} />
        </label>
        <p className="text-xs text-muted">{t('tabular.data.uploadHint', { rows: CSV_LIMITS.maxRows, columns: CSV_LIMITS.maxColumns })}</p>
      </div>
      <div className="lab-card space-y-2 p-4">
        <label htmlFor={pasteId} className="font-semibold">{t('tabular.data.pasteTitle')}</label>
        <textarea
          id={pasteId}
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={4}
          placeholder={t('tabular.data.pastePlaceholder')}
          className="w-full rounded border border-rule bg-paper p-2 font-mono text-xs"
        />
        <button type="button" className="btn btn-ghost text-sm" disabled={busy || pasted.trim() === ''} onClick={() => save(pasted, t('tabular.data.pastedName'), null)}>
          {t('tabular.data.usePasted')}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-danger lg:col-span-3">{error}</p>}
    </div>
  );
}

function ColumnBadge({ column }: { readonly column: ColumnSummary }) {
  const { t } = useTranslation();
  return (
    <span className="block font-mono text-[10px] font-normal text-muted">
      {t(`tabular.kinds.${column.kind}`)}
      {column.missing > 0 && <span className="text-warning"> · {t('tabular.data.missing', { n: column.missing })}</span>}
    </span>
  );
}

export function DataSection({ table, parsed, columns, onSave }: DataSectionProps) {
  const { t } = useTranslation();
  const [replacing, setReplacing] = useState(false);
  const sample = findTabularSample(table?.sampleId ?? null);

  if (!table || !parsed || replacing) {
    return (
      <div className="space-y-3">
        <p className="text-muted">{t('tabular.data.empty')}</p>
        <DataLoader onSave={async (input) => { await onSave(input); setReplacing(false); }} />
        {replacing && <button type="button" className="btn btn-ghost text-sm" onClick={() => setReplacing(false)}>{t('tabular.data.cancel')}</button>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="font-mono text-sm">{table.fileName}</p>
        <p className="text-sm text-muted" data-testid="table-size">{t('tabular.data.size', { rows: parsed.rows.length, columns: parsed.headers.length })}</p>
        <button type="button" className="btn btn-ghost ml-auto text-sm" onClick={() => setReplacing(true)}>{t('tabular.data.replace')}</button>
      </div>
      {sample && (
        <p className="text-xs text-muted">
          {t('tabular.data.credit', { author: sample.author })}{' '}
          <a href={sample.source} className="text-primary underline" target="_blank" rel="noreferrer noopener">{t('tabular.data.source')}</a>{' · '}
          <a href={sample.licenseUrl} className="text-primary underline" target="_blank" rel="noreferrer noopener">{sample.license}</a>
        </p>
      )}
      <div className="overflow-x-auto rounded border border-rule">
        <table className="w-full text-sm">
          <caption className="sr-only">{t('tabular.data.previewCaption', { n: Math.min(PREVIEW_ROWS, parsed.rows.length) })}</caption>
          <thead className="bg-surface">
            <tr>
              <th scope="col" className="px-2 py-1 text-left font-mono text-xs text-muted">#</th>
              {columns.map((c) => (
                <th key={c.name} scope="col" className="px-2 py-1 text-left">
                  {c.name}
                  <ColumnBadge column={c} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parsed.rows.slice(0, PREVIEW_ROWS).map((row, i) => (
              <tr key={i} className="border-t border-rule">
                <td className="px-2 py-1 font-mono text-xs text-muted">{i + 1}</td>
                {row.map((cell, j) => (
                  <td key={j} className={`px-2 py-1 ${cell === '' ? 'bg-highlight/40' : ''}`}>{cell === '' ? '—' : cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {parsed.rows.length > PREVIEW_ROWS && (
        <p className="text-xs text-muted">{t('tabular.data.moreRows', { n: parsed.rows.length - PREVIEW_ROWS })}</p>
      )}
    </div>
  );
}
