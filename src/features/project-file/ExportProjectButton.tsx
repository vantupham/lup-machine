import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectFileRepository } from '@/storage/repository-context';
import { downloadBytes } from '@/ui/download';
import { getErrorMessage } from '@/ui/error-message';

interface ExportProjectButtonProps {
  readonly projectId: string;
  readonly projectName: string;
}

/** Nút xuất cả dự án thành tệp .lup để mang sang máy khác hoặc nộp cho thầy cô. */
export function ExportProjectButton({ projectId, projectName }: ExportProjectButtonProps) {
  const { t } = useTranslation();
  const projectFiles = useProjectFileRepository();
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsBusy(true);
    setError(null);
    try {
      const { fileName, bytes } = await projectFiles.exportProject(projectId);
      downloadBytes(fileName, bytes);
    } catch (err: unknown) {
      console.error('Không xuất được dự án', err);
      setError(t('projectFile.exportError', { message: getErrorMessage(err) }));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={isBusy}
        aria-label={t('projectFile.exportLabel', { name: projectName })}
        className="btn btn-ghost px-3 py-1 text-sm"
      >
        {isBusy ? t('projectFile.exporting') : t('projectFile.exportButton')}
      </button>
      {error && (
        <p role="alert" className="basis-full text-xs text-danger">
          {error}
        </p>
      )}
    </>
  );
}
