import { useMemo, useState } from 'react';
import { ModelCardLink } from '@/features/model-card/ModelCardLink';
import { NotebookProvider } from '@/features/notebook/NotebookContext';
import { NotebookPrintLink } from '@/features/notebook/NotebookPrintLink';
import { ProjectTitle } from '@/features/studio/ProjectTitle';
import { AssignmentBanner } from '@/features/classroom/AssignmentBanner';
import { useTranslation } from 'react-i18next';
import { prepareVectors } from '@/core/ml/vector-classifier';
import { poseFeatures, unpackKeypoints } from '@/core/pose/features';
import { checkPoseQuality } from '@/core/pose/pose-quality';
import { RangeField } from '@/features/playground/controls';
import { StudioStep as Step } from '../StudioStep';
import { StepBar, studioStepTargets } from '../StepBar';
import { PoseDataSection } from './PoseDataSection';
import { PoseInspector } from './PoseInspector';
import { PoseModelLab } from './PoseModelLab';
import { usePoseProject } from './usePoseProject';
import { BackLink } from '@/ui/BackLink';
import { datasetFingerprint } from '@/core/data/fingerprint';

/** Id tiêu đề 6 bước trên trang, cho thanh các bước. */
const STEP_TARGETS = studioStepTargets('pose');

export function PoseProjectPage({ projectId }: { readonly projectId: string }) {
  const { t } = useTranslation();
  const { state, reload, dataset, poses, kind, setKind, kindLocked } = usePoseProject(projectId);
  const [testRatio, setTestRatio] = useState(0.2);
  const [seed, setSeed] = useState(1);

  const classes = state.status === 'ready' ? state.classes : null;
  const samples = useMemo(
    () => (state.status === 'ready' ? state.poses.filter((p) => p.kind === kind && state.classes.some((c) => c.id === p.classId)) : []),
    [state, kind],
  );
  const issues = useMemo(
    () => (classes ? checkPoseQuality(kind, samples.map((p) => ({ label: classes.find((c) => c.id === p.classId)?.name ?? '', keypoints: unpackKeypoints(p.keypoints) })), classes.map((c) => c.name)) : []),
    [classes, samples, kind],
  );
  const prepared = useMemo(() => {
    if (!classes) return null;
    const withFeatures = samples.flatMap((p) => {
      const f = poseFeatures(kind, unpackKeypoints(p.keypoints));
      return f ? [{ sample: p, features: f }] : [];
    });
    const used = classes.filter((c) => withFeatures.some((s) => s.sample.classId === c.id));
    const examples = withFeatures.map(({ sample, features }) => ({ id: sample.id, label: used.findIndex((c) => c.id === sample.classId), features }));
    return prepareVectors(examples, used.map((c) => c.name), { testRatio, seed });
  }, [classes, samples, kind, testRatio, seed]);

  if (state.status === 'loading') return <p className="text-muted">{t('tabular.loading')}</p>;
  if (state.status === 'not-found') return <p role="alert">{t('project.notFound')}</p>;
  if (state.status === 'error') return <p role="alert" className="text-danger">{t('project.loadError')}</p>;

  const data = prepared?.ok ? prepared.data : null;
  const dataKey = JSON.stringify([kind, samples.map((p) => `${p.id}:${p.classId}`), state.classes.map((c) => c.name), testRatio, seed]);

  return (
    <NotebookProvider projectId={projectId} projectType="pose">
    <div className="space-y-8">
      <header className="space-y-2">
        <BackLink to="/studio">{t('project.back')}</BackLink>
        <p className="text-sm text-muted">{t('studio.types.pose')}</p>
        <ProjectTitle projectId={projectId} name={state.project.name} onRenamed={() => void reload()} />
        <AssignmentBanner projectId={projectId} />
        <div className="flex flex-wrap gap-2">
          <ModelCardLink projectId={projectId} />
          <NotebookPrintLink projectId={projectId} />
        </div>
        <p className="max-w-3xl text-muted">{t('pose.lead')}</p>
      </header>

      <StepBar targets={STEP_TARGETS} />

      <Step n={1} id="pose-step-data" notebook="data" title={t('pose.steps.data')} done={new Set(samples.map((p) => p.classId)).size >= 2}>
        <PoseDataSection projectId={projectId} kind={kind} kindLocked={kindLocked} onKindChange={setKind} classes={state.classes} poses={samples} dataset={dataset} repo={poses} onChanged={reload} />
      </Step>

      {samples.length > 0 && (
        <Step n={2} id="pose-step-check" notebook="check" title={t('pose.steps.check')}>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <RangeField label={t('tabular.setup.testRatio')} value={testRatio} min={0.1} max={0.5} step={0.05} onChange={setTestRatio} format={(v) => `${Math.round(v * 100)}%`} />
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted">{t('tabular.setup.seed', { seed })}</span>
                <button type="button" className="btn btn-ghost px-3 py-1 text-sm" onClick={() => setSeed(seed + 1)}>{t('tabular.setup.reshuffle')}</button>
              </div>
            </div>
            <section aria-labelledby="pose-quality-title" className="lab-card p-4">
              <h3 id="pose-quality-title" className="font-semibold">{t('tabular.quality.title')}</h3>
              {prepared && !prepared.ok && <p role="alert" className="mt-2 text-sm text-danger">{t(`pose.prepareErrors.${prepared.error.code}`, prepared.error)}</p>}
              {issues.length === 0 && prepared?.ok && <p className="mt-2 text-sm text-accent">{t('tabular.quality.none')}</p>}
              {issues.length > 0 && (
                <ul className="mt-2 space-y-2 text-sm" data-testid="pose-issues">
                  {issues.map((issue, i) => <li key={i} className="border-l-4 border-warning pl-2">{t(`pose.quality.${issue.kind}`, issue)}</li>)}
                </ul>
              )}
            </section>
          </div>
        </Step>
      )}

      {samples.length > 0 && (
        <Step n={3} id="pose-step-represent" notebook="represent" title={t('pose.steps.represent')}>
          <PoseInspector kind={kind} classes={state.classes} poses={samples} />
        </Step>
      )}

      {data && (
        <PoseModelLab
          kind={kind}
          projectId={projectId}
          projectName={state.project.name}
          trialBase={{
            split: { testRatio, seed },
            data: {
              fingerprint: datasetFingerprint(state.classes.map((c) => c.id), samples.map((p) => ({ id: p.id, classId: p.classId, split: '' }))),
              train: data.train.ys.length,
              test: data.test.ys.length,
              classNames: data.classNames,
            },
          }}
          data={data}
          dataKey={dataKey}
          sampleOf={(id) => {
            const sample = samples.find((p) => p.id === id);
            return sample ? { keypoints: unpackKeypoints(sample.keypoints), width: sample.width, height: sample.height } : null;
          }}
        />
      )}
    </div>
    </NotebookProvider>
  );
}
