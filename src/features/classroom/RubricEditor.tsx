import { useTranslation } from 'react-i18next';
import { ASSIGNMENT_LIMITS, rubricTotal, type RubricCriterion } from '@/storage/schemas/assignment';
import { X } from '@/ui/icons';

interface RubricEditorProps {
  readonly rubric: readonly RubricCriterion[];
  readonly onChange: (rubric: RubricCriterion[]) => void;
}

/** Bảng rubric: mỗi tiêu chí có tên, mô tả và điểm tối đa; luôn còn ít nhất 1 tiêu chí. */
export function RubricEditor({ rubric, onChange }: RubricEditorProps) {
  const { t } = useTranslation();
  const replace = (index: number, patch: Partial<RubricCriterion>) =>
    onChange(rubric.map((c, i) => (i === index ? { ...c, ...patch } : c)));

  return (
    <fieldset className="space-y-3">
      <legend className="font-semibold">{t('classroom.create.rubricTitle')}</legend>
      <ol className="space-y-3">
        {rubric.map((c, i) => {
          const n = i + 1;
          return (
            <li key={i} className="grid gap-2 rounded border border-rule p-3 sm:grid-cols-[1fr_6rem_auto]">
              <input
                aria-label={t('classroom.create.criterionLabel', { n })}
                value={c.criterion}
                maxLength={ASSIGNMENT_LIMITS.criterion}
                onChange={(e) => replace(i, { criterion: e.target.value })}
                className="rounded border border-rule bg-paper px-3 py-2 font-medium"
              />
              <input
                type="number"
                aria-label={t('classroom.create.pointsLabel', { n })}
                min={1}
                max={ASSIGNMENT_LIMITS.maxPoints}
                value={c.maxPoints}
                onChange={(e) => replace(i, { maxPoints: Math.min(ASSIGNMENT_LIMITS.maxPoints, Math.max(1, Math.round(Number(e.target.value)) || 1)) })}
                className="rounded border border-rule bg-paper px-3 py-2 font-mono"
              />
              <button
                type="button"
                aria-label={t('classroom.create.removeCriterion', { n })}
                disabled={rubric.length <= 1}
                onClick={() => onChange(rubric.filter((_, j) => j !== i))}
                className="btn btn-ghost px-2 py-1 text-sm"
              >
                <X />
              </button>
              <textarea
                aria-label={t('classroom.create.descriptionLabel', { n })}
                value={c.description}
                maxLength={ASSIGNMENT_LIMITS.criterionDescription}
                rows={2}
                onChange={(e) => replace(i, { description: e.target.value })}
                className="rounded border border-rule bg-paper p-2 text-sm sm:col-span-3"
              />
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        {rubric.length < ASSIGNMENT_LIMITS.rubric && (
          <button type="button" onClick={() => onChange([...rubric, { criterion: '', description: '', maxPoints: 1 }])} className="btn btn-ghost text-sm">
            {t('classroom.create.addCriterion')}
          </button>
        )}
        <span className="font-mono text-sm" data-testid="rubric-total">{t('classroom.create.rubricTotal', { total: rubricTotal(rubric) })}</span>
      </div>
    </fieldset>
  );
}
