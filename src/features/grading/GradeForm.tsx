import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSubmissionRepository } from '@/storage/repository-context';
import type { StoredSubmission } from '@/storage/repositories/submission-repository';
import { rubricTotal } from '@/storage/schemas/assignment';
import { GRADE_COMMENT_MAX_LENGTH, gradeTotal, roundScore } from '@/storage/schemas/grade';
import { getErrorMessage } from '@/ui/error-message';

interface GradeFormProps {
  readonly submission: StoredSubmission;
  readonly onSaved: (updated: StoredSubmission) => void;
}

type Status = { readonly kind: 'idle' | 'busy' | 'saved' } | { readonly kind: 'error'; readonly message: string };

const SCORE_PATTERN = /^\d+([.,]\d+)?$/;

/** Ô trống = chưa chấm; ô gõ sai (chữ, vượt điểm tối đa) = 'invalid'; điểm hợp lệ làm tròn tới 0,25. */
export function parseScore(raw: string, max: number): number | null | 'invalid' {
  const text = raw.trim();
  if (text === '') return null;
  if (!SCORE_PATTERN.test(text)) return 'invalid';
  const value = roundScore(Number(text.replace(',', '.')));
  return value <= max ? value : 'invalid';
}

/** Điểm hiển thị theo ngôn ngữ giao diện: tiếng Việt dùng dấu phẩy thập phân (9,5). */
export function formatScore(value: number, language: string): string {
  return value.toLocaleString(language, { maximumFractionDigits: 2 });
}

export function GradeForm({ submission, onSaved }: GradeFormProps) {
  const { t, i18n } = useTranslation();
  const toText = (s: number | null) => (s === null ? '' : formatScore(s, i18n.language));
  const repo = useSubmissionRepository();
  const { rubric } = submission.submission.assignment;
  const [scores, setScores] = useState<string[]>(submission.grade.scores.map(toText));
  const [comment, setComment] = useState(submission.grade.comment);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const parsed = scores.map((raw, i) => parseScore(raw, rubric[i]?.maxPoints ?? 0));
  const hasInvalid = parsed.includes('invalid');
  const valid = parsed.map((s) => (s === 'invalid' ? null : s));
  const total = hasInvalid ? null : gradeTotal({ scores: valid, comment });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus({ kind: 'busy' });
    try {
      const updated = await repo.saveGrade(submission.id, { scores: valid, comment });
      setScores(updated.grade.scores.map(toText));
      onSaved(updated);
      setStatus({ kind: 'saved' });
    } catch (err: unknown) {
      setStatus({ kind: 'error', message: t('grading.detail.saveError', { message: getErrorMessage(err) }) });
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} aria-labelledby="grade-title" className="space-y-3">
      <h3 id="grade-title" className="font-semibold">{t('grading.detail.gradeTitle')}</h3>
      {rubric.map((c, i) => (
        <div key={i} className="grid grid-cols-[1fr_6rem] items-start gap-2">
          <label htmlFor={`score-${i}`} className="text-sm">
            {t('grading.detail.scoreLabel', { criterion: c.criterion, max: c.maxPoints })}
            {c.description && <span className="block text-xs text-muted">{c.description}</span>}
          </label>
          <input
            id={`score-${i}`}
            // Ô chữ thay vì ô số: nhận cả "3,5" lẫn "3.5" (ô số của trình duyệt có thể từ chối dấu phẩy).
            type="text"
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={parsed[i] === 'invalid'}
            aria-describedby={parsed[i] === 'invalid' ? `score-${i}-error` : undefined}
            value={scores[i] ?? ''}
            onChange={(e) => {
              const value = e.target.value;
              setScores((current) => current.map((s, j) => (j === i ? value : s)));
              setStatus({ kind: 'idle' });
            }}
            className={`rounded border bg-paper px-2 py-1 text-right font-mono ${parsed[i] === 'invalid' ? 'border-danger' : 'border-rule'}`}
          />
          {parsed[i] === 'invalid' && (
            <p id={`score-${i}-error`} className="col-span-2 text-right text-xs text-danger">
              {t('grading.detail.invalidScore', { max: c.maxPoints })}
            </p>
          )}
        </div>
      ))}
      <p className="text-right font-mono font-semibold" data-testid="grade-total">
        {t('grading.table.total')}: {total === null ? '–' : formatScore(total, i18n.language)}/{rubricTotal(rubric)}
      </p>
      <div>
        <label htmlFor="grade-comment" className="mb-1 block text-sm font-medium">{t('grading.detail.comment')}</label>
        <textarea
          id="grade-comment"
          value={comment}
          maxLength={GRADE_COMMENT_MAX_LENGTH}
          rows={3}
          onChange={(e) => {
            setComment(e.target.value);
            setStatus({ kind: 'idle' });
          }}
          className="w-full rounded border border-rule bg-paper p-2 text-sm"
        />
      </div>
      <button type="submit" className="btn btn-primary" disabled={status.kind === 'busy' || hasInvalid}>
        {status.kind === 'busy' ? t('grading.detail.saving') : t('grading.detail.save')}
      </button>
      <p role="status" className="text-sm text-accent empty:hidden">{status.kind === 'saved' ? t('grading.detail.saved') : ''}</p>
      <p role="alert" className="text-sm text-danger empty:hidden">{status.kind === 'error' ? status.message : ''}</p>
    </form>
  );
}
