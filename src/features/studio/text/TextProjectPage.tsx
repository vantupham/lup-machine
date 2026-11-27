import { useMemo, useState } from 'react';
import { TextGrowth } from '@/features/studio/growth/StudioGrowth';
import { ModelCardLink } from '@/features/model-card/ModelCardLink';
import { NotebookProvider } from '@/features/notebook/NotebookContext';
import { NotebookPrintLink } from '@/features/notebook/NotebookPrintLink';
import { ProjectTitle } from '@/features/studio/ProjectTitle';
import { AssignmentBanner } from '@/features/classroom/AssignmentBanner';
import { useTranslation } from 'react-i18next';
import { textNotebook } from '@/core/export/text-notebook';
import { parseCsv } from '@/core/tabular/csv';
import { prepareText } from '@/core/text/text-model';
import { checkTextQuality } from '@/core/text/text-quality';
import { ColabExportPanel } from '@/features/export/ColabExportPanel';
import { isTextConfig } from '@/storage/repositories/table-repository';
import type { TextConfig } from '@/storage/schemas/text';
import { getErrorMessage } from '@/ui/error-message';
import { version as appVersion } from '../../../../package.json';
import { StudioStep as Step } from '../StudioStep';
import { StepBar, studioStepTargets } from '../StepBar';
import { useTabularProject } from '../tabular/useTabularProject';
import { examplesFrom, initialTextConfig, isTextConfigValid } from './text-config';
import { TextDataSection } from './TextDataSection';
import { TextEvaluateSection } from './TextEvaluateSection';
import { TextModelSection } from './TextModelSection';
import { NaiveBayesCode } from './TextCodePanels';
import { TextRepresentSection } from './TextRepresentSection';
import { TextSetupSection } from './TextSetupSection';
import { TextUseSection } from './TextUseSection';
import { BackLink } from '@/ui/BackLink';
import { TrialBefore } from '@/features/trials/TrialBefore';
import { TrialAfter } from '@/features/trials/TrialAfter';
import { StudioFindings } from '@/features/trials/StudioFindings';
import { encodeText, predictProbaText } from '@/core/text/text-model';
import { useModeSwitch } from '@/ui/mode-store';
import { StepDetails } from '../StepDetails';
import { findTextSample, type TextSampleId } from './text-samples';
import { useTextModel } from './useTextModel';
import { TextQuickWorkspace } from './quick/TextQuickWorkspace';

/** Id tiêu đề 6 bước trên trang, cho thanh các bước. */
const STEP_TARGETS = studioStepTargets('text');

