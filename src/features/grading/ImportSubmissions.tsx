import { useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSubmissionRepository } from '@/storage/repository-context';
import { SUBMISSION_FILE_EXTENSION } from '@/storage/classroom/extensions';
import { importSubmissionFiles, type ImportResult } from './grading';

interface ImportSubmissionsProps {
  readonly onImported: (results: readonly ImportResult[]) => Promise<void>;
}

/** Chọn nhiều tệp .lups một lần; mỗi tệp được báo kết quả riêng. */
export function ImportSubmissions({ onImported }: ImportSubmissionsProps) {
  const { t } = useTranslation();
  const repo = useSubmissionRepository();
  const [isBusy, setIsBusy] = useState(false);
  const [results, setResults] = useState<readonly ImportResult[]>([]);

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    // Sao chép trước khi xóa giá trị ô chọn tệp: FileList thay đổi theo ô chọn.
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;
    setIsBusy(true);
    try {
      const loaded = await Promise.all(files.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })));
      const next = await importSubmissionFiles(repo, loaded);
      setResults(next);
      await onImported(next);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section aria-labelledby="import-submissions-title" className="lab-card space-y-3 p-5">
      <h2 id="import-submissions-title" className="text-xl font-semibold">{t('grading.importTitle')}</h2>
      <p className="text-sm text-muted">{t('grading.importLead')}</p>
      <label className={`btn btn-primary text-sm ${isBusy ? 'opacity-60' : 'cursor-pointer'}`}>
        {isBusy ? t('grading.importing') : t('grading.importLabel')}
        <input type="file" multiple accept={`${SUBMISSION_FILE_EXTENSION},application/zip`} className="sr-only" onChange={(e) => void handleFiles(e)} disabled={isBusy} />
      </label>
      <ul aria-live="polite" data-testid="import-results" className="space-y-1 text-sm empty:hidden">
        {results.map((r, i) => (
          <li key={i} className={r.outcome === 'error' ? 'text-danger' : r.outcome === 'older' ? 'text-warning' : 'text-accent'}>
            <span className="font-mono">{r.fileName}</span>
            {r.students ? ` (${r.students})` : ''}: {r.outcome === 'error' ? t('grading.outcome.error', { message: r.message }) : t(`grading.outcome.${r.outcome}`)}
          </li>
        ))}
      </ul>
    </section>
  );
}
