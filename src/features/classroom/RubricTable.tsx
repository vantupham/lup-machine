import { useTranslation } from 'react-i18next';
import { rubricTotal, type RubricCriterion } from '@/storage/schemas/assignment';

interface RubricTableProps {
  readonly rubric: readonly RubricCriterion[];
}

/** Rubric chỉ đọc: học sinh biết trước bài được chấm theo những tiêu chí nào. */
export function RubricTable({ rubric }: RubricTableProps) {
  const { t } = useTranslation();
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-rule text-left">
          <th scope="col" className="py-2 pr-3">{t('classroom.assignment.criterion')}</th>
          <th scope="col" className="whitespace-nowrap py-2 pl-3 text-right">{t('classroom.assignment.points')}</th>
        </tr>
      </thead>
      <tbody>
        {rubric.map((c, i) => (
          <tr key={i} className="border-b border-rule align-top">
            <td className="py-2 pr-3">
              <span className="font-medium">{c.criterion}</span>
              {c.description && <span className="block text-xs text-muted">{c.description}</span>}
            </td>
            <td className="py-2 text-right font-mono">{c.maxPoints}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row" className="py-2 pr-3 text-left">{t('classroom.assignment.total')}</th>
          <td className="py-2 text-right font-mono font-semibold">{rubricTotal(rubric)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
