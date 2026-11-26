import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { diffRunSetup, isTestSetChanged } from '@/core/experiments/run-diff';
import type { RunRecord } from '@/storage/db';
import { RUN_CONCLUSION_MAX_LENGTH } from '@/storage/repositories/experiment-repository';
import { AutosaveStatus } from '@/ui/AutosaveStatus';
import { TrendingDown, TrendingUp, TriangleAlert } from '@/ui/icons';
import { useAutosave } from '@/ui/useAutosave';
import { describeChange, finalScore, setupOf } from './run-setup';

interface RunComparisonProps {
  /** Lần chạy đang hiện. */
  readonly run: RunRecord;
  /** Lần chạy ngay trước nó (undefined nếu là lần đầu). */
  readonly previous: RunRecord | undefined;
  readonly onSaveConclusion: (runId: string, text: string) => Promise<void>;
}

/** Sau khi huấn luyện: đổi gì → điểm đổi thế nào → kết luận của học sinh (lưu vào lần chạy). */
export function RunComparison({ run, previous, onSaveConclusion }: RunComparisonProps) {
  const { t } = useTranslation();
  const [conclusion, setConclusion] = useState(run.conclusion ?? '');
  const save = useCallback((text: string) => onSaveConclusion(run.id, text), [onSaveConclusion, run.id]);
  const autosave = useAutosave(save);

  return (
    <div className="lab-card space-y-3 p-4" data-testid="run-comparison">
      {previous ? <Delta run={run} previous={previous} /> : <p className="text-sm text-muted">{t('project.compare.firstRun')}</p>}
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{t('project.compare.conclusionLabel')}</span>
        <textarea
          value={conclusion}
          onChange={(e) => {
            setConclusion(e.target.value);
            autosave.schedule(e.target.value);
          }}
          onBlur={() => void autosave.flush()}
          maxLength={RUN_CONCLUSION_MAX_LENGTH}
          rows={2}
          placeholder={t('project.compare.conclusionPlaceholder')}
          className="w-full rounded border border-rule bg-paper p-2 text-ink"
        />
      </label>
      <AutosaveStatus state={autosave.state} />
    </div>
  );
}

function Delta({ run, previous }: { readonly run: RunRecord; readonly previous: RunRecord }) {
  const { t } = useTranslation();
  const changes = diffRunSetup(setupOf(previous), setupOf(run));
  const kind = finalScore(run, 'test') !== null && finalScore(previous, 'test') !== null ? 'test' : 'train';
  const percent = (v: number | null) => Math.round((v ?? 0) * 100);
  const from = percent(finalScore(previous, kind));
  const to = percent(finalScore(run, kind));
  const change = to > from ? t('project.compare.up', { d: to - from }) : to < from ? t('project.compare.down', { d: from - to }) : t('project.compare.same');

  return (
    <div className="space-y-1 text-sm">
      <p className="font-semibold">{t('project.compare.resultTitle', { n: previous.number })}</p>
      {changes.length === 0 ? (
        <p className="text-muted">{t('project.experiments.noChange')}</p>
      ) : (
        <ul className="list-disc pl-5 font-mono text-xs">
          {changes.map((c) => (
            <li key={c.kind}>{describeChange(t, c)}</li>
          ))}
        </ul>
      )}
      <p data-testid="run-delta">{t('project.compare.delta', { label: t(`project.compare.score.${kind}`), from, to, change })}</p>
      {kind === 'test' && isTestSetChanged(changes) && (
        <p className="text-warning"><TriangleAlert /> {t('project.compare.unfairTest', { n: previous.number })}</p>
      )}
      <ClassRecallTable run={run} previous={previous} />
    </div>
  );
}

/** Tỉ lệ nhận ra từng lớp trước / sau: thấy rõ thay đổi giúp (hay hại) lớp nào. Ghép lớp theo tên. */
function ClassRecallTable({ run, previous }: { readonly run: RunRecord; readonly previous: RunRecord }) {
  const { t } = useTranslation();
  if (!run.classRecall || !previous.classRecall) return null;
  const before = new Map(previous.classNames.map((name, i) => [name, previous.classRecall?.[i] ?? null]));
  const cell = (v: number | null | undefined) => (v === null || v === undefined ? '–' : `${Math.round(v * 100)}%`);
  return (
    <table className="mt-2 text-xs [&_td]:pr-4 [&_th]:pr-4" data-testid="class-recall">
      <caption className="mb-1 whitespace-nowrap text-left font-medium">{t('project.compare.classTitle')}</caption>
      <thead>
        <tr className="text-left text-muted">
          <th scope="col" className="font-normal">{t('project.compare.className')}</th>
          <th scope="col" className="font-normal">{t('project.compare.run', { n: previous.number })}</th>
          <th scope="col" className="font-normal">{t('project.compare.run', { n: run.number })}</th>
        </tr>
      </thead>
      <tbody className="font-mono">
        {run.classNames.map((name, i) => {
          const now = run.classRecall?.[i] ?? null;
          const was = before.get(name);
          const trend = now === null || was === null || was === undefined || now === was ? null : now > was ? 'up' : 'down';
          return (
            <tr key={name}>
              <th scope="row" className="text-left font-sans font-normal">{name}</th>
              <td>{cell(was)}</td>
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
