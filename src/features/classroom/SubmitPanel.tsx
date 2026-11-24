import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useRepositories } from '@/storage/repository-context';
import { ASSIGNMENT_LIMITS } from '@/storage/schemas/assignment';
import { downloadBytes } from '@/ui/download';
import { getErrorMessage } from '@/ui/error-message';
import { createSubmissionFile, storedBlockers, submitterBlockers, SubmissionBlockedError, type SubmissionBlocker } from './classroom-files';

interface SubmitPanelProps {
  readonly projectId: string;
  /** Đổi mỗi khi câu trả lời được lưu, để tính lại điều kiện nộp bài. */
  readonly answersVersion: string;
  /** Học sinh đã sửa câu trả lời nhưng chưa bấm Lưu: bài nộp sẽ thiếu những sửa đổi đó. */
  readonly hasUnsavedAnswers: boolean;
}

type StoredCheck = { readonly blockers: readonly SubmissionBlocker[] } | { readonly error: true } | null;
type Status = { readonly kind: 'idle' | 'busy' } | { readonly kind: 'done'; readonly file: string } | { readonly kind: 'error'; readonly message: string };

/** Nộp bài: kiểm tra điều kiện, chọn kèm / không kèm dữ liệu gốc, tải tệp .lups. */
export function SubmitPanel({ projectId, answersVersion, hasUnsavedAnswers }: SubmitPanelProps) {
  const { t } = useTranslation();
  const repos = useRepositories();
  const [students, setStudents] = useState('');
  const [className, setClassName] = useState('');
  const [includeData, setIncludeData] = useState(false);
  const [stored, setStored] = useState<StoredCheck>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  // Chỉ đọc cơ sở dữ liệu khi câu trả lời được lưu hoặc đổi dự án (không đọc theo từng phím gõ).
  useEffect(() => {
    let isActive = true;
    storedBlockers(repos, projectId).then(
      (blockers) => isActive && setStored({ blockers }),
      (error: unknown) => {
        console.error('Không kiểm tra được điều kiện nộp bài', error);
        if (isActive) setStored({ error: true });
      },
    );
    return () => {
      isActive = false;
    };
  }, [repos, projectId, answersVersion]);

  const unsaved: readonly SubmissionBlocker[] = hasUnsavedAnswers ? ['unsaved-answers'] : [];
  const blockers: readonly SubmissionBlocker[] | null =
    stored === null || 'error' in stored ? null : [...submitterBlockers({ students, className }), ...stored.blockers, ...unsaved];

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus({ kind: 'busy' });
    try {
      const file = await createSubmissionFile(repos, projectId, { students, className }, includeData);
      downloadBytes(file.fileName, file.bytes);
      setStatus({ kind: 'done', file: file.fileName });
    } catch (err: unknown) {
      if (err instanceof SubmissionBlockedError) setStored({ blockers: err.blockers });
      setStatus({ kind: 'error', message: t('classroom.assignment.submitError', { message: getErrorMessage(err) }) });
    }
  };

  const isReady = blockers !== null && blockers.length === 0;

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate aria-labelledby="submit-title" className="lab-card space-y-4 p-5">
      <h2 id="submit-title" className="text-xl font-semibold">{t('classroom.assignment.submitTitle')}</h2>
      <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <div>
          <label htmlFor="submit-students" className="mb-1 block font-medium">{t('classroom.assignment.studentsLabel')}</label>
          <input id="submit-students" value={students} maxLength={ASSIGNMENT_LIMITS.students} placeholder={t('classroom.assignment.studentsPlaceholder')} onChange={(e) => setStudents(e.target.value)} className="w-full rounded border border-rule bg-paper px-3 py-2" />
        </div>
        <div>
          <label htmlFor="submit-class" className="mb-1 block font-medium">{t('classroom.assignment.classLabel')}</label>
          <input id="submit-class" value={className} maxLength={ASSIGNMENT_LIMITS.className} onChange={(e) => setClassName(e.target.value)} className="w-full rounded border border-rule bg-paper px-3 py-2" />
        </div>
      </div>
      <div>
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={includeData} onChange={(e) => setIncludeData(e.target.checked)} className="mt-1" aria-describedby="include-data-hint" />
          <span className="font-medium">{t('classroom.assignment.includeData')}</span>
        </label>
        <p id="include-data-hint" className="ml-6 text-xs text-muted">{t('classroom.assignment.includeDataHint')}</p>
      </div>
      <div aria-live="polite" data-testid="submit-checklist" className="rounded border border-rule p-3 text-sm">
        <p className="font-semibold">{t('classroom.assignment.checklist')}</p>
        {isReady && <p className="text-accent">✓ {t('classroom.assignment.ready')}</p>}
        {stored !== null && 'error' in stored && <p className="text-danger">{t('classroom.assignment.checkError')}</p>}
        {blockers && blockers.length > 0 && (
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {blockers.map((b) => (
              <li key={b}>
                {t(`classroom.assignment.blockers.${b}`)}{' '}
                {b === 'model-card' && <Link to={`/studio/${projectId}/the-mo-hinh`} className="text-primary underline">{t('classroom.assignment.openModelCard')}</Link>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <button type="submit" className="btn btn-primary" disabled={!isReady || status.kind === 'busy'}>
        {status.kind === 'busy' ? t('classroom.assignment.submitting') : t('classroom.assignment.download')}
      </button>
      <p role="status" className="text-sm text-accent empty:hidden">{status.kind === 'done' ? t('classroom.assignment.submitted', { file: status.file }) : ''}</p>
      <p role="alert" className="text-sm text-danger empty:hidden">{status.kind === 'error' ? status.message : ''}</p>
    </form>
  );
}
