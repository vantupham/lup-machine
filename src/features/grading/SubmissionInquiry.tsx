import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Note } from '@/storage/schemas/notebook';
import type { ProjectType } from '@/storage/schemas/project';
import { useSubmissionRepository } from '@/storage/repository-context';
import { getErrorMessage } from '@/ui/error-message';
import type { RunSummary } from '@/features/studio/image/lab/run-setup';
import { InquiryRecord } from '@/features/notebook/InquiryRecord';

type State =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly notes: readonly Note[]; readonly runs: readonly RunSummary[] }
  | { readonly kind: 'error'; readonly message: string };

interface SubmissionInquiryProps {
  readonly submissionId: string;
  readonly projectType: ProjectType;
}

/** Sổ tay và các lần thí nghiệm trong bài nộp: bằng chứng để chấm 5 năng lực. */
export function SubmissionInquiry({ submissionId, projectType }: SubmissionInquiryProps) {
  const { t } = useTranslation();
  const submissions = useSubmissionRepository();
  const [state, setState] = useState<{ readonly id: string; readonly value: State } | null>(null);

  useEffect(() => {
    let isActive = true;
    submissions.getProject(submissionId).then(
      (bundle) => {
        if (isActive) setState({ id: submissionId, value: { kind: 'ready', notes: bundle?.notes ?? [], runs: bundle?.runs ?? [] } });
      },
      (error: unknown) => {
        console.error('Không đọc được dự án của bài nộp', submissionId, error);
        if (isActive) setState({ id: submissionId, value: { kind: 'error', message: getErrorMessage(error) } });
      },
    );
    return () => {
      isActive = false;
    };
  }, [submissions, submissionId]);

  const current: State = state?.id === submissionId ? state.value : { kind: 'loading' };
  return (
    <section aria-labelledby="submission-inquiry-title" className="space-y-2">
      <h3 id="submission-inquiry-title" className="font-semibold">{t('inquiry.title')}</h3>
      {current.kind === 'loading' && <p className="text-sm text-muted">…</p>}
      {current.kind === 'error' && <p role="alert" className="text-sm text-danger">{t('inquiry.loadError', { message: current.message })}</p>}
      {current.kind === 'ready' && <InquiryRecord projectType={projectType} notes={current.notes} runs={current.runs} />}
    </section>
  );
}
