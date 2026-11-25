/** Bước 4 Huấn luyện, 5 Đánh giá, 6 Sử dụng của Studio tư thế. */
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { poseNotebook } from '@/core/export/pose-notebook';
import { contributionMap, encodeVector, evaluateVectors, importanceMap, predictVector, trainVectorModel, type TrainedVectorModel, type VectorData, type VectorModelSettings, type VectorPrediction } from '@/core/ml/vector-classifier';
import { keypointCount, perJoint, poseFeatures, type PoseKind } from '@/core/pose/features';
import { ColabExportPanel } from '@/features/export/ColabExportPanel';
import { formatPercent, RangeField, Stat } from '@/features/playground/controls';
import { colorFor } from '@/features/studio/image/lab/class-style';
import { ExactBadge } from '@/ui/ExactBadge';
import { getErrorMessage } from '@/ui/error-message';
import { version as appVersion } from '../../../../package.json';
import { StudioStep as Step } from '../StudioStep';
import { C_LEVELS } from '../tabular/ModelSection';
import { ConfusionTable } from '../tabular/EvaluateSection';
import { PoseCamera } from './PoseCamera';
import { grabFrame, imageFromFile, loadDetector, type PoseDetection } from './pose-io.browser';
import { Skeleton } from './Skeleton';
import { ClassMarker } from '@/ui/ClassMarker';

const DEFAULT_SETTINGS: VectorModelSettings = { kind: 'logistic', c: 1, k: 3 };

/** Tư thế trung bình của mỗi lớp (tọa độ đã chuẩn hóa, gốc tọa độ tại giữa khung vẽ) để vẽ độ quan trọng của khớp. */
function meanPose(data: VectorData, c: number, size: number, span: number) {
  const rows = data.train.raw.filter((_, i) => data.train.ys[i] === c);
  const dim = rows[0]?.length ?? 0;
  const mean = Array.from({ length: dim }, (_, j) => rows.reduce((s, r) => s + (r[j] as number), 0) / Math.max(1, rows.length));
  return Array.from({ length: dim / 2 }, (_, i) => ({ x: size / 2 + ((mean[2 * i] as number) / span) * size, y: size * 0.55 + ((mean[2 * i + 1] as number) / span) * size, score: 1 }));
}

function Prediction({ prediction, data }: { readonly prediction: VectorPrediction; readonly data: VectorData }) {
  const { t } = useTranslation();
  return (
    <>
      <p className="text-lg" data-testid="pose-prediction">
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
  );
}

