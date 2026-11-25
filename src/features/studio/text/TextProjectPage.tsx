import { useMemo, useState } from 'react';
import { ModelCardLink } from '@/features/model-card/ModelCardLink';
import { ProjectTitle } from '@/features/studio/ProjectTitle';
import { AssignmentBanner } from '@/features/classroom/AssignmentBanner';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { textNotebook } from '@/core/export/text-notebook';
import { parseCsv } from '@/core/tabular/csv';
import { evaluateText, prepareText, trainText, type TrainedText } from '@/core/text/text-model';
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
import { TextRepresentSection } from './TextRepresentSection';
import { TextSetupSection } from './TextSetupSection';
import { TextUseSection } from './TextUseSection';

interface TrainedState {
  readonly key: string;
  readonly model: TrainedText;
  readonly count: number;
}

/** Id tiêu đề 6 bước trên trang, cho thanh các bước. */
const STEP_TARGETS = studioStepTargets('text');

export function TextProjectPage({ projectId }: { readonly projectId: string }) {
  const { t } = useTranslation();
  const { state, saveTable, saveConfig, renameProject } = useTabularProject(projectId);
  const [trained, setTrained] = useState<TrainedState | null>(null);
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

  const trainKey = JSON.stringify([table?.updatedAt ?? null, config]);
  const current = trained && trained.key === trainKey ? trained.model : null;
  const evaluation = useMemo(() => (current && data ? evaluateText(current, data) : null), [current, data]);

  if (state.status === 'loading') return <p className="text-muted">{t('tabular.loading')}</p>;
  if (state.status === 'not-found') return <p role="alert">{t('project.notFound')}</p>;
  if (state.status === 'error') return <p role="alert" className="text-danger">{t('project.loadError')}</p>;

  const updateConfig = (next: TextConfig) => {
    setSaveError(null);
    saveConfig(next).catch((err: unknown) => setSaveError(t('tabular.saveError', { message: getErrorMessage(err) })));
  };

  const train = () => {
    if (!data || !config) return;
    setTrained({ key: trainKey, model: trainText(data, config.model), count: (trained?.count ?? 0) + 1 });
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link to="/studio" className="text-sm text-primary hover:underline">{t('project.back')}</Link>
        <p className="font-mono text-xs uppercase text-accent">{t('studio.types.text')}</p>
        <ProjectTitle projectId={projectId} name={state.project.name} onRenamed={renameProject} />
        <AssignmentBanner projectId={projectId} />
        <ModelCardLink projectId={projectId} />
        <p className="max-w-3xl text-muted">{t('text.lead')}</p>
        {saveError && <p role="alert" className="text-sm text-danger">{saveError}</p>}
      </header>

      <StepBar targets={STEP_TARGETS} />

      <Step n={1} id="text-step-data" title={t('text.steps.data')} done={state.table !== null}>
        <TextDataSection
          hasTable={parsed !== null}
          fileName={table?.fileName ?? null}
          examples={examples}
          onSave={async (input) => {
            await saveTable(input);
            setTrained(null);
          }}
        />
      </Step>

      {parsed && config && (
        <Step n={2} id="text-step-check" title={t('text.steps.check')}>
          <TextSetupSection headers={parsed.headers} config={config} onChange={updateConfig} issues={issues} error={prepared && !prepared.ok ? prepared.error : null} />
        </Step>
      )}

      {data && config && (
        <>
          <Step n={3} id="text-step-represent" title={t('text.steps.represent')}>
            <TextRepresentSection data={data} maxN={config.maxN} onMaxNChange={(maxN) => updateConfig({ ...config, maxN })} />
          </Step>
          <Step n={4} id="text-step-train" title={t('text.steps.train')} done={current !== null}>
            <TextModelSection
              settings={config.model}
              onChange={(model) => updateConfig({ ...config, model })}
              onTrain={train}
              isStale={trained !== null && current === null}
              trainCount={trained?.count ?? 0}
            />
          </Step>
          {current && evaluation && (
            <>
              <Step n={5} id="text-step-evaluate" title={t('text.steps.evaluate')}>
                <TextEvaluateSection evaluation={evaluation} trained={current} data={data} />
              </Step>
              <Step n={6} id="text-step-use" title={t('text.steps.use')}>
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
    </div>
  );
}
