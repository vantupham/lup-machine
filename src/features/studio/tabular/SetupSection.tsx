import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnSummary, TaskKind } from '@/core/tabular/columns';
import type { PrepareError } from '@/core/tabular/prepare';
import type { TabularIssue } from '@/core/tabular/quality';
import type { TabularConfig } from '@/storage/schemas/tabular';
import { RangeField } from '@/features/playground/controls';
import { configForTarget, toggleFeature, withTask } from './tabular-config';

interface SetupSectionProps {
  readonly columns: readonly ColumnSummary[];
  readonly config: TabularConfig;
  readonly onChange: (config: TabularConfig) => void;
  readonly issues: readonly TabularIssue[];
  readonly error: PrepareError | null;
}

export function SetupSection({ columns, config, onChange, issues, error }: SetupSectionProps) {
  const { t } = useTranslation();
  const targetId = useId();
  const target = columns.find((c) => c.name === config.target);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-4">
        <div>
          <label htmlFor={targetId} className="block text-sm font-medium">{t('tabular.setup.target')}</label>
          <select
            id={targetId}
            value={config.target}
            onChange={(e) => {
              const next = configForTarget(columns, e.target.value, config);
              if (next) onChange(next);
            }}
            className="mt-1 w-full rounded border border-rule bg-surface px-2 py-1.5"
          >
            {columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>

        <fieldset>
          <legend className="text-sm font-medium">{t('tabular.setup.task')}</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {(['classification', 'regression'] as const satisfies readonly TaskKind[]).map((task) => {
              const disabled = task === 'regression' && target?.kind !== 'numeric';
              return (
                <label key={task} className={`flex items-center gap-2 rounded border px-3 py-1.5 text-sm ${config.task === task ? 'border-primary' : 'border-rule'} ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
                  <input type="radio" name="tabular-task" checked={config.task === task} disabled={disabled} onChange={() => onChange(withTask(config, task))} />
                  {t(`tabular.tasks.${task}`)}
                </label>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-muted">{t(`tabular.setup.taskHint.${config.task}`)}</p>
        </fieldset>

        <RangeField
          label={t('tabular.setup.testRatio')}
          value={config.testRatio}
          min={0.1}
          max={0.5}
          step={0.05}
          onChange={(testRatio) => onChange({ ...config, testRatio })}
          format={(v) => `${Math.round(v * 100)}%`}
        />
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted">{t('tabular.setup.seed', { seed: config.seed })}</span>
          <button type="button" className="btn btn-ghost px-3 py-1 text-sm" onClick={() => onChange({ ...config, seed: config.seed + 1 })}>
            {t('tabular.setup.reshuffle')}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <fieldset>
          <legend className="text-sm font-medium">{t('tabular.setup.features')}</legend>
          <ul className="mt-1 space-y-1">
            {columns.filter((c) => c.name !== config.target).map((c) => (
              <li key={c.name}>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={config.features.includes(c.name)} onChange={() => onChange(toggleFeature(config, c.name))} />
                  {c.name}
                  <span className="font-mono text-[10px] text-muted">{t(`tabular.kinds.${c.kind}`)}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <section aria-labelledby="tabular-quality-title" className="lab-card p-4">
          <h3 id="tabular-quality-title" className="font-semibold">{t('tabular.quality.title')}</h3>
          {error ? (
            <p role="alert" className="mt-2 text-sm text-danger">{t(`tabular.prepareErrors.${error.code}`, error)}</p>
          ) : issues.length === 0 ? (
            <p className="mt-2 text-sm text-accent">{t('tabular.quality.none')}</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm" data-testid="tabular-issues">
              {issues.map((issue, i) => (
                <li key={i} className="border-l-4 border-warning pl-2">{t(`tabular.quality.${issue.kind}`, issue)}</li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
