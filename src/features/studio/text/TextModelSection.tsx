import { useTranslation } from 'react-i18next';
import { RangeField } from '@/features/playground/controls';
import type { TextConfig } from '@/storage/schemas/text';
import { C_LEVELS } from '../tabular/ModelSection';

/** Các mức làm trơn α của Naive Bayes. */
export const ALPHA_LEVELS = [0.01, 0.1, 0.5, 1, 2, 5] as const;

interface TextModelSectionProps {
  readonly settings: TextConfig['model'];
  readonly onChange: (settings: TextConfig['model']) => void;
  readonly onTrain: () => void;
  readonly isStale: boolean;
  readonly trainCount: number;
}

export function TextModelSection({ settings, onChange, onTrain, isStale, trainCount }: TextModelSectionProps) {
  const { t } = useTranslation();
  const alphaIndex = Math.max(0, ALPHA_LEVELS.findIndex((a) => a >= settings.alpha));
  const cIndex = Math.max(0, C_LEVELS.findIndex((c) => c >= settings.c));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('tabular.model.choose')}</legend>
        {(['naive-bayes', 'logistic'] as const).map((kind) => (
          <label key={kind} className={`flex cursor-pointer gap-3 rounded border p-3 ${settings.kind === kind ? 'border-primary bg-surface' : 'border-rule'}`}>
            <input type="radio" name="text-model" checked={settings.kind === kind} onChange={() => onChange({ ...settings, kind })} className="mt-1" />
            <span>
              <span className="block font-semibold">{t(`text.models.${kind}.name`)}</span>
              <span className="block text-sm text-muted">{t(`text.models.${kind}.how`)}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="lab-card space-y-4 p-4">
        {settings.kind === 'naive-bayes' ? (
          <RangeField
            label={t('text.model.alpha')}
            value={alphaIndex}
            min={0}
            max={ALPHA_LEVELS.length - 1}
            onChange={(i) => onChange({ ...settings, alpha: ALPHA_LEVELS[i] as number })}
            format={(i) => String(ALPHA_LEVELS[i])}
            hint={t('text.model.alphaHint')}
          />
        ) : (
          <RangeField
            label={t('tabular.model.c')}
            value={cIndex}
            min={0}
            max={C_LEVELS.length - 1}
            onChange={(i) => onChange({ ...settings, c: C_LEVELS[i] as number })}
            format={(i) => String(C_LEVELS[i])}
            hint={t('tabular.model.cHint')}
          />
        )}
        <button type="button" className="btn btn-primary" onClick={onTrain}>{t('tabular.model.train')}</button>
        <p className="text-xs text-muted" role="status">
          {trainCount === 0 ? t('tabular.model.notTrained') : isStale ? t('tabular.model.stale') : t('tabular.model.trained', { n: trainCount })}
        </p>
      </div>
    </div>
  );
}
