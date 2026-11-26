import { useTranslation } from 'react-i18next';
import { diffTrialSetup, isTrialTestChanged, trialVariableCount, type TrialSetupLike } from '@/core/experiments/trial-diff';
import { TriangleAlert } from '@/ui/icons';
import type { TrialLog } from './useTrialLog';
import { describeTrialChange } from './trial-text';

interface TrialBeforeProps {
  readonly log: TrialLog;
  /** Cài đặt và dữ liệu sẽ dùng nếu huấn luyện ngay bây giờ. */
  readonly current: TrialSetupLike;
  /** Có ảnh / mẫu Kiểm tra và đo bằng độ chính xác thì mới hỏi đoán điểm. */
  readonly canGuess: boolean;
}

/** Trước khi huấn luyện: đã đổi gì so với lần trước (biến thí nghiệm) và ô đoán điểm Kiểm tra. */
export function TrialBefore({ log, current, canGuess }: TrialBeforeProps) {
  const { t } = useTranslation();
  const latest = log.trials[0];
  const changes = latest ? diffTrialSetup(latest, current) : [];
  const count = trialVariableCount(changes);

  return (
    <div className="space-y-3" data-testid="trial-before">
      {latest &&
        (changes.length === 0 ? (
          <p className="text-sm text-muted" data-testid="trial-plan">{t('project.compare.noChange', { n: latest.number })}</p>
        ) : (
          <div className="space-y-1 border-l-4 border-rule pl-3 text-sm" data-testid="trial-plan">
            <p>{t('project.compare.planTitle', { n: latest.number })}</p>
            <ul className="list-disc pl-5 font-mono text-xs">
              {changes.map((c, i) => (
                <li key={i}>{describeTrialChange(t, c)}</li>
              ))}
            </ul>
            {count >= 2 && <p className="text-warning"><TriangleAlert /> {t('project.compare.tooMany', { count })}</p>}
            {isTrialTestChanged(changes) && <p className="text-warning"><TriangleAlert /> {t('project.compare.unfairTest', { n: latest.number })}</p>}
          </div>
        ))}
      {canGuess && (
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t('project.train.guessLabel')}
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={log.guessText}
            onChange={(e) => log.setGuessText(e.target.value)}
            className="w-24 rounded border border-rule bg-paper px-2 py-1 font-mono text-sm text-ink"
          />
          {log.guess === undefined && <span role="alert" className="text-danger">{t('project.train.guessInvalid')}</span>}
        </label>
      )}
    </div>
  );
}
