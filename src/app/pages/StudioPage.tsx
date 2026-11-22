import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { SampleDatasetsPanel } from '@/features/samples/SampleDatasetsPanel';
import { useDatasetRepository, useProjectRepository } from '@/storage/repository-context';
import type { ProjectRecord } from '@/storage/db';
import { PROJECT_TYPES } from '@/storage/schemas/manifest';
import { projectNameSchema, type ProjectType } from '@/storage/schemas/project';
import { getErrorMessage } from '@/ui/error-message';

/** Loại dự án đã có trong phiên bản hiện tại (MVP: chỉ Ảnh). */
const AVAILABLE_TYPES: ReadonlySet<ProjectType> = new Set(['image']);

type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly projects: ProjectRecord[] }
  | { readonly status: 'error' };

export function StudioPage() {
  const { t } = useTranslation();
  const repository = useProjectRepository();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

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
    await repository.delete(project.id);
    await reload();
  };

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-display text-4xl font-bold">{t('studio.title')}</h1>
        <p className="mt-2 max-w-2xl text-muted">{t('studio.lead')}</p>
      </header>

      <SampleDatasetsPanel />

      <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
        <NewProjectForm onCreated={reload} />
        <section aria-labelledby="project-list-title">
          <h2 id="project-list-title" className="mb-4 text-lg font-semibold">
            {t('studio.listTitle')}
          </h2>
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
          {state.status === 'ready' && state.projects.length > 0 && (
            <ul aria-labelledby="project-list-title" className="grid gap-3 sm:grid-cols-2">
              {state.projects.map((project) => (
                <ProjectCard key={project.id} project={project} onDelete={handleDelete} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

interface NewProjectFormProps {
  readonly onCreated: () => Promise<void>;
}

function NewProjectForm({ onCreated }: NewProjectFormProps) {
  const { t } = useTranslation();
  const repository = useProjectRepository();
  const dataset = useDatasetRepository();
  const [name, setName] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('image');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!projectNameSchema.safeParse(name).success) {
      setError(t('studio.nameRequired'));
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const project = await repository.create({ name, projectType });
      await dataset.addClass(project.id, t('project.defaultClass', { n: 1 }));
      await dataset.addClass(project.id, t('project.defaultClass', { n: 2 }));
      setName('');
      await onCreated();
    } catch (err: unknown) {
      setError(t('studio.saveError', { message: getErrorMessage(err) }));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="lab-card h-fit space-y-5 p-5" noValidate>
      <h2 className="text-lg font-semibold">{t('studio.newProject')}</h2>
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
          {PROJECT_TYPES.map((type) => {
            const isAvailable = AVAILABLE_TYPES.has(type);
            return (
              <label
                key={type}
                className={`flex items-center gap-2 rounded border px-3 py-2 text-sm ${
                  projectType === type ? 'border-primary' : 'border-rule'
                } ${isAvailable ? 'cursor-pointer' : 'opacity-50'}`}
              >
                <input
                  type="radio"
                  name="project-type"
                  value={type}
                  checked={projectType === type}
                  disabled={!isAvailable}
                  onChange={() => setProjectType(type)}
                />
                {t(`studio.types.${type}`)}
                {!isAvailable && <span className="ml-auto text-xs">{t('studio.comingSoon')}</span>}
              </label>
            );
          })}
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

interface ProjectCardProps {
  readonly project: ProjectRecord;
  readonly onDelete: (project: ProjectRecord) => Promise<void>;
}

function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const { t, i18n } = useTranslation();
  const date = new Date(project.updatedAt).toLocaleString(i18n.language);

  return (
    <li className="lab-card lab-card-interactive flex flex-col gap-3 p-4">
      <div>
        <span className="font-mono text-xs uppercase text-accent">
          {t(`studio.types.${project.projectType}`)}
        </span>
        <p className="text-lg font-semibold">{project.name}</p>
        <p className="text-xs text-muted">{t('studio.updatedAt', { date })}</p>
      </div>
      <div className="mt-auto flex gap-2">
        <Link
          to={`/studio/${project.id}`}
          aria-label={`${t('studio.open')} ${project.name}`}
          className="btn btn-primary px-3 py-1 text-sm"
        >
          {t('studio.open')} →
        </Link>
        <button
          type="button"
          onClick={() => void onDelete(project)}
          aria-label={`${t('studio.delete')} ${project.name}`}
          className="btn btn-ghost px-3 py-1 text-sm"
        >
          {t('studio.delete')}
        </button>
      </div>
    </li>
  );
}
