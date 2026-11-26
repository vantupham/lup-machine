/** Bước 4 Huấn luyện, 5 Đánh giá, 6 Sử dụng của Studio âm thanh. */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { contributionMap, encodeVector, importanceMap, predictVector, type VectorData, type TrainedVectorModel } from '@/core/ml/vector-classifier';
import { audioFeatures, fitClip } from '@/core/audio/features';
import { audioNotebook } from '@/core/export/audio-notebook';
import { formatPercent, RangeField, SelectField, Stat } from '@/features/playground/controls';
import { ColabExportPanel } from '@/features/export/ColabExportPanel';
import { colorFor } from '@/features/studio/image/lab/class-style';
import { ExactBadge } from '@/ui/ExactBadge';
import { getErrorMessage } from '@/ui/error-message';
import { version as appVersion } from '../../../../package.json';
import { StudioStep as Step } from '../StudioStep';
import { C_LEVELS } from '../tabular/ModelSection';
import { ConfusionTable } from '../tabular/EvaluateSection';
import { decodeAudioFile, playClip, recordClip } from './audio-io.browser';
import { FeatureGrid, Waveform } from './viz';
import { Play } from '@/ui/icons';
import { ClassMarker } from '@/ui/ClassMarker';
import type { VectorModel } from '@/features/studio/quick/useVectorModel';
import { TrialBefore } from '@/features/trials/TrialBefore';
import { TrialAfter } from '@/features/trials/TrialAfter';
import { StudioFindings } from '@/features/trials/StudioFindings';
import { vectorFindingSamples } from '@/features/trials/finding-samples';

interface AudioModelLabProps {
  readonly projectName: string;
  /** Mô hình dùng chung với khối "Dạy máy trong 3 bước". */
  readonly lab: VectorModel;
  readonly data: VectorData;
  /** Lấy lại âm thanh của một đoạn Huấn luyện (để nghe các láng giềng của k-NN). */
  readonly trainSamples: (id: string) => Float32Array | null;
}

