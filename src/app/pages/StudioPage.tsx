import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SampleDatasetsPanel } from '@/features/samples/SampleDatasetsPanel';
import { ImportProjectPanel } from '@/features/project-file/ImportProjectPanel';
import { ProjectList } from '@/features/studio/project-list/ProjectList';
import { CreateProjectPanel } from '@/features/studio/quick-start/CreateProjectPanel';
import { UndoToast } from '@/features/studio/project-list/UndoToast';
import { useUndoableDelete } from '@/features/studio/project-list/useUndoableDelete';
import { useProjectRepository } from '@/storage/repository-context';
import type { ProjectRecord } from '@/storage/db';
import { getErrorMessage } from '@/ui/error-message';

type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly projects: ProjectRecord[] }
  | { readonly status: 'error' };

/**
 * Thứ tự: tạo dự án (tên tùy chọn + thẻ loại dữ liệu) → dự án của em → dữ liệu mẫu.
 * Mở tệp .lup là lối phụ, nằm cột bên. Xóa một chạm, còn hoàn tác được trong vài giây.
 */
export function StudioPage() {
  const { t } = useTranslation();
  const repository = useProjectRepository();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadProjects = useCallback(
    (): Promise<LoadState> =>
      repository.findAll().then(
        (projects): LoadState => ({ status: 'ready', projects }),
        (error: unknown): LoadState => {
          console.error('Không đọc được danh sách dự án', error);
          return { status: 'error' };
        },
      ),
    [repository],
  );

  const reload = useCallback(async () => setState(await loadProjects()), [loadProjects]);

  useEffect(() => {
    let isActive = true;
    void loadProjects().then((next) => {
      if (isActive) setState(next);
    });
    return () => {
      isActive = false;
    };
  }, [loadProjects]);

  const deletion = useUndoableDelete({
    remove: (id) => repository.delete(id),
    onSettled: reload,
    onError: (project, error) => {
      console.error('Không xóa được dự án', project.id, error);
      setDeleteError(t('studio.deleteError', { name: project.name, message: getErrorMessage(error) }));
    },
  });

  const handleDelete = (project: ProjectRecord) => {
    setDeleteError(null);
    deletion.request(project);
  };

  const visible = state.status === 'ready' ? state.projects.filter((p) => p.id !== deletion.pending?.id) : [];

  return (
    <div className="space-y-12">
      <header>
        <h1 className="font-display text-4xl font-bold">{t('studio.title')}</h1>
        <p className="mt-2 max-w-2xl text-muted">{t('studio.lead')}</p>
      </header>

      <CreateProjectPanel />

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <section aria-labelledby="project-list-title">
          <h2 id="project-list-title" className="mb-4 font-display text-2xl font-bold">
            {t('studio.listTitle')}
          </h2>
          {deleteError && (
            <p role="alert" className="mb-3 rounded border border-danger p-3 text-danger">
              {deleteError}
            </p>
          )}
          {state.status === 'error' && (
            <p role="alert" className="rounded border border-danger p-3 text-danger">
              {t('studio.loadError')}
            </p>
          )}
          {state.status === 'ready' && visible.length === 0 && (
            <p className="rounded border border-dashed border-rule p-6 text-muted">
              {t('studio.empty')}
            </p>
          )}
          {visible.length > 0 && <ProjectList projects={visible} onDelete={handleDelete} />}
        </section>
        <aside className="space-y-6">
          <ImportProjectPanel onImported={reload} />
        </aside>
      </div>

      <SampleDatasetsPanel />

      {deletion.pending && (
        <UndoToast message={t('studio.deleted', { name: deletion.pending.name })} onUndo={deletion.undo} onDismiss={deletion.confirm} />
      )}
    </div>
  );
}
