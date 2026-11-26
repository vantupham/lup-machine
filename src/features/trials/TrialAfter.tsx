import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { diffTrialSetup, isTrialTestChanged } from '@/core/experiments/trial-diff';
import type { TrialRecord } from '@/storage/db';
import { TRIAL_CONCLUSION_MAX_LENGTH } from '@/storage/schemas/trial';
import { AutosaveStatus } from '@/ui/AutosaveStatus';
import { TrendingDown, TrendingUp, TriangleAlert } from '@/ui/icons';
import { useAutosave } from '@/ui/useAutosave';
import { describeDelta, describeTrialChange, formatScore } from './trial-text';
import type { TrialLog } from './useTrialLog';

interface TrialAfterProps {
  readonly log: TrialLog;
  /** Mô hình đang hiện đúng là lần chạy vừa ghi (chưa đổi cài đặt / dữ liệu sau đó). */
  readonly isCurrent: boolean;
}

/** Sau khi huấn luyện: so với lần trước, từng lớp trước / sau, kết luận; và nhật ký các lần chạy. */
export function TrialAfter({ log, isCurrent }: TrialAfterProps) {
  const { t } = useTranslation();
  const shown = isCurrent && log.shownNumber !== null ? log.trials.find((x) => x.number === log.shownNumber) : undefined;
  const before = shown ? log.trials.find((x) => x.number < shown.number) : undefined;

  return (
    <div className="space-y-4">
      {log.error !== null && <p role="alert" className="text-sm text-danger">{t('project.experiments.saveError', { message: String(log.error) })}</p>}
      {shown && <TrialResult key={shown.id} trial={shown} previous={before} onSaveConclusion={log.setConclusion} />}
      {log.trials.length > 0 && <TrialTable trials={log.trials} />}
    </div>
  );
}

interface TrialResultProps {
  readonly trial: TrialRecord;
  readonly previous: TrialRecord | undefined;
  readonly onSaveConclusion: (id: string, text: string) => Promise<void>;
}

function TrialResult({ trial, previous, onSaveConclusion }: TrialResultProps) {
  const { t, i18n } = useTranslation();
  const [conclusion, setConclusion] = useState(trial.conclusion ?? '');
  const save = useCallback((text: string) => onSaveConclusion(trial.id, text), [onSaveConclusion, trial.id]);
  const autosave = useAutosave(save);
  const label = t(trial.metric === 'accuracy' ? 'project.compare.score.test' : 'trials.r2Test');

  return (
    <div className="lab-card space-y-3 p-4" data-testid="trial-result">
      {trial.guess !== undefined && trial.scores.test !== null && (
        <p className="border-l-4 border-primary pl-3 text-sm" data-testid="trial-guess">
          {t('project.train.guessResult', {
            guess: Math.round(trial.guess * 100),
            actual: Math.round(trial.scores.test * 100),
            diff: Math.abs(Math.round(trial.scores.test * 100) - Math.round(trial.guess * 100)),
          })}
        </p>
      )}
      {previous ? (
        <div className="space-y-1 text-sm">
          <p className="font-semibold">{t('project.compare.resultTitle', { n: previous.number })}</p>
          <ChangeList trial={trial} previous={previous} />
          {trial.scores.test !== null && previous.scores.test !== null && (
            <p data-testid="trial-delta">
              {t(trial.metric === 'accuracy' ? 'project.compare.delta' : 'trials.deltaR2', {
                label,
                from: formatScore(trial.metric, previous.scores.test, i18n.language).replace('%', ''),
                to: formatScore(trial.metric, trial.scores.test, i18n.language).replace('%', ''),
                change: describeDelta(t, trial.metric, previous.scores.test, trial.scores.test, i18n.language),
              })}
            </p>
          )}
          {isTrialTestChanged(diffTrialSetup(previous, trial)) && (
            <p className="text-warning"><TriangleAlert /> {t('project.compare.unfairTest', { n: previous.number })}</p>
          )}
          <RecallTable trial={trial} previous={previous} />
        </div>
      ) : (
        <p className="text-sm text-muted">{t('project.compare.firstRun')}</p>
      )}
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{t('project.compare.conclusionLabel')}</span>
        <textarea
          value={conclusion}
          onChange={(e) => {
            setConclusion(e.target.value);
            autosave.schedule(e.target.value);
          }}
          onBlur={() => void autosave.flush()}
          maxLength={TRIAL_CONCLUSION_MAX_LENGTH}
          rows={2}
          placeholder={t('project.compare.conclusionPlaceholder')}
          className="w-full rounded border border-rule bg-paper p-2 text-ink"
        />
      </label>
      <AutosaveStatus state={autosave.state} />
    </div>
  );
}

