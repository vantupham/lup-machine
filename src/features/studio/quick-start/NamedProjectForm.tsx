import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { ProjectType } from '@/storage/schemas/project';
import { getErrorMessage } from '@/ui/error-message';
import { ProjectTypeIcon } from './ProjectTypeIcon';
import { QUICK_START_TYPES } from './quick-start';
import { useCreateProject } from './useCreateProject';
import { ArrowRight } from '@/ui/icons';

/**
 * Tạo dự án kèm tên riêng (ví dụ để nộp bài). Để trống tên thì tự đặt, giống các thẻ một chạm.
 * Mỗi loại dữ liệu là một ô có biểu tượng; nút radio gốc vẫn hiện (đã mang màu chủ đạo qua accent-color),
 * nên ô đang chọn được nhận ra cả bằng chấm radio, không chỉ bằng màu.
 */
export function NamedProjectForm() {
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
    <form
      onSubmit={(e) => void handleSubmit(e)}
      aria-labelledby="named-project-title"
      noValidate
      className="lab-card relative overflow-hidden p-5 pl-6 sm:p-6 sm:pl-8"
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-primary" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-10">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">{t('studio.namedEyebrow')}</p>
          <h2 id="named-project-title" className="mt-1 font-display text-2xl font-bold">{t('studio.namedTitle')}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t('studio.namedLead')}</p>
        </div>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="project-name" className="block text-sm font-semibold">
              {t('studio.nameLabel')}
            </label>
            <input
              id="project-name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('studio.namePlaceholder')}
              maxLength={100}
              autoComplete="off"
              enterKeyHint="go"
              aria-describedby="project-name-hint"
              className="min-h-12 w-full rounded-md border border-rule bg-paper px-3 text-base"
            />
            <p id="project-name-hint" className="text-xs text-muted">{t('studio.nameHint')}</p>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold">{t('studio.typeLabel')}</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {QUICK_START_TYPES.map((type) => (
                <label
                  key={type}
                  className="relative flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-rule bg-paper px-2 py-3 text-sm font-medium transition-colors hover:border-primary/60 has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:font-semibold has-[:checked]:text-primary has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary"
                >
                  <input
                    type="radio"
                    name="project-type"
                    value={type}
                    checked={projectType === type}
                    onChange={() => setProjectType(type)}
                    className="absolute top-2 left-2 size-4 focus-visible:outline-none"
                  />
                  <ProjectTypeIcon type={type} />
                  <span>{t(`studio.types.${type}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="btn btn-primary min-h-12 px-6 text-base" disabled={isSaving}>
              {isSaving ? t('studio.creating') : t('studio.create')}
              {!isSaving && <ArrowRight />}
            </button>
            <p className="text-xs text-muted">{t('studio.namedFooter')}</p>
          </div>
        </div>
      </div>
    </form>
  );
}
