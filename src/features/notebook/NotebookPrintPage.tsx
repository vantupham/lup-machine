import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ProjectRecord, RunRecord } from '@/storage/db';
import type { Note } from '@/storage/schemas/notebook';
import { useExperimentRepository, useNotebookRepository, useProjectRepository } from '@/storage/repository-context';
import { getErrorMessage } from '@/ui/error-message';
import { BackLink } from '@/ui/BackLink';
import { Info, Printer } from '@/ui/icons';
import { WriteLines } from '@/features/lessons/WorksheetRecords';
import { InquiryRecord } from './InquiryRecord';

type Loaded =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly project: ProjectRecord; readonly notes: readonly Note[]; readonly runs: readonly RunRecord[] }
  | { readonly kind: 'error'; readonly message: string };

/**
 * Sổ tay thí nghiệm in được của một dự án: bản trống để học sinh ghi tay trên lớp,
 * hoặc bản kèm ghi chép và nhật ký đã có để nộp như một báo cáo.
 */
export function NotebookPrintPage() {
  const { projectId = '' } = useParams();
  const { t } = useTranslation();
  const projects = useProjectRepository();
  const notebook = useNotebookRepository();
  const experiments = useExperimentRepository();
  const [loaded, setLoaded] = useState<{ readonly id: string; readonly value: Loaded } | null>(null);
  const [isBlank, setIsBlank] = useState(false);

  useEffect(() => {
    let isActive = true;
    Promise.all([projects.findById(projectId), notebook.list(projectId), experiments.listRuns(projectId)]).then(
      ([project, notes, runs]) => {
        if (!isActive) return;
        setLoaded({
          id: projectId,
          value: project ? { kind: 'ready', project, notes, runs } : { kind: 'error', message: t('project.notFound') },
        });
      },
      (error: unknown) => {
        console.error('Không đọc được sổ tay để in', projectId, error);
        if (isActive) setLoaded({ id: projectId, value: { kind: 'error', message: getErrorMessage(error) } });
      },
    );
    return () => {
      isActive = false;
    };
  }, [projects, notebook, experiments, projectId, t]);

  const state: Loaded = loaded?.id === projectId ? loaded.value : { kind: 'loading' };
  if (state.kind === 'loading') return <p>…</p>;
  if (state.kind === 'error') {
    return (
      <div className="space-y-4">
        <BackLink to="/studio">{t('project.back')}</BackLink>
        <p role="alert">{state.message}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <BackLink to={`/studio/${projectId}`}>{state.project.name}</BackLink>
        <span className="flex-1" />
        <span className="inline-flex overflow-hidden rounded border border-rule text-sm" role="group" aria-label={t('inquiry.print.version')}>
          <button type="button" aria-pressed={!isBlank} onClick={() => setIsBlank(false)} className={`px-3 py-1 ${!isBlank ? 'bg-ink text-paper' : ''}`}>
            {t('inquiry.print.filled')}
          </button>
          <button type="button" aria-pressed={isBlank} onClick={() => setIsBlank(true)} className={`px-3 py-1 ${isBlank ? 'bg-ink text-paper' : ''}`}>
            {t('inquiry.print.blank')}
          </button>
        </span>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          <Printer /> {t('inquiry.print.button')}
        </button>
      </div>
      <p className="text-xs text-muted print:hidden"><Info /> {t('inquiry.print.hint')}</p>

      <article className="space-y-6" data-testid="notebook-sheet">
        <header className="space-y-3 border-b border-ink pb-3">
          <h1 className="text-2xl font-semibold">{t('inquiry.print.title')}</h1>
          <p className="font-medium">{state.project.name}</p>
          <div className="grid grid-cols-[1fr_10rem] gap-4 text-sm">
            <div>
              <span>{t('inquiry.print.name')}:</span>
              <WriteLines count={1} />
            </div>
            <div>
              <span>{t('inquiry.print.className')}:</span>
              <WriteLines count={1} />
            </div>
          </div>
        </header>
        <InquiryRecord projectType={state.project.projectType} notes={isBlank ? [] : state.notes} runs={isBlank ? [] : state.runs} isPrint />
      </article>
    </div>
  );
}
