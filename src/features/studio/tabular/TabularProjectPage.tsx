import { useMemo, useState } from 'react';
import { ModelCardLink } from '@/features/model-card/ModelCardLink';
import { NotebookProvider } from '@/features/notebook/NotebookContext';
import { NotebookPrintLink } from '@/features/notebook/NotebookPrintLink';
import { ProjectTitle } from '@/features/studio/ProjectTitle';
import { AssignmentBanner } from '@/features/classroom/AssignmentBanner';
import { useTranslation } from 'react-i18next';
import { parseCsv } from '@/core/tabular/csv';
import { summarizeColumns } from '@/core/tabular/columns';
import { prepareData } from '@/core/tabular/prepare';
import { checkTabularQuality } from '@/core/tabular/quality';
import type { TabularConfig } from '@/storage/schemas/tabular';
import { getErrorMessage } from '@/ui/error-message';
import { tabularNotebook } from '@/core/export/tabular-notebook';
import { isTabularConfig } from '@/storage/repositories/table-repository';
import { ColabExportPanel } from '@/features/export/ColabExportPanel';
import { version as appVersion } from '../../../../package.json';
import { StudioStep as Step } from '../StudioStep';
import { StepBar, studioStepTargets } from '../StepBar';
import { DataSection } from './DataSection';
import { EvaluateSection } from './EvaluateSection';
import { ModelSection } from './ModelSection';
import { RepresentSection } from './RepresentSection';
import { ScaleCode } from './TabularCodePanels';
import { SetupSection } from './SetupSection';
import { initialConfig, isConfigValid } from './tabular-config';
import { findTabularSample, type TabularSampleId } from './tabular-samples';
import { UseSection } from './UseSection';
import { useTabularProject } from './useTabularProject';
import { BackLink } from '@/ui/BackLink';
import { TrialBefore } from '@/features/trials/TrialBefore';
import { TrialAfter } from '@/features/trials/TrialAfter';
import { StudioFindings } from '@/features/trials/StudioFindings';
import { RegressionFindings } from '@/features/trials/RegressionFindings';
import { predictRow } from '@/core/tabular/models';
import { useModeSwitch } from '@/ui/mode-store';
import { StepDetails } from '../StepDetails';
import { useTabularModel } from './useTabularModel';
import { TabularQuickWorkspace } from './quick/TabularQuickWorkspace';

/** Id tiêu đề 6 bước trên trang, cho thanh các bước. */
const STEP_TARGETS = studioStepTargets('tab');

