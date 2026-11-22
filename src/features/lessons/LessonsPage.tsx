import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LESSONS } from '@/content/lessons';

export function LessonsPage() {
  const { t, i18n } = useTranslation();
  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-4xl font-bold">{t('lessons.title')}</h1>
        <p className="mt-2 max-w-2xl text-muted">{t('lessons.lead')}</p>
        {i18n.language !== 'vi' && <p className="mt-2 text-sm text-warning">{t('lessons.onlyVietnamese')}</p>}
      </header>
      <ol className="grid gap-4 md:grid-cols-3">
        {LESSONS.map((lesson, i) => (
          <li key={lesson.id} className="lab-card lab-card-interactive flex flex-col gap-2 p-5">
            <span className="font-mono text-xs text-primary">{String(i + 1).padStart(2, '0')}</span>
            <h2 className="font-display text-xl font-bold" lang="vi">{lesson.title}</h2>
            <p className="text-sm text-muted" lang="vi">{lesson.summary}</p>
            <p className="font-mono text-xs">
              {t('lessons.grade', { grade: lesson.grade })} · {t('lessons.minutes', { minutes: lesson.minutes })}
            </p>
            <Link to={`/lessons/${lesson.id}`} className="btn btn-primary mt-auto self-start text-sm" aria-label={`${t('lessons.open')}: ${lesson.title}`}>
              {t('lessons.open')} →
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
