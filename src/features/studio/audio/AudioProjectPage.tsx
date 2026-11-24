import { useMemo, useState } from 'react';
import { ModelCardLink } from '@/features/model-card/ModelCardLink';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { prepareVectors } from '@/core/ml/vector-classifier';
import { checkAudioQuality, peakAmplitude } from '@/core/audio/audio-quality';
import { RangeField } from '@/features/playground/controls';
import { clipSamples } from '@/storage/repositories/audio-repository';
import { StudioStep as Step } from '../StudioStep';
import { AudioDataSection } from './AudioDataSection';
import { AudioInspector } from './AudioInspector';
import { AudioModelLab } from './AudioModelLab';
import { useAudioProject } from './useAudioProject';

export function AudioProjectPage({ projectId }: { readonly projectId: string }) {
  const { t } = useTranslation();
  const { state, reload, features, dataset, audio } = useAudioProject(projectId);
  const [testRatio, setTestRatio] = useState(0.2);
  const [seed, setSeed] = useState(1);

  const classes = state.status === 'ready' ? state.classes : null;
  const clips = state.status === 'ready' ? state.clips : null;
  const usable = useMemo(() => (clips && classes ? clips.filter((c) => classes.some((k) => k.id === c.classId)) : []), [clips, classes]);
  const issues = useMemo(
    () => (classes ? checkAudioQuality(usable.map((c) => ({ label: classes.find((k) => k.id === c.classId)?.name ?? '', peak: peakAmplitude(clipSamples(c)) })), classes.map((c) => c.name)) : []),
    [usable, classes],
  );
  const prepared = useMemo(() => {
    if (!classes) return null;
    const used = classes.filter((c) => usable.some((clip) => clip.classId === c.id));
    const examples = usable.map((clip) => ({ id: clip.id, label: used.findIndex((c) => c.id === clip.classId), features: features.get(clip.id) as Float32Array }));
    return prepareVectors(examples, used.map((c) => c.name), { testRatio, seed });
  }, [classes, usable, features, testRatio, seed]);

  if (state.status === 'loading') return <p className="text-muted">{t('tabular.loading')}</p>;
  if (state.status === 'not-found') return <p role="alert">{t('project.notFound')}</p>;
  if (state.status === 'error') return <p role="alert" className="text-danger">{t('project.loadError')}</p>;

  const data = prepared?.ok ? prepared.data : null;
  const dataKey = JSON.stringify([usable.map((c) => `${c.id}:${c.classId}`), state.classes.map((c) => c.name), testRatio, seed]);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link to="/studio" className="text-sm text-primary hover:underline">{t('project.back')}</Link>
        <p className="font-mono text-xs uppercase text-accent">{t('studio.types.audio')}</p>
        <h1 className="font-display text-4xl font-bold">{state.project.name}</h1>
        <ModelCardLink projectId={projectId} />
        <p className="max-w-3xl text-muted">{t('audio.lead')}</p>
      </header>

      <Step n={1} id="audio-step-data" title={t('audio.steps.data')}>
        <AudioDataSection projectId={projectId} classes={state.classes} clips={state.clips} dataset={dataset} audio={audio} onChanged={reload} />
      </Step>

      {state.clips.length > 0 && (
        <Step n={2} id="audio-step-check" title={t('audio.steps.check')}>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <RangeField label={t('tabular.setup.testRatio')} value={testRatio} min={0.1} max={0.5} step={0.05} onChange={setTestRatio} format={(v) => `${Math.round(v * 100)}%`} />
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted">{t('tabular.setup.seed', { seed })}</span>
                <button type="button" className="btn btn-ghost px-3 py-1 text-sm" onClick={() => setSeed(seed + 1)}>{t('tabular.setup.reshuffle')}</button>
              </div>
            </div>
            <section aria-labelledby="audio-quality-title" className="lab-card p-4">
              <h3 id="audio-quality-title" className="font-semibold">{t('tabular.quality.title')}</h3>
              {prepared && !prepared.ok && <p role="alert" className="mt-2 text-sm text-danger">{t(`audio.prepareErrors.${prepared.error.code}`, prepared.error)}</p>}
              {issues.length === 0 && prepared?.ok && <p className="mt-2 text-sm text-accent">{t('tabular.quality.none')}</p>}
              {issues.length > 0 && (
                <ul className="mt-2 space-y-2 text-sm" data-testid="audio-issues">
                  {issues.map((issue, i) => <li key={i} className="border-l-4 border-warning pl-2">{t(`audio.quality.${issue.kind}`, issue)}</li>)}
                </ul>
              )}
            </section>
          </div>
        </Step>
      )}

      {state.clips.length > 0 && (
        <Step n={3} id="audio-step-represent" title={t('audio.steps.represent')}>
          <AudioInspector classes={state.classes} clips={usable} />
        </Step>
      )}

      {data && (
        <AudioModelLab
          projectName={state.project.name}
          data={data}
          dataKey={dataKey}
          trainSamples={(id) => {
            const clip = state.clips.find((c) => c.id === id);
            return clip ? clipSamples(clip) : null;
          }}
        />
      )}
    </div>
  );
}
