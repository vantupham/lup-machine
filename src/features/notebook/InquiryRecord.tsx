import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { diffRunSetup } from '@/core/experiments/run-diff';
import type { ProjectType } from '@/storage/schemas/project';
import type { Note } from '@/storage/schemas/notebook';
import { STEP_KEYS } from '@/features/studio/StepBar';
import { describeChange, finalScore, setupOf, type RunSummary } from '@/features/studio/image/lab/run-setup';
import { WriteLines } from '@/features/lessons/WorksheetRecords';

/** Bản in: số dòng trống cho mỗi bước chưa ghi, và số hàng trống thêm vào bảng thí nghiệm. */
const PRINT_NOTE_LINES = 3;
const PRINT_BLANK_RUNS = 4;

interface InquiryRecordProps {
  readonly projectType: ProjectType;
  readonly notes: readonly Note[];
  readonly runs: readonly RunSummary[];
  /** Bản in: đủ mọi bước kèm câu hỏi, chừa dòng trống để viết tay. */
  readonly isPrint?: boolean;
}

/**
 * Sổ tay và nhật ký thí nghiệm của một dự án, để giáo viên đọc (bài nộp) hoặc in ra giấy:
 * ghi chép theo từng bước, mỗi lần chạy đổi gì, đoán bao nhiêu, điểm thật và kết luận.
 */
export function InquiryRecord({ projectType, notes, runs, isPrint = false }: InquiryRecordProps) {
  const { t } = useTranslation();
  const steps: readonly string[] = STEP_KEYS;
  const textOf = new Map(notes.map((n) => [n.step, n.text]));
  const ordered = [...runs].sort((a, b) => a.number - b.number);
  const shownSteps = isPrint ? steps : steps.filter((step) => textOf.has(step));

  return (
    <div className="space-y-5" data-testid="inquiry-record">
      {!isPrint && (
        <p className="text-sm text-muted" data-testid="inquiry-summary">
          {t('inquiry.summary', {
            notes: steps.filter((s) => textOf.has(s)).length,
            steps: steps.length,
            runs: ordered.length,
            guesses: ordered.filter((r) => r.guess).length,
            conclusions: ordered.filter((r) => r.conclusion).length,
          })}
        </p>
      )}
      <div>
        <h3 className="mb-2 font-semibold">{t('inquiry.notesTitle')}</h3>
        {shownSteps.length === 0 ? (
          <p className="text-sm text-muted">{t('inquiry.noNotes')}</p>
        ) : (
          <ol className="space-y-3">
            {shownSteps.map((step) => (
              <StepEntry key={step} t={t} projectType={projectType} step={step} text={textOf.get(step)} isPrint={isPrint} />
            ))}
          </ol>
        )}
      </div>
      <RunsTable runs={ordered} isPrint={isPrint} />
    </div>
  );
}

interface StepEntryProps {
  readonly t: TFunction;
  readonly projectType: ProjectType;
  readonly step: string;
  readonly text: string | undefined;
  readonly isPrint: boolean;
}

function StepEntry({ t, projectType, step, text, isPrint }: StepEntryProps) {
  const questions = (['observe', 'explain'] as const)
    .map((kind) => `notebook.${projectType}.${step}.${kind}`)
    .filter((key) => t(key) !== key)
    .map((key) => t(key));
  return (
    <li className="break-inside-avoid text-sm" data-testid={`inquiry-note-${step}`}>
      <p className="font-medium">{t(`project.steps.${step}`, { defaultValue: step })}</p>
      {isPrint && questions.length > 0 && <p className="text-xs text-muted">{questions.join(' ')}</p>}
      {text ? <p className="whitespace-pre-wrap">{text}</p> : isPrint && <WriteLines count={PRINT_NOTE_LINES} />}
    </li>
  );
}

function RunsTable({ runs, isPrint }: { readonly runs: readonly RunSummary[]; readonly isPrint: boolean }) {
  const { t } = useTranslation();
  const percent = (v: number | null | undefined) => (v === null || v === undefined ? '–' : `${Math.round(v * 100)}%`);

  if (runs.length === 0 && !isPrint) {
    return (
      <div>
        <h3 className="mb-2 font-semibold">{t('inquiry.runsTitle')}</h3>
        <p className="text-sm text-muted">{t('inquiry.noRuns')}</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm [&_td]:border-b [&_td]:border-rule [&_td]:py-1 [&_td]:pr-3 [&_th]:pr-3" aria-label={t('inquiry.runsTitle')}>
        <caption className="mb-2 text-left font-semibold">{t('inquiry.runsTitle')}</caption>
        <thead>
          <tr className="text-left text-xs text-muted">
            <th scope="col" className="font-normal">{t('inquiry.columns.run')}</th>
            <th scope="col" className="font-normal">{t('inquiry.columns.changes')}</th>
            <th scope="col" className="font-normal">{t('inquiry.columns.guess')}</th>
            <th scope="col" className="font-normal">{t('inquiry.columns.test')}</th>
            <th scope="col" className="font-normal">{t('inquiry.columns.conclusion')}</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run, i) => {
            const before = runs[i - 1];
            const changes = before ? diffRunSetup(setupOf(before), setupOf(run)) : null;
            return (
              <tr key={run.number}>
                <td className="font-mono">#{run.number}</td>
                <td className="text-xs">
                  {changes === null
                    ? t('project.experiments.firstRun')
                    : changes.length === 0
                      ? t('project.experiments.noChange')
                      : changes.map((c) => describeChange(t, c)).join('; ')}
                </td>
                <td className="font-mono">{percent(run.guess?.testAccuracy)}</td>
                <td className="font-mono">{percent(finalScore(run, 'test'))}</td>
                <td className="whitespace-pre-wrap text-xs">{run.conclusion ?? ''}</td>
              </tr>
            );
          })}
          {isPrint &&
            Array.from({ length: PRINT_BLANK_RUNS }, (_, i) => (
              <tr key={`blank-${i}`}>
                {Array.from({ length: 5 }, (__, j) => (
                  <td key={j} className="h-9" />
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
