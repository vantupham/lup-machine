import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RunRecord } from '@/storage/db';
import { CLASS_COLORS } from './class-style';
import { LineChart } from './LineChart';
import { RotateCcw } from '@/ui/icons';

const MAX_COMPARE = 4;

interface ExperimentLogProps {
  readonly runs: readonly RunRecord[];
  readonly fingerprint: string;
  readonly canReplay: boolean;
  readonly onReplay: (run: RunRecord) => void;
  readonly onDelete: (run: RunRecord) => void;
}

export function ExperimentLog({ runs, fingerprint, canReplay, onReplay, onDelete }: ExperimentLogProps) {
  const { t, i18n } = useTranslation();
  const [compared, setCompared] = useState<ReadonlySet<string>>(new Set());
  const pct = (v: number | null | undefined) =>
    v === null || v === undefined ? t('project.experiments.na') : `${Math.round(v * 100)}%`;
  const time = (iso: string) => new Date(iso).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' });

  const toggle = (id: string) =>
    setCompared((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_COMPARE) next.add(id);
      return next;
    });

  const selectedRuns = runs.filter((r) => compared.has(r.id));
  const useTest = selectedRuns.length > 0 && selectedRuns.every((r) => r.metrics.some((m) => m.testAccuracy !== null));

  return (
    <section aria-labelledby="experiments-title" className="space-y-3">
      <div>
        <h2 id="experiments-title" className="text-2xl font-semibold">{t('project.experiments.title')}</h2>
        <p className="max-w-3xl text-sm text-muted">{t('project.experiments.lead')}</p>
      </div>
      {runs.length === 0 ? (
        <p className="text-sm text-muted">{t('project.experiments.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm" aria-label={t('project.experiments.title')}>
            <thead>
              <tr className="border-b border-rule text-left text-xs text-muted">
                <th className="py-1">{t('project.experiments.compare')}</th>
                <th>{t('project.experiments.number')}</th>
                <th>{t('project.experiments.time')}</th>
                <th>{t('project.experiments.settings')}</th>
                <th>{t('project.experiments.data')}</th>
                <th>{t('project.experiments.trainScore')}</th>
                <th>{t('project.experiments.testScore')}</th>
                <th>{t('project.experiments.guess')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const last = run.metrics.at(-1);
                const isSameData = run.fingerprint === fingerprint;
                return (
                  <tr key={run.id} className="border-b border-rule">
                    <td className="py-1.5">
                      <input
                        type="checkbox"
                        aria-label={t('project.experiments.compareLabel', { n: run.number })}
                        checked={compared.has(run.id)}
                        disabled={!compared.has(run.id) && compared.size >= MAX_COMPARE}
                        onChange={() => toggle(run.id)}
                      />
                    </td>
                    <td className="font-mono">#{run.number}</td>
                    <td className="text-xs">{time(run.createdAt)}</td>
                    <td className="font-mono text-xs">
                      {run.options.epochs} ep · lr {run.options.learningRate} · b {run.options.batchSize}
                    </td>
                    <td className="font-mono text-xs">
                      {run.counts.train} / {run.counts.test}
                    </td>
                    <td className="font-mono">{pct(last?.trainAccuracy)}</td>
                    <td className="font-mono font-semibold">{pct(last?.testAccuracy)}</td>
                    <td className="font-mono">{pct(run.guess?.testAccuracy)}</td>
                    <td className="space-x-2 whitespace-nowrap text-right">
                      {isSameData ? (
                        <button
                          type="button"
                          className="text-primary hover:underline disabled:opacity-50"
                          disabled={!canReplay}
                          title={t('project.experiments.replayHint')}
                          aria-label={t('project.experiments.replayLabel', { n: run.number })}
                          onClick={() => onReplay(run)}
                        >
                          <RotateCcw /> {t('project.experiments.replay')}
                        </button>
                      ) : (
                        <span className="text-xs text-muted" title={t('project.experiments.changedHint')}>
                          {t('project.experiments.changed')}
                        </span>
                      )}
                      <button
                        type="button"
                        className="text-danger hover:underline"
                        aria-label={t('project.experiments.deleteLabel', { n: run.number })}
                        onClick={() => onDelete(run)}
                      >
                        {t('project.experiments.delete')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {selectedRuns.length > 0 && (
        <div className="max-w-xl">
          <LineChart
            title={t(useTest ? 'project.experiments.chartTitle' : 'project.experiments.chartTitleTrain')}
            yMax={100}
            markerX={null}
            maxX={Math.max(...selectedRuns.map((r) => r.metrics.at(-1)?.epoch ?? 0))}
            series={selectedRuns.map((r, i) => ({
              label: t('project.experiments.run', { n: r.number }),
              color: CLASS_COLORS[i % CLASS_COLORS.length] as string,
              values: r.metrics.map((m) => ((useTest ? m.testAccuracy : m.trainAccuracy) ?? 0) * 100),
            }))}
          />
        </div>
      )}
    </section>
  );
}
