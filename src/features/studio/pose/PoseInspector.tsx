import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { keypointNames, MIN_KEYPOINT_SCORE, normalizationFrame, poseFeatures, unpackKeypoints, type PoseKind } from '@/core/pose/features';
import { SelectField } from '@/features/playground/controls';
import type { ClassRecord, PoseSampleRecord } from '@/storage/db';
import { ExactBadge } from '@/ui/ExactBadge';
import { Skeleton } from './Skeleton';

/** Khung vẽ cho tọa độ đã chuẩn hóa (đơn vị: chiều dài thân / bàn tay). */
const NORMALIZED_VIEW: Record<PoseKind, { x: number; y: number; w: number; h: number }> = {
  body: { x: -2.2, y: -2.8, w: 4.4, h: 5 },
  hand: { x: -2, y: -2.6, w: 4, h: 3.2 },
};
const VIEW_PX = 400;

export function PoseInspector({ kind, classes, poses }: { readonly kind: PoseKind; readonly classes: readonly ClassRecord[]; readonly poses: readonly PoseSampleRecord[] }) {
  const { t } = useTranslation();
  const options = poses.map((p) => {
    const cls = classes.find((c) => c.id === p.classId);
    return { value: p.id, label: `${cls?.name ?? '?'} #${poses.filter((q) => q.classId === p.classId).indexOf(p) + 1}` };
  });
  const [poseId, setPoseId] = useState(options[0]?.value ?? '');
  const sample = poses.find((p) => p.id === poseId) ?? poses[0];
  if (!sample) return null;
  const keypoints = unpackKeypoints(sample.keypoints);
  const frame = normalizationFrame(kind, keypoints);
  const features = poseFeatures(kind, keypoints);
  const names = keypointNames(kind);
  const view = NORMALIZED_VIEW[kind];
  const toView = (v: number, origin: number, span: number) => ((v - origin) / span) * VIEW_PX;
  const normalized = features
    ? keypoints.map((k, i) => ({ x: toView(features[2 * i] as number, view.x, view.w), y: toView(features[2 * i + 1] as number, view.y, view.w), score: k.score }))
    : null;
  const unitEnd = kind === 'body' ? { x: (keypoints[5]!.x + keypoints[6]!.x) / 2, y: (keypoints[5]!.y + keypoints[6]!.y) / 2 } : keypoints[9]!;
  const unit = Math.max(sample.width, sample.height) / 100;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-56"><SelectField label={t('pose.inspector.sample')} value={sample.id} options={options} onChange={setPoseId} /></div>
        <ExactBadge label={t('playground.exact')} hint={t('pose.inspector.exactHint')} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-2" aria-labelledby="pose-raw-title">
          <h3 id="pose-raw-title" className="font-semibold">{t('pose.inspector.rawTitle')}</h3>
          <Skeleton kind={kind} keypoints={keypoints} width={sample.width} height={sample.height} label={t('pose.inspector.rawLabel')} testId="pose-raw">
            {frame && (
              <g>
                <line x1={frame.cx} y1={frame.cy} x2={unitEnd.x} y2={unitEnd.y} stroke="var(--color-warning)" strokeWidth={unit * 1.2} />
                <circle cx={frame.cx} cy={frame.cy} r={unit * 2.4} fill="none" stroke="var(--color-warning)" strokeWidth={unit * 0.8} />
              </g>
            )}
          </Skeleton>
          <p className="text-xs text-muted">{t(`pose.inspector.rawHint.${kind}`, { w: sample.width, h: sample.height })}</p>
        </section>
        <section className="space-y-2" aria-labelledby="pose-norm-title">
          <h3 id="pose-norm-title" className="font-semibold">{t('pose.inspector.normTitle')}</h3>
          {normalized ? (
            <Skeleton kind={kind} keypoints={normalized} width={VIEW_PX} height={toView(view.y + view.h, view.y, view.w)} label={t('pose.inspector.normLabel')} testId="pose-normalized">
              <line x1={toView(0, view.x, view.w)} x2={toView(0, view.x, view.w)} y1={0} y2={VIEW_PX * 2} className="stroke-rule" />
              <line x1={0} x2={VIEW_PX} y1={toView(0, view.y, view.w)} y2={toView(0, view.y, view.w)} className="stroke-rule" />
            </Skeleton>
          ) : (
            <p role="alert" className="text-sm text-warning">{t(`pose.inspector.cannotNormalize.${kind}`)}</p>
          )}
          <p className="text-xs text-muted">{t(`pose.inspector.normHint.${kind}`)}</p>
        </section>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="pose-table">
          <caption className="mb-1 text-left text-sm font-medium">{t('pose.inspector.tableCaption', { n: names.length, dims: names.length * 2 })}</caption>
          <thead>
            <tr className="text-left text-xs text-muted">
              <th scope="col" className="py-1 pr-2">{t('pose.inspector.joint')}</th>
              <th scope="col" className="py-1 pr-2">x, y (px)</th>
              <th scope="col" className="py-1 pr-2">{t('pose.inspector.score')}</th>
              <th scope="col" className="py-1">{t('pose.inspector.modelSees')}</th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs">
            {keypoints.map((k, i) => (
              <tr key={i} className={`border-t border-rule ${k.score < MIN_KEYPOINT_SCORE ? 'text-muted' : ''}`}>
                <th scope="row" className="py-0.5 pr-2 text-left font-sans font-medium">{t(`pose.joints.${names[i]}`)}</th>
                <td className="py-0.5 pr-2">{k.x.toFixed(0)}, {k.y.toFixed(0)}</td>
                <td className="py-0.5 pr-2">{k.score.toFixed(2)}</td>
                <td className="py-0.5">{features ? `${(features[2 * i] as number).toFixed(3)}, ${(features[2 * i + 1] as number).toFixed(3)}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-xs text-muted">{t('pose.inspector.tableHint', { min: MIN_KEYPOINT_SCORE })}</p>
      </div>
    </div>
  );
}
