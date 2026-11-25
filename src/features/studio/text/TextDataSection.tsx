import { useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { CSV_LIMITS, parseCsv } from '@/core/tabular/csv';
import type { TextExample } from '@/core/text/text-model';
import type { SaveTableInput } from '@/storage/repositories/table-repository';
import { getErrorMessage } from '@/ui/error-message';
import { csvErrorKey } from '../tabular/DataSection';
import { SentenceEditor } from './SentenceEditor';
import { TEXT_SAMPLES } from './text-samples';
import { ClassMarker } from '@/ui/ClassMarker';

const PREVIEW_PER_CLASS = 3;

interface TextDataSectionProps {
  readonly hasTable: boolean;
  readonly fileName: string | null;
  readonly examples: readonly TextExample[];
  readonly onSave: (input: Omit<SaveTableInput, 'projectId'>) => Promise<void>;
}

type Mode = 'view' | 'edit' | 'replace';

export function TextDataSection({ hasTable, fileName, examples, onSave }: TextDataSectionProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('view');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (csv: string, name: string, sampleId: string | null) => {
    const result = parseCsv(csv);
    if (!result.ok) {
      const [key, params] = csvErrorKey(result);
      setError(t(key, params));
      return;
    }
    if (result.table.headers.length < 2) {
      setError(t('text.data.needTwoColumns'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave({ csv, fileName: name, sampleId });
      setMode('view');
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

  const errorLine = error && <p role="alert" className="text-sm text-danger">{error}</p>;

  if (mode === 'edit') {
    return (
      <div className="space-y-3">
        <SentenceEditor initial={examples} onSave={(csv) => save(csv, t('text.editor.fileName'), null)} onCancel={() => setMode('view')} />
        {errorLine}
      </div>
    );
  }

  if (!hasTable || mode === 'replace') {
    return (
      <div className="space-y-4">
        <p className="text-muted">{t('text.data.empty')}</p>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lab-card space-y-2 p-4">
            <h3 className="font-semibold">{t('tabular.data.samplesTitle')}</h3>
            {TEXT_SAMPLES.map((s) => (
              <button key={s.id} type="button" disabled={busy} className="btn btn-ghost w-full justify-between text-left text-sm" onClick={async () => save(await s.load(), s.fileName, s.id)}>
                <span>{t(`text.samples.${s.id}`)}</span>
                <span className="font-mono text-xs text-muted">{t('text.data.sentenceCount', { n: s.sentences })}</span>
              </button>
            ))}
          </div>
          <div className="lab-card space-y-2 p-4">
            <h3 className="font-semibold">{t('text.data.writeTitle')}</h3>
            <p className="text-sm text-muted">{t('text.data.writeHint')}</p>
            <button type="button" className="btn btn-primary text-sm" onClick={() => setMode('edit')}>{t('text.data.write')}</button>
          </div>
          <div className="lab-card space-y-2 p-4">
            <h3 className="font-semibold">{t('tabular.data.uploadTitle')}</h3>
            <label className="btn btn-ghost cursor-pointer text-sm">
              {t('tabular.data.chooseFile')}
              <input type="file" accept=".csv,.tsv,.txt,text/csv" className="sr-only" onChange={handleFile} disabled={busy} />
            </label>
            <p className="text-xs text-muted">{t('text.data.uploadHint')}</p>
          </div>
        </div>
        {hasTable && <button type="button" className="btn btn-ghost text-sm" onClick={() => setMode('view')}>{t('tabular.data.cancel')}</button>}
        {errorLine}
      </div>
    );
  }

  const groups = new Map<string, string[]>();
  for (const e of examples) {
    if (!e.label.trim() || !e.text.trim()) continue;
    groups.set(e.label.trim(), [...(groups.get(e.label.trim()) ?? []), e.text.trim()]);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <p className="font-mono text-sm">{fileName}</p>
        <p className="text-sm text-muted" data-testid="text-size">{t('text.data.size', { sentences: [...groups.values()].flat().length, classes: groups.size })}</p>
        <div className="ml-auto flex gap-2">
          <button type="button" className="btn btn-ghost text-sm" onClick={() => setMode('edit')}>{t('text.data.edit')}</button>
          <button type="button" className="btn btn-ghost text-sm" onClick={() => setMode('replace')}>{t('tabular.data.replace')}</button>
        </div>
      </div>
      <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {[...groups.entries()].map(([label, sentences], i) => (
          <li key={label} className="lab-card p-3">
            <p className="font-semibold">
              <ClassMarker index={i} className="mr-1" />
              {label} <span className="font-mono text-xs text-muted">· {t('text.data.sentenceCount', { n: sentences.length })}</span>
            </p>
            <ul className="mt-1 space-y-0.5 text-sm text-muted">
              {sentences.slice(0, PREVIEW_PER_CLASS).map((s, j) => <li key={j} className="truncate">“{s}”</li>)}
              {sentences.length > PREVIEW_PER_CLASS && <li className="text-xs">{t('tabular.data.moreRows', { n: sentences.length - PREVIEW_PER_CLASS })}</li>}
            </ul>
          </li>
        ))}
      </ul>
      {errorLine}
    </div>
  );
}
