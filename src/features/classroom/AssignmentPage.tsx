import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useAssignmentRepository } from '@/storage/repository-context';
import type { ProjectAssignment } from '@/storage/repositories/assignment-repository';
import { ASSIGNMENT_LIMITS } from '@/storage/schemas/assignment';
import { getErrorMessage } from '@/ui/error-message';
import { RubricTable } from './RubricTable';
import { SubmitPanel } from './SubmitPanel';
import { BackLink } from '@/ui/BackLink';

type Loaded = { readonly projectId: string; readonly linked: ProjectAssignment | null; readonly failed: boolean } | null;

/** Trang làm bài (#/studio/:projectId/bai-tap): đề bài, rubric, phiếu thí nghiệm, nộp bài. */
export function AssignmentPage() {
  const { t } = useTranslation();
  const { projectId = '' } = useParams();
  const assignments = useAssignmentRepository();
  const [loaded, setLoaded] = useState<Loaded>(null);
  const [hasUnsavedAnswers, setHasUnsavedAnswers] = useState(false);

  useEffect(() => {
    let isActive = true;
    assignments.get(projectId).then(
      (linked) => isActive && setLoaded({ projectId, linked, failed: false }),
      (error: unknown) => {
        console.error('Không đọc được bài tập', error);
        if (isActive) setLoaded({ projectId, linked: null, failed: true });
      },
    );
    return () => {
      isActive = false;
    };
  }, [assignments, projectId]);

  if (!loaded || loaded.projectId !== projectId) return <p role="status" className="text-muted">{t('classroom.assignment.loading')}</p>;
  if (!loaded.linked) {
    return (
      <p role="alert" className="rounded border border-danger p-3 text-danger">
        {t(loaded.failed ? 'project.loadError' : 'classroom.assignment.notLinked')}
      </p>
    );
  }
  const { assignment } = loaded.linked;
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <BackLink to={`/studio/${projectId}`}>{t('classroom.assignment.back')}</BackLink>
        <p className="font-mono text-xs uppercase text-accent">{t('classroom.assignment.eyebrow')}</p>
        <h1 className="font-display text-4xl font-bold">{assignment.title}</h1>
        {assignment.teacher && <p className="text-muted">{t('classroom.banner.by', { teacher: assignment.teacher })}</p>}
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <section aria-labelledby="assignment-instructions" className="lab-card space-y-2 p-5">
          <h2 id="assignment-instructions" className="text-xl font-semibold">{t('classroom.assignment.instructions')}</h2>
          <p className="whitespace-pre-wrap">{assignment.instructions || t('classroom.assignment.noInstructions')}</p>
        </section>
        <section aria-labelledby="assignment-rubric" className="lab-card space-y-2 p-5">
          <h2 id="assignment-rubric" className="text-xl font-semibold">{t('classroom.assignment.rubric')}</h2>
          <RubricTable rubric={assignment.rubric} />
        </section>
      </div>
      <AnswersForm key={projectId} linked={loaded.linked} onDirtyChange={setHasUnsavedAnswers} onSaved={(linked) => setLoaded({ projectId, linked, failed: false })} />
      <SubmitPanel projectId={projectId} answersVersion={loaded.linked.updatedAt} hasUnsavedAnswers={hasUnsavedAnswers} />
    </div>
  );
}

interface AnswersFormProps {
  readonly linked: ProjectAssignment;
  readonly onSaved: (linked: ProjectAssignment) => void;
  readonly onDirtyChange: (isDirty: boolean) => void;
}

type SaveStatus = { readonly kind: 'idle' | 'busy' | 'saved' } | { readonly kind: 'error'; readonly message: string };

function AnswersForm({ linked, onSaved, onDirtyChange }: AnswersFormProps) {
  const { t } = useTranslation();
  const assignments = useAssignmentRepository();
  const [draft, setDraft] = useState<string[]>([...linked.answers]);
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const { questions } = linked.assignment;
  const isDirty = draft.some((a, i) => a !== linked.answers[i]);
  const isSaving = status.kind === 'busy';

  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus({ kind: 'busy' });
    try {
      const saved = await assignments.saveAnswers(linked.projectId, draft);
      setDraft([...saved.answers]);
      onSaved(saved);
      setStatus({ kind: 'saved' });
    } catch (err: unknown) {
      setStatus({ kind: 'error', message: t('classroom.assignment.saveError', { message: getErrorMessage(err) }) });
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} aria-labelledby="assignment-questions" className="lab-card space-y-4 p-5">
      <h2 id="assignment-questions" className="text-xl font-semibold">{t('classroom.assignment.questions')}</h2>
      {questions.length === 0 && <p className="text-muted">{t('classroom.assignment.noQuestions')}</p>}
      <div className="space-y-4">
        {questions.map((question, i) => (
          <div key={i}>
            <label htmlFor={`answer-${i}`} className="mb-1 block font-medium">{`${i + 1}. ${question}`}</label>
            <textarea
              id={`answer-${i}`}
              value={draft[i] ?? ''}
              // Chỉ đọc khi đang lưu: chữ gõ thêm không bị bản vừa lưu ghi đè, mà con trỏ vẫn ở nguyên ô.
              readOnly={isSaving}
              maxLength={ASSIGNMENT_LIMITS.answer}
              rows={3}
              onChange={(e) => {
                const value = e.target.value;
                setDraft((current) => current.map((a, j) => (j === i ? value : a)));
                setStatus({ kind: 'idle' });
              }}
              className="w-full rounded border border-rule bg-paper p-2"
            />
          </div>
        ))}
      </div>
      {questions.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={!isDirty || isSaving}>
            {isSaving ? t('classroom.assignment.savingAnswers') : t('classroom.assignment.saveAnswers')}
          </button>
          {isDirty && <span className="text-sm text-warning">{t('classroom.assignment.unsaved')}</span>}
        </div>
      )}
      <p role="status" className="text-sm text-accent empty:hidden">{status.kind === 'saved' ? t('classroom.assignment.savedAnswers') : ''}</p>
      <p role="alert" className="text-sm text-danger empty:hidden">{status.kind === 'error' ? status.message : ''}</p>
    </form>
  );
}
