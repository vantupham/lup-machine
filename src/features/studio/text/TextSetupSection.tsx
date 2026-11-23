import { useTranslation } from 'react-i18next';
import type { TextPrepareError } from '@/core/text/text-model';
import type { TextIssue } from '@/core/text/text-quality';
import { RangeField, SelectField } from '@/features/playground/controls';
import type { TextConfig } from '@/storage/schemas/text';

interface TextSetupSectionProps {
  readonly headers: readonly string[];
  readonly config: TextConfig;
  readonly onChange: (config: TextConfig) => void;
  readonly issues: readonly TextIssue[];
  readonly error: TextPrepareError | null;
}

export function TextSetupSection({ headers, config, onChange, issues, error }: TextSetupSectionProps) {
  const { t } = useTranslation();
  const options = headers.map((h) => ({ value: h, label: h }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        {headers.length > 2 && (
          <div className="grid grid-cols-2 gap-3">
            <SelectField label={t('text.setup.textColumn')} value={config.textColumn} options={options} onChange={(textColumn) => onChange({ ...config, textColumn })} />
            <SelectField label={t('text.setup.labelColumn')} value={config.labelColumn} options={options} onChange={(labelColumn) => onChange({ ...config, labelColumn })} />
          </div>
        )}
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
      <section aria-labelledby="text-quality-title" className="lab-card p-4">
        <h3 id="text-quality-title" className="font-semibold">{t('tabular.quality.title')}</h3>
        {error && <p role="alert" className="mt-2 text-sm text-danger">{t(`text.prepareErrors.${error.code}`, error)}</p>}
        {!error && issues.length === 0 && <p className="mt-2 text-sm text-accent">{t('tabular.quality.none')}</p>}
        {issues.length > 0 && (
          <ul className="mt-2 space-y-2 text-sm" data-testid="text-issues">
            {issues.map((issue, i) => (
              <li key={i} className="border-l-4 border-warning pl-2">{t(`text.quality.${issue.kind}`, issue)}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
