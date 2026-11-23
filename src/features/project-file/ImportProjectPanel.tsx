import { useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { ProjectRecord } from '@/storage/db';
import { useProjectFileRepository } from '@/storage/repository-context';
import { PROJECT_FILE_EXTENSION, PROJECT_FILE_LIMITS, ProjectFileError } from '@/storage/project-file/constants';
import { getErrorMessage } from '@/ui/error-message';

interface ImportProjectPanelProps {
  readonly onImported: () => Promise<void>;
}

type ImportState =
  | { readonly status: 'idle' }
  | { readonly status: 'busy' }
  | { readonly status: 'done'; readonly project: ProjectRecord }
  | { readonly status: 'error'; readonly message: string };

const BYTES_PER_MB = 1024 * 1024;

/** Mở tệp .lup thành một dự án mới trên máy này. Tệp được kiểm tra kỹ vì có thể đến từ bất kỳ đâu. */
export function ImportProjectPanel({ onImported }: ImportProjectPanelProps) {
  const { t } = useTranslation();
  const projectFiles = useProjectFileRepository();
  const [state, setState] = useState<ImportState>({ status: 'idle' });

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    // Sao chép trước khi xóa giá trị ô chọn tệp: FileList thay đổi theo ô chọn.
    const [file] = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!file) return;
    if (file.size > PROJECT_FILE_LIMITS.maxArchiveBytes) {
      const mb = PROJECT_FILE_LIMITS.maxArchiveBytes / BYTES_PER_MB;
      setState({ status: 'error', message: t('projectFile.importError', { message: t('projectFile.tooLarge', { mb }) }) });
      return;
    }
    setState({ status: 'busy' });
    try {
      const project = await projectFiles.importProject(new Uint8Array(await file.arrayBuffer()));
      await onImported();
      setState({ status: 'done', project });
    } catch (err: unknown) {
      if (!(err instanceof ProjectFileError)) console.error('Không mở được tệp dự án', err);
      setState({ status: 'error', message: t('projectFile.importError', { message: getErrorMessage(err) }) });
    }
  };

  const isBusy = state.status === 'busy';

  return (
    <section aria-labelledby="import-project-title" className="lab-card h-fit space-y-3 p-5">
      <h2 id="import-project-title" className="text-lg font-semibold">
        {t('projectFile.importTitle')}
      </h2>
      <p className="text-sm text-muted">{t('projectFile.importLead')}</p>
      <label className={`btn btn-ghost text-sm ${isBusy ? 'opacity-60' : 'cursor-pointer'}`}>
        {isBusy ? t('projectFile.importing') : t('projectFile.importLabel')}
        <input
          type="file"
          accept={`${PROJECT_FILE_EXTENSION},application/zip`}
          className="sr-only"
          onChange={(e) => void handleFile(e)}
          disabled={isBusy}
        />
      </label>
      {state.status === 'done' && (
        <p role="status" className="text-sm">
          {t('projectFile.imported', { name: state.project.name })}{' '}
          <Link to={`/studio/${state.project.id}`} className="font-medium text-primary underline">
            {t('projectFile.openImported')} →
          </Link>
        </p>
      )}
      {state.status === 'error' && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}
    </section>
  );
}
