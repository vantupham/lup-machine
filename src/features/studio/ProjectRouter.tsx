import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ProjectType } from '@/storage/schemas/project';
import { useProjectRepository } from '@/storage/repository-context';
import { ImageProjectPage } from './image/ImageProjectPage';
import { TabularProjectPage } from './tabular/TabularProjectPage';
import { TextProjectPage } from './text/TextProjectPage';

/** Mở đúng Studio theo loại dự án. Không tìm thấy dự án thì để trang Ảnh báo lỗi như trước. */
export function ProjectRouter() {
  const { t } = useTranslation();
  const { projectId = '' } = useParams();
  const projects = useProjectRepository();
  const [type, setType] = useState<{ id: string; type: ProjectType | null } | null>(null);

  useEffect(() => {
    let isActive = true;
    projects.findById(projectId).then(
      (project) => isActive && setType({ id: projectId, type: project?.projectType ?? null }),
      () => isActive && setType({ id: projectId, type: null }),
    );
    return () => {
      isActive = false;
    };
  }, [projects, projectId]);

  if (!type || type.id !== projectId) return <p className="text-muted">{t('tabular.loading')}</p>;
  if (type.type === 'tabular') return <TabularProjectPage key={projectId} projectId={projectId} />;
  if (type.type === 'text') return <TextProjectPage key={projectId} projectId={projectId} />;
  return <ImageProjectPage />;
}
