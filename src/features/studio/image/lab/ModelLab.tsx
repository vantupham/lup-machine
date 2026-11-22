import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { datasetFingerprint } from '@/core/data/fingerprint';
import type { EpochSnapshot, TrainOptions } from '@/core/ml/softmax-regression';
import type { ClassRecord, RunRecord, SampleRecord } from '@/storage/db';
import { getErrorMessage } from '@/ui/error-message';
import { EvaluateSection } from './EvaluateSection';
import { ExperimentLog } from './ExperimentLog';
import { buildTrainingData, predictSamples } from './lab-data';
import { RepresentSection } from './RepresentSection';
import { TrainSection } from './TrainSection';
import { useExperiments } from './useExperiments';
import { useFeatures } from './useFeatures';
import { useTraining, type TrainingSpeed } from './useTraining';

interface ModelLabProps {
  readonly projectId: string;
  readonly classes: readonly ClassRecord[];
  readonly samples: readonly SampleRecord[];
}

/** Lần chạy hiện tại từ đâu ra: huấn luyện mới (sẽ lưu nhật ký) hay chạy lại một lần cũ (không lưu trùng). */
type RunOrigin =
  | { readonly kind: 'new'; readonly fingerprint: string }
  | { readonly kind: 'replay' | 'restore'; readonly number: number; readonly seed: number };

type Notice = { readonly kind: 'info' | 'error'; readonly text: string } | null;

function toMetrics(snapshots: readonly EpochSnapshot[]) {
  return snapshots.map((s) => ({
    epoch: s.epoch,
    trainLoss: s.train.loss,
    trainAccuracy: s.train.accuracy,
    testLoss: s.test?.loss ?? null,
    testAccuracy: s.test?.accuracy ?? null,
  }));
}

/** Bước ③ Biểu diễn → ④ Huấn luyện → ⑤ Đánh giá → Nhật ký thí nghiệm. */
export function ModelLab({ projectId, classes, samples }: ModelLabProps) {
  const { t } = useTranslation();
  const { features, missingCount, status, extractMissing } = useFeatures(projectId, samples);
  const training = useTraining();
  const experiments = useExperiments(projectId);
  const [selected, setSelected] = useState<SampleRecord | null>(null);
  const [replayEpoch, setReplayEpoch] = useState<number | null>(null);
  const [origin, setOrigin] = useState<RunOrigin | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const restoreAttempted = useRef(false);

  const readiness = useMemo(() => buildTrainingData(classes, samples, features), [classes, samples, features]);
  const fingerprint = useMemo(() => datasetFingerprint(classes.map((c) => c.id), samples), [classes, samples]);
  const isStale = origin !== null && origin.kind === 'new' && origin.fingerprint !== fingerprint;
  const snapshots = isStale ? [] : training.snapshots;
  const lastEpoch = snapshots.at(-1)?.epoch ?? null;
  const shownEpoch = replayEpoch !== null && lastEpoch !== null ? Math.min(replayEpoch, lastEpoch) : lastEpoch;
  const snapshot = shownEpoch === null ? null : (snapshots[shownEpoch] ?? null);
  const isTraining = training.status === 'running' || training.status === 'waiting-step';

  const predictions = useMemo(
    () => (snapshot ? predictSamples(snapshot.params, classes, samples, features) : new Map()),
    [snapshot, classes, samples, features],
  );
  const wrongIds = useMemo(() => new Set([...predictions].filter(([, p]) => !p.isCorrect).map(([id]) => id)), [predictions]);
  const samplesBySplit = useMemo(
    () => ({ train: samples.filter((s) => s.split === 'train'), test: samples.filter((s) => s.split === 'test') }),
    [samples],
  );
  const selectedSample = selected && samples.find((s) => s.id === selected.id) ? selected : null;

  const run = (options: TrainOptions, speed: TrainingSpeed, nextOrigin: RunOrigin) => {
    if (readiness.readiness !== 'ready') return;
    setReplayEpoch(null);
    setOrigin(nextOrigin);
    // Chỉ lần huấn luyện MỚI được ghi vào nhật ký (chạy lại thì không lưu trùng).
    const onDone =
      nextOrigin.kind === 'new'
        ? (done: EpochSnapshot[]) =>
            experiments
              .add({
                projectId,
                fingerprint: nextOrigin.fingerprint,
                options,
                classNames: classes.map((c) => c.name),
                counts: { train: readiness.trainSamples.length, test: readiness.testSamples.length },
                metrics: toMetrics(done),
              })
              .catch((error: unknown) =>
                setNotice({ kind: 'error', text: t('project.experiments.saveError', { message: getErrorMessage(error) }) }),
              )
        : undefined;
    training.start(readiness.data, options, speed, onDone);
  };

  const replay = (record: RunRecord, kind: 'replay' | 'restore') => {
    run(record.options, 'normal', { kind, number: record.number, seed: record.options.seed });
    setNotice({
      kind: 'info',
      text: t(kind === 'restore' ? 'project.experiments.restored' : 'project.experiments.replaying', {
        n: record.number,
        seed: record.options.seed,
      }),
    });
  };

  // Mở lại dự án: nếu dữ liệu chưa đổi, khôi phục lần chạy gần nhất bằng cách chạy lại với cùng seed.
  useEffect(() => {
    if (restoreAttempted.current || !experiments.loaded || readiness.readiness !== 'ready' || training.status !== 'idle') return;
    const latest = experiments.runs[0];
    if (!latest || latest.fingerprint !== fingerprint) {
      restoreAttempted.current = true;
      return;
    }
    // Đánh dấu bên trong timer: nếu effect bị dọn dẹp trước (StrictMode), lần chạy sau vẫn khôi phục được.
    const timer = window.setTimeout(() => {
      restoreAttempted.current = true;
      replay(latest, 'restore');
    }, 0);
    return () => window.clearTimeout(timer);
    // replay chỉ cần chạy một lần khi đủ điều kiện
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experiments.loaded, experiments.runs, readiness, training.status, fingerprint]);

  return (
    <div className="space-y-12 border-t border-rule pt-8">
      <RepresentSection
        classes={classes}
        samples={samples}
        features={features}
        missingCount={missingCount}
        status={status}
        onExtract={() => void extractMissing()}
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
        selectedEpoch={shownEpoch}
        onSelectEpoch={setReplayEpoch}
        onStart={(options, speed) => {
          setNotice(null);
          run(options, speed, { kind: 'new', fingerprint });
        }}
        onStep={training.step}
        onFinish={training.finish}
      />
      {isStale && <p role="status" className="text-sm text-warning">↻ {t('project.train.stale')}</p>}
      {notice && (
        <p role={notice.kind === 'error' ? 'alert' : 'status'} className={`text-sm ${notice.kind === 'error' ? 'text-danger' : 'text-accent'}`}>
          {notice.text}
        </p>
      )}
      <EvaluateSection classes={classes} snapshot={snapshot} samplesBySplit={samplesBySplit} predictions={predictions} />
      <ExperimentLog
        runs={experiments.runs}
        fingerprint={fingerprint}
        canReplay={readiness.readiness === 'ready' && !isTraining}
        onReplay={(record) => replay(record, 'replay')}
        onDelete={(record) => void experiments.remove(record.id)}
      />
    </div>
  );
}
