import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { findLesson, type Lesson } from '@/content/lessons';
import { datasetClassKeys } from '@/core/datasets/catalog';
import { RecordBlock, WriteLines } from './WorksheetRecords';
import { CornerDownRight, Info, Lightbulb, Printer, Square, SquareCheck } from '@/ui/icons';
import { BackLink } from '@/ui/BackLink';

const PREDICT_LINES = 2;
const OBSERVE_LINES = 2;
const REFLECT_LINES = 3;

/** Phiếu bài tập in được, sinh từ nội dung bài học: bản học sinh (để trống) và bản giáo viên (có đáp án). */
export function WorksheetPage() {
  const { lessonId = '' } = useParams();
  const { t } = useTranslation();
  const [isTeacher, setIsTeacher] = useState(false);
  const lesson = findLesson(lessonId);

  if (!lesson) {
    return (
      <div className="space-y-4">
        <BackLink to="/lessons">{t('lessons.back')}</BackLink>
        <p role="alert">{t('lessons.notFound')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <BackLink to={`/lessons/${lesson.id}`}>{lesson.title}</BackLink>
        <span className="flex-1" />
        <span className="inline-flex overflow-hidden rounded border border-rule text-sm" role="group" aria-label={t('worksheet.version')}>
          <button type="button" aria-pressed={!isTeacher} onClick={() => setIsTeacher(false)} className={`px-3 py-1 ${!isTeacher ? 'bg-ink text-paper' : ''}`}>
            {t('worksheet.student')}
          </button>
          <button type="button" aria-pressed={isTeacher} onClick={() => setIsTeacher(true)} className={`px-3 py-1 ${isTeacher ? 'bg-ink text-paper' : ''}`}>
            {t('worksheet.teacher')}
          </button>
        </span>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          <Printer /> {t('worksheet.print')}
        </button>
      </div>
      <p className="text-xs text-muted print:hidden"><Info /> {t('worksheet.hint')}</p>
      <Sheet lesson={lesson} isTeacher={isTeacher} />
    </div>
  );
}

function hasSampleData(lesson: Lesson): boolean {
  return lesson.steps.some((s) => s.record?.some((r) => ('answers' in r && r.answers) || ('answer' in r && r.answer)));
}

function Sheet({ lesson, isTeacher }: { readonly lesson: Lesson; readonly isTeacher: boolean }) {
  const { t } = useTranslation();
  const classNames = datasetClassKeys(lesson.dataset).map((k) => t(`samples.classes.${k}`));
  const label = isTeacher ? t('worksheet.keyTitle') : t('worksheet.title');

  return (
    <article aria-label={`${label}: ${lesson.title}`} lang="vi" className="worksheet space-y-6 bg-surface p-6 shadow-card print:bg-transparent print:p-0 print:shadow-none">
      <header className="space-y-2 border-b-2 border-ink pb-3">
        <p className="font-mono text-xs uppercase tracking-widest">
          {label} · {t('lessons.grade', { grade: lesson.grade })} · {t('lessons.minutes', { minutes: lesson.minutes })}
        </p>
        <h1 className="font-display text-3xl font-bold">{lesson.title}</h1>
        {!isTeacher && (
          <div className="grid grid-cols-[2fr_1fr_1fr] gap-4 pt-2 text-sm">
            {[t('worksheet.name'), t('worksheet.class'), t('worksheet.date')].map((f) => (
              <p key={f} className="flex items-end gap-2">
                <span>{f}</span>
                <span aria-hidden="true" className="h-6 flex-1 border-b border-dotted border-ink/60" />
              </p>
            ))}
          </div>
        )}
        {isTeacher && hasSampleData(lesson) && (
          <p className="text-xs italic" data-testid="sample-data-note">
            {t('worksheet.sampleNote')}
          </p>
        )}
      </header>

      <section className="break-inside-avoid text-sm">
        <h2 className="font-semibold">{t('lessons.goals')}</h2>
        <ul className="list-disc pl-5">{lesson.goals.map((g) => <li key={g}>{g}</li>)}</ul>
      </section>

      <ol className="space-y-5">
        {lesson.steps.map((step, i) => (
          <li key={step.title} className="space-y-3 break-inside-avoid">
            <h2 className="font-semibold">
              <span aria-hidden="true" className="mr-2 inline-block h-4 w-4 translate-y-0.5 border border-ink" />
              {t('worksheet.step', { n: i + 1 })} {step.title}
            </h2>
            {step.predict && (
              <div className="rounded border border-ink/40 p-3 text-sm">
                <p className="font-medium">
                  <Lightbulb className="mr-1" />
                  <span>{step.predict.question}</span>
                </p>
                {isTeacher ? (
                  <p className="mt-2 leading-relaxed">{step.predict.answer}</p>
                ) : (
                  <>
                    <p className="mt-2 text-xs text-muted">{t('worksheet.myPrediction')}</p>
                    <WriteLines count={PREDICT_LINES} />
                    <p className="mt-2 text-xs text-muted">{t('worksheet.observed')}</p>
                    <WriteLines count={OBSERVE_LINES} />
                  </>
                )}
              </div>
            )}
            {step.record?.map((r) => <RecordBlock key={r.title} record={r} classNames={classNames} showAnswers={isTeacher} />)}
          </li>
        ))}
      </ol>

      <section className="space-y-3 break-inside-avoid">
        <h2 className="font-semibold">{t('lessons.quiz')}</h2>
        <ol className="list-decimal space-y-3 pl-5 text-sm">
          {lesson.quiz.map((q) => (
            <li key={q.question} className="break-inside-avoid">
              <p>{q.question}</p>
              <ul className="mt-1 space-y-0.5">
                {q.options.map((o, j) => (
                  <li key={o} data-correct={isTeacher && j === q.correct ? 'true' : undefined} className={isTeacher && j === q.correct ? 'font-semibold' : ''}>
                    {isTeacher && j === q.correct ? <SquareCheck className="mr-1" /> : <Square className="mr-1" />}
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
              {isTeacher && (
                <p className="mt-1 text-muted">
                  <CornerDownRight className="mr-1" />
                  <span>{q.explanation}</span>
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>

      {isTeacher ? (
        <section className="space-y-2 break-inside-avoid text-sm">
          <h2 className="font-semibold">{t('lessons.wrapUp')}</h2>
          <p>{lesson.wrapUp}</p>
          <h2 className="pt-2 font-semibold">{t('lessons.teacherNotes')}</h2>
          <ul className="list-disc pl-5">{lesson.teacherNotes.map((n) => <li key={n}>{n}</li>)}</ul>
        </section>
      ) : (
        <section className="break-inside-avoid text-sm">
          <h2 className="font-semibold">{t('worksheet.reflect')}</h2>
          <WriteLines count={REFLECT_LINES} />
        </section>
      )}

      <footer className="border-t border-ink/40 pt-2 text-xs text-muted">{t('worksheet.footer')}</footer>
    </article>
  );
}
