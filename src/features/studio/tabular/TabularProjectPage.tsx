import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { parseCsv } from '@/core/tabular/csv';
import { summarizeColumns } from '@/core/tabular/columns';
import { evaluateTabular, trainTabular, type TrainedModel } from '@/core/tabular/models';
import { prepareData } from '@/core/tabular/prepare';
import { checkTabularQuality } from '@/core/tabular/quality';
import type { TabularConfig } from '@/storage/schemas/tabular';
import { getErrorMessage } from '@/ui/error-message';
import { tabularNotebook } from '@/core/export/tabular-notebook';
import { isTabularConfig } from '@/storage/repositories/table-repository';
import { ColabExportPanel } from '@/features/export/ColabExportPanel';
import { version as appVersion } from '../../../../package.json';
import { StudioStep as Step } from '../StudioStep';
import { DataSection } from './DataSection';
import { EvaluateSection } from './EvaluateSection';
import { ModelSection } from './ModelSection';
import { RepresentSection } from './RepresentSection';
import { SetupSection } from './SetupSection';
import { initialConfig, isConfigValid } from './tabular-config';
import { findTabularSample } from './tabular-samples';
import { UseSection } from './UseSection';
import { useTabularProject } from './useTabularProject';

interface TrainedState {
  readonly key: string;
  readonly model: TrainedModel;
  readonly count: number;
}

export function TabularProjectPage({ projectId }: { readonly projectId: string }) {
  const { t } = useTranslation();
  const { state, saveTable, saveConfig } = useTabularProject(projectId);
  const [trained, setTrained] = useState<TrainedState | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const table = state.status === 'ready' ? state.table : null;
  const parsed = useMemo(() => {
    if (!table) return null;
    const result = parseCsv(table.csv);
    return result.ok ? result.table : null;
  }, [table]);
  const columns = useMemo(() => (parsed ? summarizeColumns(parsed) : []), [parsed]);
  const storedConfig = table?.config ?? null;
  const tabularConfig = isTabularConfig(storedConfig) ? storedConfig : null;
  const savedConfig = tabularConfig && isConfigValid(tabularConfig, columns) ? tabularConfig : null;
  const config = useMemo(
    () => savedConfig ?? initialConfig(columns, findTabularSample(table?.sampleId ?? null)?.defaultTarget ?? null),
    [savedConfig, columns, table?.sampleId],
  );
  const prepared = useMemo(() => (parsed && config ? prepareData(parsed, columns, config) : null), [parsed, columns, config]);
  const data = prepared?.ok ? prepared.data : null;
  const issues = useMemo(() => (data && config ? checkTabularQuality(columns, config.features, data) : []), [data, columns, config]);

  // mô hình chỉ còn hợp lệ khi dữ liệu và cấu hình không đổi kể từ lần huấn luyện
  const trainKey = JSON.stringify([table?.updatedAt ?? null, config]);
  const current = trained && trained.key === trainKey ? trained.model : null;
  const evaluation = useMemo(() => (current && data ? evaluateTabular(current, data) : null), [current, data]);

  if (state.status === 'loading') return <p className="text-muted">{t('tabular.loading')}</p>;
  if (state.status === 'not-found') return <p role="alert">{t('project.notFound')}</p>;
  if (state.status === 'error') return <p role="alert" className="text-danger">{t('project.loadError')}</p>;

  const updateConfig = (next: TabularConfig) => {
    setSaveError(null);
    saveConfig(next).catch((err: unknown) => setSaveError(t('tabular.saveError', { message: getErrorMessage(err) })));
  };

  const train = () => {
    if (!data || !config) return;
    setTrained({ key: trainKey, model: trainTabular(data, config.model), count: (trained?.count ?? 0) + 1 });
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link to="/studio" className="text-sm text-primary hover:underline">{t('project.back')}</Link>
        <p className="font-mono text-xs uppercase text-accent">{t('studio.types.tabular')}</p>
        <h1 className="font-display text-4xl font-bold">{state.project.name}</h1>
        <p className="max-w-3xl text-muted">{t('tabular.lead')}</p>
        {saveError && <p role="alert" className="text-sm text-danger">{saveError}</p>}
      </header>

      <Step n={1} id="tab-step-data" title={t('tabular.steps.data')}>
        <DataSection table={table} parsed={parsed} columns={columns} onSave={async (input) => { await saveTable(input); setTrained(null); }} />
      </Step>

      {parsed && config && (
        <Step n={2} id="tab-step-check" title={t('tabular.steps.check')}>
          <SetupSection columns={columns} config={config} onChange={updateConfig} issues={issues} error={prepared && !prepared.ok ? prepared.error : null} />
        </Step>
      )}

      {data && config && (
        <>
          <Step n={3} id="tab-step-represent" title={t('tabular.steps.represent')}>
            <RepresentSection data={data} />
          </Step>
          <Step n={4} id="tab-step-train" title={t('tabular.steps.train')}>
            <ModelSection
              task={config.task}
              settings={config.model}
              onChange={(model) => updateConfig({ ...config, model })}
              onTrain={train}
              isStale={trained !== null && current === null}
              trainCount={trained?.count ?? 0}
            />
          </Step>
          {current && evaluation && (
            <>
              <Step n={5} id="tab-step-evaluate" title={t('tabular.steps.evaluate')}>
                <EvaluateSection evaluation={evaluation} trained={current} data={data} />
              </Step>
              <Step n={6} id="tab-step-use" title={t('tabular.steps.use')}>
                <UseSection key={trainKey} trained={current} data={data} />
                {parsed && (
                  <ColabExportPanel
                    projectName={state.project.name}
                    descriptionKey="export.colab.tabularDescription"
                    build={() =>
                      tabularNotebook({
                        projectName: state.project.name,
                        appVersion,
                        exportedAt: new Date().toLocaleString('vi'),
                        table: parsed,
                        data,
                        settings: config.model,
                        evaluation,
                      })
                    }
                  />
                )}
              </Step>
            </>
          )}
        </>
      )}
    </div>
  );
}
