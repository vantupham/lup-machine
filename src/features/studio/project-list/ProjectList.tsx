import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProjectRecord } from '@/storage/db';
import { matchesName } from './match-name';
import { ProjectCard } from './ProjectCard';

/** Từ chừng này dự án trở lên mới hiện ô tìm kiếm (ít hơn thì nhìn là thấy). */
export const SEARCH_THRESHOLD = 5;

interface ProjectListProps {
  /** Đã xếp dự án sửa gần nhất lên đầu. */
  readonly projects: readonly ProjectRecord[];
  readonly onDelete: (project: ProjectRecord) => void;
}

export function ProjectList({ projects, onDelete }: ProjectListProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const canSearch = projects.length >= SEARCH_THRESHOLD;
  const effectiveQuery = canSearch ? query : '';
  const shown = projects.filter((p) => matchesName(p.name, effectiveQuery));

  return (
    <div className="space-y-3">
      {canSearch && (
        <input
          type="search"
          aria-label={t('studio.searchLabel')}
          placeholder={t('studio.searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={100}
          className="w-full rounded border border-rule bg-surface px-3 py-2 sm:max-w-xs"
        />
      )}
      {shown.length === 0 ? (
        <p role="status" className="rounded border border-dashed border-rule p-4 text-muted">
          {t('studio.noMatch', { query: effectiveQuery.trim() })}
        </p>
      ) : (
        <ul aria-labelledby="project-list-title" className="grid gap-3 sm:grid-cols-2">
          {shown.map((project) => (
            <ProjectCard key={project.id} project={project} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </div>
  );
}
