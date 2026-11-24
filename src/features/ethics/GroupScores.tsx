import { useTranslation } from 'react-i18next';
import { accuracy, REGIONS, type BiasScores, type GroupScore } from '@/core/ethics/rice-leaves';
import { floorPercent } from '@/core/percent';
import { useModeStore } from '@/ui/mode-store';

interface GroupScoresProps {
  readonly scores: BiasScores;
  /** false: chỉ hiện độ chính xác chung (trước khi học sinh dự đoán). */
  readonly showGroups: boolean;
}

function Bar({ label, group, testId }: { readonly label: string; readonly group: GroupScore; readonly testId: string }) {
  const value = floorPercent(accuracy(group));
  return (
    <div className="grid grid-cols-[8rem_1fr_3.5rem] items-center gap-3 text-sm" data-testid={testId}>
      <span className="font-medium">{label}</span>
      <span className="h-3 overflow-hidden rounded bg-rule" aria-hidden="true">
        <span className="block h-full bg-primary" style={{ width: `${value}%` }} />
      </span>
      <span className="text-right font-mono">{value}%</span>
    </div>
  );
}

/** Độ chính xác chung và theo từng vùng; chế độ Chuyên sâu (THPT) thêm số báo động nhầm / bỏ sót. */
export function GroupScores({ scores, showGroups }: GroupScoresProps) {
  const { t } = useTranslation();
  const isExpert = useModeStore((s) => s.mode) === 'expert';
  return (
    <div className="space-y-2">
      <Bar label={t('ethics.scores.overall')} group={scores.overall} testId="score-overall" />
      {showGroups &&
        REGIONS.map((r) => <Bar key={r} label={t(`ethics.regions.${r}`)} group={scores.byRegion[r]} testId={`score-${r}`} />)}
      {showGroups && isExpert && (
        <table className="mt-3 w-full max-w-md border-collapse text-sm" data-testid="error-table">
          <caption className="text-left text-xs font-semibold">{t('ethics.scores.errorsCaption')}</caption>
          <thead>
            <tr className="border-b border-rule text-left">
              <th scope="col" className="py-1 pr-3">{t('ethics.scores.region')}</th>
              <th scope="col" className="py-1 pr-3 text-right">{t('ethics.scores.correct')}</th>
              <th scope="col" className="py-1 pr-3 text-right">{t('ethics.scores.falseAlarm')}</th>
              <th scope="col" className="py-1 text-right">{t('ethics.scores.missed')}</th>
            </tr>
          </thead>
          <tbody>
            {REGIONS.map((r) => {
              const g = scores.byRegion[r];
              return (
                <tr key={r} className="border-b border-rule">
                  <th scope="row" className="py-1 pr-3 text-left font-medium">{t(`ethics.regions.${r}`)}</th>
                  <td className="py-1 pr-3 text-right font-mono">{`${g.correct}/${g.total}`}</td>
                  <td className="py-1 pr-3 text-right font-mono">{g.falseAlarm}</td>
                  <td className="py-1 text-right font-mono">{g.missed}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
