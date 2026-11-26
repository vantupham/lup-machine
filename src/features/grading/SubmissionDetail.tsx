import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { ProjectRecord } from '@/storage/db';
import { useProjectFileRepository, useSubmissionRepository } from '@/storage/repository-context';
import type { StoredSubmission } from '@/storage/repositories/submission-repository';
import { MODEL_CARD_TEXT_FIELDS } from '@/storage/schemas/model-card';
import { PROJECT_NAME_MAX_LENGTH } from '@/storage/schemas/manifest';
import { getErrorMessage } from '@/ui/error-message';
import { FactsPanel } from '@/features/model-card/FactsPanel';
import { GradeForm } from './GradeForm';
import { SubmissionInquiry } from './SubmissionInquiry';
import { ArrowRight } from '@/ui/icons';

interface SubmissionDetailProps {
  readonly submission: StoredSubmission;
  readonly onSaved: (updated: StoredSubmission) => void;
  readonly onDelete: (submission: StoredSubmission) => Promise<void>;
  readonly onClose: () => void;
}

/** Chi tiết một bài nộp: câu trả lời, thẻ mô hình, số liệu, ô chấm điểm theo rubric. */
export function SubmissionDetail({ submission, onSaved, onDelete, onClose }: SubmissionDetailProps) {
  const { t, i18n } = useTranslation();
  const { assignment, submitter, answers, summary } = submission.submission;
  const card = submission.modelCard;

  return (
    <section aria-labelledby="submission-detail-title" className="lab-card space-y-5 p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="mr-auto">
          <h2 id="submission-detail-title" className="text-xl font-semibold">{t('grading.detail.title', { students: submitter.students })}</h2>
          <p className="text-xs text-muted">
            {t('grading.detail.meta', { className: submitter.className || '–', date: new Date(submission.submission.submittedAt).toLocaleString(i18n.language), file: submission.fileName })}
          </p>
          <p className="text-xs text-muted">{submission.submission.includesData ? t('grading.detail.withData') : t('grading.detail.withoutData')}</p>
        </div>
        <button type="button" onClick={onClose} className="btn btn-ghost px-3 py-1 text-sm">{t('grading.detail.close')}</button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {assignment.questions.length > 0 && (
            <div>
              <h3 className="mb-2 font-semibold">{t('grading.detail.answers')}</h3>
              <dl className="space-y-2 text-sm">
                {assignment.questions.map((q, i) => (
                  <div key={i}>
                    <dt className="font-medium">{`${i + 1}. ${q}`}</dt>
                    <dd className="whitespace-pre-wrap">{answers[i] || t('grading.detail.noAnswer')}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          <div>
            <h3 className="mb-2 font-semibold">{t('grading.detail.modelCard')}</h3>
            {card ? (
              <dl className="space-y-2 text-sm">
                {MODEL_CARD_TEXT_FIELDS.map((field) => (
                  <div key={field}>
                    <dt className="font-medium">{t(`modelCard.fields.${field}.label`)}</dt>
                    <dd className="whitespace-pre-wrap">{card[field] || t('grading.detail.noAnswer')}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-muted">{t('grading.detail.noModelCard')}</p>
            )}
          </div>
          <FactsPanel facts={summary} />
          <SubmissionInquiry submissionId={submission.id} projectType={summary.projectType} />
        </div>
        <div className="space-y-5">
          <GradeForm key={submission.id} submission={submission} onSaved={onSaved} />
          <OpenProjectButton submission={submission} />
          <button type="button" onClick={() => void onDelete(submission)} className="btn btn-ghost text-sm text-danger">
            {t('grading.detail.delete')}
          </button>
        </div>
      </div>
    </section>
  );
}

/** Chép dự án của học sinh thành một dự án trong trang Mô hình của giáo viên để xem kỹ. */
function OpenProjectButton({ submission }: { readonly submission: StoredSubmission }) {
  const { t } = useTranslation();
  const projectFiles = useProjectFileRepository();
  const submissions = useSubmissionRepository();
  const [opened, setOpened] = useState<ProjectRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = async () => {
    setError(null);
    try {
      const name = `${submission.submission.submitter.students} – ${submission.submission.assignment.title}`.slice(0, PROJECT_NAME_MAX_LENGTH);
      const bundle = await submissions.getProject(submission.id);
      if (!bundle) throw new Error('Không tìm thấy dự án của bài nộp này');
      const project = await projectFiles.writeBundle({ ...bundle, manifest: { ...bundle.manifest, name } });
      setOpened(project);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-1">
      <button type="button" onClick={() => void handleOpen()} className="btn btn-ghost text-sm">{t('grading.detail.openProject')}</button>
      {opened && (
        <p role="status" className="text-sm">
          {t('grading.detail.openedProject', { name: opened.name })}{' '}
          <Link to={`/studio/${opened.id}`} className="inline-flex items-center gap-1 text-primary underline">{t('grading.detail.openProjectLink')}<ArrowRight /></Link>
        </p>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
