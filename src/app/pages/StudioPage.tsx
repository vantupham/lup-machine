import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { SampleDatasetsPanel } from '@/features/samples/SampleDatasetsPanel';
import { ImportProjectPanel } from '@/features/project-file/ImportProjectPanel';
import { ProjectList } from '@/features/studio/project-list/ProjectList';
import { ProjectTypeCards } from '@/features/studio/quick-start/ProjectTypeCards';
import { useCreateProject } from '@/features/studio/quick-start/useCreateProject';
import { useProjectRepository } from '@/storage/repository-context';
import type { ProjectRecord } from '@/storage/db';
import { PROJECT_TYPES } from '@/storage/schemas/manifest';
import type { ProjectType } from '@/storage/schemas/project';
import { getErrorMessage } from '@/ui/error-message';

type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly projects: ProjectRecord[] }
  | { readonly status: 'error' };

/**
 * Thứ tự theo mức hay dùng: tạo mới một chạm → dự án của em → dữ liệu mẫu.
 * Form đặt tên riêng và mở tệp .lup là lối phụ, nằm cột bên.
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

  const handleDelete = async (project: ProjectRecord) => {
    if (!window.confirm(t('studio.confirmDelete', { name: project.name }))) return;
    setDeleteError(null);
    try {
      await repository.delete(project.id);
    } catch (error: unknown) {
      console.error('Không xóa được dự án', project.id, error);
      setDeleteError(t('studio.deleteError', { name: project.name, message: getErrorMessage(error) }));
    }
    await reload();
  };

  return (
    <div className="space-y-12">
      <header>
        <h1 className="font-display text-4xl font-bold">{t('studio.title')}</h1>
        <p className="mt-2 max-w-2xl text-muted">{t('studio.lead')}</p>
      </header>

      <section aria-labelledby="new-project-title" className="space-y-4">
        <h2 id="new-project-title" className="font-display text-2xl font-bold">{t('studio.newProject')}</h2>
        <ProjectTypeCards />
      </section>

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
          {state.status === 'ready' && state.projects.length === 0 && (
            <p className="rounded border border-dashed border-rule p-6 text-muted">
              {t('studio.empty')}
            </p>
          )}
          {state.status === 'ready' && state.projects.length > 0 && <ProjectList projects={state.projects} onDelete={handleDelete} />}
        </section>
        <aside className="space-y-6">
          <NamedProjectForm />
          <ImportProjectPanel onImported={reload} />
        </aside>
      </div>

      <SampleDatasetsPanel />
    </div>
  );
}

/** Lối phụ cho ai muốn đặt tên trước (ví dụ để nộp bài). Để trống tên thì tự đặt, giống thẻ ở trên. */
function NamedProjectForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const [name, setName] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('image');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const project = await createProject(projectType, name);
      navigate(`/studio/${project.id}`);
    } catch (err: unknown) {
      setError(t('studio.saveError', { message: getErrorMessage(err) }));
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="lab-card h-fit space-y-4 p-5" noValidate>
      <div>
        <h2 className="text-lg font-semibold">{t('studio.namedTitle')}</h2>
        <p className="text-sm text-muted">{t('studio.namedLead')}</p>
      </div>
      <div>
        <label htmlFor="project-name" className="mb-1 block text-sm font-medium">
          {t('studio.nameLabel')}
        </label>
        <input
          id="project-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('studio.namePlaceholder')}
          maxLength={100}
          className="w-full rounded border border-rule bg-paper px-3 py-2"
        />
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t('studio.typeLabel')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {PROJECT_TYPES.map((type) => (
            <label
              key={type}
              className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm ${projectType === type ? 'border-primary' : 'border-rule'}`}
            >
              <input type="radio" name="project-type" value={type} checked={projectType === type} onChange={() => setProjectType(type)} />
              {t(`studio.types.${type}`)}
            </label>
          ))}
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary w-full justify-center" disabled={isSaving}>
        {isSaving ? t('studio.creating') : t('studio.create')}
      </button>
    </form>
  );
}
