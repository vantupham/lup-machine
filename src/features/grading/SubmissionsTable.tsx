import { useTranslation } from 'react-i18next';
import type { StoredSubmission } from '@/storage/repositories/submission-repository';
import { rubricTotal, type Assignment } from '@/storage/schemas/assignment';
import { gradeTotal } from '@/storage/schemas/grade';
import { testAccuracy } from './grading';
import { formatScore } from './GradeForm';
import { floorPercent } from '@/core/percent';

interface SubmissionsTableProps {
  readonly assignment: Assignment;
  readonly submissions: readonly StoredSubmission[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}

/** Bảng tổng hợp cả lớp: mỗi học sinh một dòng, điểm từng tiêu chí và tổng. */
export function SubmissionsTable({ assignment, submissions, selectedId, onSelect }: SubmissionsTableProps) {
  const { t, i18n } = useTranslation();
  const max = rubricTotal(assignment.rubric);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" data-testid="submissions-table">
        <caption className="sr-only">{t('grading.table.caption')}</caption>
        <thead>
          <tr className="border-b border-rule text-left">
            <th scope="col" className="py-2 pr-3">{t('grading.table.students')}</th>
            <th scope="col" className="py-2 pr-3">{t('grading.table.className')}</th>
            <th scope="col" className="py-2 pr-3">{t('grading.table.submittedAt')}</th>
            <th scope="col" className="py-2 pr-3">{t('grading.table.data')}</th>
            <th scope="col" className="py-2 pr-3 text-right">{t('grading.table.accuracy')}</th>
            {assignment.rubric.map((c, i) => (
              <th key={i} scope="col" className="py-2 pr-3 text-right" title={c.description}>{`${c.criterion} /${c.maxPoints}`}</th>
            ))}
            <th scope="col" className="py-2 text-right">{`${t('grading.table.total')} /${max}`}</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((s) => {
            const total = gradeTotal(s.grade);
            const accuracy = testAccuracy(s);
            const isSelected = s.id === selectedId;
            return (
              <tr key={s.id} className={`border-b border-rule ${isSelected ? 'bg-surface' : ''}`}>
                <th scope="row" className="py-2 pr-3 text-left font-medium">
                  <button
                    type="button"
                    onClick={() => onSelect(s.id)}
                    aria-label={t('grading.table.open', { students: s.submission.submitter.students })}
                    aria-pressed={isSelected}
                    className="text-left text-primary underline"
                  >
                    {s.submission.submitter.students}
                  </button>
                </th>
                <td className="py-2 pr-3">{s.submission.submitter.className}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{new Date(s.submission.submittedAt).toLocaleString(i18n.language)}</td>
                <td className="py-2 pr-3">{s.submission.includesData ? t('grading.table.dataYes') : t('grading.table.dataNo')}</td>
                <td className="py-2 pr-3 text-right font-mono">{accuracy === null ? '–' : `${floorPercent(accuracy)}%`}</td>
                {s.grade.scores.map((score, i) => (
                  <td key={i} className="py-2 pr-3 text-right font-mono">{score === null ? '–' : formatScore(score, i18n.language)}</td>
                ))}
                <td className="py-2 text-right font-mono font-semibold">{total !== null ? formatScore(total, i18n.language) : <span className="font-sans text-xs font-normal text-muted">{t('grading.table.notGraded')}</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