function TryPose({ kind, trained, data }: { readonly kind: PoseKind; readonly trained: TrainedVectorModel; readonly data: VectorData }) {
  const { t } = useTranslation();
  const [live, setLive] = useState(false);
  const [detection, setDetection] = useState<PoseDetection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const features = detection ? poseFeatures(kind, detection.keypoints) : null;
  const encoded = features ? encodeVector(data, features) : null;
  const prediction = encoded ? predictVector(trained, encoded) : null;
  const contribution = encoded && prediction ? contributionMap(trained, encoded.scaled, prediction.label) : null;
  const jointValues = contribution ? perJoint(contribution.cells) : null;
  const onDetection = useCallback((d: PoseDetection) => setDetection(d), []);

  const upload = async (file: File) => {
    setError(null);
    setLive(false);
    try {
      const frame = grabFrame(await imageFromFile(file), false);
      if (!frame) throw new Error(t('pose.use.badImage'));
      setDetection(await (await loadDetector(kind))(frame));
    } catch (err: unknown) {
      setError(t('pose.data.error', { message: getErrorMessage(err) }));
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary text-sm" onClick={() => setLive(!live)}>{live ? t('pose.data.cameraOff') : t('pose.use.live')}</button>
          <label className="btn btn-ghost cursor-pointer text-sm">
            {t('pose.data.upload')}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void upload(file);
            }} />
          </label>
        </div>
        {live && <PoseCamera kind={kind} onDetection={onDetection} jointValues={jointValues} />}
        {!live && detection && <Skeleton kind={kind} keypoints={detection.keypoints} width={detection.width} height={detection.height} label={t('pose.camera.overlay')} jointValues={jointValues} testId="pose-try-skeleton" />}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {!detection && <p className="text-sm text-muted">{t('pose.use.empty')}</p>}
        {detection && !features && <p role="status" className="text-sm text-warning">{t(`pose.inspector.cannotNormalize.${kind}`)}</p>}
      </div>
      {prediction && (
        <section aria-labelledby="pose-why-title" className="lab-card space-y-3 p-4">
          <Prediction prediction={prediction} data={data} />
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="pose-why-title" className="font-semibold">{t('text.use.whyTitle')}</h3>
            <ExactBadge label={t('playground.exact')} hint={t('pose.use.whyHint')} />
          </div>
          {contribution ? (
            <p className="text-xs text-muted">{t('pose.use.contributionHint', { cls: data.classNames[prediction.label], base: contribution.base.toFixed(3), total: contribution.total.toFixed(3) })}</p>
          ) : (
            <p className="text-sm" data-testid="pose-neighbors">
              {t('pose.use.neighbors', { k: prediction.neighbors?.length ?? 0, labels: prediction.neighbors?.map((n) => data.classNames[data.train.ys[n.index] as number]).join(', ') })}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

export function PoseModelLab({ kind, projectName, data, dataKey }: { readonly kind: PoseKind; readonly projectName: string; readonly data: VectorData; readonly dataKey: string }) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<VectorModelSettings>(DEFAULT_SETTINGS);
  const [trained, setTrained] = useState<{ key: string; model: TrainedVectorModel; count: number } | null>(null);
  const key = JSON.stringify([dataKey, settings]);
  const current = trained?.key === key ? trained.model : null;
  const evaluation = useMemo(() => (current ? evaluateVectors(current, data) : null), [current, data]);
  const cIndex = Math.max(0, C_LEVELS.findIndex((c) => c >= settings.c));
  const VIEW = 220;
  const span = kind === 'body' ? 5 : 4;

  return (
    <>
      <Step n={4} id="pose-step-train" title={t('pose.steps.train')} done={current !== null}>
        <div className="grid gap-6 lg:grid-cols-2">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('tabular.model.choose')}</legend>
            {(['logistic', 'knn'] as const).map((k) => (
              <label key={k} className={`flex cursor-pointer gap-3 rounded border p-3 ${settings.kind === k ? 'border-primary bg-surface' : 'border-rule'}`}>
                <input type="radio" name="pose-model" checked={settings.kind === k} onChange={() => setSettings({ ...settings, kind: k })} className="mt-1" />
                <span>
                  <span className="block font-semibold">{t(`pose.models.${k}.name`)}</span>
                  <span className="block text-sm text-muted">{t(`pose.models.${k}.how`)}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="lab-card space-y-4 p-4">
            {settings.kind === 'logistic' ? (
              <RangeField label={t('tabular.model.c')} value={cIndex} min={0} max={C_LEVELS.length - 1} onChange={(i) => setSettings({ ...settings, c: C_LEVELS[i] as number })} format={(i) => String(C_LEVELS[i])} hint={t('tabular.model.cHint')} />
            ) : (
              <RangeField label={t('playground.knn.k')} value={settings.k} min={1} max={15} onChange={(k) => setSettings({ ...settings, k })} hint={t('pose.model.kHint')} />
            )}
            <button type="button" className="btn btn-primary" onClick={() => setTrained({ key, model: trainVectorModel(data, settings), count: (trained?.count ?? 0) + 1 })}>{t('tabular.model.train')}</button>
            <p className="text-xs text-muted" role="status">{!trained ? t('tabular.model.notTrained') : !current ? t('tabular.model.stale') : t('tabular.model.trained', { n: trained.count })}</p>
          </div>
        </div>
      </Step>
      {current && evaluation && (
        <>
          <Step n={5} id="pose-step-evaluate" title={t('pose.steps.evaluate')}>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <dl className="grid grid-cols-2 gap-3">
                  <Stat label={t('playground.common.trainAccuracy')} value={evaluation.trainAccuracy === null ? '—' : formatPercent(evaluation.trainAccuracy)} />
                  <Stat label={t('playground.common.testAccuracy')} value={evaluation.testAccuracy === null ? '—' : formatPercent(evaluation.testAccuracy)} />
                </dl>
                <ConfusionTable matrix={evaluation.confusion} classNames={data.classNames} />
              </div>
              <section aria-labelledby="pose-importance-title" className="lab-card space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 id="pose-importance-title" className="font-semibold">{t('pose.evaluate.importanceTitle')}</h3>
                  <ExactBadge label={t('playground.exact')} hint={t('pose.evaluate.importanceHint')} />
                </div>
                {current.kind === 'logistic' ? (
                  <>
                    <div className="flex flex-wrap gap-3">
                      {data.classNames.map((name, c) => {
                        const w = importanceMap(current, c) ?? [];
                        const importance = Array.from({ length: keypointCount(kind) }, (_, j) => Math.abs(w[2 * j] ?? 0) + Math.abs(w[2 * j + 1] ?? 0));
                        return (
                          <figure key={name} className="w-36 text-center">
                            <Skeleton kind={kind} keypoints={meanPose(data, c, VIEW, span)} width={VIEW} height={VIEW} label={t('pose.evaluate.importanceLabel', { cls: name })} jointValues={importance} color={colorFor(c)} testId={`pose-importance-${c}`} />
                            <figcaption className="mt-1 text-xs font-semibold" style={{ color: colorFor(c) }}>{name}</figcaption>
                          </figure>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted">{t('pose.evaluate.importanceLegend')}</p>
                  </>
                ) : (
                  <p className="text-sm text-muted">{t('pose.evaluate.knnNoMap')}</p>
                )}
              </section>
            </div>
          </Step>
          <Step n={6} id="pose-step-use" title={t('pose.steps.use')}>
            <TryPose key={key} kind={kind} trained={current} data={data} />
            <ColabExportPanel
              projectName={projectName}
              descriptionKey="export.colab.poseDescription"
              build={() => poseNotebook({ kind, projectName, appVersion, exportedAt: new Date().toLocaleString('vi'), data, settings, evaluation })}
            />
          </Step>
        </>
      )}
    </>
  );
}
