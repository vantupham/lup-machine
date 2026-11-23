import { useTranslation } from 'react-i18next';
import { MODELS_BY_TASK } from '@/core/tabular/models';
import type { TaskKind } from '@/core/tabular/columns';
import type { TabularModelSettings } from '@/storage/schemas/tabular';
import { RangeField, SelectField } from '@/features/playground/controls';

/** Các mức C cho hồi quy logistic (thang log). */
export const C_LEVELS = [0.01, 0.1, 1, 10, 100] as const;

interface ModelSectionProps {
  readonly task: TaskKind;
  readonly settings: TabularModelSettings;
  readonly onChange: (settings: TabularModelSettings) => void;
  readonly onTrain: () => void;
  readonly isStale: boolean;
  readonly trainCount: number;
}

export function ModelSection({ task, settings, onChange, onTrain, isStale, trainCount }: ModelSectionProps) {
  const { t } = useTranslation();
  const cIndex = Math.max(0, C_LEVELS.findIndex((c) => c >= settings.c));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('tabular.model.choose')}</legend>
        {MODELS_BY_TASK[task].map((kind) => (
          <label key={kind} className={`flex cursor-pointer gap-3 rounded border p-3 ${settings.kind === kind ? 'border-primary bg-surface' : 'border-rule'}`}>
            <input type="radio" name="tabular-model" checked={settings.kind === kind} onChange={() => onChange({ ...settings, kind })} className="mt-1" />
            <span>
              <span className="block font-semibold">{t(`tabular.models.${kind}.name`)}</span>
              <span className="block text-sm text-muted">{t(`tabular.models.${kind}.how`)}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="lab-card space-y-4 p-4">
        {settings.kind === 'tree' && (
          <>
            <RangeField label={t('playground.tree.maxDepth')} value={settings.maxDepth} min={1} max={10} onChange={(maxDepth) => onChange({ ...settings, maxDepth })} />
            <SelectField
              label={t('playground.tree.criterion')}
              value={settings.criterion}
              onChange={(criterion) => onChange({ ...settings, criterion })}
              options={[
                { value: 'gini', label: t('playground.tree.gini') },
                { value: 'entropy', label: t('playground.tree.entropy') },
              ]}
            />
          </>
        )}
        {settings.kind === 'logistic' && (
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
        {(settings.kind === 'knn' || settings.kind === 'knn-regression') && (
          <RangeField label={t('playground.knn.k')} value={settings.k} min={1} max={25} onChange={(k) => onChange({ ...settings, k })} hint={t('tabular.model.kHint')} />
        )}
        {settings.kind === 'linear' && <p className="text-sm text-muted">{t('tabular.model.linearNoSettings')}</p>}

        <button type="button" className="btn btn-primary" onClick={onTrain}>{t('tabular.model.train')}</button>
        <p className="text-xs text-muted" role="status">
          {trainCount === 0 ? t('tabular.model.notTrained') : isStale ? t('tabular.model.stale') : t('tabular.model.trained', { n: trainCount })}
        </p>
      </div>
    </div>
  );
}
