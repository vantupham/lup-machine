import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { ProjectType } from '@/storage/schemas/project';
import { getErrorMessage } from '@/ui/error-message';
import { ProjectTypeIcon } from './ProjectTypeIcon';
import { QUICK_START_TYPES } from './quick-start';
import { useCreateProject } from './useCreateProject';
import { ArrowRight } from '@/ui/icons';

/** Năm thẻ lớn: bấm một lần là có dự án (tên tự đặt) và vào thẳng không gian làm việc. */
export function ProjectTypeCards() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const [creating, setCreating] = useState<ProjectType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async (type: ProjectType) => {
    setCreating(type);
    setError(null);
    try {
      const project = await createProject(type);
      navigate(`/studio/${project.id}`);
    } catch (err: unknown) {
      console.error('Không tạo được dự án', err);
      setError(t('quickStart.error', { message: getErrorMessage(err) }));
      setCreating(null);
    }
  };

  return (
    <div className="space-y-3">
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {QUICK_START_TYPES.map((type, i) => (
          <li key={type} className={i === 0 ? 'sm:col-span-2 lg:col-span-1' : undefined}>
            <button
              type="button"
              onClick={() => void start(type)}
              disabled={creating !== null}
              aria-label={t('quickStart.startAria', { type: t(`studio.types.${type}`) })}
              aria-describedby={`quick-start-${type}-desc`}
              className="lab-card lab-card-interactive group flex h-full w-full flex-col gap-3 p-5 text-left disabled:cursor-wait disabled:opacity-60"
            >
              <span className="flex items-center justify-between">
                <span className="flex size-12 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
                  <ProjectTypeIcon type={type} />
                </span>
                {i === 0 && (
                  <span className="rounded-full bg-highlight px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider">
                    {t('quickStart.popular')}
                  </span>
                )}
              </span>
              <span className="font-display text-2xl font-bold">{t(`studio.types.${type}`)}</span>
              <span id={`quick-start-${type}-desc`} className="text-sm leading-relaxed text-muted">
                {t(`quickStart.types.${type}.description`)}
                <span className="mt-2 block font-mono text-xs text-ink/70">{t(`quickStart.types.${type}.example`)}</span>
              </span>
              <span className="mt-auto pt-2 text-sm font-semibold text-primary">
                {creating === type ? t('quickStart.creating') : t('quickStart.start')}{' '}
                <ArrowRight className="transition-transform group-hover:translate-x-1" />
              </span>
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
