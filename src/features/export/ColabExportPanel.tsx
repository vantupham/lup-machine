import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { notebookFileName, serializeNotebook, type Notebook } from '@/core/export/notebook';
import { downloadText } from '@/ui/download';
import { getErrorMessage } from '@/ui/error-message';

/** Notebook lớn hơn mức này có thể mở chậm trên Colab: báo trước cho học sinh. */
const LARGE_NOTEBOOK_BYTES = 8_000_000;

interface ColabExportPanelProps {
  readonly projectName: string;
  /** Dựng notebook khi bấm nút (không dựng sẵn vì có thể nặng). */
  readonly build: () => Notebook;
  /** Khóa i18n mô tả nội dung notebook (khác nhau giữa dự án ảnh và dự án bảng). */
  readonly descriptionKey: string;
}

export function ColabExportPanel({ projectName, build, descriptionKey }: ColabExportPanelProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<{ kind: 'done'; size: number } | { kind: 'error'; message: string } | null>(null);

  const handleExport = () => {
    try {
      const text = serializeNotebook(build());
      downloadText(notebookFileName(projectName), text, 'application/x-ipynb+json');
      setStatus({ kind: 'done', size: new Blob([text]).size });
    } catch (error: unknown) {
      setStatus({ kind: 'error', message: getErrorMessage(error) });
    }
  };

  return (
    <section aria-labelledby="colab-export-title" className="lab-card space-y-3 p-4">
      <h3 id="colab-export-title" className="font-semibold">{t('export.colab.title')}</h3>
      <p className="text-sm text-muted">{t(descriptionKey)}</p>
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>{t('export.colab.step1')}</li>
        <li>{t('export.colab.step2')}</li>
        <li>{t('export.colab.step3')}</li>
      </ol>
      <button type="button" className="btn btn-primary" onClick={handleExport}>{t('export.colab.download')}</button>
      {status?.kind === 'done' && (
        <p role="status" className="text-sm text-accent">
          {t('export.colab.done', { size: (status.size / 1e6).toLocaleString('vi', { maximumFractionDigits: 1 }) })}
          {status.size > LARGE_NOTEBOOK_BYTES && <span className="block text-warning">{t('export.colab.large')}</span>}
        </p>
      )}
      {status?.kind === 'error' && <p role="alert" className="text-sm text-danger">{t('export.colab.error', { message: status.message })}</p>}
      <p className="text-xs text-muted">{t('export.colab.privacy')}</p>
    </section>
  );
}
