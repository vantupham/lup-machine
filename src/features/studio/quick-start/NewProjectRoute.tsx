import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getErrorMessage } from '@/ui/error-message';
import { ProjectTypeCards } from './ProjectTypeCards';
import { projectTypeFromSlug } from './quick-start';
import { useCreateProject } from './useCreateProject';
import { ArrowLeft } from '@/ui/icons';

/**
 * #/studio/moi/:loai — giáo viên dán đường dẫn này (hoặc in mã QR), học sinh mở ra là có dự án mới.
 * Dùng `replace` để nút Quay lại không tạo thêm dự án thứ hai.
 */
export function NewProjectRoute() {
  const { typeSlug = '' } = useParams();
  // Đổi :loai trên cùng trang thì react-router giữ nguyên component; key buộc làm lại từ đầu.
  return <CreateFromSlug key={typeSlug} typeSlug={typeSlug} />;
}

function CreateFromSlug({ typeSlug }: { readonly typeSlug: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const projectType = projectTypeFromSlug(typeSlug);
  const [error, setError] = useState<string | null>(null);
  /** StrictMode chạy effect hai lần; ref giữ nguyên qua hai lần đó nên chỉ tạo một dự án. */
  const started = useRef(false);

  useEffect(() => {
    if (!projectType || started.current) return;
    started.current = true;
    createProject(projectType).then(
      (project) => navigate(`/studio/${project.id}`, { replace: true }),
      (err: unknown) => {
        console.error('Không tạo được dự án từ đường dẫn', err);
        setError(t('quickStart.error', { message: getErrorMessage(err) }));
      },
    );
  }, [projectType, createProject, navigate, t]);

  if (!projectType) {
    return (
      <div className="space-y-6">
        <p role="alert" className="rounded border border-warning p-3 text-warning">
          {t('quickStart.badType', { slug: typeSlug })}
        </p>
        <ProjectTypeCards />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p role="alert" className="rounded border border-danger p-3 text-danger">{error}</p>
        <Link to="/studio" className="btn btn-ghost">
          <ArrowLeft /> {t('quickStart.backToStudio')}
        </Link>
      </div>
    );
  }

  return <p role="status" className="text-muted">{t('quickStart.creatingFromLink')}</p>;
}
