import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProjectTypeCards } from './ProjectTypeCards';

/** Tạo dự án ở trang Mô hình: gõ tên nếu muốn, rồi bấm một loại dữ liệu là tạo ngay. */
export function CreateProjectPanel() {
  const { t } = useTranslation();
  const [name, setName] = useState('');

  return (
    <section aria-labelledby="new-project-title" className="space-y-4">
      <h2 id="new-project-title" className="font-display text-2xl font-bold">
        {t('studio.newProject')}
      </h2>
      <div className="max-w-md space-y-1.5">
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
          aria-describedby="project-name-hint"
          className="min-h-11 w-full rounded-md border border-rule bg-paper px-3 text-base"
        />
        <p id="project-name-hint" className="text-xs text-muted">
          {t('studio.nameHint')}
        </p>
      </div>
      <ProjectTypeCards name={name} />
    </section>
  );
}
