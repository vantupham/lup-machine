import { useTranslation } from 'react-i18next';
import { CreateAssignmentForm } from './CreateAssignmentForm';

/** Góc giáo viên (#/giao-vien): tạo gói bài tập; chấm bài nộp ở bước sau. */
export function TeacherPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-4xl font-bold">{t('classroom.teacher.title')}</h1>
        <p className="mt-2 max-w-3xl text-muted">{t('classroom.teacher.lead')}</p>
      </header>
      <div className="max-w-4xl">
        <CreateAssignmentForm />
      </div>
    </div>
  );
}
