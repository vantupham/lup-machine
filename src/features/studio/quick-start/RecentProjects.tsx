import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { ProjectRecord } from '@/storage/db';
import { useProjectRepository } from '@/storage/repository-context';
import { ProjectTypeIcon } from './ProjectTypeIcon';
import { ArrowRight } from '@/ui/icons';

const RECENT_LIMIT = 3;

/**
 * "Tiếp tục dự án gần đây" ở trang chủ. Chưa có dự án hoặc không đọc được lưu trữ thì ẩn hẳn:
 * trang Mô hình mới là nơi báo lỗi lưu trữ cho người dùng.
 */
export function RecentProjects() {
  const { t, i18n } = useTranslation();
  const repository = useProjectRepository();
  const [projects, setProjects] = useState<readonly ProjectRecord[]>([]);

  useEffect(() => {
    let isActive = true;
    repository.findAll().then(
      (all) => isActive && setProjects(all.slice(0, RECENT_LIMIT)),
      (error: unknown) => console.error('Không đọc được dự án gần đây', error),
    );
    return () => {
      isActive = false;
    };
  }, [repository]);

  if (projects.length === 0) return null;

  return (
    <section aria-labelledby="recent-title" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="recent-title" className="font-display text-xl font-bold">{t('quickStart.recentTitle')}</h2>
        <Link to="/studio" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          {t('quickStart.recentAll')}
          <ArrowRight />
        </Link>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        {projects.map((project) => (
          <li key={project.id}>
            <Link
              to={`/studio/${project.id}`}
              aria-label={`${t('studio.open')} ${project.name}`}
              className="lab-card lab-card-interactive flex items-center gap-3 p-3"
            >
              <span className="text-accent">
                <ProjectTypeIcon type={project.projectType} />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{project.name}</span>
                <span className="block text-xs text-muted">
                  {t(`studio.types.${project.projectType}`)} · {t('studio.updatedAt', { date: new Date(project.updatedAt).toLocaleDateString(i18n.language) })}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
