import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { findLesson } from '@/content/lessons';
import { useCreateSampleProject } from '@/features/samples/useCreateSampleProject';
import { Quiz } from './Quiz';

export function LessonPage() {
  const { lessonId = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const lesson = findLesson(lessonId);
  const { state, create } = useCreateSampleProject();

  if (!lesson) {
    return (
      <div className="space-y-4">
        <Link to="/lessons" className="text-sm text-primary hover:underline">{t('lessons.back')}</Link>
        <p role="alert">{t('lessons.notFound')}</p>
      </div>
    );
  }

  const openProject = async () => {
    const projectId = await create(lesson.dataset);
    if (projectId) navigate(`/studio/${projectId}`);
  };

  return (
    <article className="mx-auto max-w-3xl space-y-10" lang="vi">
      <header className="space-y-3">
        <Link to="/lessons" className="text-sm text-primary hover:underline">{t('lessons.back')}</Link>
        <h1 className="font-display text-4xl font-bold">{lesson.title}</h1>
        <p className="font-mono text-xs">
          {t('lessons.grade', { grade: lesson.grade })} · {t('lessons.minutes', { minutes: lesson.minutes })}
        </p>
        <p className="text-lg text-muted">{lesson.summary}</p>
        <Link to={`/lessons/${lesson.id}/phieu-bai-tap`} className="inline-block text-sm text-primary hover:underline">
          🖨 {t('worksheet.link')}
        </Link>
      </header>

      <section aria-labelledby="goals-title" className="lab-card p-5">
        <h2 id="goals-title" className="mb-2 text-xl font-semibold">{t('lessons.goals')}</h2>
        <ul className="list-disc space-y-1 pl-5">
          {lesson.goals.map((g) => <li key={g}>{g}</li>)}
        </ul>
        <button type="button" className="btn btn-primary mt-4" disabled={state.phase === 'rendering'} onClick={() => void openProject()}>
          {state.phase === 'rendering' ? t('samples.creating', { done: state.done, total: state.total }) : t('lessons.openProject')}
        </button>
        {state.phase === 'error' && <p role="alert" className="mt-2 text-sm text-danger">{t('samples.error', { message: state.message })}</p>}
      </section>

      <section aria-labelledby="steps-title" className="space-y-6">
        <h2 id="steps-title" className="text-2xl font-semibold">{t('lessons.steps')}</h2>
        <ol className="space-y-6">
          {lesson.steps.map((step, i) => (
            <li key={step.title} className="border-l-2 border-rule pl-5">
              <h3 className="font-semibold">
                <span className="mr-2 font-mono text-primary">{i + 1}.</span>
                {step.title}
              </h3>
              {step.body.map((p) => <p key={p} className="mt-2 leading-relaxed">{p}</p>)}
              {step.predict && (
                <details className="mt-3 rounded border border-warning/60 bg-highlight/20 p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    🤔 {t('lessons.predict')}: {step.predict.question} <span className="text-primary">({t('lessons.reveal')})</span>
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed">{step.predict.answer}</p>
                </details>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="quiz-title" className="lab-card p-5">
        <h2 id="quiz-title" className="mb-4 text-2xl font-semibold">{t('lessons.quiz')}</h2>
        <Quiz questions={lesson.quiz} />
      </section>

      <section aria-labelledby="wrap-title">
        <h2 id="wrap-title" className="mb-2 text-2xl font-semibold">{t('lessons.wrapUp')}</h2>
        <p className="leading-relaxed">{lesson.wrapUp}</p>
      </section>

      <details className="rounded border border-rule p-4 text-sm">
        <summary className="cursor-pointer font-medium">👩‍🏫 {t('lessons.teacherNotes')}</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {lesson.teacherNotes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      </details>
      <p className="text-xs text-muted">{t('lessons.license')}</p>
    </article>
  );
}