export function TabularProjectPage({ projectId }: { readonly projectId: string }) {
  const { t } = useTranslation();
  const { state, saveTable, saveConfig, renameProject } = useTabularProject(projectId);
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

  const model = useTabularModel(projectId, table, config, data);
  const { current, evaluation, trialLog, trialSetup, canGuess, key: trainKey } = model;
  useModeSwitch();

  if (state.status === 'loading') return <p className="text-muted">{t('tabular.loading')}</p>;
  if (state.status === 'not-found') return <p role="alert">{t('project.notFound')}</p>;
  if (state.status === 'error') return <p role="alert" className="text-danger">{t('project.loadError')}</p>;

  const updateConfig = (next: TabularConfig) => {
    setSaveError(null);
    saveConfig(next).catch((err: unknown) => setSaveError(t('tabular.saveError', { message: getErrorMessage(err) })));
  };

  const replaceTable = async (csv: string, fileName: string, sampleId: TabularSampleId | null) => {
    await saveTable({ csv, fileName, sampleId });
    model.reset();
  };

  /** Khối làm nhanh sửa bảng (đổi tên lớp): lưu bảng mới rồi giữ cài đặt cũ nếu các cột vẫn còn. */
  const editTable = async (csv: string) => {
    await saveTable({ csv, fileName: table?.fileName ?? '', sampleId: table?.sampleId ?? null });
    const next = parseCsv(csv);
    if (config && next.ok && isConfigValid(config, summarizeColumns(next.table))) await saveConfig(config);
  };

  const loadSample = async (id: TabularSampleId) => {
    const sample = findTabularSample(id);
    return sample ? { csv: await sample.load(), fileName: sample.fileName } : null;
  };

  return (
    <NotebookProvider projectId={projectId} projectType="tabular">
    <div className="space-y-8">
      <header className="space-y-2">
        <BackLink to="/studio">{t('project.back')}</BackLink>
        <p className="text-sm text-muted">{t('studio.types.tabular')}</p>
        <ProjectTitle projectId={projectId} name={state.project.name} onRenamed={renameProject} />
        <AssignmentBanner projectId={projectId} />
        <div className="flex flex-wrap gap-2">
          <ModelCardLink projectId={projectId} />
          <NotebookPrintLink projectId={projectId} />
        </div>
        <p className="max-w-3xl text-muted">{t('tabular.lead')}</p>
        {saveError && <p role="alert" className="text-sm text-danger">{saveError}</p>}
      </header>

      <StepBar targets={STEP_TARGETS} />

      <StepDetails
        quick={
          <TabularQuickWorkspace
            fileName={table?.fileName ?? null}
            parsed={parsed}
            columns={columns}
            config={config}
            data={data}
            prepareError={prepared && !prepared.ok ? prepared.error : null}
            model={model}
            onConfigChange={updateConfig}
            onReplace={replaceTable}
            onEdit={editTable}
            loadSample={loadSample}
          />
        }
      >

      <Step n={1} id="tab-step-data" notebook="data" title={t('tabular.steps.data')} done={state.table !== null}>
        <DataSection table={table} parsed={parsed} columns={columns} onSave={async (input) => { await saveTable(input); model.reset(); }} />
      </Step>

      {parsed && config && (
        <Step n={2} id="tab-step-check" notebook="check" title={t('tabular.steps.check')}>
          <SetupSection columns={columns} config={config} onChange={updateConfig} issues={issues} error={prepared && !prepared.ok ? prepared.error : null} />
        </Step>
      )}

      {data && config && (
        <>
          <Step n={3} id="tab-step-represent" notebook="represent" title={t('tabular.steps.represent')}>
            <RepresentSection data={data} />
            <ScaleCode data={data} />
          </Step>
          <Step n={4} id="tab-step-train" notebook="train" title={t('tabular.steps.train')} done={current !== null}>
            {trialSetup && current === null && <TrialBefore log={trialLog} current={trialSetup} canGuess={canGuess} />}
            <ModelSection
              task={config.task}
              settings={config.model}
              onChange={(model) => updateConfig({ ...config, model })}
              onTrain={model.train}
              isStale={model.trained !== null && current === null}
              trainCount={model.trained?.count ?? 0}
            />
            <TrialAfter log={trialLog} isCurrent={current !== null} />
          </Step>
          {current && evaluation && (
            <>
              <Step n={5} id="tab-step-evaluate" notebook="evaluate" title={t('tabular.steps.evaluate')}>
                <EvaluateSection evaluation={evaluation} trained={current} data={data} />
                {evaluation.task === 'classification' ? (
                  <StudioFindings
                    classNames={data.classNames}
                    dataStepId="tab-step-data"
                    samples={data.test.y.map((actual, i) => {
                      const proba = predictRow(current, { raw: data.test.raw[i] as number[], scaled: data.test.scaled[i] as number[] }).proba ?? [];
                      const predicted = evaluation.testPredictions[i] as number;
                      const row = data.test.rowNumbers[i] as number;
                      return { id: `row-${row}`, actual, predicted, confidence: proba[predicted] ?? 0, evidence: <span className="font-mono">{t('sampleFindings.row', { row })}</span> };
                    })}
                  />
                ) : (
                  <RegressionFindings
                    target={config.target}
                    rows={data.test.y.map((actual, i) => ({ rowNumber: data.test.rowNumbers[i] as number, actual, predicted: evaluation.testPredictions[i] as number }))}
                  />
                )}
              </Step>
              <Step n={6} id="tab-step-use" notebook="use" title={t('tabular.steps.use')}>
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
      </StepDetails>
    </div>
    </NotebookProvider>
  );
}
