import { useTranslation } from 'react-i18next';
import { changedVariableCount, diffRunSetup, isTestSetChanged, type RunSetup } from '@/core/experiments/run-diff';
import { TriangleAlert } from '@/ui/icons';
import { describeChange } from './run-setup';

interface ExperimentPlanProps {
  readonly previousNumber: number;
  readonly previous: RunSetup;
  readonly current: RunSetup;
}

/**
 * Trước khi huấn luyện lại: liệt kê những gì đã đổi so với lần trước (biến thí nghiệm),
 * nhắc khi đổi nhiều thứ cùng lúc hoặc khi tập Kiểm tra (thước đo) đã đổi.
 */
export function ExperimentPlan({ previousNumber, previous, current }: ExperimentPlanProps) {
  const { t } = useTranslation();
  const changes = diffRunSetup(previous, current);

  if (changes.length === 0) {
    return <p className="text-sm text-muted" data-testid="experiment-plan">{t('project.compare.noChange', { n: previousNumber })}</p>;
  }
  const count = changedVariableCount(changes);
  return (
    <div className="space-y-1 border-l-4 border-rule pl-3 text-sm" data-testid="experiment-plan">
      <p>{t('project.compare.planTitle', { n: previousNumber })}</p>
      <ul className="list-disc pl-5 font-mono text-xs">
        {changes.map((change) => (
          <li key={change.kind}>{describeChange(t, change)}</li>
        ))}
      </ul>
      {count >= 2 && <p className="text-warning"><TriangleAlert /> {t('project.compare.tooMany', { count })}</p>}
      {isTestSetChanged(changes) && <p className="text-warning"><TriangleAlert /> {t('project.compare.unfairTest', { n: previousNumber })}</p>}
    </div>
  );
}