function TryClip({ trained, data, trainSamples }: { readonly trained: TrainedVectorModel; readonly data: VectorData; readonly trainSamples: (id: string) => Float32Array | null }) {
  const { t } = useTranslation();
  const [signal, setSignal] = useState<Float32Array | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explainFor, setExplainFor] = useState('predicted');

  const take = async (get: () => Promise<Float32Array>) => {
    setBusy(true);
    setError(null);
    try {
      setSignal(fitClip(await get()));
    } catch (err: unknown) {
      setError(t('audio.data.error', { message: getErrorMessage(err) }));
    } finally {
      setBusy(false);
    }
  };

  const encoded = signal ? encodeVector(data, audioFeatures(signal)) : null;
  const prediction = encoded ? predictVector(trained, encoded) : null;
  const c = explainFor === 'predicted' ? (prediction?.label ?? 0) : Number(explainFor);
  const contribution = encoded ? contributionMap(trained, encoded.scaled, c) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary text-sm" disabled={busy} onClick={() => void take(async () => (await recordClip(1.5)).result)}>
            {busy ? t('audio.data.recording') : t('audio.data.record')}
          </button>
          <label className="btn btn-ghost cursor-pointer text-sm">
            {t('audio.data.upload')}
            <input type="file" accept="audio/*" className="sr-only" onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void take(() => decodeAudioFile(file));
            }} />
          </label>
          {signal && <button type="button" className="btn btn-ghost text-sm" onClick={() => playClip(signal)}>{t('audio.use.play')}</button>}
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {!signal && <p className="text-sm text-muted">{t('audio.use.empty')}</p>}
        {signal && prediction && (
          <>
            <Waveform samples={signal} label={t('audio.inspector.waveLabel')} />
            <p className="text-lg" data-testid="audio-prediction">
              <ClassMarker index={prediction.label} className="mr-1" />
              {t('tabular.use.predictedClass', { cls: data.classNames[prediction.label] })}
            </p>
            <ul className="space-y-1">
              {prediction.proba.map((p, k) => (
                <li key={k} className="grid grid-cols-[8rem_1fr_3.5rem] items-center gap-2 text-xs">
                  <span>{data.classNames[k]}</span>
                  <span className="h-2 rounded" style={{ width: `${p * 100}%`, backgroundColor: colorFor(k) }} />
                  <span className="text-right font-mono">{(p * 100).toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {signal && prediction && (
        <section aria-labelledby="audio-why-title" className="lab-card space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="audio-why-title" className="font-semibold">{t('text.use.whyTitle')}</h3>
            <ExactBadge label={t('playground.exact')} hint={t('audio.use.whyHint')} />
          </div>
          {contribution ? (
            <>
              <SelectField
                label={t('text.use.explainFor')}
                value={explainFor}
                onChange={setExplainFor}
                options={[{ value: 'predicted', label: t('text.use.predictedOption', { cls: data.classNames[prediction.label] }) }, ...data.classNames.map((n, k) => ({ value: String(k), label: n }))]}
              />
              <FeatureGrid values={contribution.cells} diverging label={t('audio.use.contributionLabel')} testId="audio-contribution" />
              <p className="text-xs text-muted">{t('audio.use.contributionHint', { cls: data.classNames[c], base: contribution.base.toFixed(3), total: contribution.total.toFixed(3) })}</p>
            </>
          ) : (
            <>
              <p className="text-sm">{t('tabular.use.neighbors', { k: prediction.neighbors?.length ?? 0 })}</p>
              <ul className="space-y-1 text-sm" data-testid="audio-neighbors">
                {prediction.neighbors?.map((n) => {
                  const id = data.train.ids[n.index] as string;
                  const samples = trainSamples(id);
                  return (
                    <li key={n.index} className="flex items-center gap-2">
                      <button type="button" className="btn btn-ghost px-2 py-0.5 text-xs" aria-label={t('audio.use.playNeighbour')} disabled={!samples} onClick={() => samples && playClip(samples)}><Play /></button>
                      <span>{data.classNames[data.train.ys[n.index] as number]}</span>
                      <span className="font-mono text-xs text-muted">{t('audio.use.distance', { d: n.distance.toFixed(1) })}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-muted">{t('audio.use.knnHint')}</p>
            </>
          )}
        </section>
      )}
    </div>
  );
}

export function AudioModelLab({ projectName, lab, data, trainSamples }: AudioModelLabProps) {
  const { t } = useTranslation();
  const { settings, setSettings, trained, current, evaluation, key, trial } = lab;
  const cIndex = Math.max(0, C_LEVELS.findIndex((c) => c >= settings.c));

  return (
    <>
      <Step n={4} id="audio-step-train" notebook="train" title={t('audio.steps.train')} done={current !== null}>
        {current === null && trial.setup && <TrialBefore log={trial.log} current={trial.setup} canGuess={trial.canGuess} />}
        <div className="grid gap-6 lg:grid-cols-2">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('tabular.model.choose')}</legend>
            {(['logistic', 'knn'] as const).map((kind) => (
              <label key={kind} className={`flex cursor-pointer gap-3 rounded border p-3 ${settings.kind === kind ? 'border-primary bg-surface' : 'border-rule'}`}>
                <input type="radio" name="audio-model" checked={settings.kind === kind} onChange={() => setSettings({ ...settings, kind })} className="mt-1" />
                <span>
                  <span className="block font-semibold">{t(`audio.models.${kind}.name`)}</span>
                  <span className="block text-sm text-muted">{t(`audio.models.${kind}.how`)}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="lab-card space-y-4 p-4">
            {settings.kind === 'logistic' ? (
              <RangeField label={t('tabular.model.c')} value={cIndex} min={0} max={C_LEVELS.length - 1} onChange={(i) => setSettings({ ...settings, c: C_LEVELS[i] as number })} format={(i) => String(C_LEVELS[i])} hint={t('tabular.model.cHint')} />
            ) : (
              <RangeField label={t('playground.knn.k')} value={settings.k} min={1} max={15} onChange={(k) => setSettings({ ...settings, k })} hint={t('audio.model.kHint')} />
            )}
            <button type="button" className="btn btn-primary" onClick={() => void lab.train()}>
              {t('tabular.model.train')}
            </button>
            <p className="text-xs text-muted" role="status">
              {!trained ? t('tabular.model.notTrained') : !current ? t('tabular.model.stale') : t('tabular.model.trained', { n: trained.count })}
            </p>
          </div>
        </div>
        <TrialAfter log={trial.log} isCurrent={current !== null} />
      </Step>
      {current && evaluation && (
        <>
          <Step n={5} id="audio-step-evaluate" notebook="evaluate" title={t('audio.steps.evaluate')}>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <dl className="grid grid-cols-2 gap-3">
                  <Stat label={t('playground.common.trainAccuracy')} value={evaluation.trainAccuracy === null ? '—' : formatPercent(evaluation.trainAccuracy)} />
                  <Stat label={t('playground.common.testAccuracy')} value={evaluation.testAccuracy === null ? '—' : formatPercent(evaluation.testAccuracy)} />
                </dl>
                <ConfusionTable matrix={evaluation.confusion} classNames={data.classNames} />
                <StudioFindings
                  classNames={data.classNames}
                  dataStepId="audio-step-data"
                  samples={vectorFindingSamples(current, data, (id, i) => {
                    const samples = trainSamples(id);
                    return (
                      <span className="inline-flex items-center gap-1">
                        <button type="button" className="btn btn-ghost px-2 py-0.5 text-xs" aria-label={t('sampleFindings.playClip')} disabled={!samples} onClick={() => samples && playClip(samples)}><Play /></button>
                        {t('sampleFindings.clip', { n: i + 1 })}
                      </span>
                    );
                  })}
                />
              </div>
              <section aria-labelledby="audio-importance-title" className="lab-card space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 id="audio-importance-title" className="font-semibold">{t('audio.evaluate.importanceTitle')}</h3>
                  <ExactBadge label={t('playground.exact')} hint={t('audio.evaluate.importanceHint')} />
                </div>
                {current.kind === 'logistic' ? (
                  <>
                    <div className="flex flex-wrap gap-4">
                      {data.classNames.map((name, c) => (
                        <figure key={name} className="text-center">
                          <FeatureGrid values={importanceMap(current, c) ?? []} diverging label={t('audio.evaluate.importanceLabel', { cls: name })} testId={`importance-${c}`} />
                          <figcaption className="mt-1 text-xs font-semibold" style={{ color: colorFor(c) }}>{name}</figcaption>
                        </figure>
                      ))}
                    </div>
                    <p className="text-xs text-muted">{t('audio.evaluate.importanceLegend')}</p>
                  </>
                ) : (
                  <p className="text-sm text-muted">{t('audio.evaluate.knnNoMap')}</p>
                )}
              </section>
            </div>
          </Step>
          <Step n={6} id="audio-step-use" notebook="use" title={t('audio.steps.use')}>
            <TryClip key={key} trained={current} data={data} trainSamples={trainSamples} />
            <ColabExportPanel
              projectName={projectName}
              descriptionKey="export.colab.audioDescription"
              build={() => audioNotebook({ projectName, appVersion, exportedAt: new Date().toLocaleString('vi'), data, settings, evaluation })}
            />
          </Step>
        </>
      )}
    </>
  );
}
