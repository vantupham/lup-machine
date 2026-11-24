import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAssignmentRepository } from '@/storage/repository-context';
import type { Assignment } from '@/storage/schemas/assignment';

interface AssignmentBannerProps {
  readonly projectId: string;
}

/** Hiện ở đầu trang dự án khi dự án được mở từ gói bài tập. */
export function AssignmentBanner({ projectId }: AssignmentBannerProps) {
  const { t } = useTranslation();
  const assignments = useAssignmentRepository();
  const [linked, setLinked] = useState<{ id: string; assignment: Assignment | null } | null>(null);

  useEffect(() => {
    let isActive = true;
    assignments.get(projectId).then(
      (record) => isActive && setLinked({ id: projectId, assignment: record?.assignment ?? null }),
      (error: unknown) => console.error('Không đọc được bài tập của dự án', error),
    );
    return () => {
      isActive = false;
    };
  }, [assignments, projectId]);

  const assignment = linked?.id === projectId ? linked.assignment : null;
  if (!assignment) return null;
  return (
    <aside aria-label={t('classroom.banner.label')} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded border-l-4 border-primary bg-surface px-4 py-2">
      <span className="font-mono text-xs uppercase text-primary">{t('classroom.banner.label')}</span>
      <span className="font-semibold">{assignment.title}</span>
      {assignment.teacher && <span className="text-sm text-muted">{t('classroom.banner.by', { teacher: assignment.teacher })}</span>}
      <Link to={`/studio/${projectId}/bai-tap`} className="ml-auto text-sm font-medium text-primary underline">
        {t('classroom.banner.open')}
      </Link>
    </aside>
  );
}
