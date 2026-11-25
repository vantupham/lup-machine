import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EpochSnapshot } from '@/core/ml/softmax-regression';
import type { ClassRecord, SampleRecord } from '@/storage/db';
import { imageNotebook } from '@/core/export/image-notebook';
import { ColabExportPanel } from '@/features/export/ColabExportPanel';
import { version as appVersion } from '../../../../../package.json';
import { EvaluateSection } from './EvaluateSection';
import { ExperimentLog } from './ExperimentLog';
import { RepresentSection } from './RepresentSection';
import { TrainSection } from './TrainSection';
import { useImageLabContext } from './ImageLabContext';
import { UseSection } from './UseSection';

interface ModelLabProps {
  readonly projectName: string;
  readonly classes: readonly ClassRecord[];
  readonly samples: readonly SampleRecord[];
}

/** Bước ③ Biểu diễn → ④ Huấn luyện → ⑤ Đánh giá → ⑥ Sử dụng (thử ảnh mới, xuất notebook) → Nhật ký thí nghiệm. */
export function ModelLab({ projectName, classes, samples }: ModelLabProps) {
  const { t } = useTranslation();
  /** Trạng thái học máy dùng chung với khối "làm nhanh" ở đầu trang. */
  const lab = useImageLabContext();
  const [selected, setSelected] = useState<SampleRecord | null>(null);
  const { snapshot, snapshots, predictions, readiness, training, isStale, lastOptions } = lab;

  const wrongIds = useMemo(() => new Set([...predictions].filter(([, p]) => !p.isCorrect).map(([id]) => id)), [predictions]);
  const samplesBySplit = useMemo(
    () => ({ train: samples.filter((s) => s.split === 'train'), test: samples.filter((s) => s.split === 'test') }),
    [samples],
  );
  const selectedSample = selected && samples.find((s) => s.id === selected.id) ? selected : null;

  return (
    <div className="space-y-12 border-t border-rule pt-8">
      <RepresentSection
        classes={classes}
        samples={samples}
        features={lab.features}
        missingCount={lab.missingCount}
        status={lab.status}
        onExtract={() => void lab.extractMissing()}
        selected={selectedSample}
        onSelect={setSelected}
        wrongIds={wrongIds}
        params={snapshot?.params ?? null}
        mainTrainAccuracy={snapshot?.train.accuracy ?? null}
      />
      <TrainSection
        readiness={readiness}
        numClasses={classes.length}
        snapshots={snapshots}
        status={isStale ? 'idle' : training.status}
        selectedEpoch={lab.shownEpoch}
        onSelectEpoch={lab.setReplayEpoch}
        onStart={lab.startNew}
        onStep={training.step}
        onFinish={training.finish}
      />
      {isStale && <p role="status" className="text-sm text-warning">↻ {t('project.train.stale')}</p>}
      {lab.notice && (
        <p role={lab.notice.kind === 'error' ? 'alert' : 'status'} className={`text-sm ${lab.notice.kind === 'error' ? 'text-danger' : 'text-accent'}`}>
          {lab.notice.text}
        </p>
      )}
      <EvaluateSection classes={classes} snapshot={snapshot} samplesBySplit={samplesBySplit} predictions={predictions} />
      <UseSection classes={classes} samples={samples} features={lab.features} params={snapshot?.params ?? null} epoch={snapshot?.epoch ?? null} />
      {training.status === 'done' && !isStale && lastOptions && readiness.readiness === 'ready' && snapshots.length > 0 && (
        <ColabExportPanel
          projectName={projectName}
          descriptionKey="export.colab.imageDescription"
          build={() => {
            const final = snapshots.at(-1) as EpochSnapshot;
            return imageNotebook({
              projectName,
              appVersion,
              exportedAt: new Date().toLocaleString('vi'),
              classNames: classes.map((c) => c.name),
              train: readiness.data.train,
              test: readiness.data.test,
              options: lastOptions,
              results: { trainAccuracy: final.train.accuracy, testAccuracy: final.test?.accuracy ?? null },
            });
          }}
        />
      )}
      <ExperimentLog
        runs={lab.experiments.runs}
        fingerprint={lab.fingerprint}
        canReplay={readiness.readiness === 'ready' && !lab.isTraining}
        onReplay={(record) => lab.replay(record, 'replay')}
        onDelete={(record) => void lab.experiments.remove(record.id)}
      />
    </div>
  );
}