function ChangeList({ trial, previous }: { readonly trial: TrialRecord; readonly previous: TrialRecord }) {
  const { t } = useTranslation();
  const changes = diffTrialSetup(previous, trial);
  if (changes.length === 0) return <p className="text-muted">{t('project.experiments.noChange')}</p>;
  return (
    <ul className="list-disc pl-5 font-mono text-xs">
      {changes.map((c, i) => (
        <li key={i}>{describeTrialChange(t, c)}</li>
      ))}
    </ul>
  );
}

/** Tỉ lệ nhận ra từng lớp trước / sau (ghép lớp theo tên). */
function RecallTable({ trial, previous }: { readonly trial: TrialRecord; readonly previous: TrialRecord }) {
  const { t } = useTranslation();
  if (!trial.classRecall || !previous.classRecall) return null;
  const was = new Map(previous.data.classNames.map((name, i) => [name, previous.classRecall?.[i] ?? null]));
  const cell = (v: number | null | undefined) => (v === null || v === undefined ? '–' : `${Math.round(v * 100)}%`);
  return (
    <table className="mt-2 text-xs [&_td]:pr-4 [&_th]:pr-4" data-testid="trial-recall">
      <caption className="mb-1 whitespace-nowrap text-left font-medium">{t('project.compare.classTitle')}</caption>
      <thead>
        <tr className="text-left text-muted">
          <th scope="col" className="font-normal">{t('project.compare.className')}</th>
          <th scope="col" className="font-normal">{t('project.compare.run', { n: previous.number })}</th>
          <th scope="col" className="font-normal">{t('project.compare.run', { n: trial.number })}</th>
        </tr>
      </thead>
      <tbody className="font-mono">
        {trial.data.classNames.map((name, i) => {
          const now = trial.classRecall?.[i] ?? null;
          const before = was.get(name);
          const trend = now === null || before === null || before === undefined || now === before ? null : now > before ? 'up' : 'down';
          return (
            <tr key={name}>
              <th scope="row" className="text-left font-sans font-normal">{name}</th>
              <td>{cell(before)}</td>
              <td>
                {cell(now)}
                {trend === 'up' && <TrendingUp className="ml-1 text-accent" />}
                {trend === 'down' && <TrendingDown className="ml-1 text-danger" />}
                {trend && <span className="sr-only">{' '}{t(`project.compare.trend.${trend}`)}</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Nhật ký: mỗi lần chạy đổi gì, điểm, đoán, kết luận. */
export function TrialTable({ trials }: { readonly trials: readonly TrialRecord[] }) {
  const { t, i18n } = useTranslation();
  const ordered = [...trials].sort((a, b) => a.number - b.number);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm [&_td]:border-b [&_td]:border-rule [&_td]:py-1 [&_td]:pr-3 [&_th]:whitespace-nowrap [&_th]:pr-3" aria-label={t('project.experiments.title')}>
        <caption className="mb-2 text-left font-semibold">{t('project.experiments.title')}</caption>
        <thead>
          <tr className="text-left text-xs text-muted">
            <th scope="col" className="font-normal">{t('inquiry.columns.run')}</th>
            <th scope="col" className="font-normal">{t('project.experiments.changes')}</th>
            <th scope="col" className="font-normal">{t('project.experiments.trainScore')}</th>
            <th scope="col" className="font-normal">{t('project.experiments.testScore')}</th>
            <th scope="col" className="font-normal">{t('project.experiments.guess')}</th>
            <th scope="col" className="font-normal">{t('project.experiments.conclusion')}</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((trial, i) => {
            const before = ordered[i - 1];
            const changes = before ? diffTrialSetup(before, trial) : null;
            return (
              <tr key={trial.id} data-testid={`trial-row-${trial.number}`}>
                <td className="font-mono">#{trial.number}</td>
                <td className="text-xs">
                  {changes === null
                    ? t('project.experiments.firstRun')
                    : changes.length === 0
                      ? t('project.experiments.noChange')
                      : changes.map((c) => describeTrialChange(t, c)).join('; ')}
                </td>
                <td className="font-mono">{formatScore(trial.metric, trial.scores.train, i18n.language)}</td>
                <td className="font-mono font-semibold">{formatScore(trial.metric, trial.scores.test, i18n.language)}</td>
                <td className="font-mono">{trial.guess === undefined ? '–' : `${Math.round(trial.guess * 100)}%`}</td>
                <td className="max-w-[16rem] truncate text-xs" title={trial.conclusion ?? ''}>{trial.conclusion ?? ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