export function TextProjectPage({ projectId }: { readonly projectId: string }) {
  const { t } = useTranslation();
  const { state, saveTable, saveConfig, renameProject } = useTabularProject(projectId);
  const [saveError, setSaveError] = useState<string | null>(null);

  const table = state.status === 'ready' ? state.table : null;
  const parsed = useMemo(() => {
    if (!table) return null;
    const result = parseCsv(table.csv);
    return result.ok ? result.table : null;
  }, [table]);
  const stored = table?.config ?? null;
  const config = useMemo(() => {
    if (!parsed) return null;
    return isTextConfig(stored) && isTextConfigValid(stored, parsed) ? stored : initialTextConfig(parsed);
  }, [parsed, stored]);
  const examples = useMemo(() => (parsed && config ? examplesFrom(parsed, config) : []), [parsed, config]);
  const prepared = useMemo(
    () => (config && examples.length > 0 ? prepareText(examples, { testRatio: config.testRatio, seed: config.seed, maxN: config.maxN }) : null),
    [examples, config],
  );
  const data = prepared?.ok ? prepared.data : null;
  const issues = useMemo(() => checkTextQuality(examples), [examples]);

  const model = useTextModel(projectId, table, config, data);
  const { current, evaluation, trialLog, trialSetup, canGuess, key: trainKey } = model;
  useModeSwitch();

  if (state.status === 'loading') return <p className="text-muted">{t('tabular.loading')}</p>;
  if (state.status === 'not-found') return <p role="alert">{t('project.notFound')}</p>;
  if (state.status === 'error') return <p role="alert" className="text-danger">{t('project.loadError')}</p>;

  const updateConfig = (next: TextConfig) => {
    setSaveError(null);
    saveConfig(next).catch((err: unknown) => setSaveError(t('tabular.saveError', { message: getErrorMessage(err) })));
  };

  /** Khối làm nhanh sửa bảng câu: lưu bảng mới rồi giữ cài đặt cũ (mô hình, cách chia) nếu các cột vẫn còn. */
  const saveCsvKeepConfig = async (csv: string) => {
    await saveTable({ csv, fileName: table?.fileName ?? t('text.editor.fileName'), sampleId: null });
    const next = parseCsv(csv);
    if (config && next.ok && isTextConfigValid(config, next.table)) await saveConfig(config);
  };

  const loadSample = async (id: TextSampleId) => {
    const sample = findTextSample(id);
    if (!sample) return;
    await saveTable({ csv: await sample.load(), fileName: sample.fileName, sampleId: sample.id });
    model.reset();
  };

  return (
    <NotebookProvider projectId={projectId} projectType="text">
    <div className="space-y-8">
      <header className="space-y-2">
        <BackLink to="/studio">{t('project.back')}</BackLink>
        <p className="text-sm text-muted">{t('studio.types.text')}</p>
        <ProjectTitle projectId={projectId} name={state.project.name} onRenamed={renameProject} />
        <AssignmentBanner projectId={projectId} />
        <div className="flex flex-wrap gap-2">
          <ModelCardLink projectId={projectId} />
          <NotebookPrintLink projectId={projectId} />
        </div>
        <p className="max-w-3xl text-muted">{t('text.lead')}</p>
        {saveError && <p role="alert" className="text-sm text-danger">{saveError}</p>}
      </header>

      <StepBar targets={STEP_TARGETS} />

      <StepDetails
        quick={
          <TextQuickWorkspace
            parsed={parsed}
            config={config}
            examples={examples}
            data={data}
            prepareError={prepared && !prepared.ok ? prepared.error : null}
            model={model}
            onSaveCsv={saveCsvKeepConfig}
            onLoadSample={loadSample}
          />
        }
      >

      <Step n={1} id="text-step-data" notebook="data" title={t('text.steps.data')} done={state.table !== null}>
        <TextDataSection
          hasTable={parsed !== null}
          fileName={table?.fileName ?? null}
          examples={examples}
          onSave={async (input) => {
            await saveTable(input);
            model.reset();
          }}
        />
      </Step>

      {parsed && config && (
        <Step n={2} id="text-step-check" notebook="check" title={t('text.steps.check')}>
          <TextSetupSection headers={parsed.headers} config={config} onChange={updateConfig} issues={issues} error={prepared && !prepared.ok ? prepared.error : null} />
        </Step>
      )}

      {data && config && (
        <>
          <Step n={3} id="text-step-represent" notebook="represent" title={t('text.steps.represent')}>
            <TextRepresentSection data={data} maxN={config.maxN} onMaxNChange={(maxN) => updateConfig({ ...config, maxN })} />
          </Step>
          <Step n={4} id="text-step-train" notebook="train" title={t('text.steps.train')} done={current !== null}>
            {trialSetup && current === null && <TrialBefore log={trialLog} current={trialSetup} canGuess={canGuess} />}
            <TextModelSection
              settings={config.model}
              onChange={(model) => updateConfig({ ...config, model })}
              onTrain={model.train}
              isStale={model.trained !== null && current === null}
              trainCount={model.trained?.count ?? 0}
            />
            <TrialAfter log={trialLog} isCurrent={current !== null} />
            <NaiveBayesCode data={data} trained={current} />
            <TextGrowth trained={current} data={data} c={config.model.c} />
          </Step>
          {current && evaluation && (
            <>
              <Step n={5} id="text-step-evaluate" notebook="evaluate" title={t('text.steps.evaluate')}>
                <TextEvaluateSection evaluation={evaluation} trained={current} data={data} />
                <StudioFindings
                  classNames={data.classNames}
                  dataStepId="text-step-data"
                  samples={data.test.texts.map((text, i) => {
                    const proba = predictProbaText(current, encodeText(data, text));
                    const predicted = evaluation.testPredictions[i] as number;
                    return { id: `row-${data.test.rowNumbers[i]}`, actual: data.test.y[i] as number, predicted, confidence: proba[predicted] ?? 0, evidence: <q>{text}</q> };
                  })}
                />
              </Step>
              <Step n={6} id="text-step-use" notebook="use" title={t('text.steps.use')}>
                <TextUseSection key={trainKey} trained={current} data={data} />
                <ColabExportPanel
                  projectName={state.project.name}
                  descriptionKey="export.colab.textDescription"
                  build={() =>
                    textNotebook({
                      projectName: state.project.name,
                      appVersion,
                      exportedAt: new Date().toLocaleString('vi'),
                      data,
                      settings: config.model,
                      evaluation,
                    })
                  }
                />
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
