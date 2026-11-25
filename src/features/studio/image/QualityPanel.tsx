import { useTranslation } from 'react-i18next';
import { checkDatasetQuality, checkTestCoverage } from '@/core/data/quality-checks';
import type { ClassRecord } from '@/storage/db';
import type { SplitCounts } from '@/storage/repositories/dataset-repository';
import { useModeStore } from '@/ui/mode-store';
import { Check, CornerDownRight } from '@/ui/icons';
import { ClassMarker } from '@/ui/ClassMarker';
import { StepNumber } from '@/ui/StepNumber';

interface QualityPanelProps {
  readonly classes: readonly ClassRecord[];
  readonly counts: SplitCounts;
}

interface DisplayIssue {
  readonly key: string;
  readonly code: string;
  readonly severity: 'error' | 'warning';
  readonly params: Record<string, string | number>;
}

function collectIssues(classes: readonly ClassRecord[], counts: SplitCounts): DisplayIssue[] {
  const byName = (pick: 'train' | 'both') =>
    Object.fromEntries(
      classes.map((c) => {
        const entry = counts[c.id] ?? { train: 0, test: 0 };
        return [c.name, pick === 'train' ? entry.train : entry];
      }),
    );

  const quality = checkDatasetQuality(byName('train') as Record<string, number>).map(
    (issue, i): DisplayIssue => {
      switch (issue.code) {
        case 'class-imbalance':
          return {
            key: `q${i}`,
            code: issue.code,
            severity: issue.severity,
            params: {
              largest: issue.largest.label,
              smallest: issue.smallest.label,
              ratio: Number(issue.ratio.toFixed(1)),
            },
          };
        case 'too-few-classes':
          return { key: `q${i}`, code: issue.code, severity: issue.severity, params: { count: issue.classCount } };
        case 'too-few-samples':
          return {
            key: `q${i}`,
            code: issue.code,
            severity: issue.severity,
            params: { label: issue.label, count: issue.count, minimum: issue.minimum },
          };
        case 'empty-class':
          return { key: `q${i}`, code: issue.code, severity: issue.severity, params: { label: issue.label } };
      }
    },
  );
  const coverage = checkTestCoverage(byName('both') as SplitCounts).map(
    (issue, i): DisplayIssue => ({
      key: `c${i}`,
      code: issue.code,
      severity: issue.severity,
      params: { label: issue.label },
    }),
  );
  return [...quality, ...coverage];
}

export function QualityPanel({ classes, counts }: QualityPanelProps) {
  const { t } = useTranslation();
  const mode = useModeStore((s) => s.mode);
  const issues = collectIssues(classes, counts);
  const max = Math.max(1, ...classes.map((c) => (counts[c.id]?.train ?? 0) + (counts[c.id]?.test ?? 0)));

  return (
    <section aria-labelledby="quality-title" className="lab-card h-fit space-y-4 p-4 lg:sticky lg:top-20">
      <div>
        <h2 id="quality-title" className="flex items-center gap-2 text-lg font-semibold">
          <StepNumber n={2} size="sm" />
          {t('project.quality.title')}
        </h2>
        <p className="text-sm text-muted">{t('project.quality.lead')}</p>
      </div>

      <figure>
        <figcaption className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          {t('project.quality.chartLabel')}
        </figcaption>
        <ul className="space-y-1.5">
          {classes.map((c, i) => {
            const entry = counts[c.id] ?? { train: 0, test: 0 };
            return (
              <li key={c.id} className="text-sm">
                <div className="flex justify-between gap-2">
                  <span className="truncate">
                    <ClassMarker index={i} className="mr-1" />
                    {c.name}
                  </span>
                  <span className="font-mono text-xs">
                    {entry.train} + {entry.test}
                  </span>
                </div>
                <div aria-hidden="true" className="mt-0.5 flex h-2 overflow-hidden rounded-sm bg-rule">
                  <div style={{ width: `${(entry.train / max) * 100}%` }} className="bg-primary" />
                  <div style={{ width: `${(entry.test / max) * 100}%` }} className="bg-accent" />
                </div>
              </li>
            );
          })}
        </ul>
        <p aria-hidden="true" className="mt-2 flex gap-4 text-xs text-muted">
          <span>
            <span className="mr-1 inline-block h-2 w-2 bg-primary" />
            {t('project.class.train')}
          </span>
          <span>
            <span className="mr-1 inline-block h-2 w-2 bg-accent" />
            {t('project.class.test')}
          </span>
        </p>
      </figure>

      {issues.length === 0 ? (
        <p role="status" className="rounded bg-accent/10 p-3 text-sm text-accent">
          <Check /> {t('project.quality.ok')}
        </p>
      ) : (
        <ul aria-label={t('project.quality.title')} className="space-y-2">
          {issues.map((issue) => (
            <li
              key={issue.key}
              className={`border-l-4 py-1 pl-3 text-sm ${
                issue.severity === 'error' ? 'border-danger' : 'border-warning'
              }`}
            >
              <p>{t(`project.quality.issues.${issue.code}`, issue.params)}</p>
              {mode === 'explore' && (
                <p className="mt-0.5 text-xs text-muted"><CornerDownRight className="mr-1" />{t(`project.quality.tips.${issue.code}`)}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
