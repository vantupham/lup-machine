import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ExportProjectButton } from '@/features/project-file/ExportProjectButton';
import { ProjectTypeIcon } from '@/features/studio/quick-start/ProjectTypeIcon';
import { useObjectUrl } from '@/features/studio/image/useObjectUrl';
import type { ProjectRecord, StoredImage } from '@/storage/db';
import type { ProjectSummary } from '@/storage/repositories/project-summary';
import { useProjectRepository } from '@/storage/repository-context';
import { ArrowRight } from '@/ui/icons';

interface ProjectCardProps {
  readonly project: ProjectRecord;
  readonly onDelete: (project: ProjectRecord) => void;
}

/** Thẻ một dự án: ảnh thu nhỏ hoặc biểu tượng, số liệu tóm tắt, rồi Mở / Xuất / Xóa (xóa để nhạt nhất). */
export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const { t, i18n } = useTranslation();
  const summary = useProjectSummary(project);
  const date = new Date(project.updatedAt).toLocaleString(i18n.language);

  return (
    <li aria-label={project.name} className="lab-card lab-card-interactive flex flex-col gap-3 p-4">
      <div className="flex gap-3">
        <Preview project={project} thumbnails={summary?.thumbnails ?? []} />
        <div className="min-w-0">
          <span className="text-xs text-muted">{t(`studio.types.${project.projectType}`)}</span>
          <p className="truncate text-lg font-semibold">{project.name}</p>
          {summary && <SummaryLine project={project} summary={summary} />}
          <p className="text-xs text-muted">{t('studio.updatedAt', { date })}</p>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <Link to={`/studio/${project.id}`} aria-label={`${t('studio.open')} ${project.name}`} className="btn btn-primary px-3 py-1 text-sm">
          {t('studio.open')} <ArrowRight />
        </Link>
        <ExportProjectButton projectId={project.id} projectName={project.name} />
        <button
          type="button"
          onClick={() => onDelete(project)}
          aria-label={`${t('studio.delete')} ${project.name}`}
          className="ml-auto rounded px-2 py-1 text-sm text-muted transition-colors hover:text-danger"
        >
          {t('studio.delete')}
        </button>
      </div>
    </li>
  );
}

/**
 * Tóm tắt nạp riêng từng thẻ: thẻ hiện ngay, số liệu đến sau; lỗi thì chỉ thiếu dòng tóm tắt.
 * Chỉ nạp lại khi dự án đổi thật (updatedAt), không phải mỗi lần danh sách tải lại, để ảnh thu nhỏ khỏi nháy.
 */
function useProjectSummary({ id, projectType, updatedAt }: ProjectRecord): ProjectSummary | null {
  const repository = useProjectRepository();
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  useEffect(() => {
    let isActive = true;
    repository.summarize({ id, projectType }).then(
      (next) => isActive && setSummary(next),
      (error: unknown) => console.error('Không tóm tắt được dự án', id, error),
    );
    return () => {
      isActive = false;
    };
  }, [repository, id, projectType, updatedAt]);
  return summary;
}

function SummaryLine({ project, summary }: { readonly project: ProjectRecord; readonly summary: ProjectSummary }) {
  const { t } = useTranslation();
  const usesTable = project.projectType === 'text' || project.projectType === 'tabular';
  const hasData = usesTable ? summary.hasTable : summary.itemCount > 0;
  if (!hasData) return <p className="text-sm text-warning">{t('studio.summary.noData')}</p>;
  return (
    <>
      <p className="text-sm">
        {usesTable
          ? t('studio.summary.table')
          : `${t('studio.summary.classes', { count: summary.classCount })} · ${t(`studio.summary.items.${project.projectType}`, { count: summary.itemCount })}`}
      </p>
      {summary.runCount > 0 && <p className="text-xs font-medium text-accent">{t('studio.summary.runs', { count: summary.runCount })}</p>}
    </>
  );
}

function Preview({ project, thumbnails }: { readonly project: ProjectRecord; readonly thumbnails: readonly StoredImage[] }) {
  if (thumbnails.length === 0) {
    return (
      <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-md border border-rule bg-paper text-primary">
        <ProjectTypeIcon type={project.projectType} />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="grid size-16 shrink-0 grid-cols-2 grid-rows-2 gap-px overflow-hidden rounded-md border border-rule bg-rule">
      {thumbnails.map((image, i) => (
        <Thumb key={i} image={image} single={thumbnails.length === 1} />
      ))}
    </span>
  );
}

function Thumb({ image, single }: { readonly image: StoredImage; readonly single: boolean }) {
  const url = useObjectUrl(image);
  return <img data-testid="project-thumb" src={url} alt="" width={64} height={64} loading="lazy" className={`h-full w-full object-cover ${single ? 'col-span-2 row-span-2' : ''}`} />;
}
