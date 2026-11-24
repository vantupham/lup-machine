import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { GradingPanel } from '@/features/grading/GradingPanel';
import { CreateAssignmentForm } from './CreateAssignmentForm';

const TABS = ['tao-bai', 'cham-bai'] as const;
type Tab = (typeof TABS)[number];

/** Góc giáo viên (#/giao-vien): tạo gói bài tập và chấm bài nộp. Tab đang mở nằm trên URL (?tab=cham-bai). */
export function TeacherPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'cham-bai' ? 'cham-bai' : 'tao-bai';
  const labels: Record<Tab, string> = { 'tao-bai': t('grading.tabs.create'), 'cham-bai': t('grading.tabs.grade') };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-4xl font-bold">{t('classroom.teacher.title')}</h1>
        <p className="mt-2 max-w-3xl text-muted">{t('classroom.teacher.lead')}</p>
      </header>
      <div role="tablist" aria-label={t('grading.tabs.label')} className="flex gap-2 border-b border-rule">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`teacher-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`teacher-panel-${id}`}
            onClick={() => setParams(id === 'tao-bai' ? {} : { tab: id })}
            className={`-mb-px border-b-2 px-4 py-2 font-medium ${tab === id ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink'}`}
          >
            {labels[id]}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`teacher-panel-${tab}`} aria-labelledby={`teacher-tab-${tab}`}>
        {tab === 'tao-bai' ? (
          <div className="max-w-4xl">
            <CreateAssignmentForm />
          </div>
        ) : (
          <GradingPanel />
        )}
      </div>
    </div>
  );
}
