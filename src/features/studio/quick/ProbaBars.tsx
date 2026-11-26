import { useTranslation } from 'react-i18next';
import { ClassMarker } from '@/ui/ClassMarker';

interface ProbaBarsProps {
  readonly classNames: readonly string[];
  /** Xác suất (0–1) theo đúng thứ tự classNames. */
  readonly probabilities: ArrayLike<number>;
}

/** Kết quả "Máy đoán": mỗi lớp một thanh phần trăm, lớp máy chọn đứng đầu. */
export function ProbaBars({ classNames, probabilities }: ProbaBarsProps) {
  const { t } = useTranslation();
  const rows = classNames
    .map((name, index) => ({ name, index, percent: Math.round((probabilities[index] ?? 0) * 100) }))
    .sort((a, b) => b.percent - a.percent);

  return (
    <ul aria-label={t('project.quick.resultLabel')} className="space-y-2">
      {rows.map(({ name, index, percent }, rank) => (
        <li key={index} className="text-sm">
          <div className="flex justify-between gap-2">
            <span className={rank === 0 ? 'font-semibold' : ''}>
              <ClassMarker index={index} className="mr-1.5" />
              {name}
            </span>
            <span className="font-mono">{percent}%</span>
          </div>
          <div aria-hidden="true" className="mt-1 h-2.5 overflow-hidden rounded-full bg-rule/70">
            <div className={`h-full rounded-full ${rank === 0 ? 'bg-primary' : 'bg-muted/60'}`} style={{ width: `${percent}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
